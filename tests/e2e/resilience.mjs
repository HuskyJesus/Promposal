/**
 * Adversarial pass.
 *
 * The playthrough suite proves the game can be finished. This one tries to
 * break it: hammering buttons, rotating mid-sentence, refreshing at the worst
 * possible instant, answering puzzles out of order, exhausting the hints, and
 * poking at things that are supposed to be inert.
 *
 *   npm start
 *   npm run test:resilience
 */

import { chromium } from 'playwright';
import { instrument, tokenLeaks } from './instrument.mjs';

const BASE = process.env.GAME_URL || 'http://127.0.0.1:4173/index.html';
const CHROME = process.env.CHROMIUM_PATH || undefined;

const checks = [];
let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  checks.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `: ${detail}` : ''}`);
  console.log(`${ok ? '  ok' : 'FAIL'}  ${name}${detail && !ok ? `: ${detail}` : ''}`);
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

/**
 * The two halves of the mural are deliberately hung in different orders, so a
 * test cannot join row N to row N. These read the real pairing out of the game
 * and then click the panels by the words printed on them, exactly as a person
 * reading the wall would.
 */
async function muralPairing(p) {
  return p.evaluate(async () => {
    const mod = await import(new URL('src/puzzles/muralPairs.js', document.baseURI).href);
    return mod.MURAL_PAIRS.map((pair) => ({ dark: pair.dark.label, light: pair.light.label }));
  });
}

async function joinMural(p, dark, light, settle = 380) {
  await p.locator('#overlay .mural-tile[data-side="dark"]', { hasText: dark }).click();
  await p.waitForTimeout(140);
  await p.locator('#overlay .mural-tile[data-side="light"]', { hasText: light }).click();
  await p.waitForTimeout(settle);
}


async function open(viewport = { width: 390, height: 844 }, seed = null) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (seed) {
    await page.addInitScript((raw) => {
      localStorage.setItem('unwritten-page:progress:v1', raw);
    }, JSON.stringify({ version: 1, startedAt: 1, gossipHeard: [], hintCounts: {}, moonflowers: [], fragments: [], flags: {}, ...seed }));
  }
  await instrument(page);
  await page.goto(`${BASE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  page.errors = errors;
  return page;
}

const dialogueVisible = (p) => p.locator('#dialogue').isVisible();

async function clearDialogue(p, seconds = 25) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline && await dialogueVisible(p)) {
    const choices = p.locator('#dialogue-choices button');
    if (await p.locator('#dialogue-choices').isVisible() && (await choices.count()) > 0) {
      await choices.first().click().catch(() => {});
    } else {
      await p.locator('#dialogue').click({ position: { x: 12, y: 12 } }).catch(() => {});
    }
    await p.waitForTimeout(120);
  }
}

async function startFresh(p) {
  await p.locator('#overlay button', { hasText: 'Start the story' }).click();
  for (let i = 0; i < 3; i++) await p.locator('#overlay button', { hasText: 'Turn the page' }).click();
  await p.locator('#dialogue').waitFor({ state: 'visible', timeout: 15000 });
  await clearDialogue(p);
}

async function interact(p, id) {
  await p.evaluate((id) => {
    const scene = window.unwrittenPage.game.scene;
    const item = scene.interactables.find((i) => i.id === id);
    if (item) { scene.player.x = item.x; scene.player.y = item.y + 14; }
  }, id);
  await p.waitForTimeout(180);
  await p.evaluate(() => document.activeElement?.blur());
  await p.keyboard.press('Space');
  await p.waitForTimeout(280);
}

const state = (p) => p.evaluate(() => {
  const { game } = window.unwrittenPage;
  return { scene: game.scene?.name, progress: JSON.parse(JSON.stringify(game.save.progress)) };
});

/* ========================================================================= */

