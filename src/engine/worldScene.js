/**
 * Base class for the chapters you can walk around in.
 *
 * It owns the things every explorable area needs: the heroine and her
 * animation states, Theo trailing behind her, collision, the "press to
 * interact" logic, the painted background buffer, and the lighting and
 * particle layers that give a flat top-down scene depth.
 */

import { ParticleField, AmbientDrift } from './particles.js';
import { drawHeroine, drawTheo, facingFromVector } from './sprites.js';
import {
  drawInteractPrompt, drawVignette, drawAtmosphere, drawLightPools,
  drawSwayingTufts, drawForegroundFoliage, makeRandom
} from './art.js';
import { PALETTE } from './theme.js';

const PLAYER_RADIUS = 8;
const PLAYER_SPEED = 124;
const ACCELERATION = 1500;
const DECELERATION = 1900;
const STEP_INTERVAL = 0.3;

export class WorldScene {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.world = { width: 1200, height: 800 };
    this.colliders = [];
    /** Drawn in y order so characters walk in front of and behind scenery. */
    this.entities = [];
    this.interactables = [];
    this.particles = new ParticleField();
    this.drifts = [];
    this.background = null;
    this.foreground = null;
    this.lightPools = [];
    this.tufts = [];
    this.atmosphere = null;
    this.atmosphereStrength = 0.1;

    this.player = {
      x: 200, y: 400, vx: 0, vy: 0,
      facing: 'down', moving: false, walkTime: 0, stepTimer: 0
    };
    this.anim = { state: 'idle', time: 0, duration: 0 };
    this.theo = { x: 170, y: 420, visible: true, mood: 'happy', facing: 'down', cheer: 0 };
    this.theoFollowOffset = { x: -28, y: 16 };

