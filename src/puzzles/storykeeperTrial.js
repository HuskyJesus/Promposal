/**
 * Chapter three, part two: the Storykeeper's Trial.
 *
 * Three questions asked by the hall itself. They are drawn from things the
 * player has already seen, so they reward attention rather than trivia
 * knowledge — the point is to feel clever, not to be blocked.
 */

export const QUESTIONS = [
  {
    id: 'moonflowers',
    prompt: 'The woods asked for a number, and the number keeps returning. How many moonflowers were hidden among the trees?',
    answers: [
      { id: 'a', text: 'Two' },
      { id: 'b', text: 'Three' },
      { id: 'c', text: 'Seven' }
    ],
    correct: 'b',
    hint: 'Count the lights on your own fragment track. The kingdom is fond of this number.',
    afterword: 'Three. It is always three. The hall seems pleased that you noticed.'
  },
  {
    id: 'gossip',
    prompt: 'A frog in the woods was absolutely certain about one scandal. What was it?',
    answers: [
      { id: 'a', text: "The prince's horse wears false horseshoes" },
      { id: 'b', text: 'The baker has been watering the honey' },
      { id: 'c', text: 'The river has been running backwards on purpose' }
    ],
    correct: 'a',
    hint: 'It concerned somebody very well dressed, and their extremely well dressed horse.',
    afterword: 'Correct, and Bartholomew stands by it. He has never once been wrong, in his own opinion.'
  },
  {
    id: 'trial',
    prompt: 'At the cottage, the guardians settled everything with three symbols. Which one defeats the Scroll?',
    answers: [
      { id: 'a', text: 'Stone' },
      { id: 'b', text: 'Scroll' },
      { id: 'c', text: 'Shears' }
    ],
    correct: 'c',
    hint: 'One guardian was very proud of how neatly it cut things.',
    afterword: 'Shears. The kingdom will now be deciding dinner on your authority.'
  }
];

export function createTrialState() {
  return { index: 0, correctCount: 0, wrongThisQuestion: 0, answered: [], finished: false };
}

export function currentQuestion(state) {
  return QUESTIONS[state.index] || null;
}

/**
 * Answers the current question. A wrong answer never ends the trial — it just
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
