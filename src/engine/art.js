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

/**
 * Accepts `#abc`, `#aabbcc` and `rgb(...)`/`rgba(...)`.
 *
 * The `rgb()` case matters: `mix()` returns one, and mixed colours are
 * routinely mixed again or faded with `rgba()`. Parsing only hex made those
 * calls produce an invalid colour, which canvas silently ignores — leaving
 * whatever fill style happened to be set before.
 */
export function hexToRgb(color) {
  if (typeof color !== 'string') return [0, 0, 0];
  if (color.startsWith('rgb')) {
    const parts = color.slice(color.indexOf('(') + 1, color.indexOf(')')).split(',');
    return [
      Math.round(parseFloat(parts[0])) || 0,
      Math.round(parseFloat(parts[1])) || 0,
      Math.round(parseFloat(parts[2])) || 0
    ];
  }
  const clean = color.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
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

/**
 * Draws the trunk shared by the broadleaf shapes: a tapering, slightly leaning
 * column with bark grain and a lit edge.
 */
function paintTrunk(ctx, scale, palette, random, { height, width, lean, pale = false }) {
  const bark = pale ? mix(palette.bark, '#e8e2d6', 0.62) : palette.bark;
  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  ctx.quadraticCurveTo(-width / 2 + lean * 0.4, -height * 0.55, lean - width * 0.3, -height);
  ctx.lineTo(lean + width * 0.3, -height);
  ctx.quadraticCurveTo(width / 2 + lean * 0.4, -height * 0.55, width / 2, 0);
  ctx.closePath();
  ctx.fillStyle = bark;
  ctx.fill();

  // Lit edge on the moon side, shadow on the other.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba('#ffffff', pale ? 0.22 : 0.12);
  ctx.fillRect(-width / 2, -height, width * 0.34, height);
  ctx.fillStyle = rgba('#000000', 0.22);
  ctx.fillRect(width * 0.08, -height, width * 0.5, height);
  // Bark grain, or birch marks on a pale trunk.
  ctx.strokeStyle = rgba('#000000', pale ? 0.5 : 0.2);
  ctx.lineWidth = pale ? 2.2 * scale : 1.1 * scale;
  ctx.lineCap = 'round';
  const marks = pale ? 4 : 3;
  for (let i = 0; i < marks; i++) {
    const my = -height * (0.18 + random() * 0.7);
    ctx.beginPath();
    if (pale) {
      ctx.moveTo(-width * 0.36 + random() * width * 0.3, my);
      ctx.lineTo(-width * 0.06 + random() * width * 0.3, my + 1.2 * scale);
    } else {
      ctx.moveTo(-width * 0.22, my);
      ctx.quadraticCurveTo(0, my + 6 * scale, width * 0.22, my + 2 * scale);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Roots flaring into the ground.
  ctx.fillStyle = bark;
  ctx.beginPath();
  ctx.moveTo(-width * 0.9, 0);
  ctx.quadraticCurveTo(-width * 0.4, -width * 0.32, -width * 0.3, 0);
  ctx.lineTo(width * 0.3, 0);
  ctx.quadraticCurveTo(width * 0.4, -width * 0.32, width * 0.9, 0);
  ctx.closePath();
  ctx.fill();
}

/**
 * A canopy built from clumps rather than one disc: a dark mass, lit clumps
 * gathered toward the moon, and a scalloped rim of individual leaves. This is
 * what stops a forest reading as a field of identical circles.
 */
function paintCanopy(ctx, scale, palette, random, { cx, cy, radiusX, radiusY, clumps = 7 }) {
  const rim = [];
  for (let i = 0; i < clumps; i++) {
    const a = (i / clumps) * Math.PI * 2 + random() * 0.3;
    rim.push({
      x: cx + Math.cos(a) * radiusX * 0.52,
      y: cy + Math.sin(a) * radiusY * 0.52,
      r: (0.46 + random() * 0.24) * radiusX
    });
  }

  // Dark base mass.
  ctx.fillStyle = palette.leafDark;
  ctx.beginPath();
  for (const c of rim) {
    ctx.moveTo(c.x + c.r, c.y);
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  }
  ctx.fill();

  // Mid tone gathered up and to the left.
  ctx.fillStyle = palette.leaf;
  ctx.beginPath();
  for (const c of rim) {
    const lit = (c.x - cx) * -0.35 + (c.y - cy) * -0.35;
    const r = c.r * (0.62 + Math.max(0, lit / radiusX) * 0.3);
    ctx.moveTo(c.x - radiusX * 0.09 + r, c.y - radiusY * 0.12);
    ctx.arc(c.x - radiusX * 0.09, c.y - radiusY * 0.12, r, 0, Math.PI * 2);
  }
  ctx.fill();

  // Two or three brighter clumps catching the moonlight, kept to the top left.
  ctx.fillStyle = mix(palette.leaf, palette.rim, 0.26);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * (1.08 + i * 0.2);
    const r = radiusX * (0.15 + random() * 0.1);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * radiusX * 0.4, cy + Math.sin(a) * radiusY * 0.46, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shade gathering under the lower right, as a soft gradient so it never
  // reads as a second, darker blob sitting on top of the leaves.
  const shade = ctx.createRadialGradient(
    cx + radiusX * 0.22, cy + radiusY * 0.5, radiusX * 0.1,
    cx + radiusX * 0.22, cy + radiusY * 0.5, radiusX * 0.95
  );
  shade.addColorStop(0, 'rgba(0,0,0,0.2)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.beginPath();
  for (const c of rim) {
    ctx.moveTo(c.x + c.r, c.y);
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  }
  ctx.clip();
  ctx.fillStyle = shade;
  ctx.fillRect(cx - radiusX * 1.4, cy - radiusY * 1.4, radiusX * 2.8, radiusY * 2.8);
  ctx.restore();
}

/**
 * A storybook tree. `species` picks the silhouette; every tree also shifts its
 * own greens a little, so no two are quite the same colour.
 */
export function drawTree(ctx, x, y, scale, palette, seed = 1, species = 'oak') {
  const random = makeRandom(seed);
  // Per-tree colour drift keeps a forest from looking stamped.
  const drift = (random() - 0.5) * 0.34;
  const tinted = {
    bark: mix(palette.bark, drift > 0 ? '#5a4038' : '#241a20', Math.abs(drift) * 0.7),
    leaf: mix(palette.leaf, drift > 0 ? '#6aa878' : '#1f5a56', Math.abs(drift)),
    leafDark: mix(palette.leafDark, drift > 0 ? '#2b6a4c' : '#14342e', Math.abs(drift) * 0.8),
    rim: palette.rim
  };

  ctx.save();
  ctx.translate(x, y);

  // Contact shadow, softer and offset away from the moon.
  const shadow = ctx.createRadialGradient(6 * scale, 2 * scale, 0, 6 * scale, 2 * scale, 34 * scale);
  shadow.addColorStop(0, 'rgba(0,0,0,0.34)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(6 * scale, 2 * scale, 34 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (species === 'shrub') {
    paintCanopy(ctx, scale, tinted, random, {
      cx: 0, cy: -16 * scale, radiusX: 26 * scale, radiusY: 18 * scale, clumps: 5
    });
    ctx.restore();
    return;
  }

  if (species === 'pine') {
    const trunkH = 34 * scale;
    paintTrunk(ctx, scale, tinted, random, { height: trunkH, width: 10 * scale, lean: 0 });
    // Three stacked tiers, widest at the bottom.
    for (let tier = 0; tier < 3; tier++) {
      const w = (38 - tier * 9) * scale;
      const ty = -trunkH - tier * 26 * scale;
      const h = 34 * scale;
      ctx.fillStyle = tier % 2 ? tinted.leaf : tinted.leafDark;
      ctx.beginPath();
      ctx.moveTo(-w, ty);
      // A scalloped lower edge instead of a straight triangle.
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const px = -w + t * w * 2;
        const py = ty + Math.sin(t * Math.PI * 3) * 3.5 * scale;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(0, ty - h);
      ctx.closePath();
      ctx.fill();
      // Moonlit left face.
      ctx.fillStyle = rgba(tinted.rim, 0.12);
      ctx.beginPath();
      ctx.moveTo(-w, ty);
      ctx.lineTo(0, ty - h);
      ctx.lineTo(-w * 0.2, ty);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (species === 'willow') {
    const trunkH = 40 * scale;
    const lean = (random() - 0.5) * 10 * scale;
    paintTrunk(ctx, scale, tinted, random, { height: trunkH, width: 13 * scale, lean });
    ctx.translate(lean, 0);
    paintCanopy(ctx, scale, tinted, random, {
      cx: 0, cy: -trunkH - 20 * scale, radiusX: 40 * scale, radiusY: 24 * scale, clumps: 6
    });
    // Trailing fronds.
    ctx.strokeStyle = tinted.leaf;
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const fx = (-1 + (i / 8) * 2) * 34 * scale;
      const len = (16 + random() * 26) * scale;
      ctx.lineWidth = (1.4 + random() * 0.9) * scale;
      ctx.beginPath();
      ctx.moveTo(fx, -trunkH - 14 * scale);
      ctx.quadraticCurveTo(fx + 4 * scale, -trunkH - 14 * scale + len * 0.6, fx - 2 * scale, -trunkH - 14 * scale + len);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (species === 'birch') {
    const trunkH = 60 * scale;
    const lean = (random() - 0.5) * 12 * scale;
    paintTrunk(ctx, scale, tinted, random, { height: trunkH, width: 9 * scale, lean, pale: true });
    ctx.translate(lean, 0);
    // Airy canopy: three small clumps rather than one mass.
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * (0.85 + i * 0.4);
      paintCanopy(ctx, scale, tinted, random, {
        cx: Math.cos(a) * 15 * scale,
        cy: -trunkH - 12 * scale + Math.sin(a) * 8 * scale,
        radiusX: (17 + random() * 6) * scale,
        radiusY: (13 + random() * 4) * scale,
        clumps: 4
      });
    }
    ctx.restore();
    return;
  }

  // Oak: the default broadleaf.
  const trunkH = 44 * scale;
  const lean = (random() - 0.5) * 9 * scale;
  paintTrunk(ctx, scale, tinted, random, { height: trunkH, width: 14 * scale, lean });
  ctx.translate(lean, 0);
  paintCanopy(ctx, scale, tinted, random, {
    cx: 0,
    cy: -trunkH - 22 * scale,
    radiusX: (42 + random() * 8) * scale,
    radiusY: (30 + random() * 6) * scale,
    clumps: 7
  });

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
   Formal garden
   ------------------------------------------------------------------------- */

/**
 * A clipped hedge run following `points`. Built from overlapping clumps with a
 * lit crown and a shaded base, so a garden wall never reads as a green bar.
 */
export function paintHedgeWall(ctx, points, {
  thickness = 40, height = 46, leaf = '#2f6a4e', leafDark = '#1c4231',
  crown = '#4f8f63', seed = 71
} = {}) {
  const random = makeRandom(seed);

  // Clumps are laid along the run as circles rather than upright ellipses, so
  // a hedge reads the same whether it runs across the view or away from it.
  const clumps = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(2, Math.round(span / (thickness * 0.3)));
    const nx = (b.y - a.y) / (span || 1);
    const ny = -(b.x - a.x) / (span || 1);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const jitter = (random() - 0.5) * thickness * 0.2;
      clumps.push({
        x: lerp(a.x, b.x, t) + nx * jitter,
        y: lerp(a.y, b.y, t) + ny * jitter,
        r: thickness * (0.46 + random() * 0.16),
        h: height * (0.86 + random() * 0.24),
        top: random() < 0.5
      });
    }
  }

  const disc = (c, r, dy) => {
    ctx.moveTo(c.x + r, c.y + dy);
    ctx.arc(c.x, c.y + dy, r, 0, Math.PI * 2);
  };

  // Shadow on the lawn at the foot of the hedge.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  for (const c of clumps) disc(c, c.r * 1.04, 6);
  ctx.fill();

  // The dark body, drawn as one union so the seams disappear.
  ctx.fillStyle = leafDark;
  ctx.beginPath();
  for (const c of clumps) disc(c, c.r, -c.h * 0.36);
  ctx.fill();

  // Mid-tone leaves gathered toward the moon side.
  ctx.fillStyle = leaf;
  ctx.beginPath();
  for (const c of clumps) disc(c, c.r * 0.84, -c.h * 0.56);
  ctx.fill();

  // The lit crown is a continuous ribbon along the run, not one highlight per
  // clump — dots would bead up the moment a hedge ran away from the camera.
  ctx.save();
  ctx.strokeStyle = crown;
  ctx.lineWidth = thickness * 0.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = p.x - thickness * 0.14;
    const y = p.y - height * 0.72;
    return i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  // A little broken texture along that crown so it is not a painted stripe.
  ctx.fillStyle = leaf;
  ctx.beginPath();
  for (const c of clumps) {
    if (c.top) continue;
    ctx.moveTo(c.x - c.r * 0.14 + c.r * 0.32, c.y - c.h * 0.72);
    ctx.arc(c.x - c.r * 0.14, c.y - c.h * 0.72, c.r * 0.32, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * A rose arbour over a path: two posts, a keystone arch, cross-battens and
 * climbing roses. `openings` are drawn as one piece so the arch stays legible
 * against a dark lawn.
 */
export function drawRoseArch(ctx, x, y, scale = 1, {
  wood = '#5b4630', woodLight = '#7a5f40', leaf = '#3d7c57', leafDark = '#255139',
  bloom = '#f0d5ea', bloomWarm = '#ffe6b8'
} = {}, seed = 17) {
  const random = makeRandom(seed);
  const halfWidth = 46 * scale;
  const height = 88 * scale;
  const springs = height * 0.62;

  ctx.save();
  ctx.translate(x, y);

  // Only the posts cast shadow — the opening is meant to be walked through.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * halfWidth, 1, 11 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Frame.
  ctx.strokeStyle = wood;
  ctx.lineCap = 'round';
  ctx.lineWidth = 7 * scale;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * halfWidth, 0);
    ctx.lineTo(side * halfWidth, -springs);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-halfWidth, -springs);
  ctx.quadraticCurveTo(0, -height - 14 * scale, halfWidth, -springs);
  ctx.stroke();

  // A lighter edge along the left of every member, so the wood has a form.
  ctx.strokeStyle = woodLight;
  ctx.lineWidth = 2.2 * scale;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * halfWidth - 2 * scale, -2 * scale);
    ctx.lineTo(side * halfWidth - 2 * scale, -springs);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-halfWidth, -springs - 2 * scale);
  ctx.quadraticCurveTo(0, -height - 17 * scale, halfWidth, -springs - 2 * scale);
  ctx.stroke();

  // Battens across the crown, set along the curve of the arch itself.
  ctx.strokeStyle = wood;
  ctx.lineWidth = 3 * scale;
  const crownAt = (t) => {
    const u = 1 - t;
    return {
      x: u * u * -halfWidth + 2 * u * t * 0 + t * t * halfWidth,
      y: u * u * -springs + 2 * u * t * (-height - 14 * scale) + t * t * -springs
    };
  };
  for (let i = 1; i <= 5; i++) {
    const p = crownAt(i / 6);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 5 * scale);
    ctx.lineTo(p.x, p.y + 9 * scale);
    ctx.stroke();
  }

  // Two horizontal rails on each post, so the trellis reads as built.
  ctx.lineWidth = 2.4 * scale;
  for (const t of [0.34, 0.68]) {
    const py = -springs * t;
    ctx.beginPath();
    ctx.moveTo(-halfWidth, py);
    ctx.lineTo(-halfWidth + 13 * scale, py);
    ctx.moveTo(halfWidth, py);
    ctx.lineTo(halfWidth - 13 * scale, py);
    ctx.stroke();
  }

  // Climbing growth: leaves first, then blooms, gathered at the crown.
  const points = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    if (t < 0.34) {
      points.push({ x: -halfWidth, y: -t / 0.34 * springs });
    } else if (t > 0.66) {
      points.push({ x: halfWidth, y: -(1 - t) / 0.34 * springs });
    } else {
      const u = (t - 0.34) / 0.32;
      const cx = lerp(-halfWidth, halfWidth, u);
      const cy = -springs - Math.sin(u * Math.PI) * (height - springs + 14 * scale);
      points.push({ x: cx, y: cy });
    }
  }
  for (const p of points) {
    for (let l = 0; l < 2; l++) {
      const a = random() * Math.PI * 2;
      ctx.fillStyle = l ? leafDark : leaf;
      ctx.save();
      ctx.translate(p.x + Math.cos(a) * 7 * scale, p.y + Math.sin(a) * 7 * scale);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.4 * scale, 3 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  for (const p of points) {
    if (random() < 0.62) continue;
    const r = (2.6 + random() * 1.8) * scale;
    const warm = random() < 0.34;
    ctx.fillStyle = warm ? bloomWarm : bloom;
    ctx.beginPath();
    ctx.arc(p.x + (random() - 0.5) * 12 * scale, p.y + (random() - 0.5) * 12 * scale, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * A still reflecting pool with a cut-stone rim. `reflect` is painted inside the
 * water and then veiled, which is what sells it as a reflection rather than a
 * picture lying on the grass.
 */
export function paintPool(ctx, x, y, radiusX, radiusY, {
  water = '#16303f', waterLight = '#27566a', rim = '#b3aa98', rimDark = '#7d7768',
  seed = 33, reflect = null
} = {}) {
  const random = makeRandom(seed);

  ctx.save();
  // Stone kerb, cut into segments.
  const segments = Math.max(14, Math.round(radiusX / 5));
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 0.92) / segments) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? rim : mix(rim, rimDark, 0.45);
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX + 8, radiusY + 6, 0, a0, a1);
    ctx.ellipse(x, y, radiusX - 1, radiusY - 1, 0, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }

  // Water.
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.clip();
  const depth = ctx.createLinearGradient(0, y - radiusY, 0, y + radiusY);
  depth.addColorStop(0, waterLight);
  depth.addColorStop(1, water);
  ctx.fillStyle = depth;
  ctx.fillRect(x - radiusX, y - radiusY, radiusX * 2, radiusY * 2);

  if (reflect) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    reflect(ctx);
    ctx.restore();
    ctx.fillStyle = rgba(water, 0.34);
    ctx.fillRect(x - radiusX, y - radiusY, radiusX * 2, radiusY * 2);
  }

  // Surface ripples.
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    const ry = y - radiusY + random() * radiusY * 2;
    const half = radiusX * (0.2 + random() * 0.5);
    const cx = x + (random() - 0.5) * radiusX * 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - half, ry);
    ctx.quadraticCurveTo(cx, ry - 2, cx + half, ry);
    ctx.stroke();
  }

  // Lily pads.
  for (let i = 0; i < 5; i++) {
    const a = random() * Math.PI * 2;
    const d = 0.3 + random() * 0.6;
    const px = x + Math.cos(a) * radiusX * d;
    const py = y + Math.sin(a) * radiusY * d;
    const pr = 6 + random() * 5;
    ctx.fillStyle = i % 2 ? '#2f6a4e' : '#3d7c57';
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.62, a, 0.35, Math.PI * 2 + 0.05);
    ctx.closePath();
    ctx.fill();
    if (random() < 0.4) {
      ctx.fillStyle = '#f4e3f0';
      ctx.beginPath();
      ctx.arc(px + 1, py - 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * A topiary in a stone urn. `shape` is 'star' or 'ball'; the star ones flank
 * things that matter.
 */
export function drawTopiary(ctx, x, y, scale = 1, {
  leaf = '#3d7c57', leafDark = '#245139', crown = '#5da074', stone = '#b3aa98', stoneDark = '#857f70'
} = {}, seed = 5, shape = 'ball') {
  const random = makeRandom(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Urn: a footed bowl rather than a block, lit down its left side.
  const body = ctx.createLinearGradient(-13, 0, 13, 0);
  body.addColorStop(0, mix(stone, '#ffffff', 0.16));
  body.addColorStop(0.55, stone);
  body.addColorStop(1, mix(stoneDark, '#000000', 0.2));

  ctx.fillStyle = mix(stoneDark, '#000000', 0.15);
  ctx.beginPath();
  ctx.ellipse(0, -1, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-7, -5);
  ctx.quadraticCurveTo(-14, -13, -12, -23);
  ctx.lineTo(12, -23);
  ctx.quadraticCurveTo(14, -13, 7, -5);
  ctx.closePath();
  ctx.fill();

  // Rim and a band of moulding.
  ctx.fillStyle = mix(stone, '#ffffff', 0.1);
  ctx.beginPath();
  ctx.ellipse(0, -24, 14, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(stoneDark, '#000000', 0.1);
  ctx.beginPath();
  ctx.ellipse(0, -24, 10.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(stoneDark, 0.7);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-12.5, -18);
  ctx.quadraticCurveTo(0, -15.6, 12.5, -18);
  ctx.stroke();

  // Stem.
  ctx.strokeStyle = '#4b3f2c';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, -23);
  ctx.lineTo(0, -42);
  ctx.stroke();

  const paintMass = (cy, r) => {
    ctx.fillStyle = leafDark;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * r * 0.45 + r * 0.62, cy + Math.sin(a) * r * 0.45);
      ctx.arc(Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, r * 0.62, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = leaf;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * r * 0.4 - r * 0.1 + r * 0.46, cy + Math.sin(a) * r * 0.4 - r * 0.12);
      ctx.arc(Math.cos(a) * r * 0.4 - r * 0.1, cy + Math.sin(a) * r * 0.4 - r * 0.12, r * 0.46, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = crown;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-r * (0.1 + random() * 0.3), cy - r * (0.5 + random() * 0.2), r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (shape === 'star') {
    paintMass(-52, 15);
    ctx.fillStyle = '#ffe9a8';
    starPath(ctx, 0, -76, 11, 4, 0.34);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,233,168,0.28)';
    starPath(ctx, 0, -76, 17, 4, 0.3);
    ctx.fill();
  } else {
    paintMass(-52, 16);
    paintMass(-78, 11);
  }

  ctx.restore();
}

/**
 * A bordered parterre bed: clipped edging, turned soil, and blooms massed
 * thickly enough that the bed reads as planting rather than a hole in the lawn.
 */
export function paintParterre(ctx, x, y, width, height, {
  edge = '#2f6a4e', edgeDark = '#1c4231', soil = '#4b3c2c',
  colors = ['#f0d5ea', '#ffe6b8', '#c7b6ea'], seed = 9
} = {}) {
  const random = makeRandom(seed);
  const hw = width / 2;
  const hh = height / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y + hh * 0.42, hw * 1.02, hh * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Turned soil, lit from the moon side so the bed sits proud of the grass.
  const bed = ctx.createLinearGradient(0, y - hh, 0, y + hh);
  bed.addColorStop(0, mix(soil, '#8d7256', 0.4));
  bed.addColorStop(1, mix(soil, '#160f09', 0.35));
  ctx.fillStyle = bed;
  ctx.beginPath();
  ctx.ellipse(x, y, hw, hh, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rake lines.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, hw, hh, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = rgba(mix(soil, '#000000', 0.4), 0.4);
  ctx.lineWidth = 1.4;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x - hw, y + (i * hh) / 3.2);
    ctx.quadraticCurveTo(x, y + (i * hh) / 3.2 - 3, x + hw, y + (i * hh) / 3.2);
    ctx.stroke();
  }
  ctx.restore();

  // Clipped edging all the way round.
  const steps = Math.max(18, Math.round((hw + hh) / 5));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const ex = x + Math.cos(a) * hw;
    const ey = y + Math.sin(a) * hh;
    ctx.fillStyle = Math.sin(a) > -0.2 ? edge : edgeDark;
    ctx.beginPath();
    ctx.arc(ex, ey, 5.4 + random() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Massed planting: foliage first, then blooms on top, thick enough to cover.
  const count = Math.round((hw * hh) / 26);
  const spots = [];
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * 0.86;
    spots.push({ x: x + Math.cos(a) * hw * d, y: y + Math.sin(a) * hh * d, r: 2.4 + random() * 1.6 });
  }
  spots.sort((a, b) => a.y - b.y);

  ctx.fillStyle = edgeDark;
  ctx.beginPath();
  for (const s of spots) {
    ctx.moveTo(s.x + s.r * 1.5, s.y + 2.6);
    ctx.arc(s.x, s.y + 2.6, s.r * 1.5, 0, Math.PI * 2);
  }
  ctx.fill();

  spots.forEach((s, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (i % 4 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.34, s.r * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
  });
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
export function paintMist(ctx, width, height, color, seed = 3, bands = 7, region = null) {
  const random = makeRandom(seed);
  const top = region ? region.top : height * 0.18;
  const span = region ? region.height : height * 0.75;
  ctx.save();
  for (let i = 0; i < bands; i++) {
    const y = top + random() * span;
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
    gradient.addColorStop(0, rgba(color, 0.36 * intensity));
    gradient.addColorStop(0.5, rgba(color, 0.12 * intensity));
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
