/**
 * The art library. Every tree, mushroom, lantern, cobblestone and window in
 * the game is drawn by one of these functions — there are no image files in
 * this project. Scenes call them once into an offscreen buffer.
 *
 * A seeded random number generator keeps the "hand-drawn" wobble identical on
 * every load, so a forest never re-shuffles itself between sessions.
 */

export function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lerp(a, b, t) { return a + (b - a) * t; }

/** Mixes two hex colours; used constantly for shading. */
export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Renders a piece of scenery once into its own small canvas so it can then be
 * blitted every frame. Trees are expensive to draw and cheap to copy; this is
 * what keeps a forest full of them running smoothly on a phone.
 *
 * The sprite is drawn around an anchor point, which is normally where the
 * object meets the ground, so scenes can depth-sort by that y value.
 */
export function makeSprite({ width, height, anchorX, anchorY, resolution = 2, paint }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * resolution));
  canvas.height = Math.max(1, Math.round(height * resolution));
  const ctx = canvas.getContext('2d');
  ctx.scale(resolution, resolution);
  ctx.translate(anchorX, anchorY);
  paint(ctx);
  return {
    canvas,
    width,
    height,
    anchorX,
    anchorY,
    draw(target, x, y, alpha = 1) {
      if (alpha !== 1) {
        target.save();
        target.globalAlpha = alpha;
      }
      target.drawImage(canvas, x - anchorX, y - anchorY, width, height);
      if (alpha !== 1) target.restore();
    }
  };
}

/* -------------------------------------------------------------------------
   Ground and paths
   ------------------------------------------------------------------------- */

/** Mottled ground with soft colour variation, painted once per scene. */
export function paintGround(ctx, width, height, { base, patch, seed = 7, patchCount = 220 }) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);
  const random = makeRandom(seed);
  for (let i = 0; i < patchCount; i++) {
    const x = random() * width;
    const y = random() * height;
    const r = 20 + random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(patch, 0.16 + random() * 0.14));
    g.addColorStop(1, rgba(patch, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** An old stone path built from irregular flagstones. */
export function paintStonePath(ctx, points, { width = 46, stone = '#8c8579', grout = '#5a5346', seed = 21 }) {
  const random = makeRandom(seed);
  const steps = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const count = Math.max(2, Math.round(dist / 22));
    for (let s = 0; s < count; s++) {
      const t = s / count;
      steps.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle: Math.atan2(b.y - a.y, b.x - a.x) });
    }
  }
  // Soil showing between the stones.
  ctx.strokeStyle = grout;
  ctx.lineWidth = width + 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();

  for (const step of steps) {
    const across = random() * width * 0.5 - width * 0.25;
    const w = 12 + random() * 12;
    const h = 9 + random() * 9;
    ctx.save();
    ctx.translate(step.x + Math.cos(step.angle + Math.PI / 2) * across, step.y + Math.sin(step.angle + Math.PI / 2) * across);
    ctx.rotate(random() * Math.PI);
    ctx.fillStyle = mix(stone, '#ffffff', random() * 0.25);
    roundedBlob(ctx, 0, 0, w, h, random);
    ctx.fill();
    ctx.fillStyle = rgba('#000000', 0.12);
    roundedBlob(ctx, 0, h * 0.28, w * 0.9, h * 0.4, random);
    ctx.fill();
    ctx.restore();
  }
}

