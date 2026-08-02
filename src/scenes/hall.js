/**
 * Chapter three, The Monochrome Hall.
 *
 * A long gallery that lost its colour: black and white tiles, silver frames,
 * mirrored silhouettes, and one stubbornly blue bear. Joining the halves of
 * the divided mural lets the colour back in; the Storykeeper's Trial hands
 * over the final fragment.
 */

import { WorldScene } from '../engine/worldScene.js';
import { createBuffer } from '../engine/renderer.js';
import {
  paintNightSky, drawPersonalStar, drawMoon, drawArch, drawLantern,
  drawFlowerCluster, drawLightPool, paintMist, makeSprite, makeRandom, rgba, starPath, mix
} from '../engine/art.js';
import { SCENE_THEMES, PALETTE } from '../engine/theme.js';
import { drawWallPortrait } from '../engine/sprites.js';
import { HALL } from '../data/dialogue.js';
import { GOSSIP } from '../data/gossip.js';
import { runMuralPuzzle, runStorykeeperTrial } from '../puzzles/panels.js';
import { CHAPTER_TITLES } from '../engine/game.js';

const WORLD = { width: 1280, height: 780 };
const WALL_Y = 240;
const THEME = SCENE_THEMES.hall;

/**
 * Colour returns to the hall in visible stages rather than all at once:
 * a little with each mural pair, half when the mural is whole, and the rest
 * when the Storykeeper is satisfied.
 */
const COLOUR_AFTER_MURAL = 0.6;

const SPOTS = {
  mural: { x: 620, y: 262 },
  portraitLeft: { x: 300, y: 258 },
  portraitRight: { x: 950, y: 258 },
  window: { x: 1140, y: 258 },
  storykeeper: { x: 830, y: 590 },
  doors: { x: 1190, y: 470 }
};

export class HallScene extends WorldScene {
  constructor(game) {
    super(game);
    this.world = WORLD;
    this.skyColor = '#0c0b12';
    this.vignetteStrength = THEME.vignette;
    this.atmosphere = PALETTE.silver;
    this.atmosphereStrength = 0.04;
    Object.assign(this.player, { x: 420, y: 690, facing: 'up', moving: false, walkTime: 0 });
    Object.assign(this.theo, { x: 380, y: 710, visible: true, mood: 'happy', facing: 'up' });
    this.colorLevel = 0;
    this.colorTarget = 0;
  }

  async enter(payload = {}) {
    const game = this.game;
    game.save.setChapter('hall');
    game.audio.setMood('hall');
    game.ui.setChapter(CHAPTER_TITLES.hall, '');
    game.ui.setFragments(game.save.progress.fragments.length);

    this.colorTarget = game.save.hasFlag('triviaComplete') ? 1
      : game.save.hasFlag('muralComplete') ? COLOUR_AFTER_MURAL : 0;
    this.colorLevel = this.colorTarget;

    this.#buildSprites();
    this.monoBackground = this.#paintBackground(false);
    this.colourBackground = this.#paintBackground(true);
    this.#buildColliders();
    this.#buildScenery();
    this.#buildInteractables();
    this.#refreshObjective();

    this.drifts = [];
    this.addDrift({
      count: 30,
      bounds: { x: 0, y: WALL_Y, width: WORLD.width, height: WORLD.height - WALL_Y },
      style: 'rise',
      palette: { core: '#e8eefb' }
    });

    game.renderer.snapCamera(this.player.x, this.player.y - 20, this.world);
  }

  async begin(payload = {}) {
    const game = this.game;
    if (!game.save.hasFlag('hallArrived')) {
      await this.say(HALL.arrive);
      game.save.setFlag('hallArrived');
    } else if (payload.continued) {
      await this.say([{ who: 'theo', text: 'Back in the hall. Try not to compliment either portrait on her frame. It escalates.' }]);
    }

    // Both halves of the chapter can be finished without the fragment ever
    // being handed over, if the page was closed at exactly the wrong moment.
    await this.#checkComplete();
  }

