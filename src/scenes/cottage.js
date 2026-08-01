/**
 * Chapter two — The Enchanted Cottage.
 *
 * A small garden in front of a cottage with a crooked chimney. Three guardians
 * wait on the lawn, each willing to explain exactly how to beat them, and the
 * second fragment hangs in the lantern above the door.
 */

import { WorldScene } from '../engine/worldScene.js';
import { createBuffer } from '../engine/renderer.js';
import {
  paintGround, paintNightSky, paintStonePath, drawTree, drawCottage, drawFlowerCluster,
  drawMushroom, drawFern, drawLantern, drawLampPost, drawMoon, drawPersonalStar,
  drawArch, drawThreeStars, drawVine, paintMist, drawLightPool,
  makeRandom, makeSprite, rgba, starPath
} from '../engine/art.js';
import { SCENE_THEMES, PALETTE } from '../engine/theme.js';
import { drawGuardian } from '../engine/sprites.js';
import { COTTAGE } from '../data/dialogue.js';
import { runGuardianTrial } from '../puzzles/panels.js';
import { CHAPTER_TITLES } from '../engine/game.js';

const WORLD = { width: 1240, height: 860 };
const SHORE_Y = 250;

const SPOTS = {
  cottage: { x: 620, y: 400 },
  door: { x: 620, y: 412 },
  stone: { x: 330, y: 610 },
  scroll: { x: 620, y: 690 },
  shears: { x: 910, y: 610 },
  kettle: { x: 250, y: 420 },
  shelf: { x: 980, y: 430 },
  journal: { x: 430, y: 760 },
  portrait: { x: 790, y: 404 },
  exit: { x: 1180, y: 470 }
};

const THEME = SCENE_THEMES.cottage;
const TREE_PALETTE = THEME.tree;

export class CottageScene extends WorldScene {
  constructor(game) {
    super(game);
    this.world = WORLD;
    this.skyColor = THEME.skyTop;
    this.vignetteStrength = THEME.vignette;
    this.atmosphere = PALETTE.amber;
    this.atmosphereStrength = 0.05;
    Object.assign(this.player, { x: 620, y: 790, facing: 'up', moving: false, walkTime: 0 });
    Object.assign(this.theo, { x: 580, y: 810, visible: true, mood: 'happy', facing: 'up' });
    this.guardiansMet = new Set();
  }

  async enter(payload = {}) {
    const game = this.game;
    game.save.setChapter('cottage');
    game.audio.setMood('cottage');
    game.ui.setChapter(CHAPTER_TITLES.cottage, '');
    game.ui.setFragments(game.save.progress.fragments.length);

    if (game.save.hasFlag('guardiansGreeted')) {
      this.guardiansMet = new Set(['stone', 'scroll', 'shears']);
    }

    this.#buildSprites();
    this.background = this.#paintBackground();
    this.#buildColliders();
    this.#buildScenery();
    this.#buildInteractables();
    this.#refreshObjective();

    // Warm light spills from the windows, the lamps and the doorway.
    this.lightPools = [
      { x: SPOTS.cottage.x - 56, y: SPOTS.cottage.y + 40, r: 110 },
      { x: SPOTS.cottage.x + 56, y: SPOTS.cottage.y + 40, r: 110 },
      { x: 200, y: 566, r: 90 }, { x: 1040, y: 566, r: 90 }
    ];
    this.seedTufts({
      count: 110,
      bounds: { x: 20, y: SHORE_Y + 10, width: WORLD.width - 40, height: WORLD.height - SHORE_Y - 30 },
      colors: ['#3f7d5c', '#4b8f68'],
      blooms: THEME.flowers,
      seed: 2211
    });

    this.drifts = [];
    this.addDrift({
      count: 30,
      bounds: { x: 0, y: SHORE_Y, width: WORLD.width, height: WORLD.height - SHORE_Y },
      style: 'firefly',
      palette: { core: '#ffdf9a' }
    });
    this.addDrift({
      count: 20,
      bounds: { x: 0, y: SHORE_Y, width: WORLD.width, height: WORLD.height - SHORE_Y },
      style: 'rise',
      palette: { core: '#ffd0a8' }
    });

    game.renderer.snapCamera(this.player.x, this.player.y - 20, this.world);
  }

  async begin(payload = {}) {
    const game = this.game;
    if (!game.save.hasFlag('cottageArrived')) {
      await this.say(COTTAGE.arrive);
      game.save.setFlag('cottageArrived');
    } else if (payload.continued) {
      await this.say([{ who: 'theo', text: 'The cottage again. Still warm. Still smells like somebody is expecting us.' }]);
    }
  }

