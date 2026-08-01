/**
 * Chapter one — The Whispering Woods.
 *
 * An open forest to wander, three hidden moonflowers, a signpost that tells
 * you roughly where they are, and several woodland residents with opinions.
 */

import { WorldScene } from '../engine/worldScene.js';
import { createBuffer } from '../engine/renderer.js';
import {
  paintGround, paintNightSky, paintStonePath, drawTree, drawMushroom, drawFlowerCluster,
  drawFern, drawLantern, drawMoon, drawPersonalStar, drawArch, drawThreeStars,
  paintMist, drawLightPool, makeRandom, makeSprite, rgba, mix, starPath
} from '../engine/art.js';
import { SCENE_THEMES, PALETTE } from '../engine/theme.js';
import { drawFrog, drawBird, drawChattyFlowers } from '../engine/sprites.js';
import { WOODS } from '../data/dialogue.js';
import { GOSSIP } from '../data/gossip.js';
import { CHAPTER_TITLES } from '../engine/game.js';

const WORLD = { width: 1500, height: 1000 };

/** Where the walkable forest floor begins; everything above is sky and river. */
const SHORE_Y = 300;

const MOONFLOWERS = [
  { id: 'stream', x: 620, y: 345, label: 'Gather the moonflower' },
  { id: 'stones', x: 1230, y: 600, label: 'Gather the moonflower' },
  { id: 'hollow', x: 300, y: 862, label: 'Gather the moonflower' }
];

const LANDMARKS = {
  signpost: { x: 700, y: 690 },
  starGap: { x: 470, y: 336 },
  lanterns: { x: 980, y: 520 },
  frog: { x: 810, y: 352 },
  flowers: { x: 1080, y: 830 },
  bird: { x: 420, y: 618 },
  arch: { x: 1432, y: 520 },
  stones: { x: 1230, y: 640 },
  log: { x: 300, y: 880 }
};

const THEME = SCENE_THEMES.woods;
const TREE = THEME.tree;

export class WoodsScene extends WorldScene {
  constructor(game) {
    super(game);
    this.world = WORLD;
    this.skyColor = THEME.skyTop;
    this.vignetteStrength = THEME.vignette;
    this.atmosphere = PALETTE.moonlit;
    this.atmosphereStrength = 0.045;
    Object.assign(this.player, { x: 700, y: 790, facing: 'up', moving: false, walkTime: 0 });
    Object.assign(this.theo, { x: 660, y: 812, visible: true, mood: 'happy', facing: 'right' });
  }

  async enter(payload = {}) {
    const game = this.game;
    game.save.setChapter('woods');
    game.audio.setMood('woods');
    game.ui.setChapter(CHAPTER_TITLES.woods, '');
    game.ui.setFragments(game.save.progress.fragments.length);

    this.#buildSprites();
    this.background = this.#paintBackground();
    this.#buildColliders();
    this.#buildScenery();
    this.#buildInteractables();
    this.#refreshObjective();

    this.lightPools = [
      { x: 430, y: 520, r: 120 }, { x: 900, y: 430, r: 150 },
      { x: 1180, y: 760, r: 130 }, { x: 640, y: 880, r: 110 },
      { x: 240, y: 640, r: 100 }
    ];
    this.seedTufts({
      count: 150,
      bounds: { x: 20, y: SHORE_Y + 10, width: WORLD.width - 40, height: WORLD.height - SHORE_Y - 30 },
      colors: ['#3f7d5c', '#356b4c', '#4b8f68'],
      blooms: THEME.flowers,
      seed: 4711
    });
    this.foreground = this.#buildForeground();

    this.drifts = [];
    this.addDrift({
      count: 46,
      bounds: { x: 0, y: SHORE_Y, width: WORLD.width, height: WORLD.height - SHORE_Y },
      style: 'firefly',
      palette: { core: '#ffe38f' }
    });
    this.addDrift({
      count: 24,
      bounds: { x: 0, y: SHORE_Y - 40, width: WORLD.width, height: WORLD.height - SHORE_Y },
      style: 'fall',
      palette: { core: '#5f8f6a' }
    });

    this.game.renderer.snapCamera(this.player.x, this.player.y - 20, this.world);
  }