console.log('\n[ Hammering the interface ]');
{
  const p = await open();
  await startFresh(p);

  // One tap must never consume two lines, however fast the taps arrive.
  await p.evaluate(() => { window.unwrittenPage.game.settings.textSpeed = 'instant'; });
  await interact(p, 'signpost');
  await p.waitForTimeout(200);
  const remainingBefore = await p.evaluate(() => window.unwrittenPage.game.ui.dialogue.queue.length);
  await p.locator('#dialogue').click({ position: { x: 12, y: 12 } });
  await p.waitForTimeout(260);
  const remainingAfter = await p.evaluate(() => window.unwrittenPage.game.ui.dialogue.queue.length);
  check('one tap advances exactly one line',
    remainingBefore - remainingAfter === 1, `${remainingBefore} -> ${remainingAfter}`);

  // A burst of taps inside the guard window must not multiply into advances.
  const burstBefore = await p.evaluate(() => window.unwrittenPage.game.ui.dialogue.queue.length);
  await p.evaluate(() => {
    const box = document.getElementById('dialogue');
    for (let i = 0; i < 12; i++) box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await p.waitForTimeout(200);
  const burstAfter = await p.evaluate(() => window.unwrittenPage.game.ui.dialogue.queue.length);
  check('a burst of taps inside the guard window counts once',
    burstBefore - burstAfter <= 1, `${burstBefore} -> ${burstAfter}`);
  await p.evaluate(() => { window.unwrittenPage.game.settings.textSpeed = 'normal'; });
  await clearDialogue(p);

  // Opening and closing the menu repeatedly must leave the game running.
  for (let i = 0; i < 6; i++) {
    await p.locator('#menu-button').click();
    await p.waitForTimeout(160);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(160);
  }
  check('the menu survives being opened and closed repeatedly',
    await p.locator('#overlay').isHidden());
  check('the game is not left paused', await p.evaluate(() => window.unwrittenPage.game.paused === false));
  check('only one panel is ever on the stack',
    await p.evaluate(() => window.unwrittenPage.game.ui.panelStack.length === 0));

  // Hidden controls must not be reachable.
  await p.locator('#menu-button').click();
  await p.waitForTimeout(250);
  check('the hint button cannot be pressed through an open menu',
    await p.evaluate(() => {
      const hint = document.getElementById('hint-button');
      const r = hint.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !hint.contains(top);
    }));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(250);

  // Interaction while paused must do nothing.
  await p.locator('#menu-button').click();
  await p.waitForTimeout(200);
  const beforePaused = await state(p);
  await p.evaluate(() => {
    const scene = window.unwrittenPage.game.scene;
    const item = scene.interactables.find((i) => i.id === 'flower-stream');
    scene.player.x = item.x; scene.player.y = item.y;
  });
  await p.keyboard.press('Space');
  await p.waitForTimeout(400);
  const afterPaused = await state(p);
  check('nothing can be collected while the menu is open',
    afterPaused.progress.moonflowers.length === beforePaused.progress.moonflowers.length);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  check('hammering: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

console.log('\n[ Rotating at bad moments ]');
{
  const p = await open();
  await startFresh(p);

  // Mid-sentence.
  await interact(p, 'signpost');
  await p.waitForTimeout(200);
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(600);
  check('dialogue survives a rotation', await dialogueVisible(p));
  check('the dialogue box still fits after rotating', await p.evaluate(() => {
    const r = document.getElementById('dialogue').getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
  }));
  await clearDialogue(p);

  // Mid-puzzle.
  await p.evaluate(() => {
    const g = window.unwrittenPage.game;
    g.save.progress.fragments = ['woods'];
    Object.assign(g.save.progress.flags, { metTheo: 1, woodsComplete: 1, cottageArrived: 1, guardiansGreeted: 1 });
    g.save.save();
    g.goTo('cottage', {}, { transition: false });
  });
  await p.waitForTimeout(1500);
  await clearDialogue(p);
  await interact(p, 'door');
  await clearDialogue(p);
  await p.locator('#overlay .choice-grid').waitFor({ timeout: 10000 });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(600);
  check('a puzzle survives a rotation', (await p.locator('#overlay .choice-grid').count()) === 1);
  check('the puzzle still fits after rotating', await p.evaluate(() => {
    const r = document.querySelector('#overlay .panel').getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1;
  }));
  check('rotation: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

console.log('\n[ Refreshing at the worst moment ]');
{
  // Right after the last moonflower, before the ceremony finishes.
  const p = await open({ width: 390, height: 844 });
  await startFresh(p);
  for (const id of ['flower-stream', 'flower-stones']) {
    await interact(p, id);
    await clearDialogue(p);
  }
  await interact(p, 'flower-hollow');
  await p.waitForTimeout(250);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.locator('#overlay button', { hasText: 'Continue' }).click();
  await p.waitForTimeout(1800);

  const deadline = Date.now() + 40000;
  let recovered = false;
  while (Date.now() < deadline) {
    const snapshot = await state(p);
    if (snapshot.progress.flags.woodsComplete) { recovered = true; break; }
    if (await dialogueVisible(p)) {
      await p.locator('#dialogue').click({ position: { x: 12, y: 12 } }).catch(() => {});
    } else {
      const button = p.locator('#overlay button', { hasText: /Keep the fragment|Take the final fragment/ });
      if (await button.count() && await button.first().isVisible()) await button.first().click();
    }
    await p.waitForTimeout(160);
  }
  check('refreshing mid-ceremony still completes the chapter', recovered);
  const snapshot = await state(p);
  check('the fragment is awarded exactly once', snapshot.progress.fragments.length === 1,
    JSON.stringify(snapshot.progress.fragments));
  check('refresh: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

console.log('\n[ Puzzles out of order and hints exhausted ]');
{
  const p = await open({ width: 390, height: 844 }, {
    chapter: 'hall', fragments: ['woods', 'cottage'],
    flags: { metTheo: true, cottageComplete: true, hallArrived: true }
  });
  await p.locator('#overlay button', { hasText: 'Continue' }).click();
  await p.waitForTimeout(1800);
  await clearDialogue(p);

  // The trial before the mural.
  await interact(p, 'storykeeper');
  await p.waitForTimeout(400);
  check('the Storykeeper refuses to start before the mural',
    (await p.locator('#overlay .answer-list').count()) === 0);
  await clearDialogue(p);

  await interact(p, 'mural');
  await clearDialogue(p);
  await p.locator('#overlay .mural-board').waitFor({ timeout: 10000 });

  const pairs = await muralPairing(p);

  // Every wrong pairing for one panel in a row, then every hint.
  for (const pair of pairs.slice(1)) {
    await joinMural(p, pairs[0].dark, pair.light, 200);
  }
  check('repeated wrong pairings match nothing',
    (await p.locator('#overlay .mural-tile[data-matched="true"]').count()) === 0);
  for (let i = 0; i < 5; i++) {
    await p.locator('#overlay .menu-button', { hasText: 'hint' }).first().click();
    await p.waitForTimeout(120);
  }
  const finalHint = await p.locator('#overlay .puzzle-feedback').innerText();
  check('hints keep working past the last level', finalHint.length > 20, finalHint);

  // The strongest hint must name a pair that actually joins.
  const named = await p.evaluate(async () => {
    // Resolved against the page, so this works under a subdirectory too.
    const mod = await import(new URL('src/puzzles/muralPairs.js', document.baseURI).href);
    const state = mod.createMuralState();
    const hint = mod.hintForMural(state, 3);
    const pair = mod.MURAL_PAIRS.find((x) => hint.includes(x.dark.label));
    return pair ? mod.tryJoin(state, pair.dark.id, pair.light.id).correct : false;
  });
  check('the strongest mural hint names a pair that really joins', named);

  // Solve it, then confirm the fragment cannot be taken twice.
  for (const pair of pairs) await joinMural(p, pair.dark, pair.light, 320);
  await p.waitForTimeout(1800);
  await clearDialogue(p);
  await interact(p, 'mural');
  await p.waitForTimeout(400);
  check('a solved mural cannot be solved again',
    (await p.locator('#overlay .mural-board').count()) === 0);
  await clearDialogue(p);

  await interact(p, 'storykeeper');
  await clearDialogue(p);
  await p.locator('#overlay .answer-list').waitFor({ timeout: 10000 });
  // Every wrong answer on question one, then the right one.
  const wrongButtons = await p.locator('#overlay .answer-button').count();
  for (let i = 0; i < wrongButtons; i++) {
    const button = p.locator('#overlay .answer-button').nth(i);
    if (await button.isEnabled()) {
      await button.click();
      await p.waitForTimeout(300);
    }
  }
  await p.waitForTimeout(1600);
  check('answering everything still advances the trial',
    (await p.locator('#overlay .answer-list').count()) === 1);

  check('out-of-order: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

console.log('\n[ Ending replayed and reset ]');
{
  const p = await open({ width: 390, height: 844 }, {
    chapter: 'garden', fragments: ['woods', 'cottage', 'hall'],
    endingSeen: true, saidYes: true, flags: { metTheo: true, hallComplete: true }
  });
  await p.locator('#overlay button', { hasText: 'Continue' }).click();
  await p.waitForTimeout(1800);
  await clearDialogue(p);

  // Replay the ending three times in a row.
  for (let round = 0; round < 3; round++) {
    await interact(p, 'dais');
    await p.locator('#overlay button', { hasText: 'There is one more line' })
      .waitFor({ state: 'visible', timeout: 20000 });
    await p.locator('#overlay button', { hasText: 'There is one more line' }).click();
    await p.waitForTimeout(500);
    await p.locator('#overlay button', { hasText: round % 2 ? 'Come ask me in person' : 'Yes, of course!' }).click();
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const button = p.locator('#overlay button', { hasText: 'Stay in the garden' });
      if (await button.count() && await button.first().isVisible()) break;
      if (await dialogueVisible(p)) await p.locator('#dialogue').click({ position: { x: 12, y: 12 } }).catch(() => {});
      await p.waitForTimeout(180);
    }
    await p.locator('#overlay button', { hasText: 'Stay in the garden' }).click();
    await p.waitForTimeout(500);
  }
  check('the ending can be replayed repeatedly', await p.locator('#overlay').isHidden());
  check('the HUD comes back after the ending', await p.locator('#hud').isVisible());
  check('play resumes after replaying', await p.evaluate(() => window.unwrittenPage.game.scene.busy === false));

  // Reset from inside the finished game.
  await p.locator('#menu-button').click();
  await p.waitForTimeout(300);
  await p.locator('#overlay button', { hasText: 'Erase all progress' }).click();
  await p.waitForTimeout(300);
  await p.locator('#overlay button', { hasText: 'Yes, do it' }).click();
  await p.waitForTimeout(2000);
  const after = await state(p);
  check('resetting a finished game returns to the title', after.scene === 'title');
  check('resetting clears the ending', after.progress.endingSeen !== true);
  check('replay/reset: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

console.log('\n[ Older and partial saves ]');
{
  // A save written by an earlier build, missing fields this one expects.
  const p = await open({ width: 390, height: 844 });
  await p.evaluate(() => {
    localStorage.setItem('unwritten-page:progress:v1', JSON.stringify({
      chapter: 'hall', startedAt: 1, fragments: ['woods', 'cottage']
    }));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.locator('#overlay button', { hasText: 'Continue' }).click();
  await p.waitForTimeout(2000);
  await clearDialogue(p);
  const partial = await state(p);
  check('a partial save still loads its chapter', partial.scene === 'hall');
  check('missing fields are filled in', Array.isArray(partial.progress.moonflowers));

  // A save naming a chapter this build no longer has.
  await p.evaluate(() => {
    localStorage.setItem('unwritten-page:progress:v1', JSON.stringify({
      chapter: 'catacombs', startedAt: 1, fragments: [], flags: { metTheo: true }
    }));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.locator('#overlay button', { hasText: 'Continue' }).click();
  await p.waitForTimeout(2200);
  await clearDialogue(p);
  const unknown = await state(p);
  check('an unknown chapter falls back to a playable one',
    ['woods', 'cottage', 'hall', 'garden'].includes(unknown.scene), unknown.scene);
  check('old saves: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

console.log('\n[ Muted, keyboard only, reduced motion ]');
{
  const p = await browser.newPage({
    viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, reducedMotion: 'reduce'
  });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.addInitScript(() => {
    localStorage.setItem('unwritten-page:settings:v1', JSON.stringify({
      sound: false, music: false, reducedMotion: true, textSpeed: 'instant'
    }));
  });
  await instrument(p);
  await p.goto(`${BASE}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);

  // Reach and press Start using only the keyboard.
  for (let i = 0; i < 8; i++) {
    const onStart = await p.evaluate(() => document.activeElement?.textContent?.includes('Start the story'));
    if (onStart) break;
    await p.keyboard.press('Tab');
    await p.waitForTimeout(80);
  }
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  check('the story can be started from the keyboard alone',
    (await p.locator('#overlay button', { hasText: 'Turn the page' }).count()) > 0);
  for (let i = 0; i < 3; i++) {
    await p.keyboard.press('Enter');
    await p.waitForTimeout(250);
  }
  await p.locator('#dialogue').waitFor({ state: 'visible', timeout: 15000 });
  check('dialogue arrives with sound off and motion reduced', await dialogueVisible(p));
  await clearDialogue(p);

  // Walk with the keyboard.
  const before = await p.evaluate(() => ({ ...window.unwrittenPage.game.scene.player }));
  await p.evaluate(() => document.activeElement?.blur());
  await p.keyboard.down('ArrowRight');
  await p.waitForTimeout(500);
  await p.keyboard.up('ArrowRight');
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ ...window.unwrittenPage.game.scene.player }));
  check('she walks with the keyboard while muted', after.x > before.x + 8);
  check('muted run: no console errors', errors.length === 0, errors.join(' | '));
  await p.close();
}

console.log('\n[ Nothing is walled off ]');
{
  /*
   * Scenery carries colliders. One badly placed hedge, pond or urn could fence
   * off the thing she has to reach and there would be no way out but a reset,
   * so every chapter is flood-filled from where she starts: if an interactable
   * is not reachable on foot, the run fails.
   */
  const REACH = [
    { chapter: 'woods', seed: { flags: { metTheo: true } } },
    { chapter: 'cottage', seed: { fragments: ['woods'] } },
    { chapter: 'hall', seed: { fragments: ['woods', 'cottage'] } },
    { chapter: 'garden', seed: { moonflowers: ['a', 'b', 'c'], fragments: ['woods', 'cottage', 'hall'] } }
  ];

  for (const { chapter, seed } of REACH) {
    const p = await open({ width: 844, height: 390 }, { chapter, ...seed });
    await p.locator('#overlay button', { hasText: 'Continue' }).click();
    await p.locator('#hud').waitFor({ state: 'visible', timeout: 15000 });
    await p.waitForFunction((want) => window.unwrittenPage.game.scene?.name === want, chapter, { timeout: 15000 });
    await clearDialogue(p);

    const result = await p.evaluate(() => {
      const s = window.unwrittenPage.game.scene;
      const STEP = 8;
      const { width: W, height: H } = s.world;
      const blockedAt = (x, y) => {
        if (x < 4 || y < 4 || x > W - 4 || y > H - 4) return true;
        return s.colliders.some((c) =>
          x + 7 > c.x && x - 7 < c.x + c.width && y + 5 > c.y && y - 5 < c.y + c.height);
      };
      const start = { x: Math.round(s.player.x / STEP) * STEP, y: Math.round(s.player.y / STEP) * STEP };
      const seen = new Set([`${start.x},${start.y}`]);
      const queue = [start];
      while (queue.length) {
        const n = queue.pop();
        for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
          const nx = n.x + dx;
          const ny = n.y + dy;
          const k = `${nx},${ny}`;
          if (seen.has(k) || blockedAt(nx, ny)) continue;
          seen.add(k);
          queue.push({ x: nx, y: ny });
        }
      }
      const cells = [...seen].map((k) => k.split(',').map(Number));
      const unreachable = s.interactables
        .filter((i) => !cells.some(([x, y]) => Math.hypot(x - i.x, y - i.y) <= Math.max(12, (i.radius ?? 50) - 10)))
        .map((i) => i.id);
      return { scene: s.name, cells: cells.length, unreachable };
    });

    check(`${chapter}: the heroine starts somewhere she can walk`, result.cells > 200, `${result.cells} cells`);
    check(`${chapter}: every interactable can be reached on foot`,
      result.unreachable.length === 0, result.unreachable.join(', '));
    check(`${chapter}: no console errors`, p.errors.length === 0, p.errors.join(' | '));
    await p.close();
  }
}

console.log('\n[ The shipped build ]');
{
  // Deliberately *not* instrumented: this is exactly what a player downloads.
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${BASE}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);

  check('no test seam is exposed', await p.evaluate(() => window.unwrittenPage === undefined));
  check('no globals are leaked', await p.evaluate(() =>
    ['game', 'config', 'Game', 'debug', 'DEBUG', 'scene'].every((k) => !(k in window))));
  const q = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await q.goto(`${BASE}?test=1&debug=1&dev=1`, { waitUntil: 'networkidle' });
  await q.waitForTimeout(600);
  check('a query string does not unlock anything',
    await q.evaluate(() => window.unwrittenPage === undefined && !('game' in window)));
  await q.close();
  check('the title screen still renders', (await p.locator('#overlay button', { hasText: 'Start the story' }).count()) > 0);
  check('shipped build: no console errors', errors.length === 0, errors.join(' | '));
  await p.close();
}

check('no unexpanded {token} ever reached the screen', tokenLeaks().length === 0, tokenLeaks().join(' | '));

await browser.close();

console.log(`\n${checks.length - failures}/${checks.length} checks passed`);
if (failures > 0) {
  console.error(`\n${failures} check(s) failed:`);
  for (const line of checks) if (line.startsWith('FAIL')) console.error('  ' + line);
  process.exit(1);
}
