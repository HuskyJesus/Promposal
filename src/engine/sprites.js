/**
 * Characters. Everyone in the game is drawn from layered shapes at runtime.
 *
 * All characters are drawn with their feet at (0, 0) so scenes can sort them
 * by y position and get correct overlapping for free. Every figure carries a
 * soft dark keyline and a cool rim light, which is what keeps them readable
 * against a dark forest, a warm cottage and the near-white Monochrome Hall
 * without needing three different sprite sets.
 */

import { rgba, starPath } from './art.js';
import { HERO_COLORS, THEO_COLORS, SPEAKER_THEMES, PALETTE } from './theme.js';

/** Turns a movement vector into one of four drawn facings. */
export function facingFromVector(vx, vy, previous = 'down') {
  if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return previous;
  if (Math.abs(vx) > Math.abs(vy)) return vx > 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}

/** Soft contact shadow; every character and prop gets one. */
function contactShadow(ctx, radius, squash = 0.3, alpha = 0.32) {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.scale(1, squash);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function strokeShape(ctx, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/* =========================================================================
   Kaleighia
   ========================================================================= */

const H = HERO_COLORS;

/**
 * Pose offsets for each animation state. `phase` runs 0→1 across the state's
 * duration; looping states just keep going.
 */
function heroPose(state, phase, time, moving) {
  const pose = {
    bob: 0,
    lean: 0,
    armLeft: 0,      // radians, negative lifts the arm
    armRight: 0,
    hairLift: 0,
    breath: 1,
    skirtFlare: 0.9,
    glow: 0
  };

  // Idle breathing is always present; walking replaces it with a stride bob.
  if (moving) {
    pose.bob = Math.abs(Math.sin(time * 11)) * 1.7;
    pose.skirtFlare = 2.6;
    pose.hairLift = 1.4;
  } else {
    pose.breath = 1 + Math.sin(time * 1.9) * 0.022;
    pose.bob = Math.sin(time * 1.9) * 0.7;
  }

  switch (state) {
    case 'interact': {
      const lift = Math.sin(Math.min(1, phase) * Math.PI);
      pose.armRight = -1.15 * lift;
      pose.lean = 1.6 * lift;
      break;
    }
    case 'collect': {
      const lift = Math.sin(Math.min(1, phase) * Math.PI);
      pose.armLeft = -1.35 * lift;
      pose.armRight = -1.35 * lift;
      pose.bob += lift * 4.2;
      pose.hairLift += lift * 3;
      pose.glow = lift;
      break;
    }
    case 'success': {
      const lift = Math.sin(Math.min(1, phase) * Math.PI);
      pose.armLeft = -0.95 * lift;
      pose.armRight = -0.95 * lift;
      pose.bob += lift * 2.4;
      pose.glow = lift * 0.7;
      break;
    }
    case 'celebrate': {
      const hop = Math.abs(Math.sin(time * 4.4));
      pose.armLeft = -1.4 - Math.sin(time * 4.4) * 0.2;
      pose.armRight = -1.4 + Math.sin(time * 4.4) * 0.2;
      pose.bob += hop * 5;
      pose.hairLift += hop * 3.4;
      pose.skirtFlare = 2.2 + hop;
      pose.glow = 0.85;
      break;
    }
    default:
      break;
  }
  return pose;
}

/**
 * @param {object} o
 * @param {'up'|'down'|'left'|'right'} o.facing
 * @param {number} o.time     seconds, drives idle motion
 * @param {boolean} o.moving
 * @param {number} o.scale    1 ≈ 48 world units tall
 * @param {string} [o.state]  'idle' | 'interact' | 'collect' | 'success' | 'celebrate'
 * @param {number} [o.statePhase] 0→1 through a one-shot state
 * @param {number} [o.carry]  0→1, how brightly her fragment light glows
 */
export function drawHeroine(ctx, {
  x, y, facing = 'down', time = 0, moving = false, scale = 1,
  state = 'idle', statePhase = 0, carry = 0
}) {
  const s = scale;
  const pose = heroPose(state, statePhase, time, moving);
  const stride = moving ? Math.sin(time * 11) : 0;
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const back = facing === 'up';

  // Hair trails a little behind whichever way she is heading.
  const hairSway = Math.sin(time * 2.1) * 1.3
    + (moving ? -Math.sin(time * 11) * 2.1 - side * 2.2 : 0);

  ctx.save();
  ctx.translate(x, y);
  contactShadow(ctx, 15 * s, 0.3, moving ? 0.26 : 0.32);
  ctx.translate(0, -pose.bob * s);
  ctx.rotate((pose.lean * Math.PI) / 180);

  const line = Math.max(0.7, 1.15 * s);

  /* ---- long hair, the mass that falls behind her ---------------------- */
  ctx.save();
  ctx.translate(hairSway * s * 0.5, 0);
  ctx.fillStyle = H.hairDark;
  ctx.beginPath();
  ctx.moveTo(-9.5 * s, -40 * s);
  ctx.bezierCurveTo(-14 * s, -32 * s, -13.5 * s, -22 * s, -11 * s + hairSway * s, -12 * s);
  ctx.quadraticCurveTo(0, -8.5 * s + pose.hairLift * s, 11 * s + hairSway * s, -12 * s);
  ctx.bezierCurveTo(13.5 * s, -22 * s, 14 * s, -32 * s, 9.5 * s, -40 * s);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, H.outline, line);
  // A few strand separations so the mass does not read as one flat shape.
  ctx.strokeStyle = rgba(H.hairShine, 0.5);
  ctx.lineWidth = 1.1 * s;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 4.4 * s, -38 * s);
    ctx.quadraticCurveTo(i * 6.6 * s + hairSway * s * 0.4, -24 * s, i * 5.4 * s + hairSway * s, -13 * s);
    ctx.stroke();
  }
  ctx.restore();

  /* ---- capelet back panel --------------------------------------------- */
  const flare = pose.skirtFlare;
  ctx.fillStyle = H.capeletShade;
  ctx.beginPath();
  ctx.moveTo(-8.5 * s, -31 * s);
  ctx.quadraticCurveTo(-13 * s - flare * s, -22 * s, -10.5 * s - flare * s, -14 * s);
  ctx.lineTo(10.5 * s + flare * s, -14 * s);
  ctx.quadraticCurveTo(13 * s + flare * s, -22 * s, 8.5 * s, -31 * s);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, H.outline, line);

  /* ---- legs and boots -------------------------------------------------- */
  for (const leg of [-1, 1]) {
    const swing = stride * leg * 3.4 * s;
    ctx.fillStyle = leg * side >= 0 ? H.boot : H.bootShade;
    ctx.beginPath();
    ctx.roundRect(leg * 4.2 * s - 2.7 * s + swing, -10.5 * s, 5.4 * s, 10.5 * s, 2.2 * s);
    ctx.fill();
    strokeShape(ctx, H.outline, line * 0.9);
    // Silver buckle.
    ctx.fillStyle = H.trim;
    ctx.fillRect(leg * 4.2 * s - 2.7 * s + swing, -7.6 * s, 5.4 * s, 1.3 * s);
  }

  /* ---- dress ----------------------------------------------------------- */
  ctx.save();
  ctx.scale(1, pose.breath);
  ctx.fillStyle = H.dress;
  ctx.beginPath();
  ctx.moveTo(-10 * s - flare * 0.4 * s, -9 * s);
  ctx.quadraticCurveTo(-8.4 * s, -24 * s, -6.4 * s, -30 * s);
  ctx.lineTo(6.4 * s, -30 * s);
  ctx.quadraticCurveTo(8.4 * s, -24 * s, 10 * s + flare * 0.4 * s, -9 * s);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, H.outline, line);
  // Folds: one shaded side, one lit side.
  ctx.fillStyle = rgba(H.dressShade, 0.85);
  ctx.beginPath();
  ctx.moveTo(2.4 * s, -9 * s);
  ctx.quadraticCurveTo(5.4 * s, -23 * s, 6.4 * s, -30 * s);
  ctx.lineTo(6.4 * s, -30 * s);
  ctx.quadraticCurveTo(8.4 * s, -24 * s, 10 * s + flare * 0.4 * s, -9 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(H.dressLight, 0.55);
  ctx.beginPath();
  ctx.moveTo(-6.2 * s, -9 * s);
  ctx.quadraticCurveTo(-6.6 * s, -22 * s, -5.2 * s, -29 * s);
  ctx.lineTo(-3 * s, -29 * s);
  ctx.quadraticCurveTo(-4 * s, -22 * s, -3.4 * s, -9 * s);
  ctx.closePath();
  ctx.fill();
  // Silver hem.
  ctx.strokeStyle = H.trim;
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(-10 * s - flare * 0.4 * s, -9.6 * s);
  ctx.quadraticCurveTo(0, -7.2 * s, 10 * s + flare * 0.4 * s, -9.6 * s);
  ctx.stroke();
  ctx.restore();

  /* ---- belt ------------------------------------------------------------ */
  ctx.fillStyle = H.belt;
  ctx.beginPath();
  ctx.roundRect(-7.4 * s, -22.5 * s, 14.8 * s, 3.4 * s, 1.4 * s);
  ctx.fill();
  strokeShape(ctx, H.outline, line * 0.8);
  ctx.fillStyle = H.trim;
  starPath(ctx, 0, -20.8 * s, 2.1 * s, 4, 0.34);
  ctx.fill();

  /* ---- arms ------------------------------------------------------------ */
  for (const arm of [-1, 1]) {
    const lift = arm < 0 ? pose.armLeft : pose.armRight;
    const swing = -stride * arm * 0.34 + lift;
    ctx.save();
    ctx.translate(arm * 8.4 * s, -28 * s);
    ctx.rotate(swing);
    ctx.fillStyle = H.dress;
    ctx.beginPath();
    ctx.roundRect(-1.9 * s, 0, 3.8 * s, 7 * s, 1.9 * s);
    ctx.fill();
    strokeShape(ctx, H.outline, line * 0.8);
    ctx.fillStyle = H.skin;
    ctx.beginPath();
    ctx.roundRect(-1.7 * s, 6 * s, 3.4 * s, 6.4 * s, 1.7 * s);
    ctx.fill();
    strokeShape(ctx, H.outline, line * 0.8);
    ctx.restore();
  }

  /* ---- capelet front --------------------------------------------------- */
  ctx.fillStyle = H.capelet;
  ctx.beginPath();
  ctx.moveTo(-9.6 * s, -30.5 * s);
  ctx.quadraticCurveTo(0, -33.5 * s, 9.6 * s, -30.5 * s);
  ctx.quadraticCurveTo(8.2 * s, -23.5 * s, 5.4 * s, -21.5 * s);
  ctx.lineTo(-5.4 * s, -21.5 * s);
  ctx.quadraticCurveTo(-8.2 * s, -23.5 * s, -9.6 * s, -30.5 * s);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, H.outline, line);
  ctx.strokeStyle = H.trim;
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(-9.2 * s, -29.6 * s);
  ctx.quadraticCurveTo(0, -24.4 * s, 9.2 * s, -29.6 * s);
  ctx.stroke();

  // Star clasp at the throat — her small link to the sky.
  const claspGlow = Math.max(carry, pose.glow);
  if (claspGlow > 0.02) {
    const glow = ctx.createRadialGradient(0, -31.5 * s, 0, 0, -31.5 * s, 9 * s);
    glow.addColorStop(0, rgba(H.accent, 0.55 * claspGlow));
    glow.addColorStop(1, rgba(H.accent, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -31.5 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = H.trim;
  starPath(ctx, 0, -31.5 * s, 2.4 * s, 4, 0.32);
  ctx.fill();

  /* ---- head ------------------------------------------------------------ */
  const headY = -39 * s;
  ctx.fillStyle = H.skin;
  ctx.beginPath();
  ctx.ellipse(0, headY, 7.4 * s, 8.1 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx, H.outline, line);
  // Jaw shading away from the moon.
  ctx.fillStyle = rgba(H.skinShade, 0.4);
  ctx.beginPath();
  ctx.ellipse(2.6 * s, headY + 1.6 * s, 4.6 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  /* ---- hair: crown and face-framing strands ---------------------------- */
  ctx.fillStyle = H.hairMid;
  ctx.beginPath();
  ctx.ellipse(0, headY - 3.4 * s, 9.2 * s, 7.6 * s, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, headY - 2.6 * s, 9.2 * s, 6.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx, H.outline, line);
  ctx.fillStyle = rgba(H.hairShine, 0.55);
  ctx.beginPath();
  ctx.ellipse(-3.4 * s, headY - 6 * s, 4.4 * s, 2.1 * s, -0.3, 0, Math.PI * 2);
  ctx.fill();

  if (!back) {
    // Face opening, shifted with the facing so she reads as turning.
    ctx.fillStyle = H.skin;
    ctx.beginPath();
    ctx.ellipse(side * 1.5 * s, headY + 1.8 * s, 5.9 * s, 6.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Front strands falling past the jaw on both sides.
  ctx.fillStyle = H.hairDark;
  for (const strand of [-1, 1]) {
    if (side === strand * -1 && !back) continue; // hidden on the far side
    ctx.beginPath();
    ctx.moveTo(strand * 7.4 * s, headY - 5 * s);
    ctx.quadraticCurveTo(
      strand * 10 * s + hairSway * s * 0.3, headY + 5 * s,
      strand * 8.2 * s + hairSway * s * 0.5, headY + 13 * s
    );
    ctx.quadraticCurveTo(strand * 6 * s, headY + 6 * s, strand * 5.2 * s, headY - 4 * s);
    ctx.closePath();
    ctx.fill();
    strokeShape(ctx, H.outline, line * 0.7);
  }

  /* ---- face ------------------------------------------------------------ */
  if (!back) {
    const eyeY = headY + 1.4 * s;
    const shift = side * 1.9 * s;
    const blink = Math.sin(time * 0.85 + 1.3) > 0.975 ? 0.12 : 1;
    ctx.fillStyle = '#241a26';
    for (const eye of [-1, 1]) {
      if ((side === 1 && eye === -1) || (side === -1 && eye === 1)) continue;
      const ex = eye * 2.7 * s + shift;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 1.15 * s, 1.55 * s * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      if (blink > 0.5) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(ex + 0.4 * s, eyeY - 0.5 * s, 0.42 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#241a26';
      }
    }
    ctx.fillStyle = rgba(H.blush, 0.4);
    for (const cheek of [-1, 1]) {
      if ((side === 1 && cheek === -1) || (side === -1 && cheek === 1)) continue;
      ctx.beginPath();
      ctx.ellipse(cheek * 4 * s + shift, eyeY + 2.6 * s, 1.9 * s, 1.1 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // A small smile that widens on the happy states.
    const joy = state === 'celebrate' || state === 'success' || state === 'collect' ? 1 : 0.55;
    ctx.strokeStyle = 'rgba(60,36,44,0.7)';
    ctx.lineWidth = 0.9 * s;
    ctx.beginPath();
    ctx.arc(shift, eyeY + 2.2 * s, 2.1 * s, 0.35 * Math.PI, (0.65 + 0.1 * joy) * Math.PI);
    ctx.stroke();
  }

  // Three tiny lavender blossoms tucked into her hair — the recurring number.
  ctx.fillStyle = H.accent;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-7.6 * s + i * 2.7 * s, headY - 7.6 * s + Math.abs(i - 1) * 1.1 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---- rim light from the upper left ----------------------------------- */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(H.rim, 0.5);
  ctx.lineWidth = 1.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, headY - 2.6 * s, 9.2 * s, Math.PI * 1.02, Math.PI * 1.52);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-9.4 * s, -30.2 * s);
  ctx.quadraticCurveTo(-8.4 * s, -24 * s, -7 * s, -21.6 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-9.6 * s - flare * 0.4 * s, -10 * s);
  ctx.quadraticCurveTo(-8.2 * s, -22 * s, -6.4 * s, -29 * s);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/* =========================================================================
   Theo — a small enchanted blue bear who is definitely royalty
   ========================================================================= */

const T = THEO_COLORS;

/**
 * Theo hovers rather than walks; he insists this is a royal privilege.
 * @param {'happy'|'proud'|'worried'|'sly'|'delighted'} o.mood
 */
export function drawTheo(ctx, {
  x, y, time = 0, scale = 1, mood = 'happy', facing = 'down', cheer = 0
}) {
  const s = scale;
  const bounce = cheer > 0
    ? Math.abs(Math.sin(time * 5.2)) * 5 * cheer
    : 0;
  const float = Math.sin(time * 2.4) * 2.4 + bounce;
  const squash = 1 + Math.sin(time * 2.4) * 0.03;
  const line = Math.max(0.6, 1 * s);

  ctx.save();
  ctx.translate(x, y);
  contactShadow(ctx, 11 * s, 0.3, 0.3);
  ctx.translate(0, -15 * s - float * s);

  /* ears */
  for (const ear of [-1, 1]) {
    ctx.fillStyle = T.furShade;
    ctx.beginPath();
    ctx.arc(ear * 8.2 * s, -9.4 * s, 4.6 * s, 0, Math.PI * 2);
    ctx.fill();
    strokeShape(ctx, T.outline, line);
    ctx.fillStyle = T.muzzle;
    ctx.beginPath();
    ctx.arc(ear * 8.2 * s, -9.4 * s, 2.3 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  /* body */
  ctx.save();
  ctx.scale(1, squash);
  ctx.fillStyle = T.fur;
  ctx.beginPath();
  ctx.ellipse(0, 3.4 * s, 8.6 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx, T.outline, line);
  ctx.fillStyle = T.belly;
  ctx.beginPath();
  ctx.ellipse(0, 5.2 * s, 4.8 * s, 4.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  /* arms and legs */
  const wave = cheer > 0 ? Math.sin(time * 6) * 0.9 : Math.sin(time * 3.4) * 0.28;
  for (const arm of [-1, 1]) {
    ctx.save();
    ctx.translate(arm * 7.6 * s, 1.8 * s);
    ctx.rotate(arm * (0.45 + wave * arm) - (cheer > 0 ? arm * 0.9 : 0));
    ctx.fillStyle = T.fur;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6 * s, 2.7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    strokeShape(ctx, T.outline, line * 0.85);
    ctx.fillStyle = T.muzzle;
    ctx.beginPath();
    ctx.ellipse(arm * 1.6 * s, 0.2 * s, 1.5 * s, 1.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const foot of [-1, 1]) {
    ctx.fillStyle = T.furShade;
    ctx.beginPath();
    ctx.ellipse(foot * 4.2 * s, 11.4 * s, 3.4 * s, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    strokeShape(ctx, T.outline, line * 0.85);
  }

  /* head */
  ctx.fillStyle = T.fur;
  ctx.beginPath();
  ctx.ellipse(0, -6.2 * s, 9.4 * s, 8.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx, T.outline, line);
  ctx.fillStyle = T.muzzle;
  ctx.beginPath();
  ctx.ellipse(0, -3.2 * s, 4.6 * s, 3.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = T.nose;
  ctx.beginPath();
  ctx.ellipse(0, -4.6 * s, 1.6 * s, 1.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = T.nose;
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.moveTo(0, -3.6 * s);
  ctx.lineTo(0, -2.4 * s);
  ctx.stroke();

  /* eyes — the whole personality lives here */
  const eyeShift = facing === 'left' ? -1.1 * s : facing === 'right' ? 1.1 * s : 0;
  for (const eye of [-1, 1]) {
    const ex = eye * 3.5 * s + eyeShift;
    const ey = -8.2 * s;
    ctx.fillStyle = T.nose;
    ctx.strokeStyle = T.nose;
    ctx.lineWidth = 1.3 * s;
    ctx.lineCap = 'round';

    if (mood === 'sly') {
      ctx.beginPath();
      ctx.moveTo(ex - 1.7 * s, ey + 0.2 * s);
      ctx.lineTo(ex + 1.7 * s, ey - 0.5 * s);
      ctx.stroke();
    } else if (mood === 'worried') {
      ctx.beginPath();
      ctx.ellipse(ex, ey + 0.7 * s, 1.6 * s, 1.9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ex - 1.9 * s, ey - 2.6 * s + eye * 0.5 * s);
      ctx.lineTo(ex + 1.9 * s, ey - 3.2 * s + eye * 0.5 * s);
      ctx.stroke();
    } else if (mood === 'delighted') {
      // Happy closed arcs.
      ctx.beginPath();
      ctx.arc(ex, ey + 0.6 * s, 1.9 * s, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(ex, ey, 1.6 * s, 1.95 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + 0.55 * s, ey - 0.65 * s, 0.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (mood === 'proud' || mood === 'delighted') {
    ctx.strokeStyle = T.nose;
    ctx.lineWidth = 0.9 * s;
    ctx.beginPath();
    ctx.arc(0, -3.4 * s, 2.4 * s, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  /* silver stars across his fur */
  ctx.fillStyle = T.star;
  const spots = [[-5.4, 0.6], [4.8, 4.4], [-3.2, 7.4], [6.4, -8.4], [-7.2, -6.2], [0.6, -12.4]];
  spots.forEach(([sx, sy], i) => {
    const twinkle = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.7);
    ctx.globalAlpha = 0.45 + twinkle * 0.55;
    starPath(ctx, sx * s, sy * s, 1.8 * s, 4, 0.3);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  /* the crown he made himself */
  ctx.fillStyle = T.crown;
  ctx.beginPath();
  ctx.moveTo(-5.6 * s, -13.4 * s);
  ctx.lineTo(-3.4 * s, -17.6 * s);
  ctx.lineTo(-1.2 * s, -14.2 * s);
  ctx.lineTo(1.2 * s, -18 * s);
  ctx.lineTo(3.4 * s, -14.2 * s);
  ctx.lineTo(5.6 * s, -17.6 * s);
  ctx.lineTo(5.6 * s, -12.8 * s);
  ctx.lineTo(-5.6 * s, -12.8 * s);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, T.outline, line * 0.8);

  /* rim light */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(T.rim, 0.45);
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.arc(0, -6.2 * s, 9.4 * s, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/* =========================================================================
   Woodland and castle characters
   ========================================================================= */

/** Bartholomew the frog, a reliable source of unreliable news. */
export function drawFrog(ctx, { x, y, time = 0, scale = 1 }) {
  const s = scale;
  const puff = 1 + Math.sin(time * 2.6) * 0.07;
  ctx.save();
  ctx.translate(x, y);
  contactShadow(ctx, 12 * s, 0.3);
  ctx.fillStyle = '#5f9e5b';
  ctx.beginPath();
  ctx.ellipse(0, -7 * s, 10.4 * s * puff, 7.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx, 'rgba(20,34,18,0.5)', 1 * s);
  ctx.fillStyle = '#d7e8b8';
  ctx.beginPath();
  ctx.ellipse(0, -4.4 * s, 6.2 * s, 4.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const eye of [-1, 1]) {
    ctx.fillStyle = '#5f9e5b';
    ctx.beginPath();
    ctx.arc(eye * 4.8 * s, -14.4 * s, 3.8 * s, 0, Math.PI * 2);
    ctx.fill();
    strokeShape(ctx, 'rgba(20,34,18,0.5)', 0.9 * s);
    ctx.fillStyle = '#f7f3d8';
    ctx.beginPath();
    ctx.arc(eye * 4.8 * s, -14.4 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22331f';
    ctx.beginPath();
    ctx.arc(eye * 4.8 * s, -14.4 * s, 1.2 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2f5a2c';
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.arc(0, -7 * s, 4.6 * s, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
}

/** A gossiping songbird. */
export function drawBird(ctx, { x, y, time = 0, scale = 1 }) {
  const s = scale;
  const hop = Math.abs(Math.sin(time * 2.2)) * 2.2;
  ctx.save();
  ctx.translate(x, y);
  contactShadow(ctx, 8 * s, 0.3, 0.24);
  ctx.translate(0, -hop * s);
  ctx.fillStyle = PALETTE.rose;
  ctx.beginPath();
  ctx.ellipse(0, -6.4 * s, 6.6 * s, 5.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx, 'rgba(48,20,28,0.45)', 0.9 * s);
  ctx.fillStyle = PALETTE.cream;
  ctx.beginPath();
  ctx.ellipse(-1 * s, -4.8 * s, 3.8 * s, 3.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c2707f';
  ctx.beginPath();
  ctx.moveTo(3 * s, -8.4 * s);
  ctx.quadraticCurveTo(10.4 * s, -6.2 * s, 3 * s, -3 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.rose;
  ctx.beginPath();
  ctx.arc(-4.6 * s, -11.4 * s, 3.9 * s, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx, 'rgba(48,20,28,0.45)', 0.9 * s);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.moveTo(-8.2 * s, -11.4 * s);
  ctx.lineTo(-12.4 * s, -10.4 * s);
  ctx.lineTo(-8.2 * s, -9.2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2c2233';
  ctx.beginPath();
  ctx.arc(-5.4 * s, -12.4 * s, 0.95 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Two flowers mid-argument about the moon and the sun. */
export function drawChattyFlowers(ctx, { x, y, time = 0, scale = 1 }) {
  const s = scale;
  ctx.save();
  ctx.translate(x, y);
  contactShadow(ctx, 14 * s, 0.28, 0.22);
  ctx.restore();
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const sway = Math.sin(time * 1.8 + i * 2) * 0.17;
    ctx.save();
    ctx.translate(x + side * 9 * s, y);
    ctx.rotate(sway);
    ctx.strokeStyle = '#3d6b4f';
    ctx.lineWidth = 2.3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -20 * s);
    ctx.stroke();
    ctx.fillStyle = '#3d6b4f';
    ctx.beginPath();
    ctx.ellipse(side * 3.4 * s, -10 * s, 3.4 * s, 1.8 * s, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i === 0 ? PALETTE.gold : PALETTE.lavender;
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 4.6 * s, -20 * s + Math.sin(a) * 4.6 * s, 3.3 * s, 2.5 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.cream;
    ctx.beginPath();
    ctx.arc(0, -20 * s, 3.3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c2233';
    for (const eye of [-1.2, 1.2]) {
      ctx.beginPath();
      ctx.arc(eye * s, -20.6 * s, 0.75 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** One of the three guardians of the cottage garden. */
export function drawGuardian(ctx, { x, y, symbol, time = 0, scale = 1, active = false }) {
  const s = scale;
  const seed = symbol === 'stone' ? 0 : symbol === 'scroll' ? 2 : 4;
  const hover = Math.sin(time * 1.6 + seed) * 2.2;
  ctx.save();
  ctx.translate(x, y);
  contactShadow(ctx, 16 * s, 0.3);
  ctx.translate(0, -hover * s);

  ctx.fillStyle = '#6f6a63';
  ctx.beginPath();
  ctx.roundRect(-11 * s, -18 * s, 22 * s, 18 * s, 3 * s);
  ctx.fill();
  strokeShape(ctx, 'rgba(24,22,20,0.5)', 1 * s);
  ctx.fillStyle = '#87817a';
  ctx.beginPath();
  ctx.roundRect(-13 * s, -22 * s, 26 * s, 6 * s, 3 * s);
  ctx.fill();
  strokeShape(ctx, 'rgba(24,22,20,0.5)', 1 * s);
  // Three carved marks, matching every other door in the kingdom.
  ctx.fillStyle = active ? PALETTE.gold : 'rgba(220,224,236,0.35)';
  for (let i = -1; i <= 1; i++) {
    starPath(ctx, i * 5 * s, -9 * s, 2 * s);
    ctx.fill();
  }

  const emblemY = -42 * s;
  if (active) {
    const glow = ctx.createRadialGradient(0, emblemY, 0, 0, emblemY, 28 * s);
    glow.addColorStop(0, rgba(PALETTE.gold, 0.42));
    glow.addColorStop(1, rgba(PALETTE.gold, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, emblemY, 28 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  drawSymbolGlyph(ctx, 0, emblemY, 13 * s, symbol);
  ctx.restore();
}

/** A talking portrait on the wall of the Monochrome Hall. */
export function drawWallPortrait(ctx, { x, y, time = 0, scale = 1, tone = 'dark', talking = false, colour = 0 }) {
  const s = scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = colour > 0.5 ? '#c9a15c' : '#9a9aa4';
  ctx.beginPath();
  ctx.roundRect(-18 * s, -46 * s, 36 * s, 46 * s, 4 * s);
  ctx.fill();
  strokeShape(ctx, 'rgba(18,18,24,0.55)', 1.1 * s);
  ctx.fillStyle = tone === 'dark' ? '#241f2e' : '#efeae0';
  ctx.beginPath();
  ctx.roundRect(-14 * s, -42 * s, 28 * s, 38 * s, 3 * s);
  ctx.fill();

  ctx.fillStyle = tone === 'dark' ? PALETTE.silver : '#2a2434';
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
    ctx.ellipse(0, -25 * s, w * s * 0.6, w * s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Stone, Scroll and Shears — also used on the puzzle buttons. */
export function drawSymbolGlyph(ctx, x, y, r, symbol, palette = {}) {
  const stroke = palette.stroke || '#2f2338';
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.6, r * 0.13);
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
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
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
    ctx.fillStyle = palette.roll || '#d9c69a';
    for (const end of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(0, end * r * 0.85, r * 0.62, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = palette.metal || '#b8bec9';
    ctx.lineWidth = Math.max(2.4, r * 0.22);
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.8);
    ctx.lineTo(r * 0.45, r * 0.45);
    ctx.moveTo(r * 0.55, -r * 0.8);
    ctx.lineTo(-r * 0.45, r * 0.45);
    ctx.stroke();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.6, r * 0.13);
    ctx.beginPath();
    ctx.arc(-r * 0.5, r * 0.62, r * 0.28, 0, Math.PI * 2);
    ctx.moveTo(r * 0.78, r * 0.62);
    ctx.arc(r * 0.5, r * 0.62, r * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(0, -r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* =========================================================================
   Dialogue portraits
   ========================================================================= */

/**
 * Draws a framed close-up for the dialogue box. `who` selects the character
 * and `mood` nudges the expression.
 */
export function drawPortrait(ctx, size, who, mood = 'happy', time = 0) {
  const theme = SPEAKER_THEMES[who] || SPEAKER_THEMES.narrator;
  const [top, bottom] = theme.backdrop;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const halo = ctx.createRadialGradient(size / 2, size * 0.5, 0, size / 2, size * 0.5, size * 0.58);
  halo.addColorStop(0, rgba(theme.glow, 0.28));
  halo.addColorStop(1, rgba(theme.glow, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  const s = size / 64;
  ctx.translate(size / 2, size * 0.96);

  switch (who) {
    case 'hero':
      drawHeroine(ctx, {
        x: 0, y: 44 * s, facing: 'down', time, moving: false, scale: 2.05 * s,
        state: mood === 'happy' ? 'idle' : mood
      });
      break;
    case 'theo':
      drawTheo(ctx, { x: 0, y: 36 * s, time, scale: 2.55 * s, mood });
      break;
    case 'frog':
      drawFrog(ctx, { x: 0, y: 4 * s, time, scale: 3 * s });
      break;
    case 'bird':
      drawBird(ctx, { x: 0, y: 0, time, scale: 3.2 * s });
      break;
    case 'flowers':
      drawChattyFlowers(ctx, { x: 0, y: 2 * s, time, scale: 2.2 * s });
      break;
    case 'portrait':
      drawWallPortrait(ctx, { x: 0, y: -3 * s, time, scale: 1.25 * s, tone: mood === 'light' ? 'light' : 'dark', talking: true });
      break;
    case 'guardian':
      drawGuardian(ctx, { x: 0, y: 2 * s, symbol: mood, time, scale: 1.15 * s, active: true });
      break;
    default: {
      // Narrator: an open book beneath three stars.
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
      ctx.fillStyle = PALETTE.gold;
      for (let i = -1; i <= 1; i++) {
        const twinkle = 0.6 + 0.4 * Math.sin(time * 2 + i);
        ctx.globalAlpha = twinkle;
        starPath(ctx, i * 11 * s, -46 * s + Math.abs(i) * 4 * s, 5 * s, 4, 0.3);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
}
