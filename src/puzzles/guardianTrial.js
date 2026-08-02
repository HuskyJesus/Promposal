/**
 * Chapter two: the Trial of Stone, Scroll and Shears.
 *
 * The kingdom settles every important question, including supper, with three
 * symbols. Each guardian tells you one rule before the trial begins, so the
 * whole puzzle is solvable from what you have been told. Nothing here is
 * random: the guardians raise the same symbols in the same order every time.
 *
 * The logic below is pure so it can be unit-tested without a browser.
 */

export const SYMBOLS = ['stone', 'scroll', 'shears'];

export const SYMBOL_NAMES = {
  stone: 'Stone',
  scroll: 'Scroll',
  shears: 'Shears'
};

/** WINS_AGAINST[a] === b means a defeats b. */
export const WINS_AGAINST = {
  stone: 'shears',
  scroll: 'stone',
  shears: 'scroll'
};

/** The symbol that defeats `symbol`. */
export function counterTo(symbol) {
  return SYMBOLS.find((candidate) => WINS_AGAINST[candidate] === symbol) || null;
}

export function beats(a, b) {
  return WINS_AGAINST[a] === b;
}

/** The rule each guardian recites before the trial. */
export const GUARDIAN_CLUES = {
  stone: 'Shears grow dull and blunt against me. I have never once been cut.',
  scroll: 'I wrap myself around Stone until nobody can even remember what it looked like.',
  shears: 'Scroll parts beneath me in a single stroke. Neatly, too. I am very precise.'
};

/** Fixed rounds: the guardian's symbol and the flavour text shown with it. */
export const ROUNDS = [
  {
    id: 1,
    guardian: 'shears',
    prompt: 'The first guardian raises Shears.',
    flavour: 'This is how the kingdom decides supper. Best of three, obviously.'
  },
  {
    id: 2,
    guardian: 'stone',
    prompt: 'The second guardian raises Stone.',
    flavour: 'And this is how it decides what to watch afterwards. It has settled wars.'
  },
  {
    id: 3,
    guardian: 'scroll',
    prompt: 'The third guardian raises Scroll.',
    flavour: 'The last round. Nobody in the kingdom has ever agreed on a winner without it.'
  }
];

export function createTrialState() {
  return { round: 0, attempts: 0, wrongThisRound: 0, solved: false, history: [] };
}

export function currentRound(state) {
  return ROUNDS[state.round] || null;
}

/**
 * Plays one answer.
 * @returns {{correct: boolean, finished: boolean, expected: string, guardian: string}}
 */
export function submitChoice(state, choice) {
  const round = currentRound(state);
  if (!round || state.solved) {
    return { correct: false, finished: state.solved, expected: null, guardian: null };
  }
  const expected = counterTo(round.guardian);
  const correct = choice === expected;
  state.attempts += 1;
  state.history.push({ round: round.id, choice, correct });

  if (correct) {
    state.round += 1;
    state.wrongThisRound = 0;
    state.solved = state.round >= ROUNDS.length;
  } else {
    state.wrongThisRound += 1;
  }
  return { correct, finished: state.solved, expected, guardian: round.guardian };
}

/**
 * Feedback after a wrong answer. It always names the rule that was actually
 * broken, so a mistake teaches instead of punishing.
 */
export function feedbackForWrongChoice(guardianSymbol, choice) {
  const chosenName = SYMBOL_NAMES[choice];
  const guardianName = SYMBOL_NAMES[guardianSymbol];
  if (choice === guardianSymbol) {
    return `Two ${chosenName}s, matched exactly. The guardian is amused, but nobody has won anything. Which symbol defeats ${guardianName}?`;
  }
  if (beats(guardianSymbol, choice)) {
    return `${guardianName} defeats ${chosenName}. That is the rule you were told. Try the symbol that beats ${guardianName} instead.`;
  }
  return `${chosenName} and ${guardianName} simply stare at one another. Neither one wins. Which symbol did the guardians say defeats ${guardianName}?`;
}

/**
 * Escalating hints. Level 1 nudges, level 2 restates the rule, level 3 gives
 * the answer outright. Nobody should ever be stuck here.
 */
export function hintForRound(state, level) {
  const round = currentRound(state);
  if (!round) return 'The trial is already won.';
  const guardianName = SYMBOL_NAMES[round.guardian];
  const answer = counterTo(round.guardian);
  if (level <= 1) {
    return `Think back to what the guardians told you. One of them boasted about beating ${guardianName}.`;
  }
  if (level === 2) {
    const boaster = GUARDIAN_CLUES[answer];
    return `A guardian said: “${boaster}” That is the one you want.`;
  }
  return `Choose ${SYMBOL_NAMES[answer]}. ${SYMBOL_NAMES[answer]} defeats ${guardianName}.`;
}