  /* ------------------------------------------------------------- scenery */

  #buildSprites() {
    this.frameSprite = makeSprite({
      width: 140, height: 200, anchorX: 70, anchorY: 168,
      paint: (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 4, 46, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        // Standing silver frame with a mirrored surface.
        ctx.fillStyle = '#8e94a4';
        ctx.beginPath();
        ctx.roundRect(-46, -156, 92, 156, 10);
        ctx.fill();
        ctx.fillStyle = '#c8cedd';
        ctx.beginPath();
        ctx.roundRect(-40, -150, 80, 144, 8);
        ctx.fill();
        const g = ctx.createLinearGradient(0, -150, 0, -6);
        g.addColorStop(0, '#2b2b33');
        g.addColorStop(0.5, '#4a4a55');
        g.addColorStop(1, '#1b1b22');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(-33, -143, 66, 130, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(232,238,251,0.85)';
        starPath(ctx, 0, -78, 14, 4, 0.28);
        ctx.fill();
        ctx.fillStyle = '#8e94a4';
        ctx.beginPath();
        ctx.roundRect(-30, -6, 60, 8, 3);
        ctx.fill();
      }
    });
  }

  /** The hall is painted twice: once drained of colour, once restored. */
  #paintBackground(colour) {
    const { width, height } = WORLD;
    const tone = colour ? THEME.colour : THEME.mono;
    const accent = (hex, amount = 1) => (colour ? mix(THEME.mono.flower, hex, amount) : THEME.mono.flower);

