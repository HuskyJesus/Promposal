/**
 * The final scene — The Garden Beyond the Stars.
 *
 * Three lanterns, one personal star, its neighbour, and the last page of the
 * story. Everything after the lanterns is scripted: the light makes the
 * journey there and back, twice, and then the page finishes writing itself.
 */

import { WorldScene } from '../engine/worldScene.js';
import { createBuffer } from '../engine/renderer.js';
import {
  paintGround, paintNightSky, paintStonePath, drawFlowerCluster, drawFern, drawMoon,
  drawPersonalStar, drawCastleSilhouette, drawLantern, drawThreeStars, drawVine,
  makeRandom, makeSprite, rgba, starPath
} from '../engine/art.js';
import { GARDEN } from '../data/dialogue.js';
import { config, fill } from '../config.js';
import { el, wait } from '../engine/ui.js';
import { CHAPTER_TITLES } from '../engine/game.js';

const WORLD = { width: 1120, height: 800 };
const SHORE_Y = 260;

const LANTERNS = [
  { id: 0, x: 300, y: 540 },
  { id: 1, x: 560, y: 486 },
  { id: 2, x: 820, y: 540 }
];

const DAIS = { x: 560, y: 380 };
const STAR = { x: 800, y: 96 };
const NEIGHBOUR = { x: 856, y: 124 };

export class GardenScene extends WorldScene {
  constructor(game) {
    super(game);
    this.world = WORLD;
    this.skyColor = '#0b0a1c';
    this.vignetteStrength = 0.55;
    this.player = { x: 560, y: 720, facing: 'up', moving: false, walkTime: 0 };
    this.theo = { x: 520, y: 740, visible: true, mood: 'happy', facing: 'up' };
    this.lit = [false, false, false];
    this.neighbourGlow = 0;
    this.beam = null;
    this.promiseLights = 0;
    this.bloom = 0;
    this.celebrating = false;
  }

  async enter(payload = {}) {
    const game = this.game;
    game.save.setChapter('garden');
    game.audio.setMood('garden');
    game.ui.setChapter(CHAPTER_TITLES.garden, 'Light the three lanterns');
    game.ui.setFragments(game.save.progress.fragments.length);

    this.#buildSprites();
    this.background = this.#paintBackground();
    this.#buildColliders();
    this.#buildScenery();
    this.#buildInteractables();

    this.drifts = [];
    this.addDrift({
      count: 44,
      bounds: { x: 0, y: SHORE_Y, width: WORLD.width, height: WORLD.height - SHORE_Y },
      style: 'firefly',
      palette: { core: '#ffe9b0' }
    });

    game.renderer.snapCamera(this.player.x, this.player.y - 20, this.world);

    // Someone who has already reached the end walks back into a finished garden.
    if (game.save.progress.endingSeen) {
      this.lit = [true, true, true];
      this.neighbourGlow = 1;
      this.promiseLights = 3;
      this.bloom = 1;
      game.ui.setObjective('Read the final page again');
    }
  }

  async begin() {
    if (this.game.save.progress.endingSeen) {
      await this.say([{ who: 'theo', mood: 'happy', text: 'Again? Of course. Some pages are worth rereading. Stand on the dais whenever you like.' }]);
      return;
    }
    await this.say(GARDEN.arrive);
  }

  /* ------------------------------------------------------------- scenery */

  #buildSprites() {
    this.daisSprite = makeSprite({
      width: 260, height: 180, anchorX: 130, anchorY: 110,
      paint: (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 4, 104, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let ring = 0; ring < 3; ring++) {
          ctx.fillStyle = ring % 2 ? '#b6ac9a' : '#cdc3ae';
          ctx.beginPath();
          ctx.ellipse(0, -ring * 7, 100 - ring * 16, 26 - ring * 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#8d8474';
        ctx.beginPath();
        ctx.ellipse(0, -20, 54, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(233,180,95,0.5)';
        for (let i = 0; i < 3; i++) {
          starPath(ctx, -26 + i * 26, -22, 6);
          ctx.fill();
        }
      }
    });

    this.hedgeSprite = makeSprite({
      width: 180, height: 120, anchorX: 90, anchorY: 96,
      paint: (ctx) => {
        const random = makeRandom(88);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 74, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let pass = 0; pass < 2; pass++) {
          ctx.fillStyle = pass ? '#2f6a4e' : '#204a38';
          ctx.beginPath();
          for (let i = 0; i < 9; i++) {
            const cx = -70 + i * 18;
            const cy = -34 - random() * 16 + (pass ? -6 : 0);
            ctx.moveTo(cx + 20, cy);
            ctx.arc(cx, cy, 20 - pass * 3, 0, Math.PI * 2);
          }
          ctx.fill();
        }
        drawFlowerCluster(ctx, -30, -40, 1, ['#f4dff0', '#ffe9b0'], 4, 3);
        drawFlowerCluster(ctx, 34, -46, 1, ['#f4dff0', '#d98a9a'], 6, 3);
      }
    });
  }