  async begin(payload = {}) {
    const save = this.game.save;
    if (!save.hasFlag('metTheo')) {
      await this.#openingConversation();
    } else if (payload.continued) {
      await this.say([{ who: 'theo', text: 'Back again. Good. The woods were beginning to worry, and so, frankly, was I.' }]);
    }

    // If the page was closed between gathering the last moonflower and being
    // given the fragment, finish the ceremony now rather than stranding her.
    const allFound = save.progress.moonflowers.length === MOONFLOWERS.length;
    if (allFound && !save.hasFlag('woodsComplete')) {
      await this.#finishChapter();
    }
  }

  /** Branches hanging into frame, drawn over everything with a slight drift. */
  #buildForeground() {
    return makeSprite({
      width: 330, height: 230, anchorX: 0, anchorY: 0,
      paint: (ctx) => {
        const random = makeRandom(6161);
        ctx.strokeStyle = '#1a1416';
        ctx.lineCap = 'round';
        for (let branch = 0; branch < 3; branch++) {
          const y = -20 + branch * 34;
          ctx.lineWidth = 9 - branch * 2;
          ctx.beginPath();
          ctx.moveTo(-30, y);
          ctx.quadraticCurveTo(120, y + 40 + branch * 10, 250 - branch * 40, y + 20 + branch * 30);
          ctx.stroke();
          for (let leaf = 0; leaf < 12; leaf++) {
            const t = 0.15 + random() * 0.85;
            const lx = -30 + (280 - branch * 40) * t;
            const ly = y + (40 + branch * 12) * t * (0.7 + random() * 0.5);
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(random() * Math.PI);
            ctx.fillStyle = random() < 0.5 ? '#16332a' : '#1d4234';
            ctx.beginPath();
            ctx.ellipse(0, 0, 16 + random() * 12, 8 + random() * 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    });
  }

  /* ------------------------------------------------------------- scenery */

  #buildSprites() {
    const random = makeRandom(4242);
    this.treeSprites = [];
    for (let i = 0; i < 5; i++) {
      const scale = 1.05 + random() * 0.55;
      this.treeSprites.push(makeSprite({
        width: 150 * scale,
        height: 150 * scale,
        anchorX: 75 * scale,
        anchorY: 136 * scale,
        paint: (ctx) => drawTree(ctx, 0, 0, scale, TREE, 900 + i)
      }));
    }

    this.stoneSprite = makeSprite({
      width: 200, height: 150, anchorX: 100, anchorY: 120,
      paint: (ctx) => {
        const random2 = makeRandom(77);
        for (const [sx, sy, sw, sh] of [[-62, 0, 34, 96], [0, 6, 40, 112], [58, 0, 32, 88]]) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(sx, sy + 4, sw * 0.7, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = mix('#7c7a86', '#ffffff', random2() * 0.2);
          ctx.beginPath();
          ctx.moveTo(sx - sw / 2, sy);
          ctx.lineTo(sx - sw / 2 + 4, sy - sh);
          ctx.lineTo(sx + sw / 2 - 5, sy - sh + 6);
          ctx.lineTo(sx + sw / 2, sy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(sx - sw / 2 + 3, sy - sh + 8, 6, sh - 12);
          // Three small stars carved into each stone.
          ctx.fillStyle = 'rgba(221,229,242,0.5)';
          for (let k = 0; k < 3; k++) {
            starPath(ctx, sx, sy - sh * 0.62 + k * 12, 3.4);
            ctx.fill();
          }
        }
      }
    });

    this.logSprite = makeSprite({
      width: 190, height: 90, anchorX: 95, anchorY: 66,
      paint: (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(0, 4, 84, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a3630';
        ctx.beginPath();
        ctx.roundRect(-82, -44, 164, 48, 22);
        ctx.fill();
        ctx.fillStyle = '#5c4438';
        ctx.beginPath();
        ctx.ellipse(-80, -20, 14, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#241a18';
        ctx.beginPath();
        ctx.ellipse(-80, -20, 8, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3d5f42';
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(i * 22, -44, 14, 6, 0, Math.PI, Math.PI * 2);
          ctx.fill();
        }
        drawMushroom(ctx, 34, -40, 0.9, { cap: '#c0564f', stem: '#e8dcc0' }, 12);
        drawMushroom(ctx, 56, -38, 0.7, { cap: '#c0564f', stem: '#e8dcc0' }, 13);
      }
    });

    this.signSprite = makeSprite({
      width: 120, height: 130, anchorX: 60, anchorY: 116,
      paint: (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.rotate(-0.06);
        ctx.fillStyle = '#5b4130';
        ctx.fillRect(-4, -78, 8, 78);
        ctx.fillStyle = '#7d5c40';
        ctx.beginPath();
        ctx.roundRect(-38, -96, 76, 30, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let i = 0; i < 3; i++) ctx.fillRect(-28, -88 + i * 8, 44 - i * 8, 3);
        ctx.restore();
      }
    });
  }

  #paintBackground() {
    const { width, height } = WORLD;
    return createBuffer(width, height, (ctx) => {
      // Sky and distant treeline along the top of the map.
      paintNightSky(ctx, width, SHORE_Y, { top: THEME.skyTop, bottom: THEME.skyBottom, starCount: 90, seed: 11 });
      const random = makeRandom(303);
      ctx.fillStyle = THEME.horizon;
      for (let i = 0; i < 40; i++) {
        const x = random() * width;
        const h = 40 + random() * 60;
        ctx.beginPath();
        ctx.moveTo(x - 26, 200);
        ctx.quadraticCurveTo(x, 200 - h, x + 26, 200);
        ctx.closePath();
        ctx.fill();
      }

      // Forest floor.
      const floor = createBuffer(width, height - 190, (fctx, w, h) => {
        paintGround(fctx, w, h, { base: THEME.ground, patch: THEME.groundPatch, seed: 31, patchCount: 300 });
      });
      ctx.drawImage(floor, 0, 190);

      // The stream, running west to east just below the treeline.
      const riverTop = 210;
      const riverPoints = [];
      for (let x = -20; x <= width + 20; x += 40) {
        riverPoints.push({ x, y: riverTop + Math.sin(x / 260) * 22 + 30 });
      }
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = THEME.water.deep;
      ctx.lineWidth = 78;
      ctx.beginPath();
      riverPoints.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.strokeStyle = THEME.water.mid;
      ctx.lineWidth = 62;
      ctx.beginPath();
      riverPoints.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.strokeStyle = rgba(THEME.water.foam, 0.25);
      ctx.lineWidth = 6;
      ctx.beginPath();
      riverPoints.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y - 18) : ctx.moveTo(p.x, p.y - 18)));
      ctx.stroke();
      ctx.restore();
      this.riverPoints = riverPoints;

      // Pebbled bank.
      const bankRandom = makeRandom(64);
      for (let i = 0; i < 220; i++) {
        const x = bankRandom() * width;
        const y = riverTop + Math.sin(x / 260) * 22 + 68 + bankRandom() * 16;
        ctx.fillStyle = rgba('#8d8676', 0.5 + bankRandom() * 0.3);
        ctx.beginPath();
        ctx.ellipse(x, y, 2 + bankRandom() * 4, 1.5 + bankRandom() * 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // The old path from the clearing to the eastern archway.
      paintStonePath(ctx, [
        { x: 700, y: 900 }, { x: 760, y: 760 }, { x: 900, y: 690 },
        { x: 1080, y: 640 }, { x: 1250, y: 560 }, { x: 1430, y: 520 }
      ], { width: 44, stone: '#8b8375', grout: '#3d4f39', seed: 88 });

      // Undergrowth.
      const detail = makeRandom(5150);
      for (let i = 0; i < 160; i++) {
        const x = detail() * width;
        const y = SHORE_Y + detail() * (height - SHORE_Y - 20);
        const roll = detail();
        if (roll < 0.35) drawFern(ctx, x, y, 0.7 + detail() * 0.7, '#2c6247', 400 + i);
        else if (roll < 0.6) drawFlowerCluster(ctx, x, y, 0.7 + detail() * 0.5, THEME.flowers, 500 + i, 3);
        else if (roll < 0.78) drawMushroom(ctx, x, y, 0.7 + detail() * 0.6, { cap: '#b8524d', stem: '#e6dcc4' }, 600 + i);
      }

      // Deep shade under the canopy at the north edge, thinning southwards.
      const shade = ctx.createLinearGradient(0, SHORE_Y, 0, SHORE_Y + 220);
      shade.addColorStop(0, rgba(THEME.canopy, 0.5));
      shade.addColorStop(1, rgba(THEME.canopy, 0));
      ctx.fillStyle = shade;
      ctx.fillRect(0, SHORE_Y, width, 220);

      paintMist(ctx, width, height, THEME.mist, 17, 6);
    });
  }

  #buildColliders() {
    this.colliders = [];
    // Everything above the shoreline — treeline, sky and water — is off limits.
    this.addCollider(-80, -80, WORLD.width + 160, SHORE_Y + 80);
    this.addBoundaryWalls(6);

    // Landmarks the player should walk around rather than through.
    this.addCollider(LANDMARKS.stones.x - 92, LANDMARKS.stones.y - 30, 184, 34);
    this.addCollider(LANDMARKS.log.x - 84, LANDMARKS.log.y - 26, 168, 30);

    // Trees, placed so they never crowd anything the player needs to reach.
    const clearPoints = [
      ...MOONFLOWERS,
      ...Object.values(LANDMARKS),
      { x: 700, y: 790 },
      { x: 1430, y: 520 }
    ];
    const random = makeRandom(2024);
    this.trees = [];
    let guard = 0;
    while (this.trees.length < 38 && guard < 4000) {
      guard += 1;
      const x = 40 + random() * (WORLD.width - 80);
      const y = SHORE_Y + 20 + random() * (WORLD.height - SHORE_Y - 60);
      if (clearPoints.some((p) => Math.hypot(p.x - x, p.y - y) < 120)) continue;
      if (this.trees.some((t) => Math.hypot(t.x - x, t.y - y) < 130)) continue;
      // Keep the stone path walkable.
      if (Math.abs(y - (900 - (x - 700) * 0.28)) < 60 && x > 640) continue;
      const sprite = this.treeSprites[Math.floor(random() * this.treeSprites.length)];
      this.trees.push({ x, y, sprite });
      this.addCollider(x - 13, y - 10, 26, 14);
    }
  }

  #buildScenery() {
    this.entities = [];
    for (const tree of this.trees) {
      this.addEntity({ y: tree.y, draw: (ctx) => tree.sprite.draw(ctx, tree.x, tree.y) });
    }
    this.addEntity({ y: LANDMARKS.stones.y, draw: (ctx) => this.stoneSprite.draw(ctx, LANDMARKS.stones.x, LANDMARKS.stones.y) });
    this.addEntity({ y: LANDMARKS.log.y, draw: (ctx) => this.logSprite.draw(ctx, LANDMARKS.log.x, LANDMARKS.log.y) });
    this.addEntity({ y: LANDMARKS.signpost.y, draw: (ctx) => this.signSprite.draw(ctx, LANDMARKS.signpost.x, LANDMARKS.signpost.y) });

    // Three lanterns on a low branch, lighting one after another.
    this.addEntity({
      y: LANDMARKS.lanterns.y,
      draw: (ctx, time) => {
        const { x, y } = LANDMARKS.lanterns;
        ctx.strokeStyle = '#4a3628';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - 60, y - 96);
        ctx.quadraticCurveTo(x, y - 116, x + 60, y - 92);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          // A rolling cycle so exactly one lantern leads at any moment.
          const phase = (time * 0.6 + i * (1 / 3)) % 1;
          const lit = phase < 0.75;
          drawLantern(ctx, x - 44 + i * 44, y - 60 + Math.abs(i - 1) * 6, 1, lit, time + i);
        }
      }
    });