    return createBuffer(width, height, (ctx) => {
      // Back wall.
      const wall = ctx.createLinearGradient(0, 0, 0, WALL_Y);
      wall.addColorStop(0, tone.wallTop);
      wall.addColorStop(1, tone.wallBottom);
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, width, WALL_Y);

      // Wall panelling.
      ctx.strokeStyle = 'rgba(232,238,251,0.16)';
      ctx.lineWidth = 3;
      for (let x = 60; x < width; x += 120) {
        ctx.beginPath();
        ctx.roundRect(x, 40, 80, 170, 6);
        ctx.stroke();
      }

      // Tall windows at each end, showing the night outside.
      for (const wx of [120, 1140]) {  // eslint-disable-line no-unused-vars
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(wx - 46, 30, 92, 180, 46);
        ctx.clip();
        paintNightSky(ctx, width, 240, { top: '#0b0a1a', bottom: '#221d38', starCount: 40, seed: wx });
        ctx.restore();
        ctx.strokeStyle = tone.frame;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(wx - 46, 30, 92, 180, 46);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(wx, 34);
        ctx.lineTo(wx, 206);
        ctx.moveTo(wx - 44, 120);
        ctx.lineTo(wx + 44, 120);
        ctx.stroke();
      }

      // The great mural, split down the middle.
      const mx = SPOTS.mural.x;
      ctx.fillStyle = '#0f0f14';
      ctx.beginPath();
      ctx.roundRect(mx - 170, 44, 160, 168, 8);
      ctx.fill();
      ctx.fillStyle = '#eeeae2';
      ctx.beginPath();
      ctx.roundRect(mx + 10, 44, 160, 168, 8);
      ctx.fill();
      // Two dancing silhouettes, one on each half, reaching toward the gap.
      drawSilhouette(ctx, mx - 96, 196, 1, '#e8eefb');
      drawSilhouette(ctx, mx + 96, 196, -1, '#1a1720');
      ctx.strokeStyle = tone.frame;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(mx - 174, 40, 348, 176, 10);
      ctx.stroke();

      paintMist(ctx, width, height, THEME.mist, 55, 4);

      // Chessboard floor.
      // Counted in whole tiles, so the black-and-white pattern always
      // alternates however the floor happens to line up with the wall.
      const tile = 52;
      const rows = Math.ceil((height - WALL_Y) / tile);
      const columns = Math.ceil(width / tile);
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const dark = (row + column) % 2 === 0;
          ctx.fillStyle = dark ? tone.tileDark : tone.tileLight;
          ctx.fillRect(column * tile, WALL_Y + row * tile, tile, tile);
          ctx.strokeStyle = 'rgba(0,0,0,0.14)';
          ctx.lineWidth = 1;
          ctx.strokeRect(column * tile + 0.5, WALL_Y + row * tile + 0.5, tile - 1, tile - 1);
        }
      }
      // Perspective shading so the floor recedes.
      const floorShade = ctx.createLinearGradient(0, WALL_Y, 0, height);
      floorShade.addColorStop(0, 'rgba(0,0,0,0.45)');
      floorShade.addColorStop(0.4, 'rgba(0,0,0,0.05)');
      floorShade.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = floorShade;
      ctx.fillRect(0, WALL_Y, width, height - WALL_Y);

      // Side walls, so the hall reads as a room rather than a tiled field.
      for (const side of [0, 1]) {
        const x = side ? width - 56 : 0;
        const wallGradient = ctx.createLinearGradient(x, 0, x + 56, 0);
        const inner = colour ? '#3f3550' : '#2c2c34';
        const outer = colour ? '#241e33' : '#1a1a20';
        wallGradient.addColorStop(0, side ? inner : outer);
        wallGradient.addColorStop(1, side ? outer : inner);
        ctx.fillStyle = wallGradient;
        ctx.fillRect(x, WALL_Y - 40, 56, height - WALL_Y + 40);
        ctx.strokeStyle = 'rgba(232,238,251,0.14)';
        ctx.lineWidth = 2;
        for (let y = WALL_Y; y < height; y += 96) {
          ctx.strokeRect(x + 12, y + 12, 32, 68);
        }
      }

      // A long runner carpet down the middle of the hall.
      ctx.fillStyle = tone.runner;
      ctx.fillRect(380, WALL_Y, 500, height - WALL_Y);
      ctx.strokeStyle = rgba(tone.runnerTrim, 0.6);
      ctx.lineWidth = 4;
      ctx.strokeRect(398, WALL_Y + 10, 464, height - WALL_Y - 26);
      // Woven diamonds along the runner.
      ctx.strokeStyle = rgba(tone.runnerTrim, 0.28);
      ctx.lineWidth = 2;
      for (let y = WALL_Y + 60; y < height - 40; y += 110) {
        ctx.beginPath();
        ctx.moveTo(630, y - 26);
        ctx.lineTo(690, y);
        ctx.lineTo(630, y + 26);
        ctx.lineTo(570, y);
        ctx.closePath();
        ctx.stroke();
      }

      // Flowers along the walls, grey until the mural is whole.
      const random = makeRandom(404);
      for (let i = 0; i < 26; i++) {
        const left = random() < 0.5;
        const x = left ? 40 + random() * 280 : 940 + random() * 300;
        const y = WALL_Y + 30 + random() * (height - WALL_Y - 70);
        drawFlowerCluster(ctx, x, y, 0.8 + random() * 0.5,
          [accent(PALETTE.lavender), accent(PALETTE.gold), accent(PALETTE.lavenderLight)], 200 + i, 3);
      }
    });
  }

  #buildColliders() {
    this.colliders = [];
    this.addCollider(-80, -80, WORLD.width + 160, WALL_Y + 60);
    this.addBoundaryWalls(58); // keep her off the side walls
    this.addCollider(SPOTS.storykeeper.x - 40, SPOTS.storykeeper.y - 16, 80, 20);
  }

  #buildScenery() {
    this.entities = [];

    this.addEntity({
      y: SPOTS.portraitLeft.y,
      draw: (ctx, time) => drawWallPortrait(ctx, {
        x: SPOTS.portraitLeft.x, y: SPOTS.portraitLeft.y, time, scale: 1.5,
        tone: 'dark', talking: this.nearest?.id === 'portraitLeft', colour: this.colorLevel
      })
    });
    this.addEntity({
      y: SPOTS.portraitRight.y,
      draw: (ctx, time) => drawWallPortrait(ctx, {
        x: SPOTS.portraitRight.x, y: SPOTS.portraitRight.y, time, scale: 1.5,
        tone: 'light', talking: this.nearest?.id === 'portraitRight', colour: this.colorLevel
      })
    });

    this.addEntity({
      y: SPOTS.storykeeper.y,
      draw: (ctx) => this.frameSprite.draw(ctx, SPOTS.storykeeper.x, SPOTS.storykeeper.y)
    });

    // Chandeliers hanging over the runner.
    this.addEntity({
      y: WALL_Y + 4,
      draw: (ctx, time) => {
        for (const cx of [500, 740]) {
          ctx.strokeStyle = 'rgba(142,148,164,0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, WALL_Y - 40);
          ctx.lineTo(cx, WALL_Y + 30);
          ctx.stroke();
          for (let i = -1; i <= 1; i++) {
            drawLantern(ctx, cx + i * 26, WALL_Y + 66 + Math.abs(i) * 6, 0.85, true, time + i);
          }
        }
      }
    });

    this.addEntity({
      y: SPOTS.doors.y,
      draw: (ctx, time) => {
        const open = this.game.save.hasFlag('hallComplete');
        drawArch(ctx, SPOTS.doors.x, SPOTS.doors.y + 10, 1.3,
          { stoneDark: '#6a6474', doorway: open ? '#241d33' : '#17141f' },
          open ? rgba('#ffe0a0', 0.35) : null,
          { lit: [open, open, open], time });
      }
    });
  }

  #buildInteractables() {
    this.interactables = [];

    this.addInteractable({
      id: 'mural',
      x: SPOTS.mural.x, y: SPOTS.mural.y + 40,
      radius: 90, label: 'Study', promptOffset: -60,
      onInteract: () => this.#doMural()
    });

    this.addInteractable({
      id: 'storykeeper',
      x: SPOTS.storykeeper.x, y: SPOTS.storykeeper.y,
      radius: 62, label: 'Answer', promptOffset: -180,
      onInteract: () => this.#doTrivia()
    });

    this.#addGossip('portraitLeft', GOSSIP.hallPortraitLeft, SPOTS.portraitLeft);
    this.#addGossip('portraitRight', GOSSIP.hallPortraitRight, SPOTS.portraitRight);

    this.addInteractable({
      id: 'window',
      x: SPOTS.window.x, y: SPOTS.window.y + 40,
      radius: 60, label: 'Look out', promptOffset: -70,
      onInteract: () => this.say(HALL.windowStar)
    });

    this.addInteractable({
      id: 'theo', x: 0, y: 0, radius: 54, label: 'Talk', promptOffset: -46,
      onInteract: () => this.say(this.#theoChat())
    });

    this.addInteractable({
      id: 'doors', x: SPOTS.doors.x - 34, y: SPOTS.doors.y,
      radius: 74, label: 'Go on', promptOffset: -140,
      available: () => this.game.save.hasFlag('hallComplete'),
      onInteract: () => this.#leave()
    });
  }

  #addGossip(id, entry, position) {
    this.addInteractable({
      id,
      x: position.x, y: position.y + 30,
      radius: 54, label: 'Listen', promptOffset: -66,
      onInteract: async () => {
        const first = !this.game.save.has('gossipHeard', entry.id);
        await this.say(first ? entry.lines : entry.repeat);
        if (first) this.game.save.addToSet('gossipHeard', entry.id);
      }
    });
  }

  #theoChat() {
    const save = this.game.save;
    if (save.hasFlag('hallComplete')) return HALL.toGarden;
    if (!save.hasFlag('muralComplete')) return [{ who: 'theo', text: 'The mural first. Dark half, light half. Every panel is missing its opposite, and the wall is quietly furious about it.' }];
    return [{ who: 'theo', mood: 'proud', text: 'Now the frame at the end of the hall. Three questions. It thinks it is going to be difficult. It is about to be disappointed.' }];
  }

  /* -------------------------------------------------------------- actions */

  async #doMural() {
    if (this.game.save.hasFlag('muralComplete')) {
      await this.say([{ who: 'narrator', text: 'The mural is whole: two figures reaching across the seam, holding one lantern between them.' }]);
      return;
    }
    await this.say(HALL.muralIntro);
    const solved = await runMuralPuzzle(this.game, {
      onProgress: (fraction) => {
        this.colorTarget = Math.max(this.colorTarget, fraction * COLOUR_AFTER_MURAL);
        this.#burstColour(0.5);
      }
    });
    if (!solved) {
      await this.say([{ who: 'theo', text: 'No rush. The wall has been like this for two centuries; it can hold on a little longer.' }]);
      return;
    }
    this.game.save.setFlag('muralComplete');
    this.game.audio.rumble();
    this.colorTarget = COLOUR_AFTER_MURAL;
    this.#burstColour(1);
    if (!this.game.settings.reducedMotion) this.game.renderer.emphasise(0.07);
    await this.say(HALL.muralSolved);
    this.#refreshObjective();
    await this.#checkComplete();
  }

  async #doTrivia() {
    const save = this.game.save;
    if (save.hasFlag('triviaComplete')) {
      await this.say([{ who: 'portrait', text: 'You have already answered. The hall is still telling everyone about it.' }]);
      return;
    }
    if (!save.hasFlag('muralComplete')) {
      await this.say([{ who: 'portrait', text: 'Mend the mural first. I refuse to ask serious questions in a room that is only half a picture.' }]);
      return;
    }

    await this.say(HALL.triviaIntro);
    const result = await runStorykeeperTrial(this.game);
    if (!result?.solved) {
      await this.say([{ who: 'theo', text: 'Come back when you are ready. The frame will pretend it was not waiting.' }]);
      return;
    }
    save.setFlag('triviaComplete');
    // The last of the colour arrives with the Storykeeper's approval.
    this.colorTarget = 1;
    this.#burstColour(1);
    await this.say(HALL.triviaSolved);
    if (result.flawless) await this.say(HALL.triviaFlawless);
    this.#refreshObjective();
    await this.#checkComplete();
  }

  async #checkComplete() {
    const save = this.game.save;
    if (!save.hasFlag('muralComplete') || !save.hasFlag('triviaComplete')) return;
    if (save.hasFlag('hallComplete')) return;
    await this.say(HALL.complete);
    await this.game.awardFragment('hall', HALL.fragment);
    save.setFlag('hallComplete');
    this.#refreshObjective();
    await this.say(HALL.toGarden);
  }

  async #leave() {
    this.busy = true;
    await this.game.advanceTo('garden');
  }

  /** Lavender arrives first, then the warmer colours behind it. */
  #burstColour(strength = 1) {
    const count = Math.round(34 * strength) + 16;
    this.particles.burst(SPOTS.mural.x, SPOTS.mural.y + 20, count, {
      color: [PALETTE.lavender, PALETTE.lavenderLight, PALETTE.gold, PALETTE.theoBlue],
      speed: 110, life: 2.2, size: 3.4, shape: 'petal', gravity: 10, drag: 0.96
    });
  }

  #refreshObjective() {
    const save = this.game.save;
    if (save.hasFlag('hallComplete')) {
      this.game.ui.setObjective('The doors to the garden stand open');
    } else if (!save.hasFlag('muralComplete')) {
      this.game.ui.setObjective('Join the two halves of the mural');
    } else if (!save.hasFlag('triviaComplete')) {
      this.game.ui.setObjective("Answer the Storykeeper's three questions");
    }
  }

  celebrateFragment() {
    this.playAnim('success', 1.1);
    this.cheerTheo('proud', 1);
    this.particles.burst(SPOTS.mural.x, SPOTS.mural.y + 30, 60, {
      color: [PALETTE.goldLight, PALETTE.silver, PALETTE.lavender],
      speed: 90, life: 2, size: 3, shape: 'star', gravity: -10
    });
  }

  hint() {
    const level = this.game.save.bumpHint('hall');
    const index = Math.min(level, HALL.hintLines.length) - 1;
    this.say([{ who: 'theo', mood: 'sly', text: HALL.hintLines[index] }]);
  }

  updateScene(dt) {
    const theoTarget = this.interactables.find((i) => i.id === 'theo');
    if (theoTarget) {
      theoTarget.x = this.theo.x;
      theoTarget.y = this.theo.y;
    }
    // Colour seeps back toward whichever stage has been reached.
    if (Math.abs(this.colorLevel - this.colorTarget) > 0.002) {
      const speed = this.game.settings.reducedMotion ? 4 : 0.5;
      const direction = Math.sign(this.colorTarget - this.colorLevel);
      this.colorLevel = direction > 0
        ? Math.min(this.colorTarget, this.colorLevel + dt * speed)
        : Math.max(this.colorTarget, this.colorLevel - dt * speed);
    }
  }

  /** The hall exists in two painted versions and fades between them. */
  drawBackground(ctx) {
    const { width, height } = this.monoBackground;
    const skirt = (image, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(image, 0, 0);
      // Carry the floor past the bottom edge; see WorldScene#drawBackground.
      ctx.drawImage(image, 0, height - 2, width, 2, 0, WORLD.height, width, 260);
      ctx.restore();
    };
    skirt(this.monoBackground);
    if (this.colorLevel > 0) skirt(this.colourBackground, this.colorLevel);
  }

  drawBehind(ctx, time) {
    // Light pooling beneath the chandeliers, warming as the room recovers.
    const warmth = this.colorLevel;
    for (const cx of [500, 740]) {
      drawLightPool(ctx, cx, WALL_Y + 96, 120, warmth > 0.4 ? PALETTE.goldLight : PALETTE.silver, 0.5);
    }
    drawLightPool(ctx, SPOTS.storykeeper.x, SPOTS.storykeeper.y + 10, 100,
      warmth > 0.7 ? PALETTE.lavenderLight : PALETTE.silver, 0.45);

    // The night beyond the eastern window, personal star included.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(SPOTS.window.x - 44, 32, 88, 176, 44);
    ctx.clip();
    drawMoon(ctx, SPOTS.window.x - 20, 80, 14, time);
    drawPersonalStar(ctx, SPOTS.window.x + 16, 140, time, 0.75);
    ctx.restore();
  }

  drawFront(ctx, time) {
    // The mural's seam glows while it is still divided.
    if (this.game.save.hasFlag('muralComplete')) return;
    const mx = SPOTS.mural.x;
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(time * 2) * 0.15;
    ctx.fillStyle = '#e8eefb';
    ctx.fillRect(mx - 6, 44, 12, 168);
    ctx.restore();
  }
}

/** A simple dancing figure, used on both halves of the mural. */
function drawSilhouette(ctx, x, baseY, direction, color) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(direction, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -104, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.quadraticCurveTo(-8, -60, -4, -90);
  ctx.lineTo(10, -90);
  ctx.quadraticCurveTo(18, -50, 26, 0);
  ctx.closePath();
  ctx.fill();
  // An arm reaching toward the seam.
  ctx.lineWidth = 8;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, -84);
  ctx.quadraticCurveTo(36, -80, 52, -66);
  ctx.stroke();
  ctx.restore();
}
