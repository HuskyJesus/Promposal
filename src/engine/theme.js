/**
 * The single source of truth for colour in the game.
 *
 * Scenes, characters and interface all read from here, so the whole game can
 * be re-tinted from one place. The player-facing colours in src/config.js feed
 * into this file, this is where those few choices become the full palette.
 */

import { config } from '../config.js';

/* -------------------------------------------------------------------------
   Core hues
   ------------------------------------------------------------------------- */

export const PALETTE = {
  /** Kaleighia and everything romantic. */
  lavender: '#b9a3e3',
  lavenderLight: '#ded3f6',
  lavenderDeep: '#7d63b8',
  purpleDeep: '#4a3670',

  /** Theo. */
  theoBlue: '#6f9ee8',
  theoDeep: '#3f6ab5',

  /** Guidance, completed objectives, lantern light. */
  gold: '#e9b45f',
  goldLight: '#ffe1a0',
  amber: '#f0a95c',

  /** Outdoors. */
  forest: '#2f6a51',

  /** Paper, parchment, the storybook itself. */
  cream: '#f6e7c8',
  creamDeep: '#d9c39a',

  /** The Monochrome Hall and starlight. */
  silver: '#dde5f2',
  silverDim: '#a8b0c2',

  /** Night. */
  night: '#161228',
  nightDeep: '#0b0918',
  moonlit: '#7d8fd0',

  rose: '#d98a9a'
};

/** Player-chosen colours win where they overlap. */
Object.assign(PALETTE, {
  gold: config.colors.gold || PALETTE.gold,
  cream: config.colors.parchment || PALETTE.cream,
  night: config.colors.night || PALETTE.night,
  theoBlue: config.colors.guide || PALETTE.theoBlue,
  silver: config.colors.silver || PALETTE.silver,
  rose: config.colors.rose || PALETTE.rose,
  forest: config.colors.forest || PALETTE.forest
});

/* -------------------------------------------------------------------------
   Characters
   ------------------------------------------------------------------------- */

export const HERO_COLORS = {
  skin: '#a9744b',
  skinShade: '#8a5a37',
  blush: '#8c4a45',

  hairDark: '#221720',
  hairMid: '#33232f',
  hairShine: '#54395a',

  dress: PALETTE.lavender,
  dressShade: '#9880c9',
  dressLight: PALETTE.lavenderLight,

  capelet: PALETTE.lavenderDeep,
  capeletShade: '#5c4794',

  trim: PALETTE.silver,
  belt: PALETTE.purpleDeep,
  boot: '#55427f',
  bootShade: '#3d2f5e',

  accent: PALETTE.lavenderLight,
  /** Cool moonlight catching her upper-left edge. */
  rim: '#cfd8f5',
  /** Dark keyline that keeps her readable on pale backgrounds. */
  outline: 'rgba(24,18,34,0.55)'
};

export const THEO_COLORS = {
  fur: PALETTE.theoBlue,
  furShade: PALETTE.theoDeep,
  muzzle: '#d7e4fa',
  belly: '#c3d7f6',
  star: '#eef3fd',
  crown: PALETTE.gold,
  nose: '#232c47',
  outline: 'rgba(18,24,44,0.5)',
  rim: '#dbe6ff'
};

/* -------------------------------------------------------------------------
   Scenes
   ------------------------------------------------------------------------- */