    // Woodland residents.
    this.addEntity({ y: LANDMARKS.frog.y, draw: (ctx, time) => drawFrog(ctx, { x: LANDMARKS.frog.x, y: LANDMARKS.frog.y, time, scale: 1 }) });
    this.addEntity({ y: LANDMARKS.flowers.y, draw: (ctx, time) => drawChattyFlowers(ctx, { x: LANDMARKS.flowers.x, y: LANDMARKS.flowers.y, time, scale: 1.1 }) });
    this.addEntity({ y: LANDMARKS.bird.y, draw: (ctx, time) => drawBird(ctx, { x: LANDMARKS.bird.x, y: LANDMARKS.bird.y, time, scale: 1.2 }) });

    // The archway east, which only opens once the first fragment is found.
    this.addEntity({
      y: LANDMARKS.arch.y,
      draw: (ctx, time) => {
        const open = this.game.save.hasFlag('woodsComplete');
        drawArch(ctx, LANDMARKS.arch.x, LANDMARKS.arch.y + 10, 1.2, {
          stoneDark: '#5c5566',
          doorway: open ? '#2a1f36' : '#1a1626'
        }, open ? rgba('#e9b45f', 0.32) : null);
        drawThreeStars(ctx, LANDMARKS.arch.x, LANDMARKS.arch.y - 118, 0.9, '#dde5f2',
          [open, open, open], time);
      }
    });

