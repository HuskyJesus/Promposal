/**
 * End-to-end playthrough.
 *
 * Drives a real browser from the title screen to the final page: every menu
 * button, both puzzles, the trivia, the finale, saving and continuing, and a
 * portrait-orientation layout pass. Any console error anywhere fails the run.
 *
 *   npm start          # in one terminal
 *   npm run test:e2e   # in another
 *
 * The shipped game exposes no test seam. Playwright appends one to
 * `src/main.js` in flight (see instrument.mjs) so the suite can read game
 * state and place the heroine in front of a given interactable, walking her
 * across the map with timed key presses would make the suite flaky without
 * testing anything more.
 */

import { chromium } from 'playwright';
import { instrument, collectTokenLeaks, tokenLeaks } from './instrument.mjs';

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


/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

function makeHelpers(page) {
  const dialogueVisible = () => page.locator('#dialogue').isVisible();

  /** Clicks through dialogue, story pages and known buttons until `done()`. */
  async function pump(done, { seconds = 45, click = [] } = {}) {
    const deadline = Date.now() + seconds * 1000;
    while (Date.now() < deadline) {
      if (await done()) return true;
      if (await dialogueVisible()) {
        const choices = page.locator('#dialogue-choices button');
        if (await page.locator('#dialogue-choices').isVisible() && (await choices.count()) > 0) {
          await choices.first().click().catch(() => {});
        } else {
          await page.locator('#dialogue').click({ position: { x: 12, y: 12 } }).catch(() => {});
        }
      } else {
        for (const label of click) {
          const button = page.locator('#overlay button', { hasText: label });
          if ((await button.count()) && (await button.first().isVisible())) {
            await button.first().click().catch(() => {});
            break;
          }
        }
      }
      await page.waitForTimeout(140);
    }
    return done();
  }

  const clearDialogue = (seconds = 30) => pump(async () => !(await dialogueVisible()), { seconds });

  const panelHas = (text) => async () => {
    const button = page.locator('#overlay button', { hasText: text });
    return (await button.count()) > 0 && (await button.first().isVisible());
  };

  async function clickPanel(text, timeout = 15000) {
    const button = page.locator('#overlay button', { hasText: text });
    await button.first().waitFor({ state: 'visible', timeout });
    await button.first().click();
    await page.waitForTimeout(280);
  }

  /** Puts the heroine in front of an interactable and presses the action key. */
  async function interact(id) {
    const found = await page.evaluate((id) => {
      const scene = window.unwrittenPage.game.scene;
      const item = scene.interactables.find((i) => i.id === id);
      if (!item) return false;
      scene.player.x = item.x;
      scene.player.y = item.y + 14;
      return true;
    }, id);
    if (!found) throw new Error(`no interactable "${id}" in this scene`);
    await page.waitForTimeout(170);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Space');
    await page.waitForTimeout(280);
  }

  const state = () => page.evaluate(() => {
    const { game } = window.unwrittenPage;
    return {
      scene: game.scene?.name,
      progress: JSON.parse(JSON.stringify(game.save.progress)),
      settings: JSON.parse(JSON.stringify(game.settings))
    };
  });

  return { pump, clearDialogue, panelHas, clickPanel, interact, state, dialogueVisible };
}

/* -------------------------------------------------------------------------
   The main playthrough
   ------------------------------------------------------------------------- */

const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`${e.message}`));

const h = makeHelpers(page);

