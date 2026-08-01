/**
 * Base class for the chapters you can walk around in.
 *
 * It owns the things every explorable area needs: the heroine, Theo trailing
 * behind her, collision, the "press to interact" logic, a painted background
 * buffer and the particle layers. Chapters subclass it and describe their own
 * scenery, characters and puzzles.
 */

import { ParticleField, AmbientDrift } from './particles.js';
import { drawHeroine, drawTheo, facingFromVector } from './sprites.js';
import { drawInteractPrompt, drawVignette } from './art.js';

const PLAYER_RADIUS = 8;
const PLAYER_SPEED = 118;

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
    this.player = { x: 200, y: 400, facing: 'down', moving: false, walkTime: 0 };
    this.theo = { x: 170, y: 420, visible: true, mood: 'happy', facing: 'down' };
    this.theoFollowOffset = { x: -26, y: 14 };
    this.vignetteStrength = 0.5;
    this.skyColor = '#161228';
    this.busy = false;
    this.nearest = null;
  }

  /* ------------------------------------------------------------ lifecycle */

  /** Chapters override this; it runs once when the scene becomes active. */
  async enter() {}

  exit() {
    this.particles.clear();
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
    const item = { radius: 44, promptOffset: -46, ...spec };
    this.interactables.push(item);
    return item;
  }

  addDrift(spec) {
    const drift = new AmbientDrift(spec);
    drift.palette = spec.palette || { core: '#ffe9b0' };
    this.drifts.push(drift);
    return drift;
  }

  /* ------------------------------------------------------------ simulation */

  update(dt) {
    this.time += dt;
    const game = this.game;
    const canMove = !this.busy && !game.ui.dialogue.active && !game.ui.panelOpen;

    if (canMove) {
      const axis = game.input.axis();
      this.#movePlayer(axis, dt);
    } else {
      this.player.moving = false;
    }

    this.#updateTheo(dt);
    for (const drift of this.drifts) drift.update(dt, this.time);
    this.particles.update(dt);
    this.#updateNearest(canMove);
    this.updateScene?.(dt);
  }

  #movePlayer(axis, dt) {
    const p = this.player;
    const moving = Math.abs(axis.x) > 0.01 || Math.abs(axis.y) > 0.01;
    p.moving = moving;
    if (!moving) return;

    p.facing = facingFromVector(axis.x, axis.y, p.facing);
    p.walkTime += dt;

    const step = PLAYER_SPEED * dt;
    // One axis at a time, so walking into a wall diagonally slides along it
    // instead of stopping dead.
    this.#step(p, axis.x * step, 0);
    this.#step(p, 0, axis.y * step);

    p.x = Math.max(PLAYER_RADIUS, Math.min(this.world.width - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(this.world.height - PLAYER_RADIUS, p.y));
  }

  /** Applies one axis of movement unless something solid is in the way. */
  #step(p, dx, dy) {
    if (dx === 0 && dy === 0) return;
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (this.#blocked(nx, ny)) return;
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

  /** Theo drifts along behind her, catching up when she gets too far ahead. */
  #updateTheo(dt) {
    const t = this.theo;
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
    this.nearest = best;
    this.game.ui.setInteractTarget(best ? best.label : null);
  }

  /** Called by the game when the interaction button or Space is pressed. */
  interact() {
    if (this.busy || !this.nearest) return false;
    const target = this.nearest;
    this.game.audio.interact();
    const result = target.onInteract?.(target);
    if (result instanceof Promise) {
      this.busy = true;
      result.finally(() => { this.busy = false; });
    }
    return true;
  }

  /** Runs a dialogue, blocking movement until it finishes. */
  async say(lines) {
    this.busy = true;
    this.game.input.releaseAll();
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
    if (this.background) ctx.drawImage(this.background, 0, 0);
  }

  draw(renderer) {
    const ctx = renderer.ctx;
    renderer.followCamera(this.player.x, this.player.y - 20, this.world, 0.12);

    renderer.clear(this.skyColor);
    renderer.beginWorld();

    this.drawBackground(ctx);
    this.drawBehind?.(ctx, this.time);

    // Depth sort: everything drawn from the back of the scene forwards.
    const drawables = [];
    for (const entity of this.entities) {
      if (entity.hidden?.()) continue;
      drawables.push({ y: entity.depth ?? entity.y, draw: () => entity.draw(ctx, this.time) });
    }
    drawables.push({
      y: this.player.y,
      draw: () => drawHeroine(ctx, {
        x: this.player.x,
        y: this.player.y,
        facing: this.player.facing,
        time: this.player.moving ? this.player.walkTime : this.time,
        moving: this.player.moving,
        scale: 1
      })
    });
    if (this.theo.visible) {
      drawables.push({
        y: this.theo.y,
        draw: () => drawTheo(ctx, { x: this.theo.x, y: this.theo.y, time: this.time, scale: 0.95, mood: this.theo.mood, facing: this.theo.facing })
      });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Interaction markers sit above the scenery.
    for (const item of this.interactables) {
      if (item.available && !item.available()) continue;
      if (item.hidePrompt) continue;
      const active = this.nearest === item;
      const dist = Math.hypot(item.x - this.player.x, item.y - this.player.y);
      if (dist < item.radius * 2.4) {
        drawInteractPrompt(ctx, item.x, item.y + (item.promptOffset ?? -46), this.time, active ? '#ffe6ad' : '#cbb489', active);
      }
    }

    this.drawFront?.(ctx, this.time);
    for (const drift of this.drifts) drift.draw(ctx, this.time, drift.palette || { core: '#ffe9b0' });
    this.particles.draw(ctx);

    renderer.beginScreen();
    drawVignette(ctx, renderer.width, renderer.height, this.vignetteStrength);
    this.drawScreen?.(ctx, renderer);
  }
}