    this.vignetteStrength = 0.45;
    this.skyColor = PALETTE.night;
    this.busy = false;
    this.nearest = null;
    /** When set, the camera watches this point instead of the heroine. */
    this.cameraFocus = null;
    /** Eased offset that keeps whoever the camera follows above the dialogue. */
    this.cameraLift = 0;
    this.scriptedWalk = null;
  }

  /* ------------------------------------------------------------ lifecycle */

  /** Chapters override this; it runs once when the scene becomes active. */
  async enter() {}

  exit() {
    this.particles.clear();
    this.entities.length = 0;
    this.interactables.length = 0;
    this.drifts.length = 0;
    this.tufts.length = 0;
    this.lightPools.length = 0;
  }

  /* ------------------------------------------------------------ authoring */

  addCollider(x, y, width, height) {
    this.colliders.push({ x, y, width, height });
  }

  /** Walls just outside the playable area, so she can never walk off it. */
  addBoundaryWalls(inset = 0) {
    const { width, height } = this.world;
    const t = 60;
    this.addCollider(-t, -t, width + t * 2, t + inset);
    this.addCollider(-t, height - inset, width + t * 2, t + inset);
    this.addCollider(-t, -t, t + inset, height + t * 2);
    this.addCollider(width - inset, -t, t + inset, height + t * 2);
  }

  addEntity(entity) {
    this.entities.push(entity);
    return entity;
  }

  /**
   * `{ id, x, y, radius, label, onInteract, promptOffset, available() }`
   * `available` lets a chapter hide an interaction until it makes sense.
   */
  addInteractable(spec) {
    const item = { radius: 48, promptOffset: -50, ...spec };
    this.interactables.push(item);
    return item;
  }

  addDrift(spec) {
    const drift = new AmbientDrift(spec);
    drift.palette = spec.palette || { core: PALETTE.goldLight };
    this.drifts.push(drift);
    return drift;
  }

  /**
   * Scatters grass that leans in the breeze across the walkable area. `avoid`
   * takes a list of ellipses ({x, y, rx, ry}) that nothing may grow inside —
   * ponds, flower beds, paving — so planting never sprouts through a solid.
   */
  seedTufts({ count, bounds, colors, blooms = [], seed = 12, avoid = [] }) {
    const random = makeRandom(seed);
    const blocked = (x, y) => avoid.some((a) =>
      ((x - a.x) / a.rx) ** 2 + ((y - a.y) / a.ry) ** 2 < 1);
    for (let i = 0; i < count; i++) {
      let x = bounds.x + random() * bounds.width;
      let y = bounds.y + random() * bounds.height;
      for (let tries = 0; tries < 8 && blocked(x, y); tries++) {
        x = bounds.x + random() * bounds.width;
        y = bounds.y + random() * bounds.height;
      }
      if (blocked(x, y)) continue;
      this.tufts.push({
        x,
        y,
        height: 7 + random() * 9,
        width: 1 + random() * 0.9,
        amp: 1.6 + random() * 2.4,
        phase: random() * Math.PI * 2,
        color: colors[(random() * colors.length) | 0],
        bloom: blooms.length && random() < 0.3 ? blooms[(random() * blooms.length) | 0] : null
      });
    }
  }

  /* ------------------------------------------------------------ simulation */

  /** Plays a one-shot character animation such as "collect" or "success". */
  playAnim(state, duration = 0.6) {
    this.anim = { state, time: 0, duration };
  }

  update(dt) {
    this.time += dt;
    const game = this.game;
    const canMove = !this.busy && !this.scriptedWalk && !game.ui.dialogue.active && !game.ui.panelOpen;

    if (this.scriptedWalk) this.#advanceScriptedWalk(dt);
    else this.#movePlayer(canMove ? game.input.axis() : { x: 0, y: 0 }, dt);
    this.#updateAnim(dt);
    this.#updateTheo(dt);

    for (const drift of this.drifts) drift.update(dt, this.time);
    this.particles.update(dt);
    this.#updateNearest(canMove);
    this.updateScene?.(dt);
  }

  #movePlayer(axis, dt) {
    const p = this.player;
    const wants = Math.abs(axis.x) > 0.01 || Math.abs(axis.y) > 0.01;

    // Accelerate toward the requested direction, brake quickly when released.
    // Fast enough to feel immediate, damped enough not to feel like ice.
    const targetX = axis.x * PLAYER_SPEED;
    const targetY = axis.y * PLAYER_SPEED;
    const rate = (wants ? ACCELERATION : DECELERATION) * dt;
    p.vx += Math.max(-rate, Math.min(rate, targetX - p.vx));
    p.vy += Math.max(-rate, Math.min(rate, targetY - p.vy));

    const speed = Math.hypot(p.vx, p.vy);
    if (speed < 3) {
      p.vx = 0;
      p.vy = 0;
    }
    p.moving = speed > 8;

    if (p.moving) {
      p.facing = facingFromVector(p.vx, p.vy, p.facing);
      p.walkTime += dt * Math.min(1, speed / PLAYER_SPEED);

      // A soft puff of dust marks each footfall.
      p.stepTimer -= dt * (speed / PLAYER_SPEED);
      if (p.stepTimer <= 0) {
        p.stepTimer = STEP_INTERVAL;
        this.particles.emit({
          x: p.x + (Math.random() - 0.5) * 6,
          y: p.y + 1,
          vx: -p.vx * 0.06, vy: -4 - Math.random() * 4,
          life: 0.45, maxLife: 0.45,
          size: 1.6 + Math.random(), color: 'rgba(226,232,246,0.5)',
          gravity: 6, drag: 0.9, shape: 'dot'
        });
        this.game.audio.footstep();
      }
    }

    // One axis at a time, so walking into a wall diagonally slides along it.
    this.#step(p, p.vx * dt, 0);
    this.#step(p, 0, p.vy * dt);

    p.x = Math.max(PLAYER_RADIUS, Math.min(this.world.width - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(this.world.height - PLAYER_RADIUS, p.y));
  }

  /**
   * Walks her to a spot by herself, for the scripted moments. Collision is
   * ignored on purpose: these paths are authored, not navigated.
   */
  walkTo(x, y, seconds = 1.3) {
    return new Promise((resolve) => {
      if (this.game.settings.reducedMotion) {
        this.player.x = x;
        this.player.y = y;
        resolve();
        return;
      }
      this.scriptedWalk = {
        fromX: this.player.x, fromY: this.player.y,
        toX: x, toY: y, t: 0, seconds, resolve
      };
    });
  }

  #advanceScriptedWalk(dt) {
    const walk = this.scriptedWalk;
    walk.t = Math.min(1, walk.t + dt / walk.seconds);
    // Ease in and out so she starts and stops like a person, not a slider.
    const eased = walk.t * walk.t * (3 - 2 * walk.t);
    const nextX = walk.fromX + (walk.toX - walk.fromX) * eased;
    const nextY = walk.fromY + (walk.toY - walk.fromY) * eased;
    const dx = nextX - this.player.x;
    const dy = nextY - this.player.y;
    this.player.x = nextX;
    this.player.y = nextY;
    this.player.moving = Math.hypot(dx, dy) > 0.2;
    if (this.player.moving) {
      this.player.facing = facingFromVector(dx, dy, this.player.facing);
      this.player.walkTime += dt;
      this.player.stepTimer -= dt;
      if (this.player.stepTimer <= 0) {
        this.player.stepTimer = STEP_INTERVAL;
        this.game.audio.footstep();
      }
    }
    if (walk.t >= 1) {
      this.player.moving = false;
      const done = walk.resolve;
      this.scriptedWalk = null;
      done();
    }
  }

  /** Applies one axis of movement unless something solid is in the way. */
  #step(p, dx, dy) {
    if (dx === 0 && dy === 0) return;
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (this.#blocked(nx, ny)) {
      if (dx !== 0) p.vx = 0; else p.vy = 0;
      return;
    }
    p.x = nx;
    p.y = ny;
  }

  /** Circle against axis-aligned rectangles. */
  #blocked(x, y) {
    for (const c of this.colliders) {
      const closestX = Math.max(c.x, Math.min(x, c.x + c.width));
      const closestY = Math.max(c.y, Math.min(y, c.y + c.height));
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS) return true;
    }
    return false;
  }

  #updateAnim(dt) {
    const anim = this.anim;
    if (anim.duration <= 0) return;
    anim.time += dt;
    if (anim.time >= anim.duration) {
      this.anim = { state: 'idle', time: 0, duration: 0 };
    }
  }

  /** Theo drifts along behind her, catching up when she gets too far ahead. */
  #updateTheo(dt) {
    const t = this.theo;
    if (t.cheer > 0) t.cheer = Math.max(0, t.cheer - dt * 0.5);
    if (!t.visible) return;
    const targetX = this.player.x + this.theoFollowOffset.x;
    const targetY = this.player.y + this.theoFollowOffset.y;
    const dx = targetX - t.x;
    const dy = targetY - t.y;
    const dist = Math.hypot(dx, dy);
    const ease = dist > 90 ? 6 : 2.6;
    t.x += dx * Math.min(1, ease * dt);
    t.y += dy * Math.min(1, ease * dt);
    if (dist > 6) t.facing = facingFromVector(dx, dy, t.facing);

    // Silver stars trail off him when he is excited.
    if (t.cheer > 0.3 && Math.random() < dt * 12) {
      this.particles.emit({
        x: t.x + (Math.random() - 0.5) * 18,
        y: t.y - 16 - Math.random() * 14,
        vx: (Math.random() - 0.5) * 12, vy: -12 - Math.random() * 10,
        life: 0.9, maxLife: 0.9, size: 1.7,
        color: PALETTE.silver, gravity: -4, drag: 0.95, shape: 'star'
      });
    }
  }

  /** Theo reacts: a short burst of bouncing and stars. */
  cheerTheo(mood = 'delighted', amount = 1) {
    this.theo.mood = mood;
    this.theo.cheer = amount;
  }

  #updateNearest(canMove) {
    let best = null;
    let bestDist = Infinity;
    if (canMove) {
      for (const item of this.interactables) {
        if (item.available && !item.available()) continue;
        const d = Math.hypot(item.x - this.player.x, item.y - this.player.y);
        if (d < item.radius && d < bestDist) {
          best = item;
          bestDist = d;
        }
      }
    }
    if (best !== this.nearest) {
      this.nearest = best;
      this.game.ui.setInteractTarget(best ? best.label : null);
    }
  }

  /** Called by the game when the interaction button or Space is pressed. */
  interact() {
    if (this.busy || !this.nearest) return false;
    const target = this.nearest;
    this.game.audio.interact();
    this.playAnim('interact', 0.42);
    const result = target.onInteract?.(target);
    if (result instanceof Promise) {
      this.busy = true;
      result.finally(() => { this.busy = false; });
    }
    return true;
  }

  /**
   * A tap directly on an object she is already standing next to also works,
   * so the interaction button is a convenience rather than the only way in.
   */
  tapAt(worldX, worldY) {
    if (this.busy || !this.nearest) return false;
    const d = Math.hypot(this.nearest.x - worldX, this.nearest.y - worldY);
    if (d > 56) return false;
    return this.interact();
  }

  /** Runs a dialogue, blocking movement until it finishes. */
  async say(lines) {
    this.busy = true;
    this.game.input.releaseAll();
    this.player.vx = 0;
    this.player.vy = 0;
    try {
      return await this.game.ui.dialogue.play(lines);
    } finally {
      this.busy = false;
    }
  }

  /* -------------------------------------------------------------- drawing */

  /**
   * Paints the static scenery. The default blits the single painted buffer;
   * a chapter that needs to cross-fade between two versions of itself
   * overrides this.
   */
  drawBackground(ctx) {
    if (!this.background) return;
    ctx.drawImage(this.background, 0, 0);
    // The camera is allowed a little way past the bottom edge while the
    // dialogue box is up. Stretching the background's last row down covers
    // that strip in whatever colour the ground happens to be there, so no
    // scene ever shows a bar of nothing beside the box.
    const { width, height } = this.background;
    ctx.drawImage(this.background, 0, height - 2, width, 2, 0, this.world.height, width, 260);
  }

  /**
   * How far to push the camera target down the world so that whoever it is
   * following stays above the dialogue box. On a tall phone the box can take a
   * third of the screen, and without this she spends her own scenes standing
   * behind the words. Eased in and out so the view never jumps.
   */
  #dialogueLift(renderer) {
    const box = this.game.ui?.dialogue?.root;
    const wanted = box && !box.hidden && box.offsetHeight
      ? Math.min(0.42, box.offsetHeight / Math.max(1, renderer.height)) * renderer.viewHeight * 0.8
      : 0;
    const rate = this.game.settings.reducedMotion ? 1 : 0.08;
    this.cameraLift += (wanted - this.cameraLift) * rate;
    return this.cameraLift;
  }

  draw(renderer) {
    const ctx = renderer.ctx;
    const reduced = this.game.settings.reducedMotion;
    const focus = this.cameraFocus;
    const lift = this.#dialogueLift(renderer);
    renderer.followCamera(
      focus ? focus.x : this.player.x,
      (focus ? focus.y : this.player.y - 24) + lift,
      this.world,
      reduced ? 1 : (focus ? 0.05 : 0.14),
      lift
    );

    renderer.clear(this.skyColor);
    renderer.beginWorld();
    const bounds = renderer.viewBounds(140);

    this.drawBackground(ctx);
    if (this.lightPools.length) {
      drawLightPools(ctx, this.lightPools, this.time, PALETTE.moonlit, reduced ? 0.3 : 0.42);
    }
    this.drawBehind?.(ctx, this.time);
    if (this.tufts.length) drawSwayingTufts(ctx, this.tufts, reduced ? 0 : this.time, bounds);

    // Depth sort: everything drawn from the back of the scene forwards.
    const drawables = [];
    for (const entity of this.entities) {
      if (entity.hidden?.()) continue;
      if (entity.x !== undefined) {
        const pad = entity.cullRadius ?? 160;
        if (entity.x < bounds.left - pad || entity.x > bounds.right + pad) continue;
        if (entity.y < bounds.top - pad * 2 || entity.y > bounds.bottom + pad) continue;
      }
      drawables.push({ y: entity.depth ?? entity.y, draw: () => entity.draw(ctx, this.time) });
    }

    const carry = Math.min(1, this.game.save.progress.fragments.length / 3);
    drawables.push({
      y: this.player.y,
      draw: () => drawHeroine(ctx, {
        x: this.player.x,
        y: this.player.y,
        facing: this.player.facing,
        time: this.player.moving ? this.player.walkTime : this.time,
        moving: this.player.moving,
        scale: 1,
        state: this.anim.state,
        statePhase: this.anim.duration ? this.anim.time / this.anim.duration : 0,
        carry: carry * (0.35 + 0.25 * Math.sin(this.time * 1.6))
      })
    });
    if (this.theo.visible) {
      drawables.push({
        y: this.theo.y,
        draw: () => drawTheo(ctx, {
          x: this.theo.x, y: this.theo.y, time: this.time, scale: 0.95,
          mood: this.theo.mood, facing: this.theo.facing, cheer: this.theo.cheer
        })
      });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Interaction markers sit above the scenery.
    for (const item of this.interactables) {
      if (item.available && !item.available()) continue;
      if (item.hidePrompt) continue;
      if (item.x < bounds.left || item.x > bounds.right) continue;
      const active = this.nearest === item;
      const dist = Math.hypot(item.x - this.player.x, item.y - this.player.y);
      if (dist < item.radius * 2.6) {
        drawInteractPrompt(
          ctx, item.x, item.y + (item.promptOffset ?? -50), this.time,
          active ? PALETTE.goldLight : PALETTE.silverDim, active, reduced
        );
      }
    }

    this.drawFront?.(ctx, this.time);
    for (const drift of this.drifts) drift.draw(ctx, this.time, drift.palette);
    this.particles.draw(ctx);

    renderer.beginScreen();
    if (this.foreground) {
      drawForegroundFoliage(ctx, renderer.width, renderer.height, this.foreground, renderer.camera, 0.035);
    }
    if (this.atmosphere) {
      drawAtmosphere(ctx, renderer.width, renderer.height, this.atmosphere, this.atmosphereStrength);
    }
    drawVignette(ctx, renderer.width, renderer.height, this.vignetteStrength);
    this.drawScreen?.(ctx, renderer);
  }
}
