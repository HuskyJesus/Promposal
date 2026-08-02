/**
 * Chapter three, part two: the Storykeeper's Trial.
 *
 * Three questions asked by the hall itself. They are drawn from things the
 * player has already seen, so they reward attention rather than trivia
 * knowledge. The point is to feel clever, never to be blocked.
 */

/*
 * Three questions, and none of them can be answered by picking the only
 * sensible-looking option. Every wrong answer is a real thing from somewhere in
 * this evening, so each question asks her to remember which one, not to spot
 * the odd one out. Nothing here needs knowledge from outside the game, every
 * question has exactly one defensible answer, and the hint ladder ends by
 * naming it, so the trial can never actually stop her.
 */
export const QUESTIONS = [
  {
    id: 'mural',
    // The mural is always solved before the trial begins, so she has just seen
    // all four of these motifs and joined each to its opposite herself.
    prompt: 'The mural you just mended joined every panel to its opposite, never to its likeness. Which panel did the drop of ink turn out to need?',
    answers: [
      { id: 'a', text: 'The flower that had opened' },
      { id: 'b', text: 'The empty page' },
      { id: 'c', text: 'The lantern throwing light across the floor' },
      { id: 'd', text: 'The moon that keeps watch all night' }
    ],
    correct: 'b',
    hint: 'A stain is only a stain until something agrees to hold it.',
    afterword: 'The empty page. Ink is nothing on its own, and the hall knows it.'
  },
  {
    id: 'guardians',
    // Each guardian's boast is spoken aloud at the cottage, and the boasts are
    // required reading: the trial there cannot be attempted without them.
    prompt: 'Each guardian at the cottage boasted about a single victory. Which of them wins by leaving nobody able to remember what the loser looked like?',
    answers: [
      { id: 'a', text: 'Stone' },
      { id: 'b', text: 'Scroll' },
      { id: 'c', text: 'Shears' }
    ],
    correct: 'b',
    hint: 'That one does not cut and it does not blunt. It covers, and it keeps covering.',
    afterword: 'Scroll, who wraps around Stone until the shape of it is forgotten. Precisely so.'
  },
  {
    id: 'sparrow',
    // Deliberately not a three. The kingdom's fondness for that number is the
    // trap; the sparrow was counting, and she gave an exact figure.
    prompt: 'A breathless sparrow reported a theft from the cottage windowsill and named a small blue suspect. How many pastries had gone missing?',
    answers: [
      { id: 'a', text: 'Three' },
      { id: 'b', text: 'Four' },
      { id: 'c', text: 'Six' },
      { id: 'd', text: 'A dozen' }
    ],
    correct: 'c',
    hint: 'The sparrow was counting, and for once the answer is not the number this kingdom is fond of.',
    afterword: 'Six. The crumbs on the crown were, the accused maintains, placed there by a dragon.'
  }
];

export function createTrialState() {
  return { index: 0, correctCount: 0, wrongThisQuestion: 0, answered: [], finished: false };
}

export function currentQuestion(state) {
  return QUESTIONS[state.index] || null;
}

/**
 * Answers the current question. A wrong answer never ends the trial; it just
 * asks again with a warmer nudge.
 * @returns {{correct: boolean, finished: boolean, question: object}}
 */
export function answerQuestion(state, answerId) {
  const question = currentQuestion(state);
  if (!question || state.finished) {
    return { correct: false, finished: state.finished, question: null };
  }
  const correct = answerId === question.correct;
  if (correct) {
    state.correctCount += 1;
    state.answered.push({ id: question.id, attempts: state.wrongThisQuestion + 1 });
    state.wrongThisQuestion = 0;
    state.index += 1;
    state.finished = state.index >= QUESTIONS.length;
  } else {
    state.wrongThisQuestion += 1;
  }
  return { correct, finished: state.finished, question };
}

/** Whether the player got every question on the first try. */
export function wasFlawless(state) {
  return state.answered.length === QUESTIONS.length && state.answered.every((a) => a.attempts === 1);
}

export function hintForQuestion(state, level) {
  const question = currentQuestion(state);
  if (!question) return 'The trial is finished.';
  if (level <= 1) return question.hint;
  if (level === 2) {
    const wrong = question.answers.filter((a) => a.id !== question.correct);
    return `It is not “${wrong[0].text}”. That much the hall will admit.`;
  }
  const answer = question.answers.find((a) => a.id === question.correct);
  return `The answer is “${answer.text}”.`;
}