  #paintBackground() {
    const { width, height } = WORLD;
    return createBuffer(width, height, (ctx) => {
      paintNightSky(ctx, width, SHORE_Y, { top: '#08071a', bottom: '#241f42', starCount: 120, seed: 77 });
      drawCastleSilhouette(ctx, width * 0.5, SHORE_Y - 6, 1.5, '#13112a', 'rgba(255,214,140,0.5)');

      const lawn = createBuffer(width, height - 200, (lctx, w, h) => {
        paintGround(lctx, w, h, { base: '#1f4034', patch: '#2f6a4e', seed: 91, patchCount: 240 });
      });
      ctx.drawImage(lawn, 0, 200);

      paintStonePath(ctx, [
        { x: 560, y: 800 }, { x: 560, y: 640 }, { x: 560, y: 500 }, { x: 560, y: 400 }
      ], { width: 60, stone: '#b3aa98', grout: '#2a4a3a', seed: 5 });
      paintStonePath(ctx, [
        { x: 300, y: 560 }, { x: 430, y: 540 }, { x: 560, y: 520 }, { x: 690, y: 540 }, { x: 820, y: 560 }
      ], { width: 34, stone: '#b3aa98', grout: '#2a4a3a', seed: 6 });

      const random = makeRandom(2222);
      for (let i = 0; i < 150; i++) {
        const x = random() * width;
        const y = SHORE_Y + random() * (height - SHORE_Y - 20);
        if (Math.abs(x - 560) < 46 && y > 380) continue;
        const roll = random();
        if (roll < 0.5) {
          drawFlowerCluster(ctx, x, y, 0.7 + random() * 0.6, ['#f4dff0', '#e8d8f4', '#ffe9b0'], 300 + i, 4);
        } else if (roll < 0.8) {
          drawFern(ctx, x, y, 0.6 + random() * 0.6, '#2f6a4e', 400 + i);
        }
      }

      drawVine(ctx, [{ x: 80, y: 700 }, { x: 96, y: 650 }, { x: 84, y: 600 }, { x: 100, y: 550 }], 1.4,
        { stem: '#2f6a4e', leaf: '#4f8f63', leafDark: '#356b4c' }, 51);
      drawVine(ctx, [{ x: 1040, y: 700 }, { x: 1024, y: 648 }, { x: 1038, y: 598 }], 1.4,
        { stem: '#2f6a4e', leaf: '#4f8f63', leafDark: '#356b4c' }, 53);
    });
  }

  #buildColliders() {
    this.colliders = [];
    this.addCollider(-80, -80, WORLD.width + 160, SHORE_Y + 70);
    this.addBoundaryWalls(6);
    this.hedges = [
      { x: 150, y: 400 }, { x: 970, y: 400 }, { x: 150, y: 640 }, { x: 970, y: 640 }
    ];
    for (const hedge of this.hedges) this.addCollider(hedge.x - 74, hedge.y - 18, 148, 22);
  }

  #buildScenery() {
    this.entities = [];
    for (const hedge of this.hedges) {
      this.addEntity({ y: hedge.y, draw: (ctx) => this.hedgeSprite.draw(ctx, hedge.x, hedge.y) });
    }
    this.addEntity({ y: DAIS.y, draw: (ctx) => this.daisSprite.draw(ctx, DAIS.x, DAIS.y) });

    for (const lantern of LANTERNS) {
      this.addEntity({
        y: lantern.y,
        draw: (ctx, time) => {
          ctx.strokeStyle = '#4b3f2c';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(lantern.x, lantern.y);
          ctx.lineTo(lantern.x, lantern.y - 40);
          ctx.stroke();
          drawLantern(ctx, lantern.x, lantern.y - 22, 1.15, this.lit[lantern.id], time + lantern.id);
        }
      });
    }
  }

  #buildInteractables() {
    this.interactables = [];
    for (const lantern of LANTERNS) {
      this.addInteractable({
        id: `lantern-${lantern.id}`,
        x: lantern.x, y: lantern.y,
        radius: 56, label: 'Light', promptOffset: -80,
        available: () => !this.lit[lantern.id] && !this.game.save.progress.endingSeen,
        onInteract: () => this.#lightLantern(lantern.id)
      });
    }

    this.addInteractable({
      id: 'dais',
      x: DAIS.x, y: DAIS.y + 30,
      radius: 76, label: 'Read', promptOffset: -70,
      available: () => this.game.save.progress.endingSeen,
      onInteract: () => this.#finalPages({ replay: true })
    });

    this.addInteractable({
      id: 'theo', x: 0, y: 0, radius: 54, label: 'Talk', promptOffset: -46,
      onInteract: () => this.say(this.#theoChat())
    });
  }

  #theoChat() {
    if (this.game.save.progress.endingSeen) {
      return [{ who: 'theo', mood: 'proud', text: 'I meant every word, for the record. And I would like it noted that I delivered it flawlessly.' }];
    }
    const remaining = this.lit.filter(Boolean).length;
    if (remaining === 0) return [{ who: 'theo', text: 'Three lanterns. In order, please. I have gone to some trouble.' }];
    if (remaining < 3) return [{ who: 'theo', mood: 'happy', text: `${3 - remaining} to go. Do not rush it. This part is meant to be slow.` }];
    return GARDEN.beforeStar;
  }

  /* ------------------------------------------------------------- sequence */

  async #lightLantern(id) {
    // The lanterns insist on being lit in order — one, then two, then three.
    const expected = this.lit.findIndex((v) => !v);
    if (id !== expected) {
      await this.say([{ who: 'theo', mood: 'worried', text: 'Not that one yet. In order — that is rather the whole point of three.' }]);
      return;
    }

    this.lit[id] = true;
    this.game.audio.sparkle();
    this.game.ui.caption(`Lantern ${id + 1} of 3 lights`);
    this.particles.burst(LANTERNS[id].x, LANTERNS[id].y - 40, 22, {
      color: ['#ffe9b0', '#ffd48a'], speed: 50, life: 1.2, size: 2.6, shape: 'spark', gravity: -20
    });
    await this.say(GARDEN.lantern[id]);
    this.game.ui.setObjective(`Lanterns lit: ${this.lit.filter(Boolean).length} of 3`);

    if (this.lit.every(Boolean)) {
      this.game.audio.threeChimes();
      await wait(600);
      await this.#promiseSequence();
    }
  }

  async #promiseSequence() {
    this.busy = true;
    this.game.ui.setObjective('');
    await this.say(GARDEN.beforeStar);

    // The three promise lights rise above the dais, one for each word.
    for (let i = 0; i < 3; i++) {
      this.promiseLights = i + 1;
      this.game.audio.sparkle();
      this.particles.burst(DAIS.x + (i - 1) * 48, DAIS.y - 90, 16, {
        color: ['#ffe9b0', '#fff6d8'], speed: 34, life: 1.4, size: 2.4, shape: 'star', gravity: -10
      });
      await wait(this.game.settings.reducedMotion ? 120 : 520);
    }

    await this.say(GARDEN.starSequence);
    await this.#runBeam();
    await this.say(GARDEN.afterStar);
    await this.#finalPages({ replay: false });
    this.busy = false;
  }

  /** Light travels from the garden to the star's neighbour and back. Twice. */
  #runBeam() {
    this.neighbourGlow = 0.001;
    if (this.game.settings.reducedMotion) {
      // Same story beat, without the sweeping motion.
      this.neighbourGlow = 1;
      this.game.ui.caption('Light travels to the neighbouring star and back — twice');
      this.game.audio.sparkle();
      return wait(900);
    }
    return new Promise((resolve) => {
      this.beam = { t: 0, trips: 0, totalTrips: 2, resolve };
      this.game.ui.caption('Light travels to the neighbouring star and back — twice');
    });
  }

  /* ---------------------------------------------------------- final pages */

  async #finalPages({ replay }) {
    const game = this.game;

    await game.showStoryPage({
      title: 'The Final Page',
      paragraphs: splitParagraphs(config.finalMessage),
      buttonLabel: 'There is one more line',
      dropcap: false
    });

    const answer = await this.#askQuestion();

    if (answer === 'yes') {
      game.save.progress.saidYes = true;
      game.save.progress.endingSeen = true;
      game.save.save();
      await this.#celebrate();
      await this.say(GARDEN.yesResponse);
      await this.#closingPage();
    } else {
      game.save.progress.endingSeen = true;
      game.save.save();
      await this.say(GARDEN.talkResponse);
      await this.#closingPage({ soft: true });
    }

    game.ui.setObjective('Read the final page again');
    if (replay) this.busy = false;
  }

  #askQuestion() {
    const game = this.game;
    return game.ui.openPanel((close) => {
      const actions = config.showResponseChoices
        ? [
          el('button', {
            class: 'menu-button', type: 'button', text: config.responseYesLabel,
            onClick: () => { game.audio.uiTap(); close('yes'); }
          }),
          el('button', {
            class: 'menu-button quiet', type: 'button', text: config.responseTalkLabel,
            onClick: () => { game.audio.uiTap(); close('talk'); }
          })
        ]
        : [
          el('button', {
            class: 'menu-button', type: 'button', text: 'Close the book',
            onClick: () => { game.audio.uiTap(); close('yes'); }
          })
        ];

      return el('div', { class: 'final-panel fade-up', role: 'dialog', 'aria-label': 'The last page' }, [
        el('p', { class: 'final-lead', text: fill(config.finalLeadIn) }),
        el('h2', { class: 'final-question', text: fill(config.finalQuestion) }),
        el('div', { class: 'panel-actions' }, actions)
      ]);
    });
  }

  async #celebrate() {
    this.celebrating = true;
    this.bloom = 0.001;
    this.game.audio.celebrate();
    this.theo.mood = 'proud';

    // Three great lights pulse in sequence, then the whole garden blooms.
    for (let i = 0; i < 3; i++) {
      this.promiseLights = i + 1;
      this.particles.burst(DAIS.x + (i - 1) * 60, DAIS.y - 110, 30, {
        color: ['#ffe9b0', '#fff6d8', '#d98a9a'], speed: 70, life: 1.8, size: 3.2, shape: 'star', gravity: -12
      });
      await wait(this.game.settings.reducedMotion ? 100 : 420);
    }
    for (let i = 0; i < (this.game.settings.reducedMotion ? 2 : 8); i++) {
      this.particles.burst(
        160 + Math.random() * 800,
        400 + Math.random() * 320,
        18,
        { color: ['#f4dff0', '#ffe9b0', '#d98a9a', '#6f9ee8'], speed: 90, life: 2.2, size: 3, shape: 'petal', gravity: 12, drag: 0.97 }
      );
      await wait(this.game.settings.reducedMotion ? 40 : 160);
    }
  }

  #closingPage({ soft = false } = {}) {
    const game = this.game;
    const details = [config.promDate, config.promLocation].filter(Boolean).join(' · ');

    return game.ui.openPanel((close) =>
      el('div', { class: 'final-panel fade-up', role: 'dialog', 'aria-label': 'The end' }, [
        el('h2', { class: 'panel-title', text: soft ? 'The page stays open' : 'The final page has been written.' }),
        el('p', { class: 'signature', text: soft ? `He is waiting, and he is not going anywhere. — ${config.guideName}` : fill(config.finalResponseMessage) }),
        details ? el('p', { class: 'final-note', text: details }) : null,
        config.memories.length
          ? el('ul', { class: 'memory-list', 'aria-label': 'Whispered by the flowers' },
            config.memories.map((memory) => el('li', { text: fill(memory) })))
          : null,
        el('div', { class: 'panel-actions' }, [
          el('button', {
            class: 'menu-button', type: 'button', text: 'Stay in the garden',
            onClick: () => { game.audio.uiTap(); close('stay'); }
          }),
          el('button', {
            class: 'menu-button quiet', type: 'button', text: 'Read it again',
            onClick: () => { game.audio.uiTap(); close('again'); }
          })
        ])
      ])
    ).then(async (result) => {
      if (result === 'again') await this.#finalPages({ replay: true });
    });
  }

  /* -------------------------------------------------------------- runtime */

  updateScene(dt) {
    const theoTarget = this.interactables.find((i) => i.id === 'theo');
    if (theoTarget) {
      theoTarget.x = this.theo.x;
      theoTarget.y = this.theo.y;
    }

    if (this.neighbourGlow > 0 && this.neighbourGlow < 1) {
      this.neighbourGlow = Math.min(1, this.neighbourGlow + dt * 0.8);
    }
    if (this.bloom > 0 && this.bloom < 1) {
      this.bloom = Math.min(1, this.bloom + dt * 0.35);
    }

    if (this.beam) {
      const speed = 0.62;
      this.beam.t += dt * speed;
      if (this.beam.t >= 1) {
        this.beam.t = 0;
        this.beam.trips += 1;
        this.game.audio.sparkle();
        if (this.beam.trips >= this.beam.totalTrips) {
          const resolve = this.beam.resolve;
          this.beam = null;
          this.neighbourGlow = 1;
          resolve();
        }
      }
    }
  }

  hint() {
    const level = this.game.save.bumpHint('garden');
    const index = Math.min(level, GARDEN.hintLines.length) - 1;
    this.say([{ who: 'theo', mood: 'sly', text: GARDEN.hintLines[index] }]);
  }

  celebrateFragment() {
    this.particles.burst(DAIS.x, DAIS.y - 60, 40, {
      color: ['#ffe9b0', '#f6e7c8'], speed: 70, life: 1.6, size: 3, shape: 'star', gravity: -12
    });
  }

  drawBehind(ctx, time) {
    drawMoon(ctx, 220, 92, 34, time);
    drawPersonalStar(ctx, STAR.x, STAR.y, time, 1.25);

    if (this.neighbourGlow > 0) {
      ctx.save();
      ctx.globalAlpha = this.neighbourGlow;
      drawPersonalStar(ctx, NEIGHBOUR.x, NEIGHBOUR.y, time * 1.3, 0.7, '#ffd9e2');
      ctx.restore();
    }
  }

  drawFront(ctx, time) {
    // The three promise lights above the dais.
    for (let i = 0; i < this.promiseLights; i++) {
      const x = DAIS.x + (i - 1) * 54;
      const y = DAIS.y - 108 - Math.sin(time * 1.6 + i) * 5;
      const pulse = this.celebrating
        ? 0.6 + 0.4 * Math.sin(time * 3 - i * 1.6)
        : 0.6 + 0.25 * Math.sin(time * 1.6 + i * 1.2);
      const radius = (this.celebrating ? 46 : 30) * pulse;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, rgba('#fff3cf', 0.85));
      glow.addColorStop(0.4, rgba('#e9b45f', 0.4));
      glow.addColorStop(1, rgba('#e9b45f', 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8e2';
      starPath(ctx, x, y, 7, 4, 0.3);
      ctx.fill();
    }

    // Three silver stars set into the dais, matching the doors elsewhere.
    drawThreeStars(ctx, DAIS.x, DAIS.y - 34, 0.8, '#dde5f2', this.lit, time);

    // The travelling light.
    if (this.beam) {
      const from = { x: DAIS.x, y: DAIS.y - 90 };
      const outward = this.beam.t < 0.5;
      const t = outward ? this.beam.t * 2 : (1 - this.beam.t) * 2;
      const target = NEIGHBOUR;
      const x = from.x + (target.x - from.x) * t;
      const y = from.y + (target.y - from.y) * t;

      ctx.save();
      const trail = ctx.createLinearGradient(from.x, from.y, x, y);
      trail.addColorStop(0, rgba('#ffe9b0', 0));
      trail.addColorStop(1, rgba('#fff6d8', 0.55));
      ctx.strokeStyle = trail;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
      glow.addColorStop(0, rgba('#fffdf4', 0.95));
      glow.addColorStop(1, rgba('#ffe9b0', 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Flowers opening in colour once she has answered.
    if (this.bloom > 0) {
      ctx.save();
      ctx.globalAlpha = this.bloom;
      const random = makeRandom(6161);
      for (let i = 0; i < 40; i++) {
        const x = 90 + random() * (WORLD.width - 180);
        const y = SHORE_Y + 60 + random() * (WORLD.height - SHORE_Y - 110);
        drawFlowerCluster(ctx, x, y, 0.9 + random() * 0.5, ['#f6b8c8', '#ffe9b0', '#e2c8f4'], 800 + i, 3);
      }
      ctx.restore();
    }
  }
}

/** Blank lines in the configured message become separate paragraphs. */
function splitParagraphs(text) {
  return String(text).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}
