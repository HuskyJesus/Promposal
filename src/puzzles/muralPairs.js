/**
 * Chapter three, part one: the divided mural of the Monochrome Hall.
 *
 * The hall's great mural was split down the middle long ago. Every panel on
 * the dark half has an opposite on the light half; joining all four brings the
 * picture — and its colour — back.
 *
 * Pure logic, tested separately from the interface.
 */

/**
 * Each pair is one motif seen from its two sides. `icon` names come from
 * src/engine/icons.js.
 */
export const MURAL_PAIRS = [
  {
    id: 'sky',
    dark: { id: 'moon', label: 'The moon, keeping watch all night', icon: 'moon' },
    light: { id: 'sun', label: 'The sun, keeping watch all day', icon: 'sun' },
    joined: 'Night and day, taking turns to look after the same sky.'
  },
  {
    id: 'light',
    dark: { id: 'shadow', label: 'A long shadow across the floor', icon: 'shadow' },
    light: { id: 'lantern', label: 'The lantern that casts it', icon: 'lantern' },
    joined: 'No shadow without a light standing somewhere behind it.'
  },
  {
    id: 'story',
    dark: { id: 'ink', label: 'A drop of ink', icon: 'ink' },
    light: { id: 'page', label: 'An empty page', icon: 'page' },
    joined: 'Ink is only a stain until a page agrees to hold it.'
  },
  {
    id: 'bloom',
    dark: { id: 'bud', label: 'A flower still closed', icon: 'bud' },
    light: { id: 'bloom', label: 'The same flower, open', icon: 'bloom' },
    joined: 'The same flower, before and after somebody waited for it.'
  }
];

export function darkPanels() {
  return MURAL_PAIRS.map((pair) => ({ ...pair.dark, pairId: pair.id }));
}

export function lightPanels() {
  return MURAL_PAIRS.map((pair) => ({ ...pair.light, pairId: pair.id }));
}

export function createMuralState() {
  return { matched: [], selectedDark: null, attempts: 0, mistakes: 0 };
}

export function isMatched(state, pairId) {
  return state.matched.includes(pairId);
}

export function isComplete(state) {
  return state.matched.length === MURAL_PAIRS.length;
}

/**
 * Tries to join a dark panel to a light panel.
 * @returns {{correct: boolean, pairId: string|null, complete: boolean, joined: string|null}}
 */
export function tryJoin(state, darkId, lightId) {
  const pair = MURAL_PAIRS.find((p) => p.dark.id === darkId);
  state.attempts += 1;
  if (pair && pair.light.id === lightId) {
    if (!state.matched.includes(pair.id)) state.matched.push(pair.id);
    state.selectedDark = null;
    return { correct: true, pairId: pair.id, complete: isComplete(state), joined: pair.joined };
  }
  state.mistakes += 1;
  state.selectedDark = null;
  return { correct: false, pairId: null, complete: false, joined: null };
}

/** Explains why two panels refused to join, naming both of them. */
export function mismatchMessage(darkId, lightId) {
  const darkPanel = darkPanels().find((p) => p.id === darkId);
  const lightPanel = lightPanels().find((p) => p.id === lightId);
  if (!darkPanel || !lightPanel) return 'Those two panels will not hold together.';
  return `“${darkPanel.label}” and “${lightPanel.label}” slide apart again. They are not two halves of the same idea.`;
}

/** Escalating hints; the third names an exact pair still waiting. */
export function hintForMural(state, level) {
  const remaining = MURAL_PAIRS.filter((pair) => !state.matched.includes(pair.id));
  if (remaining.length === 0) return 'The mural is whole. Look at it for a moment.';
  const next = remaining[0];
  if (level <= 1) {
    return 'Every panel on the dark side is missing its opposite, not its match. Look for the other half of the same idea.';
  }
  if (level === 2) {
    return `Try the panel showing ${next.dark.label.toLowerCase()}. Ask yourself what it cannot exist without.`;
  }
  return `Join “${next.dark.label}” with “${next.light.label}”. ${next.joined}`;
}