  /* ------------------------------------------------------------- scenery */

  #buildSprites() {
    const random = makeRandom(818);
    this.treeSprites = [];
    for (let i = 0; i < 4; i++) {
      const scale = 1.0 + random() * 0.5;
      this.treeSprites.push(makeSprite({
        width: 150 * scale, height: 150 * scale, anchorX: 75 * scale, anchorY: 136 * scale,
        paint: (ctx) => drawTree(ctx, 0, 0, scale, TREE_PALETTE, 700 + i)
      }));
    }

    this.tableSprite = makeSprite({
      width: 130, height: 110, anchorX: 65, anchorY: 84,
      paint: (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 42, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b4d33';
        ctx.fillRect(-34, -30, 6, 30);
        ctx.fillRect(28, -30, 6, 30);
        ctx.fillStyle = '#8a6543';
        ctx.beginPath();
        ctx.roundRect(-46, -40, 92, 12, 4);
        ctx.fill();
        // Copper kettle and two mismatched cups.
        ctx.fillStyle = '#c2793c';
        ctx.beginPath();
        ctx.ellipse(-12, -50, 15, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a6602c';
        ctx.beginPath();
        ctx.moveTo(0, -56);
        ctx.quadraticCurveTo(16, -60, 18, -50);
        ctx.lineTo(14, -50);
        ctx.quadraticCurveTo(12, -55, 0, -52);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e8ddc4';
        ctx.beginPath();
        ctx.ellipse(16, -44, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cfd8e8';
        ctx.beginPath();
        ctx.ellipse(30, -43, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.shelfSprite = makeSprite({
      width: 120, height: 130, anchorX: 60, anchorY: 96,
      paint: (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 34, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b4d33';
        ctx.fillRect(-30, -78, 60, 78);
        ctx.fillStyle = '#4f3826';
        for (let i = 0; i < 3; i++) ctx.fillRect(-32, -74 + i * 26, 64, 5);
        const jars = ['#c8e0d0', '#e8d8a8', '#e2c0c8', '#c8c0e8', '#d8e8c0', '#e8d0b0'];
        for (let i = 0; i < 6; i++) {
          const col = i % 3;
          const row = Math.floor(i / 3);
          ctx.fillStyle = jars[i];
          ctx.beginPath();
          ctx.roundRect(-26 + col * 19, -70 + row * 26, 14, 18, 3);
          ctx.fill();
          ctx.fillStyle = '#7a5c3c';
          ctx.fillRect(-26 + col * 19, -72 + row * 26, 14, 4);
        }
      }
    });

    this.benchSprite = makeSprite({
      width: 130, height: 90, anchorX: 65, anchorY: 62,
      paint: (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 46, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7b5a3c';
        ctx.fillRect(-44, -22, 88, 9);
        ctx.fillRect(-38, -13, 7, 13);
        ctx.fillRect(31, -13, 7, 13);
        ctx.fillRect(-44, -44, 88, 7);
        ctx.fillRect(-42, -44, 6, 24);
        ctx.fillRect(36, -44, 6, 24);
        // An open journal left on the seat.
        ctx.fillStyle = '#f2e6cb';
        ctx.beginPath();
        ctx.moveTo(-16, -24);
        ctx.quadraticCurveTo(0, -30, 16, -24);
        ctx.lineTo(16, -30);
        ctx.quadraticCurveTo(0, -36, -16, -30);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#b6a077';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-12, -32 + i * 3);
          ctx.lineTo(-2, -31 + i * 3);
          ctx.moveTo(3, -31 + i * 3);
          ctx.lineTo(13, -32 + i * 3);
          ctx.stroke();
        }
      }
    });

    this.portraitSprite = makeSprite({
      width: 70, height: 90, anchorX: 35, anchorY: 70,
      paint: (ctx) => {
        ctx.fillStyle = '#c9a15c';
        ctx.beginPath();
        ctx.roundRect(-22, -62, 44, 52, 5);
        ctx.fill();
        ctx.fillStyle = '#2a3f6b';
        ctx.beginPath();
        ctx.roundRect(-18, -58, 36, 44, 3);
        ctx.fill();
        // A very small bear, standing very straight.
        ctx.fillStyle = '#6f9ee8';
        ctx.beginPath();
        ctx.ellipse(0, -26, 10, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, -40, 10, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(side * 8, -46, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#e9b45f';
        ctx.beginPath();
        ctx.moveTo(-6, -48);
        ctx.lineTo(-3, -54);
        ctx.lineTo(0, -49);
        ctx.lineTo(3, -54);
        ctx.lineTo(6, -48);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#dde5f2';
        starPath(ctx, -4, -24, 1.8);
        ctx.fill();
        starPath(ctx, 5, -30, 1.6);
        ctx.fill();
      }
    });
  }

  #paintBackground() {
    const { width, height } = WORLD;
    return createBuffer(width, height, (ctx) => {
      paintNightSky(ctx, width, SHORE_Y, { top: THEME.skyTop, bottom: THEME.skyBottom, starCount: 70, seed: 23 });

      const random = makeRandom(515);
      ctx.fillStyle = THEME.horizon;
      for (let i = 0; i < 34; i++) {
        const x = random() * width;
        const h = 44 + random() * 60;
        ctx.beginPath();
        ctx.moveTo(x - 26, 190);
        ctx.quadraticCurveTo(x, 190 - h, x + 26, 190);
        ctx.closePath();
        ctx.fill();
      }

      const lawn = createBuffer(width, height - 170, (lctx, w, h) => {
        paintGround(lctx, w, h, { base: THEME.ground, patch: THEME.groundPatch, seed: 61, patchCount: 260 });
      });
      ctx.drawImage(lawn, 0, 170);

      paintStonePath(ctx, [
        { x: 620, y: 840 }, { x: 620, y: 700 }, { x: 620, y: 500 }, { x: 620, y: 430 }
      ], { width: 52, stone: '#9a9082', grout: '#3f5a45', seed: 12 });
      paintStonePath(ctx, [
        { x: 700, y: 470 }, { x: 900, y: 480 }, { x: 1180, y: 470 }
      ], { width: 40, stone: '#9a9082', grout: '#3f5a45', seed: 14 });

      // A low fence marking the garden.
      ctx.strokeStyle = '#6b4f36';
      ctx.lineWidth = 5;
      for (const [x1, x2, y] of [[60, 520, 520], [720, 1120, 520]]) {
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        for (let x = x1; x <= x2; x += 46) {
          ctx.beginPath();
          ctx.moveTo(x, y - 20);
          ctx.lineTo(x, y + 14);
          ctx.stroke();
        }
      }

      const detail = makeRandom(9090);
      for (let i = 0; i < 130; i++) {
        const x = detail() * width;
        const y = SHORE_Y + detail() * (height - SHORE_Y - 20);
        const roll = detail();
        if (roll < 0.4) drawFlowerCluster(ctx, x, y, 0.7 + detail() * 0.6, THEME.flowers, 700 + i, 4);
        else if (roll < 0.7) drawFern(ctx, x, y, 0.6 + detail() * 0.6, '#356b4c', 800 + i);
        else if (roll < 0.85) drawMushroom(ctx, x, y, 0.6 + detail() * 0.5, { cap: '#d4a05a', stem: '#efe3c8' }, 900 + i);
      }

      // Vines climbing the garden posts.
      drawVine(ctx, [{ x: 120, y: 520 }, { x: 126, y: 480 }, { x: 118, y: 440 }, { x: 128, y: 400 }], 1.2,
        { stem: '#3d6b4f', leaf: '#4f8f63', leafDark: '#356b4c' }, 31);
      drawVine(ctx, [{ x: 1110, y: 520 }, { x: 1104, y: 478 }, { x: 1114, y: 438 }], 1.2,
        { stem: '#3d6b4f', leaf: '#4f8f63', leafDark: '#356b4c' }, 33);

      paintMist(ctx, width, height, THEME.mist, 29, 5);
    });
  }

  #buildColliders() {
    this.colliders = [];
    this.addCollider(-80, -80, WORLD.width + 160, SHORE_Y + 80);
    this.addBoundaryWalls(6);
    // The cottage itself.
    this.addCollider(SPOTS.cottage.x - 110, SPOTS.cottage.y - 60, 220, 62);
    // Furniture.
    this.addCollider(SPOTS.kettle.x - 44, SPOTS.kettle.y - 14, 88, 18);
    this.addCollider(SPOTS.shelf.x - 32, SPOTS.shelf.y - 14, 64, 18);
    this.addCollider(SPOTS.journal.x - 44, SPOTS.journal.y - 14, 88, 18);
    // Guardian plinths.
    for (const key of ['stone', 'scroll', 'shears']) {
      this.addCollider(SPOTS[key].x - 16, SPOTS[key].y - 12, 32, 14);
    }

    const clearPoints = Object.values(SPOTS).concat([{ x: 620, y: 790 }]);
    const random = makeRandom(1313);
    this.trees = [];
    let guard = 0;
    while (this.trees.length < 16 && guard < 2500) {
      guard += 1;
      const x = 40 + random() * (WORLD.width - 80);
      const y = SHORE_Y + 10 + random() * (WORLD.height - SHORE_Y - 40);
      if (clearPoints.some((p) => Math.hypot(p.x - x, p.y - y) < 160)) continue;
      if (this.trees.some((t) => Math.hypot(t.x - x, t.y - y) < 150)) continue;
      if (Math.abs(x - 620) < 90) continue; // keep the front path clear
      if (y > 440 && y < 520 && x > 700) continue; // and the path east
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

    this.addEntity({
      y: SPOTS.cottage.y,
      draw: (ctx, time) => {
        drawCottage(ctx, SPOTS.cottage.x, SPOTS.cottage.y, 1.2, {
          wall: '#e0cfa8', timber: '#6b4a30', roof: '#8a6440', door: '#7c4f2e',
          brass: '#e9b45f', window: '#ffd48a', stone: '#8a8074'
        }, time);
        // The lantern above the door holds the second fragment.
        const solved = this.game.save.hasFlag('cottageComplete');
        drawLantern(ctx, SPOTS.cottage.x, SPOTS.cottage.y - 128, 1.3, solved, time);
      }
    });

    this.addEntity({ y: SPOTS.kettle.y, draw: (ctx) => this.tableSprite.draw(ctx, SPOTS.kettle.x, SPOTS.kettle.y) });
    this.addEntity({ y: SPOTS.shelf.y, draw: (ctx) => this.shelfSprite.draw(ctx, SPOTS.shelf.x, SPOTS.shelf.y) });
    this.addEntity({ y: SPOTS.journal.y, draw: (ctx) => this.benchSprite.draw(ctx, SPOTS.journal.x, SPOTS.journal.y) });
    this.addEntity({ y: SPOTS.portrait.y, draw: (ctx) => this.portraitSprite.draw(ctx, SPOTS.portrait.x, SPOTS.portrait.y) });

    for (const key of ['stone', 'scroll', 'shears']) {
      this.addEntity({
        y: SPOTS[key].y,
        draw: (ctx, time) => drawGuardian(ctx, {
          x: SPOTS[key].x, y: SPOTS[key].y, symbol: key, time, scale: 1,
          active: this.guardiansMet.has(key)
        })
      });
    }

    this.addEntity({
      y: 300,
      draw: (ctx, time) => {
        drawLampPost(ctx, 200, 560, 1, true, time);
        drawLampPost(ctx, 1040, 560, 1, true, time + 1.1);
      }
    });

    this.addEntity({
      y: SPOTS.exit.y,
      draw: (ctx, time) => {
        const open = this.game.save.hasFlag('cottageComplete');
        drawArch(ctx, SPOTS.exit.x, SPOTS.exit.y + 10, 1.2,
          { stoneDark: '#5c5566', doorway: open ? '#2a1f36' : '#1a1626' },
          open ? rgba('#e9b45f', 0.3) : null);
        drawThreeStars(ctx, SPOTS.exit.x, SPOTS.exit.y - 118, 0.9, '#dde5f2', [open, open, open], time);
      }
    });
  }

  #buildInteractables() {
    this.interactables = [];

    for (const key of ['stone', 'scroll', 'shears']) {
      this.addInteractable({
        id: `guardian-${key}`,
        x: SPOTS[key].x, y: SPOTS[key].y,
        radius: 54, label: 'Speak', promptOffset: -76,
        onInteract: async () => {
          await this.say(COTTAGE.guardians[key]);
          this.guardiansMet.add(key);
          if (this.guardiansMet.size === 3) this.game.save.setFlag('guardiansGreeted');
          this.#refreshObjective();
        }
      });
    }

    this.addInteractable({
      id: 'door',
      x: SPOTS.door.x, y: SPOTS.door.y,
      radius: 64, label: this.game.save.hasFlag('cottageComplete') ? 'Look' : 'Begin', promptOffset: -150,
      onInteract: () => this.#beginTrial()
    });

    this.addInteractable({
      id: 'kettle', x: SPOTS.kettle.x, y: SPOTS.kettle.y,
      radius: 50, label: 'Look', promptOffset: -84,
      onInteract: () => this.say(COTTAGE.props.kettle)
    });
    this.addInteractable({
      id: 'shelf', x: SPOTS.shelf.x, y: SPOTS.shelf.y,
      radius: 50, label: 'Read labels', promptOffset: -96,
      onInteract: () => this.say(COTTAGE.props.shelf)
    });
    this.addInteractable({
      id: 'journal', x: SPOTS.journal.x, y: SPOTS.journal.y,
      radius: 50, label: 'Read', promptOffset: -66,
      onInteract: () => this.say(COTTAGE.props.journal)
    });
    this.addInteractable({
      id: 'portrait', x: SPOTS.portrait.x, y: SPOTS.portrait.y,
      radius: 46, label: 'Admire', promptOffset: -78,
      onInteract: () => this.say(COTTAGE.props.portraitWall)
    });

    this.addInteractable({
      id: 'theo', x: 0, y: 0, radius: 54, label: 'Talk', promptOffset: -46,
      onInteract: () => this.say(this.#theoChat())
    });

    this.addInteractable({
      id: 'exit', x: SPOTS.exit.x - 30, y: SPOTS.exit.y,
      radius: 70, label: 'Go on', promptOffset: -130,
      available: () => this.game.save.hasFlag('cottageComplete'),
      onInteract: () => this.#leave()
    });
  }

  #theoChat() {
    if (this.game.save.hasFlag('cottageComplete')) return COTTAGE.toHall;
    if (this.guardiansMet.size < 3) return COTTAGE.needClues;
    return COTTAGE.beforeTrial;
  }

  /* -------------------------------------------------------------- actions */

  async #beginTrial() {
    if (this.game.save.hasFlag('cottageComplete')) {
      await this.say([{ who: 'theo', text: 'The lantern is empty now. It looks rather pleased with itself about the whole thing.' }]);
      return;
    }
    if (this.guardiansMet.size < 3) {
      await this.say(COTTAGE.needClues);
      return;
    }

    await this.say(COTTAGE.beforeTrial);
    const solved = await runGuardianTrial(this.game);
    if (!solved) {
      await this.say([{ who: 'theo', text: 'Take your time. The guardians have waited four hundred years; they can manage another minute.' }]);
      return;
    }

    await this.say(COTTAGE.solved);
    await this.game.awardFragment('cottage', COTTAGE.fragment);
    this.game.save.setFlag('cottageComplete');
    this.#refreshObjective();
    const door = this.interactables.find((i) => i.id === 'door');
    if (door) door.label = 'Look';
    await this.say(COTTAGE.toHall);
  }

  async #leave() {
    this.busy = true;
    await this.game.advanceTo('hall');
  }

  #refreshObjective() {
    if (this.game.save.hasFlag('cottageComplete')) {
      this.game.ui.setObjective('Take the eastern path to the castle');
    } else if (this.guardiansMet.size < 3) {
      this.game.ui.setObjective(`Guardians heard: ${this.guardiansMet.size}/3`);
    } else {
      this.game.ui.setObjective('Begin the trial at the cottage door');
    }
  }

  celebrateFragment() {
    this.playAnim('success', 1.1);
    this.cheerTheo('proud', 1);
    if (!this.game.settings.reducedMotion) this.game.renderer.emphasise(0.06);
    this.particles.burst(SPOTS.cottage.x, SPOTS.cottage.y - 130, 54, {
      color: [PALETTE.goldLight, '#ffd48a', PALETTE.lavenderLight],
      speed: 80, life: 1.7, size: 3, shape: 'star', gravity: -12
    });
  }

  hint() {
    const level = this.game.save.bumpHint('cottage');
    if (this.game.save.hasFlag('cottageComplete')) {
      this.say([{ who: 'theo', text: 'East, past the lamps. The castle is expecting us, and the castle is never early.' }]);
      return;
    }
    const index = Math.min(level, COTTAGE.hintLines.length) - 1;
    this.say([{ who: 'theo', mood: 'sly', text: COTTAGE.hintLines[index] }]);
  }

  updateScene() {
    const theoTarget = this.interactables.find((i) => i.id === 'theo');
    if (theoTarget) {
      theoTarget.x = this.theo.x;
      theoTarget.y = this.theo.y;
    }
  }

  drawBehind(ctx, time) {
    drawMoon(ctx, 200, 66, 26, time);
    drawPersonalStar(ctx, 940, 84, time, 1.1);
    // The hearth inside throws a warm, flickering pool across the doorstep.
    const flicker = 0.85 + Math.sin(time * 3.1) * 0.1 + Math.sin(time * 7.3) * 0.05;
    drawLightPool(ctx, SPOTS.cottage.x, SPOTS.cottage.y + 34, 150, THEME.hearth, flicker);
  }
}