function roundedBlob(ctx, x, y, w, h, random) {
  ctx.beginPath();
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 0.82 + random() * 0.3;
    const px = x + Math.cos(a) * w * 0.5 * wobble;
    const py = y + Math.sin(a) * h * 0.5 * wobble;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/* -------------------------------------------------------------------------
   Plants
   ------------------------------------------------------------------------- */

/** A rounded storybook tree: trunk, layered canopy, warm rim light. */
export function drawTree(ctx, x, y, scale, palette, seed = 1) {
  const random = makeRandom(seed);
  const trunkH = 46 * scale;
  const trunkW = 13 * scale;

  ctx.save();
  ctx.translate(x, y);

  // Shadow pooled on the ground.
  ctx.fillStyle = rgba('#000000', 0.28);
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 30 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk with a slight lean.
  const lean = (random() - 0.5) * 8 * scale;
  ctx.beginPath();
  ctx.moveTo(-trunkW / 2, 0);
  ctx.quadraticCurveTo(-trunkW / 2 + lean * 0.5, -trunkH * 0.6, lean - trunkW * 0.32, -trunkH);
  ctx.lineTo(lean + trunkW * 0.32, -trunkH);
  ctx.quadraticCurveTo(trunkW / 2 + lean * 0.5, -trunkH * 0.6, trunkW / 2, 0);
  ctx.closePath();
  ctx.fillStyle = palette.bark;
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.1);
  ctx.beginPath();
  ctx.moveTo(trunkW * 0.1, 0);
  ctx.quadraticCurveTo(trunkW * 0.3 + lean * 0.5, -trunkH * 0.6, lean + trunkW * 0.3, -trunkH);
  ctx.lineTo(lean + trunkW * 0.32, -trunkH);
  ctx.quadraticCurveTo(trunkW / 2 + lean * 0.5, -trunkH * 0.6, trunkW / 2, 0);
  ctx.closePath();
  ctx.fill();

  // Canopy: overlapping soft lobes.
  const canopyY = -trunkH - 22 * scale;
  const lobes = 7;
  ctx.translate(lean, 0);
  for (let pass = 0; pass < 2; pass++) {
    // The second pass sits up and to the left of the first, so it reads as
    // moonlight catching one side of the canopy rather than a ring.
    const color = pass === 0 ? palette.leafDark : palette.leaf;
    const shrink = pass === 0 ? 1 : 0.88;
    const offsetX = pass === 0 ? 0 : -6 * scale;
    const offsetY = pass === 0 ? 0 : -7 * scale;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2;
      const rx = (30 + random() * 12) * scale * shrink;
      const cx = Math.cos(a) * 22 * scale * shrink + offsetX;
      const cy = canopyY + Math.sin(a) * 14 * scale * shrink + offsetY;
      ctx.moveTo(cx + rx, cy);
      ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Rim light from the moon, always upper-left.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(palette.rim, 0.14);
  ctx.beginPath();
  ctx.arc(-16 * scale, canopyY - 12 * scale, 26 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

/** Toadstool with a speckled cap. */
export function drawMushroom(ctx, x, y, scale, palette, seed = 3) {
  const random = makeRandom(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = rgba('#000000', 0.25);
  ctx.beginPath();
  ctx.ellipse(0, 1 * scale, 9 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.stem;
  ctx.beginPath();
  ctx.moveTo(-3 * scale, 0);
  ctx.quadraticCurveTo(-2.2 * scale, -8 * scale, -2.6 * scale, -11 * scale);
  ctx.lineTo(2.6 * scale, -11 * scale);
  ctx.quadraticCurveTo(2.2 * scale, -8 * scale, 3 * scale, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.cap;
  ctx.beginPath();
  ctx.ellipse(0, -11 * scale, 9 * scale, 7 * scale, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -11 * scale, 9 * scale, 2.2 * scale, 0, 0, Math.PI);
  ctx.fill();

  ctx.fillStyle = rgba('#ffffff', 0.75);
  for (let i = 0; i < 4; i++) {
    const px = (random() - 0.5) * 12 * scale;
    const py = -12 * scale - random() * 4 * scale;
    ctx.beginPath();
    ctx.arc(px, py, (0.9 + random()) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Small flower cluster. */
export function drawFlowerCluster(ctx, x, y, scale, colors, seed = 5, count = 5) {
  const random = makeRandom(seed);
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < count; i++) {
    const fx = (random() - 0.5) * 26 * scale;
    const fy = (random() - 0.5) * 10 * scale;
    const s = (0.7 + random() * 0.6) * scale;
    ctx.strokeStyle = '#3d6b4f';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx + 1 * s, fy - 5 * s, fx, fy - 9 * s);
    ctx.stroke();
    const color = colors[(random() * colors.length) | 0];
    ctx.fillStyle = color;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(fx + Math.cos(a) * 2.4 * s, fy - 9 * s + Math.sin(a) * 2.4 * s, 2.1 * s, 1.6 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f6e0a0';
    ctx.beginPath();
    ctx.arc(fx, fy - 9 * s, 1.3 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Fern / grass tuft. */
export function drawFern(ctx, x, y, scale, color, seed = 9) {
  const random = makeRandom(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (random() - 0.5) * 1.5;
    const len = (10 + random() * 12) * scale;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(angle) * len * 0.5, Math.sin(angle) * len * 0.7, Math.cos(angle) * len, Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** Climbing vine with leaves, used on walls and archways. */
export function drawVine(ctx, points, scale, palette, seed = 11) {
  const random = makeRandom(seed);
  ctx.save();
  ctx.strokeStyle = palette.stem;
  ctx.lineWidth = 2.2 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    for (let l = 0; l < 2; l++) {
      const a = random() * Math.PI * 2;
      ctx.fillStyle = l % 2 ? palette.leaf : palette.leafDark;
      ctx.save();
      ctx.translate(p.x + Math.cos(a) * 4 * scale, p.y + Math.sin(a) * 4 * scale);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5 * scale, 2.8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------
   Structures
   ------------------------------------------------------------------------- */

/** A hanging lantern; `lit` drives the glow. */
export function drawLantern(ctx, x, y, scale, lit, time = 0, palette = { metal: '#6b5a3e', glass: '#ffdb92' }) {
  ctx.save();
  ctx.translate(x, y);
  const flicker = lit ? 0.85 + Math.sin(time * 5 + x) * 0.15 : 0;

  if (lit) {
    const glow = ctx.createRadialGradient(0, -14 * scale, 0, 0, -14 * scale, 60 * scale);
    glow.addColorStop(0, rgba(palette.glass, 0.55 * flicker));
    glow.addColorStop(1, rgba(palette.glass, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -14 * scale, 60 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = palette.metal;
  ctx.lineWidth = 1.6 * scale;
  ctx.beginPath();
  ctx.arc(0, -26 * scale, 4 * scale, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Glass body.
  ctx.beginPath();
  ctx.moveTo(-7 * scale, -20 * scale);
  ctx.lineTo(7 * scale, -20 * scale);
  ctx.lineTo(5.5 * scale, -6 * scale);
  ctx.lineTo(-5.5 * scale, -6 * scale);
  ctx.closePath();
  ctx.fillStyle = lit ? rgba(palette.glass, 0.85 * flicker + 0.15) : 'rgba(190,200,220,0.28)';
  ctx.fill();
  ctx.strokeStyle = palette.metal;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  // Cap and base.
  ctx.fillStyle = palette.metal;
  ctx.beginPath();
  ctx.moveTo(-9 * scale, -20 * scale);
  ctx.lineTo(9 * scale, -20 * scale);
  ctx.lineTo(0, -27 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-7 * scale, -6 * scale, 14 * scale, 3 * scale);

  if (lit) {
    ctx.fillStyle = rgba('#fff6d8', 0.9);
    ctx.beginPath();
    ctx.ellipse(0, -12 * scale, 2.4 * scale, 3.4 * scale * flicker, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A standing lamp post: pole plus lantern. */
export function drawLampPost(ctx, x, y, scale, lit, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = rgba('#000000', 0.3);
  ctx.beginPath();
  ctx.ellipse(0, 0, 10 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4b3f2c';
  ctx.lineWidth = 3.4 * scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -46 * scale);
  ctx.quadraticCurveTo(0, -54 * scale, 10 * scale, -54 * scale);
  ctx.stroke();
  ctx.restore();
  drawLantern(ctx, x + 10 * scale, y - 28 * scale, scale, lit, time);
}

/** The cozy woodland cottage, drawn from the front. */
export function drawCottage(ctx, x, y, scale, palette, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  const w = 150 * scale;
  const h = 90 * scale;

  ctx.fillStyle = rgba('#000000', 0.32);
  ctx.beginPath();
  ctx.ellipse(0, 4 * scale, w * 0.62, 16 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Walls.
  ctx.fillStyle = palette.wall;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2 + 4 * scale, -h);
  ctx.lineTo(w / 2 - 4 * scale, -h);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();

  // Timber framing.
  ctx.strokeStyle = palette.timber;
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 10 * scale, 0); ctx.lineTo(-w / 2 + 14 * scale, -h);
  ctx.moveTo(w / 2 - 10 * scale, 0); ctx.lineTo(w / 2 - 14 * scale, -h);
  ctx.moveTo(-w / 2 + 6 * scale, -h * 0.55); ctx.lineTo(w / 2 - 6 * scale, -h * 0.55);
  ctx.stroke();

  // Thatched roof.
  ctx.fillStyle = palette.roof;
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 16 * scale, -h + 4 * scale);
  ctx.quadraticCurveTo(0, -h - 62 * scale, w / 2 + 16 * scale, -h + 4 * scale);
  ctx.quadraticCurveTo(0, -h + 18 * scale, -w / 2 - 16 * scale, -h + 4 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba('#000000', 0.14);
  ctx.lineWidth = 1.4 * scale;
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 13 * scale, -h + 6 * scale);
    ctx.quadraticCurveTo(i * 9 * scale, -h - 24 * scale, i * 5 * scale, -h - 44 * scale + Math.abs(i) * 6 * scale);
    ctx.stroke();
  }

  // Door with a rounded top and three small stars carved above it.
  ctx.fillStyle = palette.door;
  ctx.beginPath();
  ctx.moveTo(-16 * scale, 0);
  ctx.lineTo(-16 * scale, -34 * scale);
  ctx.quadraticCurveTo(0, -50 * scale, 16 * scale, -34 * scale);
  ctx.lineTo(16 * scale, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = palette.timber;
  ctx.lineWidth = 3 * scale;
  ctx.stroke();
  ctx.fillStyle = palette.brass;
  ctx.beginPath();
  ctx.arc(10 * scale, -18 * scale, 2.4 * scale, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -1; i <= 1; i++) {
    starPath(ctx, i * 9 * scale, -54 * scale, 3.2 * scale);
    ctx.fillStyle = palette.brass;
    ctx.fill();
  }

  // Windows, warmly lit and gently flickering.
  const glow = 0.75 + Math.sin(time * 2.1) * 0.12;
  for (const wx of [-46, 46]) {
    ctx.fillStyle = rgba(palette.window, glow);
    ctx.beginPath();
    ctx.roundRect(wx * scale - 15 * scale, -62 * scale, 30 * scale, 30 * scale, 4 * scale);
    ctx.fill();
    ctx.strokeStyle = palette.timber;
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx * scale, -62 * scale); ctx.lineTo(wx * scale, -32 * scale);
    ctx.moveTo(wx * scale - 15 * scale, -47 * scale); ctx.lineTo(wx * scale + 15 * scale, -47 * scale);
    ctx.stroke();
  }

  // Chimney with a curl of smoke.
  ctx.fillStyle = palette.stone;
  ctx.fillRect(w * 0.24, -h - 52 * scale, 16 * scale, 30 * scale);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#d9d4e6';
  for (let i = 0; i < 5; i++) {
    const t = time * 0.5 + i * 0.9;
    const px = x + w * 0.24 + 8 * scale + Math.sin(t) * 10 * scale;
    const py = y - 90 * scale - 60 * scale - ((t * 14) % 70) * scale;
    ctx.beginPath();
    ctx.arc(px, py, (5 + i * 2) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Distant castle silhouette on the horizon. */
export function drawCastleSilhouette(ctx, x, y, scale, color, glow) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  const towers = [
    { x: -70, w: 26, h: 96 },
    { x: -34, w: 20, h: 70 },
    { x: 0, w: 42, h: 120 },
    { x: 40, w: 20, h: 74 },
    { x: 74, w: 26, h: 92 }
  ];
  ctx.beginPath();
  ctx.rect(-90 * scale, -56 * scale, 180 * scale, 56 * scale);
  ctx.fill();
  for (const t of towers) {
    ctx.beginPath();
    ctx.rect((t.x - t.w / 2) * scale, -t.h * scale, t.w * scale, t.h * scale);
    ctx.fill();
    // Conical roof.
    ctx.beginPath();
    ctx.moveTo((t.x - t.w / 2 - 4) * scale, -t.h * scale);
    ctx.lineTo(t.x * scale, (-t.h - 26) * scale);
    ctx.lineTo((t.x + t.w / 2 + 4) * scale, -t.h * scale);
    ctx.closePath();
    ctx.fill();
  }
  if (glow) {
    ctx.fillStyle = glow;
    for (const t of towers) {
      for (let i = 0; i < 2; i++) {
        ctx.fillRect((t.x - 3) * scale, (-t.h + 18 + i * 22) * scale, 6 * scale, 9 * scale);
      }
    }
  }
  ctx.restore();
}

/** Stone archway used for doorways between areas. */
export function drawArch(ctx, x, y, scale, palette, openGlow) {
  ctx.save();
  ctx.translate(x, y);
  const w = 56 * scale;
  const h = 84 * scale;
  ctx.fillStyle = palette.stoneDark;
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 10 * scale, 0);
  ctx.lineTo(-w / 2 - 10 * scale, -h * 0.6);
  ctx.quadraticCurveTo(0, -h - 22 * scale, w / 2 + 10 * scale, -h * 0.6);
  ctx.lineTo(w / 2 + 10 * scale, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = openGlow || palette.doorway;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2, -h * 0.55);
  ctx.quadraticCurveTo(0, -h - 4 * scale, w / 2, -h * 0.55);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();

  // Stone courses.
  ctx.strokeStyle = rgba('#000000', 0.2);
  ctx.lineWidth = 1.5 * scale;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 10 * scale, -i * 16 * scale);
    ctx.lineTo(-w / 2, -i * 16 * scale);
    ctx.moveTo(w / 2, -i * 16 * scale);
    ctx.lineTo(w / 2 + 10 * scale, -i * 16 * scale);
    ctx.stroke();
  }
  ctx.restore();
}

/** Three silver stars, the recurring mark of the kingdom's oldest promise. */
export function drawThreeStars(ctx, x, y, scale, color, lit = [true, true, true], time = 0) {
  for (let i = 0; i < 3; i++) {
    const px = x + (i - 1) * 14 * scale;
    const py = y + (i === 1 ? -5 * scale : 0);
    const on = lit[i];
    ctx.save();
    if (on) {
      const pulse = 0.7 + Math.sin(time * 2 + i * 1.4) * 0.3;
      const g = ctx.createRadialGradient(px, py, 0, px, py, 18 * scale);
      g.addColorStop(0, rgba(color, 0.55 * pulse));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 18 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    starPath(ctx, px, py, 6 * scale);
    ctx.fillStyle = on ? color : rgba(color, 0.22);
    ctx.fill();
    ctx.restore();
  }
}

export function starPath(ctx, x, y, radius, points = 4, innerRatio = 0.36) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * innerRatio;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/* -------------------------------------------------------------------------
   Sky
   ------------------------------------------------------------------------- */

/** Night sky gradient plus a fixed field of stars. */
export function paintNightSky(ctx, width, height, { top, bottom, starCount = 90, seed = 42 }) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  const random = makeRandom(seed);
  for (let i = 0; i < starCount; i++) {
    const x = random() * width;
    const y = random() * height * 0.8;
    const r = random() * 1.3 + 0.3;
    ctx.fillStyle = rgba('#ffffff', 0.25 + random() * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawMoon(ctx, x, y, radius, time = 0) {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius * 4.2);
  glow.addColorStop(0, 'rgba(255,247,222,0.32)');
  glow.addColorStop(1, 'rgba(255,247,222,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fdf4dc';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(214,206,182,0.55)';
  const craters = [[-0.3, -0.2, 0.22], [0.28, 0.12, 0.16], [0.02, 0.42, 0.12], [-0.42, 0.3, 0.1]];
  for (const [cx, cy, cr] of craters) {
    ctx.beginPath();
    ctx.arc(x + cx * radius, y + cy * radius, cr * radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.5 + Math.sin(time * 0.6) * 0.08;
  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * The personal star: brighter and warmer than the rest, with a slow four-point
 * flare. It appears in every chapter's sky and is never explained until the end.
 */
export function drawPersonalStar(ctx, x, y, time, scale = 1, color = '#ffe9a8') {
  const pulse = 0.78 + Math.sin(time * 1.3) * 0.22;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 34 * scale * pulse);
  glow.addColorStop(0, rgba(color, 0.75));
  glow.addColorStop(0.35, rgba(color, 0.25));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 34 * scale * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(color, 0.95);
  starPath(ctx, x, y, 9 * scale * pulse, 4, 0.22);
  ctx.fill();
  starPath(ctx, x, y, 5.5 * scale, 4, 0.3);
  ctx.fillStyle = '#fffdf4';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/* -------------------------------------------------------------------------
   Atmosphere and depth
   ------------------------------------------------------------------------- */

/** Soft drifting bands of mist, baked into a scene's background buffer. */
export function paintMist(ctx, width, height, color, seed = 3, bands = 7) {
  const random = makeRandom(seed);
  ctx.save();
  for (let i = 0; i < bands; i++) {
    const y = height * (0.18 + random() * 0.75);
    const h = 90 + random() * 180;
    const gradient = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - h / 2, width, h);
  }
  ctx.restore();
}

/**
 * Pools of moonlight on the ground. These are drawn live rather than baked so
 * they can breathe, which is what stops a flat top-down floor reading as felt.
 */
export function drawLightPools(ctx, pools, time, color, intensity = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    const pulse = 0.82 + Math.sin(time * 0.7 + i * 1.9) * 0.18;
    const r = pool.r * pulse;
    const gradient = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, r);
    gradient.addColorStop(0, rgba(color, 0.5 * intensity));
    gradient.addColorStop(0.55, rgba(color, 0.16 * intensity));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(pool.x, pool.y, r, r * (pool.squash ?? 0.62), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A warm pool of light beneath a lantern or a lit window. */
export function drawLightPool(ctx, x, y, radius, color, intensity = 1, squash = 0.5) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, rgba(color, 0.42 * intensity));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Grass and flower heads that lean in a slow breeze. Only the tufts near the
 * camera are animated; the rest of the undergrowth stays baked.
 */
export function drawSwayingTufts(ctx, tufts, time, bounds) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < tufts.length; i++) {
    const tuft = tufts[i];
    if (tuft.x < bounds.left || tuft.x > bounds.right || tuft.y < bounds.top || tuft.y > bounds.bottom) continue;
    const lean = Math.sin(time * 1.4 + tuft.phase) * tuft.amp;
    ctx.strokeStyle = tuft.color;
    ctx.lineWidth = tuft.width;
    for (let blade = -1; blade <= 1; blade++) {
      ctx.beginPath();
      ctx.moveTo(tuft.x + blade * tuft.width * 1.6, tuft.y);
      ctx.quadraticCurveTo(
        tuft.x + blade * tuft.width * 1.6 + lean * 0.5,
        tuft.y - tuft.height * 0.6,
        tuft.x + blade * tuft.width * 1.6 + lean,
        tuft.y - tuft.height
      );
      ctx.stroke();
    }
    if (tuft.bloom) {
      ctx.fillStyle = tuft.bloom;
      ctx.beginPath();
      ctx.arc(tuft.x + lean, tuft.y - tuft.height, tuft.width * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Screen-space foreground foliage. Drawn after everything else with a slight
 * camera-driven offset, which gives a flat top-down scene real depth for very
 * little cost.
 */
export function drawForegroundFoliage(ctx, width, height, sprite, camera, strength = 0.04) {
  const offsetX = -camera.x * strength;
  const offsetY = -camera.y * strength;
  ctx.save();
  ctx.globalAlpha = 0.72;
  sprite.draw(ctx, offsetX, offsetY);
  ctx.translate(width, height);
  ctx.rotate(Math.PI);
  sprite.draw(ctx, -offsetX, -offsetY);
  ctx.restore();
}

/** Slow clouds crossing a night sky. */
export function drawClouds(ctx, bounds, time, color, count = 4, seed = 9) {
  const random = makeRandom(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const baseY = bounds.y + random() * bounds.height;
    const scale = 0.6 + random() * 0.9;
    const speed = 4 + random() * 7;
    const span = bounds.width + 400;
    const x = bounds.x - 200 + ((random() * span + time * speed) % span);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let lobe = 0; lobe < 5; lobe++) {
      const lx = x + lobe * 26 * scale;
      const ly = baseY + Math.sin(lobe * 1.7) * 6 * scale;
      ctx.moveTo(lx + 30 * scale, ly);
      ctx.arc(lx, ly, (18 + (lobe % 2) * 10) * scale, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------
   Interface bits drawn in the world
   ------------------------------------------------------------------------- */

/**
 * The marker over anything the player can interact with.
 *
 * It is never colour alone: the shape changes as well as the tint, the ring
 * closes when the object is in reach, and the whole thing bobs, so it reads on
 * a small screen and to anyone who cannot separate the two golds.
 */
export function drawInteractPrompt(ctx, x, y, time, color = '#ffdb92', ready = true, reducedMotion = false) {
  const bob = reducedMotion ? 0 : Math.sin(time * 3.2) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.globalAlpha = ready ? 1 : 0.45;

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, ready ? 22 : 16);
  glow.addColorStop(0, rgba(color, ready ? 0.55 : 0.3));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, ready ? 22 : 16, 0, Math.PI * 2);
  ctx.fill();

  if (ready) {
    // A closed ring plus a filled star: in range.
    const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 4) * 0.08;
    ctx.strokeStyle = rgba(color, 0.9);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 11 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    starPath(ctx, 0, 0, 7, 4, 0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,22,44,0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // A small downward chevron pointing at the object.
    ctx.strokeStyle = rgba(color, 0.85);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, 15);
    ctx.lineTo(0, 19);
    ctx.lineTo(4, 15);
    ctx.stroke();
  } else {
    // A broken ring and a hollow centre: something is here, but not in reach.
    ctx.strokeStyle = rgba(color, 0.75);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 8, i * Math.PI / 2 + 0.24, (i + 1) * Math.PI / 2 - 0.24);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * Soft vignette that focuses attention toward the middle of the screen.
 * Kept deliberately gentle: the centre must stay bright enough to read on a
 * phone at normal brightness.
 */
export function drawVignette(ctx, width, height, strength = 0.45, tint = '#0a0718') {
  const inner = Math.min(width, height) * 0.42;
  const outer = Math.max(width, height) * 0.78;
  const g = ctx.createRadialGradient(width / 2, height / 2, inner, width / 2, height / 2, outer);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, rgba(tint, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

/**
 * A whole-screen colour wash that gives each chapter its own air: cool blue in
 * the woods, warm amber at the cottage, silver in the hall.
 */
export function drawAtmosphere(ctx, width, height, color, strength = 0.1) {
  if (strength <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = rgba(color, Math.min(1, strength * 3));
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
