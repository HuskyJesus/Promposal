/**
 * Characters. Everyone in the game is drawn from shapes at runtime, with a
 * gentle idle bob and a two-step walk cycle so nobody ever stands perfectly
 * still.
 *
 * All characters are drawn with their feet at (0, 0) so scenes can sort them
 * by their y position and get correct overlapping for free.
 */

import { rgba, starPath } from './art.js';

/** Turns a movement vector into one of four drawn facings. */
export function facingFromVector(vx, vy, previous = 'down') {
  if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return previous;
  if (Math.abs(vx) > Math.abs(vy)) return vx > 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}

function shadow(ctx, radius, squash = 0.32) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * squash, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* -------------------------------------------------------------------------
   The heroine
   ------------------------------------------------------------------------- */

const HERO = {
  skin: '#b97c53',
  skinShade: '#9a6340',
  hair: '#2b1b22',
  hairShine: '#4a3140',
  cloak: '#2f6a63',
  cloakShade: '#22504b',
  dress: '#e6dcc6',
  dressShade: '#cbbd9f',
  trim: '#d98a9a',
  boot: '#5a3b2c'
};

/**
 * @param {object} opts
 * @param {'up'|'down'|'left'|'right'} opts.facing
 * @param {number} opts.time seconds
 * @param {boolean} opts.moving
 * @param {number} opts.scale 1 = about 46 world units tall
 */