    // Moonflowers still waiting to be found.
    for (const flower of MOONFLOWERS) {
      this.addEntity({
        y: flower.y,
        hidden: () => this.game.save.has('moonflowers', flower.id),
        draw: (ctx, time) => drawMoonflower(ctx, flower.x, flower.y, time)
      });
    }
  }

  #buildInteractables() {
    this.interactables = [];

    for (const flower of MOONFLOWERS) {
      this.addInteractable({
        id: `flower-${flower.id}`,
        x: flower.x,
        y: flower.y,
        radius: 46,
        promptOffset: -40,
        label: 'Gather',
        available: () => !this.game.save.has('moonflowers', flower.id),
        onInteract: () => this.#collect(flower)
      });
    }

    this.addInteractable({
      id: 'signpost',
      x: LANDMARKS.signpost.x, y: LANDMARKS.signpost.y,
      label: 'Read', promptOffset: -110,
      onInteract: () => this.say(WOODS.clues.signpost)
    });

    this.addInteractable({
      id: 'starGap',
      x: LANDMARKS.starGap.x, y: LANDMARKS.starGap.y,
      label: 'Look up', promptOffset: -60,
      onInteract: () => this.say(WOODS.clues.star)
    });

    this.addInteractable({
      id: 'lanterns',
      x: LANDMARKS.lanterns.x, y: LANDMARKS.lanterns.y,
      label: 'Watch', promptOffset: -90,
      onInteract: () => this.say(WOODS.clues.lanterns)
    });

    this.#addGossip('frog', GOSSIP.frog, LANDMARKS.frog, -46);
    this.#addGossip('flowers', GOSSIP.flowers, LANDMARKS.flowers, -54);
    this.#addGossip('bird', GOSSIP.bird, LANDMARKS.bird, -46);

    this.addInteractable({
      id: 'theo',
      x: 0, y: 0, radius: 54, label: 'Talk', promptOffset: -46,
      onInteract: () => this.say(this.#theoChat())
    });

    this.addInteractable({
      id: 'arch',
      x: LANDMARKS.arch.x - 30, y: LANDMARKS.arch.y,
      radius: 70, label: 'Go on', promptOffset: -130,
      available: () => this.game.save.hasFlag('woodsComplete'),
      onInteract: () => this.#leave()
    });
  }

  #addGossip(id, entry, position, offset) {
    this.addInteractable({
      id,
      x: position.x, y: position.y,
      radius: 48, label: 'Listen', promptOffset: offset,
      onInteract: async () => {
        const first = !this.game.save.has('gossipHeard', entry.id);
        await this.say(first ? entry.lines : entry.repeat);
        if (first) this.game.save.addToSet('gossipHeard', entry.id);
      }
    });
  }

  #theoChat() {
    const remaining = MOONFLOWERS.filter((f) => !this.game.save.has('moonflowers', f.id));
    if (remaining.length === 0 && this.game.save.hasFlag('woodsComplete')) return WOODS.toCottage;
    if (remaining.length === 3) return [{ who: 'theo', text: 'Three moonflowers. The signpost near the clearing lists where they like to grow — whoever carved it was oddly specific.' }];
    if (remaining.length === 2) return [{ who: 'theo', mood: 'happy', text: 'One down. Two to go. I am pacing myself so as not to peak too early with the encouragement.' }];
    return [{ who: 'theo', mood: 'proud', text: 'One left. I can feel it. Admittedly I can feel it because I can see it from here, but still.' }];
  }

  /* -------------------------------------------------------------- actions */

  async #openingConversation() {
    const choice = await this.say(WOODS.theoIntro);
    if (choice === 'who') await this.say(WOODS.theoWhoSent);
    await this.say(WOODS.theoTutorial);
    this.game.save.setFlag('metTheo');
    this.#refreshObjective();
  }

  async #collect(flower) {
    if (this.game.save.has('moonflowers', flower.id)) return;
    this.game.save.addToSet('moonflowers', flower.id);
    this.game.audio.collect();
    this.playAnim('collect', 0.7);
    this.cheerTheo('delighted', 0.9);
    if (!this.game.settings.reducedMotion) this.game.renderer.emphasise(0.07);
    this.particles.burst(flower.x, flower.y - 16, 30, {
      color: [PALETTE.lavenderLight, '#f6f0ff', PALETTE.lavender, PALETTE.goldLight],
      speed: 64, life: 1.3, size: 2.6, shape: 'star', gravity: -18
    });
    this.#refreshObjective();
    await this.say(WOODS.moonflowers[flower.id]);

    if (this.game.save.progress.moonflowers.length === MOONFLOWERS.length) {
      await this.#finishChapter();
    }
  }

  async #finishChapter() {
    await this.say(WOODS.complete);
    await this.game.awardFragment('woods', WOODS.fragment);
    this.game.save.setFlag('woodsComplete');
    this.#refreshObjective();
    await this.say(WOODS.toCottage);
  }

  async #leave() {
    this.busy = true;
    await this.game.advanceTo('cottage');
  }

  #refreshObjective() {
    const found = this.game.save.progress.moonflowers.length;
    if (this.game.save.hasFlag('woodsComplete')) {
      this.game.ui.setObjective('Follow the path east to the cottage');
    } else {
      this.game.ui.setObjective(`Moonflowers: ${found} of 3`);
    }
  }

  celebrateFragment() {
    this.playAnim('success', 1.1);
    this.cheerTheo('proud', 1);
    this.particles.burst(this.player.x, this.player.y - 40, 60, {
      color: [PALETTE.goldLight, PALETTE.lavenderLight, PALETTE.lavender],
      speed: 90, life: 1.8, size: 3, shape: 'star', gravity: -14
    });
  }

  hint() {
    const remaining = MOONFLOWERS.filter((f) => !this.game.save.has('moonflowers', f.id));
    const level = this.game.save.bumpHint('woods');
    if (this.game.save.hasFlag('woodsComplete')) {
      this.say([{ who: 'theo', text: 'East, through the archway with the three stars above it. I will be right behind you, valiantly.' }]);
      return;
    }
    if (level === 1 || remaining.length === 0) {
      this.say([{ who: 'theo', text: 'There is a signpost near where we started. It lists all three, in a very confident hand.' }]);
      return;
    }
    const index = MOONFLOWERS.findIndex((f) => f.id === remaining[0].id);
    this.say([{ who: 'theo', mood: 'sly', text: WOODS.hintLines[index] }]);
  }

  /* -------------------------------------------------------------- drawing */

  updateScene() {
    // Theo is always interactable, wherever he happens to be hovering.
    const theoTarget = this.interactables.find((i) => i.id === 'theo');
    if (theoTarget) {
      theoTarget.x = this.theo.x;
      theoTarget.y = this.theo.y;
    }
  }

  drawBehind(ctx, time) {
    // Moon and the personal star sit in the strip of sky above the treeline.
    drawMoon(ctx, 1180, 70, 30, time);
    drawPersonalStar(ctx, 470, 96, time, 1.15);

    // Warm pools under the lanterns and the doorway east.
    drawLightPool(ctx, LANDMARKS.lanterns.x, LANDMARKS.lanterns.y + 6, 130, PALETTE.goldLight, 0.9);
    if (this.game.save.hasFlag('woodsComplete')) {
      drawLightPool(ctx, LANDMARKS.arch.x - 10, LANDMARKS.arch.y + 12, 120, PALETTE.goldLight, 0.85);
    }

    // Moving highlights on the water.
    if (!this.riverPoints) return;
    ctx.save();
    ctx.strokeStyle = rgba('#bfeaf5', 0.3);
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      this.riverPoints.forEach((p, index) => {
        const wobble = Math.sin(time * 1.4 + index * 0.5 + i * 2) * 6;
        const y = p.y + wobble + (i - 1) * 16;
        if (index === 0) ctx.moveTo(p.x, y); else ctx.lineTo(p.x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** A moonflower: pale petals with a soft, breathing halo. */
function drawMoonflower(ctx, x, y, time) {
  const pulse = 0.7 + Math.sin(time * 2 + x * 0.01) * 0.3;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y - 16, 0, x, y - 16, 44 * pulse);
  glow.addColorStop(0, rgba(PALETTE.lavenderLight, 0.6));
  glow.addColorStop(0.5, rgba(PALETTE.lavender, 0.25));
  glow.addColorStop(1, rgba(PALETTE.lavender, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 16, 44 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#3f6b52';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 3, y - 10, x, y - 18);
  ctx.stroke();

  ctx.fillStyle = '#f3eeff';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.sin(time * 0.6) * 0.1;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 5.5, y - 18 + Math.sin(a) * 5.5, 4.6, 3, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.lavender;
  ctx.beginPath();
  ctx.arc(x, y - 18, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
