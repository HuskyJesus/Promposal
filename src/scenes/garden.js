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
  paintMist, drawLightPool, drawClouds, makeRandom, makeSprite, rgba, starPath
} from '../engine/art.js';
import { SCENE_THEMES, PALETTE } from '../engine/theme.js';
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

const THEME = SCENE_THEMES.garden;
const DAIS = { x: 560, y: 380 };
const STAR = { x: 800, y: 96 };
const NEIGHBOUR = { x: 856, y: 124 };

export class GardenScene extends WorldScene {
  constructor(game) {
    super(game);
    this.world = WORLD;
    this.skyColor = THEME.skyTop;
    this.vignetteStrength = THEME.vignette;
    this.atmosphere = PALETTE.lavender;
    this.atmosphereStrength = 0.055;
    Object.assign(this.player, { x: 560, y: 720, facing: 'up', moving: false, walkTime: 0 });
    Object.assign(this.theo, { x: 520, y: 740, visible: true, mood: 'happy', facing: 'up' });
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

    this.lightPools = [
      { x: DAIS.x, y: DAIS.y + 30, r: 170 },
      { x: 300, y: 566, r: 100 }, { x: 560, y: 512, r: 100 }, { x: 820, y: 566, r: 100 }
    ];
    this.seedTufts({
      count: 130,
      bounds: { x: 30, y: SHORE_Y + 20, width: WORLD.width - 60, height: WORLD.height - SHORE_Y - 50 },
      colors: ['#357a5a', '#2c6a4c'],
      blooms: THEME.flowers,
      seed: 8123
    });

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
      paintNightSky(ctx, width, SHORE_Y, { top: THEME.skyTop, bottom: THEME.skyBottom, starCount: 120, seed: 77 });
      drawCastleSilhouette(ctx, width * 0.5, SHORE_Y - 6, 1.5, THEME.horizon, 'rgba(255,214,140,0.5)');

      const lawn = createBuffer(width, height - 200, (lctx, w, h) => {
        paintGround(lctx, w, h, { base: THEME.ground, patch: THEME.groundPatch, seed: 91, patchCount: 240 });
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
          drawFlowerCluster(ctx, x, y, 0.7 + random() * 0.6, THEME.flowers, 300 + i, 4);
        } else if (roll < 0.8) {
          drawFern(ctx, x, y, 0.6 + random() * 0.6, '#2f6a4e', 400 + i);
        }
      }

      drawVine(ctx, [{ x: 80, y: 700 }, { x: 96, y: 650 }, { x: 84, y: 600 }, { x: 100, y: 550 }], 1.4,
        { stem: '#2f6a4e', leaf: '#4f8f63', leafDark: '#356b4c' }, 51);
      drawVine(ctx, [{ x: 1040, y: 700 }, { x: 1024, y: 648 }, { x: 1038, y: 598 }], 1.4,
        { stem: '#2f6a4e', leaf: '#4f8f63', leafDark: '#356b4c' }, 53);

      paintMist(ctx, width, height, THEME.mist, 41, 6);
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
    this.playAnim('interact', 0.42);
    this.cheerTheo('delighted', 0.7);
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
    this.playAnim('celebrate', 9);
    this.cheerTheo('delighted', 1);
    if (!this.game.settings.reducedMotion) this.game.renderer.emphasise(0.08);

    // Lavender blossoms open in a ring around her.
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      this.particles.emit({
        x: this.player.x + Math.cos(angle) * 26,
        y: this.player.y + Math.sin(angle) * 14,
        vx: Math.cos(angle) * 26, vy: Math.sin(angle) * 14 - 18,
        life: 2.4, maxLife: 2.4, size: 3.2,
        color: i % 2 ? PALETTE.lavender : PALETTE.lavenderLight,
        gravity: 8, drag: 0.95, shape: 'petal'
      });
    }

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
      const speed = 0.55;
      this.beam.t += dt * speed;
      // A thin trail of sparks follows the light on its way out and back.
      if (Math.random() < dt * 26) {
        const point = this.#beamPoint();
        this.particles.emit({
          x: point.x + (Math.random() - 0.5) * 6,
          y: point.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
          life: 0.7, maxLife: 0.7, size: 1.8,
          color: Math.random() < 0.5 ? PALETTE.goldLight : PALETTE.lavenderLight,
          gravity: 0, drag: 0.94, shape: 'star'
        });
      }
      if (this.beam.t >= 1) {
        this.beam.t = 0;
        this.beam.trips += 1;
        this.game.audio.sparkle();
        this.game.ui.caption(`Journey ${this.beam.trips} of ${this.beam.totalTrips} complete`);
        if (this.beam.trips >= this.beam.totalTrips) {
          const resolve = this.beam.resolve;
          this.beam = null;
          this.neighbourGlow = 1;
          resolve();
        }
      }
    }
  }

  /** Where the travelling light is right now, eased at both ends. */
  #beamPoint() {
    const from = { x: DAIS.x, y: DAIS.y - 90 };
    if (!this.beam) return from;
    const outward = this.beam.t < 0.5;
    const raw = outward ? this.beam.t * 2 : (1 - this.beam.t) * 2;
    const eased = raw * raw * (3 - 2 * raw);
    return {
      x: from.x + (NEIGHBOUR.x - from.x) * eased,
      y: from.y + (NEIGHBOUR.y - from.y) * eased,
      from
    };
  }

  hint() {
    const level = this.game.save.bumpHint('garden');
    const index = Math.min(level, GARDEN.hintLines.length) - 1;
    this.say([{ who: 'theo', mood: 'sly', text: GARDEN.hintLines[index] }]);
  }

  celebrateFragment() {
    this.playAnim('success', 1.1);
    this.particles.burst(DAIS.x, DAIS.y - 60, 40, {
      color: [PALETTE.goldLight, PALETTE.lavenderLight], speed: 70, life: 1.6, size: 3, shape: 'star', gravity: -12
    });
  }

  drawBehind(ctx, time) {
    // Clouds drift behind the castle before the moon and the stars.
    drawClouds(ctx, { x: 0, y: 40, width: WORLD.width, height: 150 }, time, THEME.cloud, 5, 21);
    drawMoon(ctx, 220, 92, 34, time);
    drawPersonalStar(ctx, STAR.x, STAR.y, time, 1.25);

    for (const lantern of LANTERNS) {
      if (this.lit[lantern.id]) {
        drawLightPool(ctx, lantern.x, lantern.y + 4, 130, PALETTE.goldLight, 0.9);
      }
    }

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
      glow.addColorStop(0, 'rgba(255,248,226,0.9)');
      glow.addColorStop(0.35, rgba(PALETTE.goldLight, 0.45));
      glow.addColorStop(0.7, rgba(PALETTE.lavender, 0.22));
      glow.addColorStop(1, rgba(PALETTE.lavender, 0));
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
      const point = this.#beamPoint();
      const from = point.from;
      const x = point.x;
      const y = point.y;

      ctx.save();
      const trail = ctx.createLinearGradient(from.x, from.y, x, y);
      trail.addColorStop(0, rgba(PALETTE.lavender, 0));
      trail.addColorStop(0.6, rgba(PALETTE.lavenderLight, 0.3));
      trail.addColorStop(1, rgba(PALETTE.goldLight, 0.65));
      ctx.strokeStyle = trail;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      const glow = ctx.createRadialGradient(x, y, 0, x, y, 30);
      glow.addColorStop(0, 'rgba(255,253,244,0.95)');
      glow.addColorStop(0.4, rgba(PALETTE.goldLight, 0.4));
      glow.addColorStop(1, rgba(PALETTE.lavender, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
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
        drawFlowerCluster(ctx, x, y, 0.9 + random() * 0.5,
          [PALETTE.lavender, PALETTE.lavenderLight, PALETTE.goldLight], 800 + i, 3);
      }
      ctx.restore();
    }
  }
}

/** Blank lines in the configured message become separate paragraphs. */
function splitParagraphs(text) {
  return String(text).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}