export const SCENE_THEMES = {
  woods: {
    skyTop: '#0c0a1d',
    skyBottom: '#252044',
    horizon: '#191634',
    ground: '#24463a',
    groundPatch: '#39785a',
    tree: { bark: '#3a2a2c', leaf: PALETTE.forest, leafDark: '#1f4a3a', rim: '#9fb8e8' },
    canopy: '#132a24',
    mist: 'rgba(150,175,205,0.06)',
    water: { deep: '#1c3d4e', mid: '#2c6079', foam: '#bfeaf5' },
    firefly: PALETTE.goldLight,
      flowers: [PALETTE.lavender, PALETTE.rose, PALETTE.gold, PALETTE.lavenderLight],
    vignette: 0.5
  },

  cottage: {
    skyTop: '#0e0c1e',
    skyBottom: '#2c2446',
    horizon: '#171331',
    ground: '#2a4a3a',
    groundPatch: '#457f5c',
    tree: { bark: '#3c2c2a', leaf: '#37765a', leafDark: '#245240', rim: PALETTE.goldLight },
    mist: 'rgba(240,200,150,0.06)',
    firefly: '#ffdf9a',
    hearth: PALETTE.amber,
    flowers: [PALETTE.gold, PALETTE.rose, PALETTE.cream, PALETTE.lavenderLight],
    vignette: 0.46
  },

  hall: {
    /** Before the mural is mended. */
    mono: {
      wallTop: '#1b1b22',
      wallBottom: '#33333c',
      tileDark: '#202027',
      tileLight: '#d2d2d8',
      runner: '#3a3a42',
      runnerTrim: '#b9bcc6',
      frame: '#8e94a4',
      accent: PALETTE.silverDim,
      flower: '#c9c9cf'
    },
    /** After. Lavender arrives first, then gold and green. */
    colour: {
      wallTop: '#2b2438',
      wallBottom: '#453a58',
      tileDark: '#2e2542',
      tileLight: '#e2dcee',
      runner: '#4a3457',
      runnerTrim: PALETTE.gold,
      frame: '#b9a8d4',
      accent: PALETTE.lavender,
      flower: PALETTE.lavender
    },
    mist: 'rgba(200,208,230,0.055)',
    vignette: 0.5
  },

  garden: {
    skyTop: '#070617',
    skyBottom: '#2a2350',
    horizon: '#141130',
    ground: '#22453a',
    groundPatch: '#39795c',
    mist: 'rgba(180,170,230,0.05)',
    firefly: PALETTE.goldLight,
    flowers: [PALETTE.lavender, PALETTE.lavenderLight, '#f4dff0', PALETTE.goldLight],
    cloud: 'rgba(190,196,240,0.16)',
    vignette: 0.45
  },

  title: {
    skyTop: '#0d0a20',
    skyBottom: '#2b2350',
    horizon: '#191634'
  }
};

/* -------------------------------------------------------------------------
   Dialogue speakers
   ------------------------------------------------------------------------- */

/**
 * Each speaker gets their own accent so the box itself says who is talking,
 * alongside the portrait and the printed name.
 */
export const SPEAKER_THEMES = {
  hero: { accent: PALETTE.lavenderDeep, glow: PALETTE.lavender, backdrop: ['#3b2f5c', '#221a36'] },
  theo: { accent: PALETTE.theoDeep, glow: PALETTE.theoBlue, backdrop: ['#2a3f6b', '#16203a'] },
  narrator: { accent: '#6b5a3f', glow: PALETTE.gold, backdrop: ['#3d3450', '#221d2e'] },
  frog: { accent: '#3f6b3c', glow: '#7fbb6f', backdrop: ['#2f4a2c', '#1a2a19'] },
  bird: { accent: '#8a4f5c', glow: PALETTE.rose, backdrop: ['#4d2f3a', '#2a1a21'] },
  flowers: { accent: '#6a5a8f', glow: PALETTE.lavenderLight, backdrop: ['#3f3a5c', '#221f33'] },
  portrait: { accent: '#5c5c66', glow: PALETTE.silver, backdrop: ['#33323a', '#1b1a20'] },
  guardian: { accent: '#6b6350', glow: PALETTE.creamDeep, backdrop: ['#3b3a35', '#201f1c'] }
};

/** Pushes the palette into CSS custom properties for the interface. */
export function applyThemeVariables(root = document.documentElement) {
  const vars = {
    '--c-lavender': PALETTE.lavender,
    '--c-lavender-light': PALETTE.lavenderLight,
    '--c-lavender-deep': PALETTE.lavenderDeep,
    '--c-purple-deep': PALETTE.purpleDeep,
    '--c-theo': PALETTE.theoBlue,
    '--c-theo-deep': PALETTE.theoDeep,
    '--c-gold': PALETTE.gold,
    '--c-gold-light': PALETTE.goldLight,
    '--c-forest': PALETTE.forest,
    '--c-silver': PALETTE.silver,
    '--c-cream': PALETTE.cream,
    '--c-rose': PALETTE.rose,
    '--c-night': PALETTE.night,
    '--c-night-deep': PALETTE.nightDeep,
    '--c-parchment': config.colors.parchment,
    '--c-ink': config.colors.ink,
    '--c-guide': PALETTE.theoBlue
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}