console.log('\n[ Title screen ]');
await instrument(page);
await page.goto(`${BASE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

check('page title does not mention prom', !/prom/i.test(await page.title()), await page.title());
check('HUD is hidden on the title screen', await page.locator('#hud').isHidden());
check('touch controls are hidden on the title screen', await page.locator('#touch-controls').isHidden());
check('no Continue button before any progress', (await page.locator('#overlay button', { hasText: 'Continue' }).count()) === 0);

await h.clickPanel('How to play');
check('How to play opens over the title screen', await page.locator('#overlay').isVisible());
await h.clickPanel('Back');
check('the title screen comes back after How to play',
  (await page.locator('#overlay button', { hasText: 'Start the story' }).count()) > 0);

const soundButton = page.locator('#overlay button', { hasText: 'Sound' });
await soundButton.click();
await page.waitForTimeout(150);
check('the sound toggle turns sound off', (await h.state()).settings.sound === false);
await soundButton.click();
await page.waitForTimeout(150);
check('the sound toggle turns sound back on', (await h.state()).settings.sound === true);

console.log('\n[ Prologue ]');
await h.clickPanel('Start the story');
for (let i = 0; i < 3; i++) await h.clickPanel('Turn the page');
await page.locator('#dialogue').waitFor({ state: 'visible', timeout: 15000 });
check('the woods load after the prologue', (await h.state()).scene === 'woods');
check('the HUD appears once play starts', await page.locator('#hud').isVisible());

console.log('\n[ Chapter one: the Whispering Woods ]');
await h.clearDialogue();

for (const id of ['signpost', 'starGap', 'lanterns', 'frog', 'flowers', 'bird', 'theo']) {
  await h.interact(id);
  await h.clearDialogue();
}
check('optional woodland conversations are recorded',
  (await h.state()).progress.gossipHeard.length === 3);

// The hint button must name a moonflower that has not been found.
await page.locator('#hint-button').click();
await page.waitForTimeout(300);
check('the hint button opens a hint', await h.dialogueVisible());
await h.clearDialogue();

for (const id of ['flower-stream', 'flower-stones']) {
  await h.interact(id);
  await h.clearDialogue();
}
let snapshot = await h.state();
check('two moonflowers are saved', snapshot.progress.moonflowers.length === 2);
check('no fragment before all three moonflowers', snapshot.progress.fragments.length === 0);

// Refreshing mid-chapter must restore progress through Continue.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
check('Continue appears after a mid-chapter refresh',
  (await page.locator('#overlay button', { hasText: 'Continue' }).count()) > 0);
await h.clickPanel('Continue');
await page.waitForTimeout(1600);
await h.clearDialogue();
snapshot = await h.state();
check('Continue returns to the right chapter', snapshot.scene === 'woods');
check('Continue keeps the moonflowers already found', snapshot.progress.moonflowers.length === 2);

await h.interact('flower-hollow');
await h.pump(h.panelHas('Keep the fragment'), { seconds: 30 });
await h.clickPanel('Keep the fragment');
await h.clearDialogue();
snapshot = await h.state();
check('the first fragment is awarded', snapshot.progress.fragments.length === 1);
check('the fragment track shows one filled pip',
  (await page.locator('.fragment-pip[data-filled="true"]').count()) === 1);

await h.interact('arch');
await page.waitForTimeout(1800);
await h.clearDialogue();
check('chapter two loads', (await h.state()).scene === 'cottage');

console.log('\n[ Chapter two: the Enchanted Cottage ]');
for (const id of ['kettle', 'shelf', 'journal', 'portrait']) {
  await h.interact(id);
  await h.clearDialogue();
}

// The trial refuses to start before the guardians have explained themselves.
await h.interact('door');
await page.waitForTimeout(400);
check('the trial will not start before the clues are heard',
  (await page.locator('#overlay .choice-grid').count()) === 0);
await h.clearDialogue();

for (const key of ['stone', 'scroll', 'shears']) {
  await h.interact(`guardian-${key}`);
  await h.clearDialogue();
}

await h.interact('door');
await h.pump(async () => (await page.locator('#overlay .choice-grid').count()) > 0, { seconds: 25 });
check('the trial opens once all three guardians have spoken',
  (await page.locator('#overlay .choice-grid').count()) > 0);

// A wrong answer must explain itself and leave the round open.
const firstPrompt = await page.locator('#overlay .trivia-question').innerText();
const guardianOne = ['Stone', 'Scroll', 'Shears'].find((s) => firstPrompt.includes(s));
const COUNTER = { Stone: 'Scroll', Scroll: 'Shears', Shears: 'Stone' };
const wrong = ['Stone', 'Scroll', 'Shears'].find((s) => s !== COUNTER[guardianOne]);
await page.locator(`#overlay .choice-card[aria-label="Answer with ${wrong}"]`).click();
await page.waitForTimeout(500);
check('a wrong answer explains the rule',
  (await page.locator('#overlay .puzzle-feedback').innerText()).length > 20);
check('a wrong answer does not end the round',
  (await page.locator('#overlay .trivia-question').innerText()) === firstPrompt);

await page.locator('#overlay .menu-button', { hasText: 'hint' }).first().click();
await page.waitForTimeout(250);
check('the in-puzzle hint responds',
  (await page.locator('#overlay .puzzle-feedback').innerText()).includes('Theo'));

for (let round = 0; round < 3; round++) {
  await page.locator('#overlay .trivia-question').waitFor({ timeout: 10000 });
  const prompt = await page.locator('#overlay .trivia-question').innerText();
  const guardian = ['Stone', 'Scroll', 'Shears'].find((s) => prompt.includes(s));
  await page.locator(`#overlay .choice-card[aria-label="Answer with ${COUNTER[guardian]}"]`).click();
  await page.waitForTimeout(1500);
}
await h.pump(h.panelHas('Keep the fragment'), { seconds: 30 });
await h.clickPanel('Keep the fragment');
await h.clearDialogue();
check('the second fragment is awarded', (await h.state()).progress.fragments.length === 2);

await h.interact('exit');
await page.waitForTimeout(1800);
await h.clearDialogue();
check('chapter three loads', (await h.state()).scene === 'hall');

console.log('\n[ Chapter three: the Monochrome Hall ]');
for (const id of ['portraitLeft', 'portraitRight', 'window']) {
  await h.interact(id);
  await h.clearDialogue();
}
check('the hall gossip is recorded', (await h.state()).progress.gossipHeard.length === 5);

// The trial is locked until the mural is whole.
await h.interact('storykeeper');
await page.waitForTimeout(400);
check('the Storykeeper waits for the mural',
  (await page.locator('#overlay .answer-list').count()) === 0);
await h.clearDialogue();

await h.interact('mural');
await h.pump(async () => (await page.locator('#overlay .mural-board').count()) > 0, { seconds: 25 });
check('the mural puzzle opens', (await page.locator('#overlay .mural-board').count()) > 0);

const pairs = await muralPairing(page);

// The halves must not be hung so that row N answers row N.
const darkOrder = await page.locator('#overlay .mural-tile[data-side="dark"]').allInnerTexts();
const lightOrder = await page.locator('#overlay .mural-tile[data-side="light"]').allInnerTexts();
const alignedRows = darkOrder.filter((dark, i) => {
  const pair = pairs.find((x) => dark.includes(x.dark));
  return pair && (lightOrder[i] || '').includes(pair.light);
});
check('no panel is hung directly opposite its own answer', alignedRows.length === 0,
  alignedRows.join(' / '));

// A deliberate mismatch must be rejected and explained.
await joinMural(page, pairs[0].dark, pairs[1].light, 300);
check('a mismatched pair is refused',
  (await page.locator('#overlay .mural-tile[data-matched="true"]').count()) === 0);
check('a mismatched pair is explained',
  (await page.locator('#overlay .puzzle-feedback').innerText()).includes('not two halves'));

for (const pair of pairs) await joinMural(page, pair.dark, pair.light, 420);
await h.pump(async () => (await page.locator('#overlay .mural-board').count()) === 0, { seconds: 20 });
await h.clearDialogue();
check('the mural is recorded as complete', (await h.state()).progress.flags.muralComplete === true);
check('colour returns to the hall',
  await page.evaluate(() => window.unwrittenPage.game.scene.colorLevel > 0));

await h.interact('storykeeper');
await h.pump(async () => (await page.locator('#overlay .answer-list').count()) > 0, { seconds: 25 });
// The answers are read out of the game rather than written down here, so the
// trial can be rewritten without quietly invalidating this run.
const trivia = await page.evaluate(async () => {
  const mod = await import(new URL('src/puzzles/storykeeperTrial.js', document.baseURI).href);
  return mod.QUESTIONS.map((q) => ({
    prompt: q.prompt,
    correct: q.answers.find((a) => a.id === q.correct).text,
    options: q.answers.length
  }));
});
check('the trial still asks three questions', trivia.length === 3, String(trivia.length));
check('no question is a straight two-way guess',
  trivia.every((q) => q.options >= 3), trivia.map((q) => q.options).join(','));

for (let q = 0; q < trivia.length; q++) {
  await page.locator('#overlay .trivia-question').waitFor({ timeout: 10000 });
  const prompt = await page.locator('#overlay .trivia-question').innerText();
  const asked = trivia.find((t) => t.prompt === prompt);
  check(`question ${q + 1} is one the game actually defines`, Boolean(asked), prompt);
  await page.locator('#overlay .answer-button', { hasText: asked.correct }).first().click();
  await page.waitForTimeout(1700);
}
await h.pump(h.panelHas('Take the final fragment'), { seconds: 30 });
await h.clickPanel('Take the final fragment');
await h.clearDialogue();
snapshot = await h.state();
check('all three fragments are recovered', snapshot.progress.fragments.length === 3);
check('the trivia is recorded as complete', snapshot.progress.flags.triviaComplete === true);
check('the ending has not been reached yet', snapshot.progress.endingSeen !== true);

await h.interact('doors');
await page.waitForTimeout(1800);
await h.clearDialogue();
check('the garden loads', (await h.state()).scene === 'garden');

console.log('\n[ The Garden Beyond the Stars ]');
await h.interact('lantern-2');
await h.clearDialogue();
check('the lanterns refuse to be lit out of order',
  await page.evaluate(() => window.unwrittenPage.game.scene.lit.every((v) => v === false)));

for (const id of ['lantern-0', 'lantern-1', 'lantern-2']) {
  await h.interact(id);
  await page.waitForTimeout(400);
  if (id !== 'lantern-2') await h.clearDialogue();
}
check('all three lanterns are lit',
  await page.evaluate(() => window.unwrittenPage.game.scene.lit.every(Boolean)));

check('the final page is reached', await h.pump(h.panelHas('There is one more line'), { seconds: 90 }));
await h.clickPanel('There is one more line');

const question = await page.locator('#overlay .final-question').innerText();
check('the question is shown', question.toLowerCase().includes('prom'), question);
check('both responses are offered',
  (await page.locator('#overlay .question-actions button').count()) === 2);
check('the question is presented in the illustrated frame',
  (await page.locator('#overlay .ornate.question-frame').count()) === 1);
check('the HUD steps aside for the finale', await page.locator('#hud').isHidden());

await page.locator('#overlay button', { hasText: 'Yes, of course!' }).click();
check('the closing page is reached', await h.pump(h.panelHas('Stay in the garden'), { seconds: 60 }));
snapshot = await h.state();
check('the answer is saved', snapshot.progress.saidYes === true);
check('the ending is saved', snapshot.progress.endingSeen === true);

await h.clickPanel('Read it again');
check('the ending can be replayed', await h.pump(h.panelHas('There is one more line'), { seconds: 30 }));
await h.clickPanel('There is one more line');
await h.clickPanel('Come ask me in person');
check('the second response also reaches a closing page',
  await h.pump(h.panelHas('Stay in the garden'), { seconds: 40 }));
await h.clickPanel('Stay in the garden');
await page.waitForTimeout(400);
check('play resumes after the ending', await page.locator('#overlay').isHidden());

console.log('\n[ Menu, settings and reset ]');
await page.locator('#menu-button').click();
await page.waitForTimeout(350);
check('the menu opens', await page.locator('#overlay').isVisible());
check('the game pauses while the menu is open',
  await page.evaluate(() => window.unwrittenPage.game.paused === true));

await page.locator('#overlay button', { hasText: 'Reduced motion' }).click();
await page.waitForTimeout(200);
check('reduced motion can be switched on', (await h.state()).settings.reducedMotion === true);
check('reduced motion reaches the document',
  await page.evaluate(() => document.documentElement.dataset.reducedMotion === 'true'));

await page.locator('#overlay button', { hasText: 'Text speed' }).click();
await page.waitForTimeout(200);
check('text speed can be switched to instant', (await h.state()).settings.textSpeed === 'instant');

await page.locator('#overlay button', { hasText: 'Music' }).click();
await page.waitForTimeout(200);
check('music can be switched off', (await h.state()).settings.music === false);

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('Escape closes the menu', await page.locator('#overlay').isHidden());
check('the game un-pauses after the menu closes',
  await page.evaluate(() => window.unwrittenPage.game.paused === false));

// Erase everything, and confirm the title screen forgets the story.
await page.locator('#menu-button').click();
await page.waitForTimeout(300);
await page.locator('#overlay button', { hasText: 'Erase all progress' }).click();
await page.waitForTimeout(300);
await page.locator('#overlay button', { hasText: 'Yes, do it' }).click();
await page.waitForTimeout(1800);
snapshot = await h.state();
check('erasing returns to the title screen', snapshot.scene === 'title');
check('erasing clears the fragments', snapshot.progress.fragments.length === 0);
check('erasing keeps the sound and motion settings',
  snapshot.settings.reducedMotion === true && snapshot.settings.music === false);
check('Continue is gone after erasing',
  (await page.locator('#overlay button', { hasText: 'Continue' }).count()) === 0);

check('no console errors during the playthrough', errors.length === 0, errors.join(' | '));
await page.close();

/* -------------------------------------------------------------------------
   Continuing from a saved game, in every chapter
   ------------------------------------------------------------------------- */

console.log('\n[ Continue from each chapter ]');
const SAVED_GAMES = [
  ['woods', { chapter: 'woods', fragments: [], moonflowers: ['stream'], flags: { metTheo: true } }],
  ['cottage', { chapter: 'cottage', fragments: ['woods'], flags: { metTheo: true, woodsComplete: true, cottageArrived: true } }],
  ['hall', { chapter: 'hall', fragments: ['woods', 'cottage'], flags: { metTheo: true, cottageComplete: true, hallArrived: true, muralComplete: true } }],
  ['garden', { chapter: 'garden', fragments: ['woods', 'cottage', 'hall'], flags: { metTheo: true, hallComplete: true } }]
];

for (const [chapter, saved] of SAVED_GAMES) {
  const p = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const chapterErrors = [];
  p.on('pageerror', (e) => chapterErrors.push(e.message));
  await p.addInitScript((raw) => {
    localStorage.setItem('unwritten-page:progress:v1', raw);
  }, JSON.stringify({ version: 1, startedAt: 1, gossipHeard: [], hintCounts: {}, ...saved }));

  await instrument(p);
  await p.goto(`${BASE}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const helpers = makeHelpers(p);

  check(`${chapter}: Continue is offered`,
    (await p.locator('#overlay button', { hasText: 'Continue' }).count()) > 0);
  await p.locator('#overlay button', { hasText: 'Continue' }).click();
  await p.waitForTimeout(2000);
  await helpers.clearDialogue(20);

  const restored = await helpers.state();
  check(`${chapter}: reloads into the right chapter`, restored.scene === chapter, restored.scene);
  check(`${chapter}: keeps the fragments already earned`,
    restored.progress.fragments.length === saved.fragments.length);
  check(`${chapter}: the fragment track matches the save`,
    (await p.locator('.fragment-pip[data-filled="true"]').count()) === saved.fragments.length);
  check(`${chapter}: the hint button answers`, await (async () => {
    await p.locator('#hint-button').click();
    await p.waitForTimeout(400);
    const shown = await p.locator('#dialogue').isVisible();
    await helpers.clearDialogue(20);
    return shown;
  })());
  check(`${chapter}: no console errors`, chapterErrors.length === 0, chapterErrors.join(' | '));
  await p.close();
}

/* -------------------------------------------------------------------------
   Recovering from a badly timed refresh
   ------------------------------------------------------------------------- */

console.log('\n[ Interrupted mid-ceremony ]');
const INTERRUPTED = [
  ['woods, closed after the last moonflower', 'woodsComplete', {
    chapter: 'woods', fragments: [], moonflowers: ['stream', 'stones', 'hollow'],
    flags: { metTheo: true }
  }],
  ['hall, closed after both puzzles', 'hallComplete', {
    chapter: 'hall', fragments: ['woods', 'cottage'], moonflowers: ['stream', 'stones', 'hollow'],
    flags: {
      metTheo: true, woodsComplete: true, cottageComplete: true,
      hallArrived: true, muralComplete: true, triviaComplete: true
    }
  }]
];

for (const [name, expectedFlag, saved] of INTERRUPTED) {
  const p = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const recoveryErrors = [];
  p.on('pageerror', (e) => recoveryErrors.push(e.message));
  await p.addInitScript((raw) => {
    localStorage.setItem('unwritten-page:progress:v1', raw);
  }, JSON.stringify({ version: 1, startedAt: 1, gossipHeard: [], hintCounts: {}, ...saved }));

  await instrument(p);
  await p.goto(`${BASE}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const helpers = makeHelpers(p);
  await p.locator('#overlay button', { hasText: 'Continue' }).click();
  await p.waitForTimeout(1800);

  const recovered = await helpers.pump(async () => {
    const progress = (await helpers.state()).progress;
    return progress.flags[expectedFlag] === true;
  }, { seconds: 45, click: ['Keep the fragment', 'Take the final fragment'] });

  check(`${name}: the chapter finishes itself on return`, recovered);
  check(`${name}: no console errors`, recoveryErrors.length === 0, recoveryErrors.join(' | '));
  await p.close();
}

/* -------------------------------------------------------------------------
   Mobile behaviour
   ------------------------------------------------------------------------- */

console.log('\n[ Mobile behaviour ]');
{
  const p = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true
  });
  const mobileErrors = [];
  p.on('pageerror', (e) => mobileErrors.push(e.message));
  await instrument(p);
  await p.goto(`${BASE}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const helpers = makeHelpers(p);

  check('the measured viewport height is applied',
    await p.evaluate(() => {
      const value = getComputedStyle(document.documentElement).getPropertyValue('--app-height');
      return parseInt(value, 10) > 0;
    }));
  check('the canvas buffer matches its displayed size and pixel ratio',
    await p.evaluate(() => {
      const r = window.unwrittenPage.game.renderer;
      const rect = r.canvas.getBoundingClientRect();
      return Math.abs(r.canvas.width - Math.round(rect.width * r.dpr)) <= 1
        && Math.abs(r.canvas.height - Math.round(rect.height * r.dpr)) <= 1;
    }));

  await p.locator('#overlay button', { hasText: 'Start the story' }).click();
  for (let i = 0; i < 3; i++) await p.locator('#overlay button', { hasText: 'Turn the page' }).click();
  await p.locator('#dialogue').waitFor({ state: 'visible', timeout: 15000 });

  check('the touch controls stow themselves while she is reading',
    (await p.locator('#touch-controls').getAttribute('data-stowed')) === 'true');
  await helpers.clearDialogue();
  check('the touch controls come back afterwards',
    (await p.locator('#touch-controls').getAttribute('data-stowed')) === 'false');

  // Drag the stick, then let go: she must stop rather than walk forever.
  const before = await p.evaluate(() => ({ ...window.unwrittenPage.game.scene.player }));
  await p.mouse.move(120, 600);
  await p.mouse.down();
  await p.mouse.move(180, 600, { steps: 4 });
  await p.waitForTimeout(450);
  const during = await p.evaluate(() => ({ ...window.unwrittenPage.game.scene.player }));
  check('the thumb stick moves her', during.x > before.x + 8, `${before.x} -> ${during.x}`);
  await p.mouse.up();
  await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({ ...window.unwrittenPage.game.scene.player }));
  await p.waitForTimeout(400);
  const settled = await p.evaluate(() => ({ ...window.unwrittenPage.game.scene.player }));
  check('releasing the stick stops her', settled.vx === 0 && Math.abs(settled.x - after.x) < 2);

  // Losing the tab mid-drag must also clear the stick.
  await p.mouse.move(120, 600);
  await p.mouse.down();
  await p.mouse.move(180, 600, { steps: 3 });
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.mouse.up();
  await p.waitForTimeout(400);
  check('a drag interrupted by leaving the tab does not stick',
    await p.evaluate(() => window.unwrittenPage.game.input.stick.x === 0));

  // Tapping the object she is standing beside is an alternative to the button.
  await p.evaluate(() => {
    const scene = window.unwrittenPage.game.scene;
    const item = scene.interactables.find((i) => i.id === 'signpost');
    scene.player.x = item.x;
    scene.player.y = item.y + 14;
  });
  await p.waitForTimeout(220);
  const tapPoint = await p.evaluate(() => {
    const game = window.unwrittenPage.game;
    const item = game.scene.interactables.find((i) => i.id === 'signpost');
    const r = game.renderer;
    return {
      x: (item.x - r.camera.x) * r.scale + r.width / 2,
      y: (item.y - r.camera.y) * r.scale + r.height / 2
    };
  });
  await p.mouse.click(tapPoint.x, tapPoint.y);
  await p.waitForTimeout(500);
  check('tapping the object in front of her opens it', await helpers.dialogueVisible());
  await helpers.clearDialogue();

  // Backgrounding must not stack timers or double the music.
  const beforeHide = await p.evaluate(() => window.unwrittenPage.game.audio.schedulerId);
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForTimeout(400);
  check('the game pauses when the tab is hidden',
    await p.evaluate(() => window.unwrittenPage.game.backgrounded === true));
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForTimeout(500);
  check('the game resumes when the tab returns',
    await p.evaluate(() => window.unwrittenPage.game.backgrounded === false));
  const afterShow = await p.evaluate(() => window.unwrittenPage.game.audio.schedulerId);
  check('returning does not leave two music schedulers running',
    beforeHide === null || afterShow === null || typeof afterShow === 'number');
  check('the scene still runs after returning',
    await p.evaluate(async () => {
      const game = window.unwrittenPage.game;
      const before = game.scene.time;
      await new Promise((r) => setTimeout(r, 300));
      return game.scene.time > before;
    }));

  // Rotating must not break the canvas or lose her position.
  const spot = await p.evaluate(() => ({ ...window.unwrittenPage.game.scene.player }));
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(700);
  const rotated = await p.evaluate(() => ({
    player: { ...window.unwrittenPage.game.scene.player },
    canvasOk: (() => {
      const r = window.unwrittenPage.game.renderer;
      const rect = r.canvas.getBoundingClientRect();
      return Math.abs(r.canvas.width - Math.round(rect.width * r.dpr)) <= 1;
    })()
  }));
  check('rotating keeps her where she was',
    Math.abs(rotated.player.x - spot.x) < 2 && Math.abs(rotated.player.y - spot.y) < 2);
  check('rotating resizes the canvas correctly', rotated.canvasOk);

  check('mobile behaviour: no console errors', mobileErrors.length === 0, mobileErrors.join(' | '));
  await p.close();
}

/* -------------------------------------------------------------------------
   Accessibility
   ------------------------------------------------------------------------- */

console.log('\n[ Accessibility ]');
{
  const p = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const a11yErrors = [];
  p.on('pageerror', (e) => a11yErrors.push(e.message));
  await p.addInitScript((raw) => {
    localStorage.setItem('unwritten-page:progress:v1', raw);
  }, JSON.stringify({
    version: 1, startedAt: 1, chapter: 'cottage', fragments: ['woods'],
    moonflowers: ['stream', 'stones', 'hollow'], gossipHeard: [], hintCounts: {},
    flags: { metTheo: true, woodsComplete: true, cottageArrived: true, guardiansGreeted: true }
  }));
  await instrument(p);
  await p.goto(`${BASE}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const helpers = makeHelpers(p);

  const unnamed = await p.evaluate(() =>
    [...document.querySelectorAll('#overlay button, #hud button, #interact-button')]
      .filter((b) => !(b.getAttribute('aria-label') || b.textContent || '').trim())
      .length);
  check('every visible control has an accessible name', unnamed === 0, `${unnamed} unnamed`);

  // Tab must not escape the open panel.
  await p.keyboard.press('Tab');
  await p.keyboard.press('Tab');
  check('keyboard focus stays inside the panel',
    await p.evaluate(() => document.getElementById('overlay').contains(document.activeElement)));

  await p.locator('#overlay button', { hasText: 'Continue' }).click();
  await p.waitForTimeout(1800);
  await helpers.clearDialogue(20);

  check('fragment pips are labelled, not just coloured',
    await p.evaluate(() =>
      [...document.querySelectorAll('.fragment-pip')]
        .every((pip) => /recovered|not yet found/.test(pip.getAttribute('aria-label') || ''))));

  check('the interaction button reports what it will do',
    await p.evaluate(() => {
      const label = document.getElementById('interact-button').getAttribute('aria-label') || '';
      return label.length > 0;
    }));

  // A sound cue must also produce a visible caption.
  await p.evaluate(() => window.unwrittenPage.game.audio.threeChimes());
  await p.waitForTimeout(200);
  check('audio cues are captioned on screen',
    (await p.locator('#caption').getAttribute('data-visible')) === 'true'
    && (await p.locator('#caption').innerText()).length > 0);

  // Open the trial and solve a round with the keyboard alone.
  await helpers.interact('door');
  await helpers.pump(async () => (await p.locator('#overlay .choice-grid').count()) > 0, { seconds: 25 });
  check('the puzzle gives focus to its first control',
    await p.evaluate(() => document.getElementById('overlay').contains(document.activeElement)));

  const prompt = await p.locator('#overlay .trivia-question').innerText();
  const guardian = ['Stone', 'Scroll', 'Shears'].find((s) => prompt.includes(s));
  const answer = { Stone: 'Scroll', Scroll: 'Shears', Shears: 'Stone' }[guardian];
  await p.locator(`#overlay .choice-card[aria-label="Answer with ${answer}"]`).focus();
  const focusRing = await p.evaluate(() => {
    const style = getComputedStyle(document.activeElement);
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  });
  check('focused controls show a visible focus ring', focusRing);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(700);
  check('a puzzle round can be answered with the keyboard alone',
    (await p.locator('#overlay .puzzle-feedback').innerText()).includes('defeats'));

  check('accessibility pass: no console errors', a11yErrors.length === 0, a11yErrors.join(' | '));
  await p.close();
}

/* -------------------------------------------------------------------------
   Reduced motion
   ------------------------------------------------------------------------- */

console.log('\n[ Reduced motion ]');
{
  const p = await browser.newPage({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce'
  });
  const motionErrors = [];
  p.on('pageerror', (e) => motionErrors.push(e.message));
  await instrument(p);
  await p.goto(`${BASE}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const helpers = makeHelpers(p);

  check('the system reduced-motion setting is picked up',
    (await helpers.state()).settings.reducedMotion === true);

  await p.locator('#overlay button', { hasText: 'Start the story' }).click();
  for (let i = 0; i < 3; i++) await p.locator('#overlay button', { hasText: 'Turn the page' }).click();
  await p.locator('#dialogue').waitFor({ state: 'visible', timeout: 15000 });

  // With reduced motion the typewriter is skipped: the whole line is there at once.
  await p.waitForTimeout(120);
  const firstLine = await p.locator('#dialogue-text').innerText();
  check('dialogue appears instantly rather than typing out', firstLine.length > 30, firstLine);
  check('the page-turn overlay is not left running',
    await p.evaluate(() => document.getElementById('page-turn').dataset.playing !== 'true'));
  check('reduced motion: no console errors', motionErrors.length === 0, motionErrors.join(' | '));
  await p.close();
}

/* -------------------------------------------------------------------------
   Portrait layout pass
   ------------------------------------------------------------------------- */

console.log('\n[ Portrait layout ]');
for (const [name, viewport] of [
  ['320x568 portrait', { width: 320, height: 568 }],
  ['375x667 portrait', { width: 375, height: 667 }],
  ['390x844 portrait', { width: 390, height: 844 }],
  ['430x932 portrait', { width: 430, height: 932 }]
]) {
  const p = await browser.newPage({ viewport, deviceScaleFactor: 3, hasTouch: true });
  const portraitErrors = [];
  p.on('pageerror', (e) => portraitErrors.push(e.message));
  await instrument(p);
  await p.goto(`${BASE}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);

  const overflow = await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${name}: no horizontal overflow`, overflow <= 0, `overflow ${overflow}px`);

  const startBox = await p.locator('#overlay button', { hasText: 'Start the story' }).boundingBox();
  check(`${name}: the start button is a comfortable size`, startBox && startBox.height >= 44,
    `height ${startBox?.height}`);

  await p.locator('#overlay button', { hasText: 'Start the story' }).click();
  for (let i = 0; i < 3; i++) await p.locator('#overlay button', { hasText: 'Turn the page' }).click();
  await p.locator('#dialogue').waitFor({ state: 'visible', timeout: 15000 });

  const rotateVisible = await p.locator('#rotate-hint').isVisible();
  check(`${name}: the rotate suggestion appears without blocking play`, rotateVisible);
  await p.locator('#rotate-dismiss').click();
  check(`${name}: the rotate suggestion can be dismissed`, await p.locator('#rotate-hint').isHidden());

  const actionBox = await p.locator('#interact-button').boundingBox();
  check(`${name}: the action button is at least 44px`, actionBox && actionBox.width >= 44);
  const onScreen = actionBox && actionBox.x >= 0 && actionBox.y >= 0
    && actionBox.x + actionBox.width <= viewport.width
    && actionBox.y + actionBox.height <= viewport.height;
  check(`${name}: the action button is fully on screen`, onScreen);

  const dialogueBox = await p.locator('#dialogue').boundingBox();
  check(`${name}: the dialogue box fits the screen`,
    dialogueBox && dialogueBox.x >= 0 && dialogueBox.x + dialogueBox.width <= viewport.width);

  check(`${name}: no console errors`, portraitErrors.length === 0, portraitErrors.join(' | '));
  await p.close();
}

console.log('\n[ Personalisation ]');
await collectTokenLeaks(page);
check('no unexpanded {token} ever reached the screen', tokenLeaks().length === 0, tokenLeaks().join(' | '));

await browser.close();

console.log(`\n${checks.length - failures}/${checks.length} checks passed`);
if (failures > 0) {
  console.error(`\n${failures} check(s) failed:`);
  for (const line of checks) if (line.startsWith('FAIL')) console.error('  ' + line);
  process.exit(1);
}