export function drawHeroine(ctx, { x, y, facing = 'down', time = 0, moving = false, scale = 1 }) {
  const s = scale;
  const stride = moving ? Math.sin(time * 11) : 0;
  const bob = moving ? Math.abs(Math.sin(time * 11)) * 1.6 : Math.sin(time * 2) * 0.9;

  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 12 * s);
  ctx.translate(0, -bob * s);

  // Legs and boots.
  ctx.fillStyle = HERO.boot;
  for (const side of [-1, 1]) {
    const swing = stride * side * 3.2 * s;
    ctx.beginPath();
    ctx.roundRect(side * 4 * s - 2.6 * s + swing, -9 * s, 5.2 * s, 9 * s, 2 * s);
    ctx.fill();
  }

  // Dress / tunic.
  ctx.fillStyle = HERO.dress;
  ctx.beginPath();
  ctx.moveTo(-9 * s, -8 * s);
  ctx.quadraticCurveTo(-8 * s, -24 * s, -6 * s, -28 * s);
  ctx.lineTo(6 * s, -28 * s);
  ctx.quadraticCurveTo(8 * s, -24 * s, 9 * s, -8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HERO.dressShade;
  ctx.beginPath();
  ctx.moveTo(2 * s, -8 * s);
  ctx.quadraticCurveTo(5 * s, -22 * s, 6 * s, -28 * s);
  ctx.lineTo(6 * s, -28 * s);
  ctx.quadraticCurveTo(8 * s, -24 * s, 9 * s, -8 * s);
  ctx.closePath();
  ctx.fill();

  // Travelling cloak, lifting slightly while she walks.
  const flare = moving ? 2.4 : 0.9;
  ctx.fillStyle = HERO.cloak;
  ctx.beginPath();
  ctx.moveTo(-8 * s, -30 * s);
  ctx.quadraticCurveTo(-13 * s - flare * s, -18 * s, -10 * s - flare * s, -9 * s);
  ctx.lineTo(-5 * s, -12 * s);
  ctx.lineTo(5 * s, -12 * s);
  ctx.lineTo(10 * s + flare * s, -9 * s);
  ctx.quadraticCurveTo(13 * s + flare * s, -18 * s, 8 * s, -30 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HERO.trim;
  ctx.fillRect(-8 * s, -31 * s, 16 * s, 2.2 * s);

  // Arms.
  ctx.fillStyle = HERO.skin;
  for (const side of [-1, 1]) {
    const swing = -stride * side * 2.6 * s;
    ctx.beginPath();
    ctx.roundRect(side * 8.6 * s - 1.8 * s, -26 * s + swing, 3.6 * s, 12 * s, 1.8 * s);
    ctx.fill();
  }

  // Head.
  const headY = -37 * s;
  ctx.fillStyle = HERO.skin;
  ctx.beginPath();
  ctx.ellipse(0, headY, 7.4 * s, 8.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair: a big soft curly shape that changes with facing.
  ctx.fillStyle = HERO.hair;
  ctx.beginPath();
  ctx.ellipse(0, headY - 3 * s, 9.4 * s, 8.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  const curlSide = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 8.4 * s + curlSide * 1.2 * s, headY - 2 * s + Math.sin(a) * 6.5 * s, 3.4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (facing !== 'up') {
    // Face opening.
    ctx.fillStyle = HERO.skin;
    ctx.beginPath();
    ctx.ellipse(curlSide * 1.6 * s, headY + 1.4 * s, 6 * s, 6.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // A ribbon: three small blossoms tucked into her hair.
  ctx.fillStyle = HERO.trim;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-7 * s + i * 2.6 * s, headY - 7.4 * s + Math.abs(i - 1) * 1.1 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  if (facing !== 'up') {
    const eyeY = headY + 1.2 * s;
    const eyeShift = facing === 'left' ? -1.8 * s : facing === 'right' ? 1.8 * s : 0;
    // A slow blink keeps her looking alive.
    const blink = Math.sin(time * 0.9) > 0.985 ? 0.15 : 1;
    ctx.fillStyle = '#231a24';
    for (const side of [-1, 1]) {
      if (facing === 'left' && side > 0) continue;
      if (facing === 'right' && side < 0) continue;
      ctx.beginPath();
      ctx.ellipse(side * 2.6 * s + eyeShift, eyeY, 1.15 * s, 1.5 * s * blink, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = rgba('#d98a9a', 0.45);
    ctx.beginPath();
    ctx.ellipse(eyeShift, eyeY + 3.4 * s, 2.4 * s, 1.1 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/* -------------------------------------------------------------------------
   Theo — a small enchanted blue bear who is definitely royalty
   ------------------------------------------------------------------------- */

const THEO = {
  fur: '#6f9ee8',
  furDark: '#4e79bd',
  muzzle: '#cfe0f8',
  star: '#e8eefb',
  crown: '#e9b45f',
  nose: '#2c3550'
};

/**
 * Theo hovers rather than walks — he insists this is a royal privilege.
 * @param {'happy'|'proud'|'worried'|'sly'} opts.mood
 */
export function drawTheo(ctx, { x, y, time = 0, scale = 1, mood = 'happy', facing = 'down' }) {
  const s = scale;
  const float = Math.sin(time * 2.4) * 2.6;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 9 * s, 0.3);
  ctx.translate(0, -14 * s + float * s);

  // Ears.
  ctx.fillStyle = THEO.furDark;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 8 * s, -9 * s, 4.4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = THEO.muzzle;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 8 * s, -9 * s, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body.
  ctx.fillStyle = THEO.fur;
  ctx.beginPath();
  ctx.ellipse(0, 3 * s, 8.4 * s, 8.8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arms.
  const wave = Math.sin(time * 3.6) * 0.5;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 7.4 * s, 1.6 * s);
    ctx.rotate(side * (0.5 + wave * (side > 0 ? 1 : -1)));
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = THEO.muzzle;
  ctx.beginPath();
  ctx.ellipse(0, 5 * s, 4.6 * s, 4.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  ctx.fillStyle = THEO.fur;
  ctx.beginPath();
  ctx.ellipse(0, -6 * s, 9.2 * s, 8.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = THEO.muzzle;
  ctx.beginPath();
  ctx.ellipse(0, -3.4 * s, 4.4 * s, 3.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = THEO.nose;
  ctx.beginPath();
  ctx.ellipse(0, -4.6 * s, 1.5 * s, 1.1 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes react to his mood.
  ctx.fillStyle = THEO.nose;
  const eyeOffset = facing === 'left' ? -1 * s : facing === 'right' ? 1 * s : 0;
  for (const side of [-1, 1]) {
    const ex = side * 3.4 * s + eyeOffset;
    const ey = -8 * s;
    if (mood === 'sly') {
      ctx.lineWidth = 1.2 * s;
      ctx.strokeStyle = THEO.nose;
      ctx.beginPath();
      ctx.moveTo(ex - 1.6 * s, ey);
      ctx.lineTo(ex + 1.6 * s, ey - 0.6 * s);
      ctx.stroke();
    } else if (mood === 'worried') {
      ctx.beginPath();
      ctx.ellipse(ex, ey + 0.6 * s, 1.5 * s, 1.7 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(ex, ey, 1.5 * s, 1.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + 0.5 * s, ey - 0.6 * s, 0.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = THEO.nose;
    }
  }

  // Silver stars scattered across his fur.
  ctx.fillStyle = THEO.star;
  const starSpots = [[-5, 0], [4.6, 4], [-3, 7], [6, -8], [-7, -6]];
  for (let i = 0; i < starSpots.length; i++) {
    const [sx, sy] = starSpots[i];
    const twinkle = 0.55 + 0.45 * Math.sin(time * 3 + i * 1.7);
    ctx.globalAlpha = twinkle;
    starPath(ctx, sx * s, sy * s, 1.7 * s, 4, 0.3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The crown. He made it himself. Nobody has told him.
  ctx.fillStyle = THEO.crown;
  ctx.beginPath();
  ctx.moveTo(-5.4 * s, -13 * s);
  ctx.lineTo(-3.4 * s, -17 * s);
  ctx.lineTo(-1.2 * s, -13.8 * s);
  ctx.lineTo(1.2 * s, -17.4 * s);
  ctx.lineTo(3.4 * s, -13.8 * s);
  ctx.lineTo(5.4 * s, -17 * s);
  ctx.lineTo(5.4 * s, -12.4 * s);
  ctx.lineTo(-5.4 * s, -12.4 * s);
  ctx.closePath();
  ctx.fill();

  if (mood === 'proud') {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = THEO.star;
    starPath(ctx, 11 * s, -14 * s, 2.2 * s, 4, 0.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/* -------------------------------------------------------------------------
   Optional woodland characters
   ------------------------------------------------------------------------- */

/** Bartholomew the frog, a reliable source of unreliable news. */
export function drawFrog(ctx, { x, y, time = 0, scale = 1 }) {
  const s = scale;
  const puff = 1 + Math.sin(time * 2.6) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 10 * s, 0.3);
  ctx.fillStyle = '#5f9e5b';
  ctx.beginPath();
  ctx.ellipse(0, -7 * s, 10 * s * puff, 7.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d7e8b8';
  ctx.beginPath();
  ctx.ellipse(0, -4 * s, 6 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes on top.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#5f9e5b';
    ctx.beginPath();
    ctx.arc(side * 4.6 * s, -14 * s, 3.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7f3d8';
    ctx.beginPath();
    ctx.arc(side * 4.6 * s, -14 * s, 2.4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22331f';
    ctx.beginPath();
    ctx.arc(side * 4.6 * s, -14 * s, 1.1 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2f5a2c';
  ctx.lineWidth = 1.3 * s;
  ctx.beginPath();
  ctx.arc(0, -7 * s, 4.4 * s, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
}

/** A gossiping songbird perched on a branch. */
export function drawBird(ctx, { x, y, time = 0, scale = 1 }) {
  const s = scale;
  const hop = Math.abs(Math.sin(time * 2.2)) * 2;
  ctx.save();
  ctx.translate(x, y - hop * s);
  ctx.fillStyle = '#d98a9a';
  ctx.beginPath();
  ctx.ellipse(0, -6 * s, 6.4 * s, 5.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6e7c8';
  ctx.beginPath();
  ctx.ellipse(-1 * s, -4.6 * s, 3.6 * s, 3.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c2707f';
  ctx.beginPath();
  ctx.moveTo(3 * s, -8 * s);
  ctx.quadraticCurveTo(10 * s, -6 * s, 3 * s, -3 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d98a9a';
  ctx.beginPath();
  ctx.arc(-4.4 * s, -11 * s, 3.8 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9b45f';
  ctx.beginPath();
  ctx.moveTo(-8 * s, -11 * s);
  ctx.lineTo(-12 * s, -10 * s);
  ctx.lineTo(-8 * s, -9 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2c2233';
  ctx.beginPath();
  ctx.arc(-5.2 * s, -12 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Two flowers mid-argument about the moon and the sun. */
export function drawChattyFlowers(ctx, { x, y, time = 0, scale = 1 }) {
  const s = scale;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const sway = Math.sin(time * 1.8 + i * 2) * 0.16;
    ctx.save();
    ctx.translate(x + side * 9 * s, y);
    ctx.rotate(sway);
    ctx.strokeStyle = '#3d6b4f';
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -20 * s);
    ctx.stroke();
    ctx.fillStyle = i === 0 ? '#e9b45f' : '#c8b8e8';
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 4.4 * s, -20 * s + Math.sin(a) * 4.4 * s, 3.2 * s, 2.4 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f6e7c8';
    ctx.beginPath();
    ctx.arc(0, -20 * s, 3.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c2233';
    for (const eye of [-1.2, 1.2]) {
      ctx.beginPath();
      ctx.arc(eye * s, -20.6 * s, 0.7 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** One of the three guardians of the cottage clearing. */
export function drawGuardian(ctx, { x, y, symbol, time = 0, scale = 1, active = false }) {
  const s = scale;
  const hover = Math.sin(time * 1.6 + (symbol === 'stone' ? 0 : symbol === 'scroll' ? 2 : 4)) * 2;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 13 * s, 0.3);
  ctx.translate(0, -hover * s);

  // Stone plinth.
  ctx.fillStyle = '#6f6a63';
  ctx.beginPath();
  ctx.roundRect(-11 * s, -18 * s, 22 * s, 18 * s, 3 * s);
  ctx.fill();
  ctx.fillStyle = '#87817a';
  ctx.beginPath();
  ctx.roundRect(-13 * s, -22 * s, 26 * s, 6 * s, 3 * s);
  ctx.fill();

  // Floating emblem.
  const emblemY = -40 * s;
  if (active) {
    const g = ctx.createRadialGradient(0, emblemY, 0, 0, emblemY, 26 * s);
    g.addColorStop(0, 'rgba(233,180,95,0.45)');
    g.addColorStop(1, 'rgba(233,180,95,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, emblemY, 26 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  drawSymbolGlyph(ctx, 0, emblemY, 13 * s, symbol);
  ctx.restore();
}

/** Stone, Scroll and Shears — also used on the puzzle buttons. */
export function drawSymbolGlyph(ctx, x, y, r, symbol, palette = {}) {
  const stroke = palette.stroke || '#2f2338';
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.4, r * 0.12);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (symbol === 'stone') {
    ctx.fillStyle = palette.fill || '#9a958c';
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.3);
    ctx.lineTo(-r * 0.6, -r * 0.5);
    ctx.lineTo(0, -r * 0.85);
    ctx.lineTo(r * 0.7, -r * 0.45);
    ctx.lineTo(r * 0.9, r * 0.35);
    ctx.lineTo(0, r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, r * 0.2);
    ctx.lineTo(-r * 0.15, -r * 0.35);
    ctx.lineTo(r * 0.4, -r * 0.15);
    ctx.stroke();
  } else if (symbol === 'scroll') {
    ctx.fillStyle = palette.fill || '#f0e0bd';
    ctx.beginPath();
    ctx.roundRect(-r * 0.6, -r * 0.85, r * 1.2, r * 1.7, r * 0.14);
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(-r * 0.34, -r * 0.4 + i * r * 0.38);
      ctx.lineTo(r * 0.34, -r * 0.4 + i * r * 0.38);
    }
    ctx.stroke();
    // Rolled ends.
    ctx.fillStyle = palette.roll || '#d9c69a';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.85, r * 0.62, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.85, r * 0.62, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();
  } else {
    // Shears.
    ctx.strokeStyle = palette.metal || '#b8bec9';
    ctx.lineWidth = Math.max(2, r * 0.2);
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.8);
    ctx.lineTo(r * 0.45, r * 0.45);
    ctx.moveTo(r * 0.55, -r * 0.8);
    ctx.lineTo(-r * 0.45, r * 0.45);
    ctx.stroke();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.4, r * 0.12);
    ctx.beginPath();
    ctx.arc(-r * 0.5, r * 0.62, r * 0.28, 0, Math.PI * 2);
    ctx.moveTo(r * 0.78, r * 0.62);
    ctx.arc(r * 0.5, r * 0.62, r * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(0, -r * 0.05, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A talking portrait on the wall of the Monochrome Hall. */
export function drawWallPortrait(ctx, { x, y, time = 0, scale = 1, tone = 'dark', talking = false }) {
  const s = scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#c9a15c';
  ctx.beginPath();
  ctx.roundRect(-18 * s, -46 * s, 36 * s, 46 * s, 4 * s);
  ctx.fill();
  ctx.fillStyle = tone === 'dark' ? '#241f2e' : '#efeae0';
  ctx.beginPath();
  ctx.roundRect(-14 * s, -42 * s, 28 * s, 38 * s, 3 * s);
  ctx.fill();

  // A simple silhouette bust.
  ctx.fillStyle = tone === 'dark' ? '#dde5f2' : '#2a2434';
  ctx.beginPath();
  ctx.arc(0, -28 * s, 6.4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-11 * s, -4 * s);
  ctx.quadraticCurveTo(-9 * s, -20 * s, 0, -20 * s);
  ctx.quadraticCurveTo(9 * s, -20 * s, 11 * s, -4 * s);
  ctx.closePath();
  ctx.fill();

  if (talking) {
    const w = 2.4 + Math.abs(Math.sin(time * 8)) * 2;
    ctx.fillStyle = tone === 'dark' ? '#241f2e' : '#efeae0';
    ctx.beginPath();
    ctx.ellipse(0, -25 * s, w * s * 0.6, w * s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------
   Dialogue portraits
   ------------------------------------------------------------------------- */

const PORTRAIT_BACKDROPS = {
  hero: ['#3a2f52', '#20182f'],
  theo: ['#2a3f6b', '#16203a'],
  frog: ['#2f4a2c', '#1a2a19'],
  bird: ['#4d2f3a', '#2a1a21'],
  flowers: ['#3f3a5c', '#221f33'],
  portrait: ['#33323a', '#1b1a20'],
  narrator: ['#3d3450', '#221d2e'],
  guardian: ['#3b3a35', '#201f1c']
};

/**
 * Draws a framed close-up for the dialogue box. `who` selects the character
 * and `mood` nudges the expression.
 */
export function drawPortrait(ctx, size, who, mood = 'happy', time = 0) {
  const [top, bottom] = PORTRAIT_BACKDROPS[who] || PORTRAIT_BACKDROPS.narrator;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Soft halo behind the subject.
  const halo = ctx.createRadialGradient(size / 2, size * 0.52, 0, size / 2, size * 0.52, size * 0.55);
  halo.addColorStop(0, 'rgba(255,232,180,0.22)');
  halo.addColorStop(1, 'rgba(255,232,180,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  const s = size / 64;
  ctx.translate(size / 2, size * 0.94);

  switch (who) {
    case 'hero':
      drawHeroine(ctx, { x: 0, y: 42 * s, facing: 'down', time, moving: false, scale: 2.05 * s });
      break;
    case 'theo':
      drawTheo(ctx, { x: 0, y: 34 * s, time, scale: 2.5 * s, mood });
      break;
    case 'frog':
      drawFrog(ctx, { x: 0, y: 6 * s, time, scale: 3.1 * s });
      break;
    case 'bird':
      drawBird(ctx, { x: 0, y: 2 * s, time, scale: 3.4 * s });
      break;
    case 'flowers':
      drawChattyFlowers(ctx, { x: 0, y: 4 * s, time, scale: 2.2 * s });
      break;
    case 'portrait':
      drawWallPortrait(ctx, { x: 0, y: -2 * s, time, scale: 1.25 * s, tone: mood === 'light' ? 'light' : 'dark', talking: true });
      break;
    case 'guardian':
      drawGuardian(ctx, { x: 0, y: 4 * s, symbol: mood, time, scale: 1.15 * s, active: true });
      break;
    default: {
      // Narrator: an open book with a quill.
      ctx.fillStyle = '#f0e0bd';
      ctx.beginPath();
      ctx.moveTo(-22 * s, -6 * s);
      ctx.quadraticCurveTo(0, -14 * s, 22 * s, -6 * s);
      ctx.lineTo(22 * s, -30 * s);
      ctx.quadraticCurveTo(0, -38 * s, -22 * s, -30 * s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#b9a179';
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.lineTo(0, -34 * s);
      ctx.stroke();
      ctx.fillStyle = '#e9b45f';
      starPath(ctx, 0, -44 * s, 6 * s, 4, 0.3);
      ctx.fill();
      break;
    }
  }
  ctx.restore();

  // Vignette so the frame reads as a little illustrated cameo.
  const vig = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);
}
