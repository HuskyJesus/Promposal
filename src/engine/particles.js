/**
 * A tiny pooled particle system. Everything magical in the game — fireflies,
 * drifting leaves, dust in a sunbeam, the sparkle when a fragment appears —
 * comes out of here.
 */

export class ParticleField {
  constructor(limit = 260) {
    this.limit = limit;
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  emit(spec) {
    if (this.items.length >= this.limit) this.items.shift();
    this.items.push({
      x: 0, y: 0, vx: 0, vy: 0,
      life: 1, maxLife: 1,
      size: 2, color: '#fff',
      gravity: 0, drag: 1, spin: 0, angle: 0,
      shape: 'dot', twinkle: 0,
      ...spec
    });
  }

  /** Convenience: a burst of n particles around a point. */
  burst(x, y, count, spec = {}) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (spec.speed ?? 40) * (0.4 + Math.random() * 0.8);
      const life = (spec.life ?? 1.1) * (0.6 + Math.random() * 0.8);
      this.emit({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life, maxLife: life,
        size: (spec.size ?? 3) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(spec.color) ? spec.color[(Math.random() * spec.color.length) | 0] : (spec.color ?? '#ffe9b0'),
        gravity: spec.gravity ?? -6,
        drag: spec.drag ?? 0.94,
        shape: spec.shape ?? 'spark',
        spin: (Math.random() - 0.5) * 4,
        angle: Math.random() * Math.PI * 2,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) {
        items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.twinkle += dt * 6;
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.items) {
      const fade = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;

      if (p.shape === 'spark') {
        const r = p.size * (0.7 + 0.3 * Math.sin(p.twinkle));
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        drawStar(ctx, p.x, p.y, p.size * 1.6, p.angle);
      } else if (p.shape === 'petal') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.shape === 'leaf') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.moveTo(-p.size * 1.6, 0);
        ctx.quadraticCurveTo(0, -p.size, p.size * 1.6, 0);
        ctx.quadraticCurveTo(0, p.size, -p.size * 1.6, 0);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export function drawStar(ctx, x, y, radius, rotation = 0, points = 4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.34;
    const a = (i / (points * 2)) * Math.PI * 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Ambient drifters that live for the whole scene: fireflies in the woods,
 * dust motes in the cottage, silver flecks in the hall. They wrap around the
 * playable area instead of expiring.
 */
export class AmbientDrift {
  constructor({ count, bounds, style }) {
    this.bounds = bounds;
    this.style = style;
    this.items = [];
    for (let i = 0; i < count; i++) this.items.push(this.#spawn(true));
  }

  #spawn(anywhere) {
    const b = this.bounds;
    return {
      x: b.x + Math.random() * b.width,
      y: anywhere ? b.y + Math.random() * b.height : b.y + b.height,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.9,
      size: 1.2 + Math.random() * 2.2,
      drift: (Math.random() - 0.5) * 10
    };
  }

  update(dt, time) {
    const b = this.bounds;
    for (const item of this.items) {
      const style = this.style;
      if (style === 'firefly') {
        item.x += Math.sin(time * item.speed + item.phase) * 12 * dt + item.drift * dt;
        item.y += Math.cos(time * item.speed * 0.7 + item.phase) * 10 * dt;
      } else if (style === 'fall') {
        item.y += (14 + item.speed * 12) * dt;
        item.x += Math.sin(time * 0.8 + item.phase) * 12 * dt;
      } else {
        item.y -= (5 + item.speed * 6) * dt;
        item.x += Math.sin(time * 0.5 + item.phase) * 6 * dt;
      }
      if (item.x < b.x) item.x = b.x + b.width;
      if (item.x > b.x + b.width) item.x = b.x;
      if (item.y < b.y) item.y = b.y + b.height;
      if (item.y > b.y + b.height) item.y = b.y;
    }
  }

  draw(ctx, time, palette) {
    ctx.save();
    for (const item of this.items) {
      const pulse = 0.45 + 0.55 * Math.sin(time * 2.2 + item.phase);
      if (this.style === 'firefly') {
        ctx.globalAlpha = 0.15 + pulse * 0.6;
        const glow = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, item.size * 5);
        glow.addColorStop(0, palette.core);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5 + pulse * 0.5;
        ctx.fillStyle = palette.core;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size * 0.75, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.style === 'fall') {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = palette.core;
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(time * item.speed + item.phase);
        ctx.beginPath();
        ctx.ellipse(0, 0, item.size * 1.8, item.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.globalAlpha = 0.2 + pulse * 0.4;
        ctx.fillStyle = palette.core;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
