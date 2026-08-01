/**
 * Puzzle rules. These run without a browser: everything under src/puzzles/
 * (apart from panels.js, which draws them) is deliberately free of DOM code.
 *
 *   npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SYMBOLS, WINS_AGAINST, counterTo, beats, ROUNDS, GUARDIAN_CLUES,
  createTrialState, currentRound, submitChoice, feedbackForWrongChoice, hintForRound
} from '../src/puzzles/guardianTrial.js';

import {
  MURAL_PAIRS, darkPanels, lightPanels, createMuralState,
  tryJoin, isComplete, mismatchMessage, hintForMural
} from '../src/puzzles/muralPairs.js';

import {
  QUESTIONS, createTrialState as createQuizState, currentQuestion,
  answerQuestion, hintForQuestion, wasFlawless
} from '../src/puzzles/storykeeperTrial.js';

/* ------------------------------------------------------------------------ */

test('guardian trial: the three rules form a complete cycle', () => {
  assert.deepEqual(SYMBOLS, ['stone', 'scroll', 'shears']);
  // Every symbol beats exactly one other and is beaten by exactly one other.
  for (const symbol of SYMBOLS) {
    assert.notEqual(WINS_AGAINST[symbol], symbol, `${symbol} must not beat itself`);
    assert.ok(SYMBOLS.includes(WINS_AGAINST[symbol]));
    assert.ok(counterTo(symbol), `something must defeat ${symbol}`);
    assert.equal(beats(counterTo(symbol), symbol), true);
  }
  const beaten = SYMBOLS.map((s) => WINS_AGAINST[s]).sort();
  assert.deepEqual(beaten, [...SYMBOLS].sort(), 'each symbol is beaten exactly once');
});

test('guardian trial: every clue the guardians give is true', () => {
  for (const [symbol, clue] of Object.entries(GUARDIAN_CLUES)) {
    assert.equal(typeof clue, 'string');
    const loser = WINS_AGAINST[symbol];
    // The clue must name the symbol this guardian defeats.
    assert.match(clue, new RegExp(loser, 'i'), `${symbol}'s clue should mention ${loser}`);
  }
});

test('guardian trial: correct answers advance and finish the trial', () => {
  const state = createTrialState();
  assert.equal(state.solved, false);

  for (let i = 0; i < ROUNDS.length; i++) {
    const round = currentRound(state);
    assert.equal(round.id, i + 1);
    const result = submitChoice(state, counterTo(round.guardian));
    assert.equal(result.correct, true);
    assert.equal(result.finished, i === ROUNDS.length - 1);
  }
  assert.equal(state.solved, true);
  assert.equal(currentRound(state), null);
});

test('guardian trial: a wrong answer keeps the round open and never breaks it', () => {
  const state = createTrialState();
  const round = currentRound(state);
  const wrong = SYMBOLS.find((s) => s !== counterTo(round.guardian));

  const result = submitChoice(state, wrong);
  assert.equal(result.correct, false);
  assert.equal(state.round, 0, 'still on the same round');
  assert.equal(state.wrongThisRound, 1);
  assert.equal(typeof feedbackForWrongChoice(round.guardian, wrong), 'string');

  // Repeated failure is survivable, and the right answer still works after.
  for (let i = 0; i < 8; i++) submitChoice(state, wrong);
  assert.equal(state.solved, false);
  assert.equal(submitChoice(state, counterTo(round.guardian)).correct, true);
  assert.equal(state.round, 1);
});

test('guardian trial: submitting after the trial is won is harmless', () => {
  const state = createTrialState();
  for (const round of ROUNDS) submitChoice(state, counterTo(round.guardian));
  const result = submitChoice(state, 'stone');
  assert.equal(result.correct, false);
  assert.equal(state.solved, true);
});

test('guardian trial: the final hint gives the answer that actually wins', () => {
  const state = createTrialState();
  for (let i = 0; i < ROUNDS.length; i++) {
    const round = currentRound(state);
    const answer = counterTo(round.guardian);
    const hint = hintForRound(state, 3);
    assert.match(hint, new RegExp(answer, 'i'), `hint for round ${round.id} must name ${answer}`);
    for (let level = 1; level <= 3; level++) {
      assert.equal(typeof hintForRound(state, level), 'string');
    }
    submitChoice(state, answer);
  }
  assert.match(hintForRound(state, 3), /already won/i);
});

/* ------------------------------------------------------------------------ */

test('mural: every pair has a distinct dark and light panel', () => {
  const darkIds = darkPanels().map((p) => p.id);
  const lightIds = lightPanels().map((p) => p.id);
  assert.equal(new Set(darkIds).size, darkIds.length, 'dark ids are unique');
  assert.equal(new Set(lightIds).size, lightIds.length, 'light ids are unique');
  assert.equal(darkIds.length, MURAL_PAIRS.length);
  for (const pair of MURAL_PAIRS) {
    assert.ok(pair.dark.label && pair.light.label);
    assert.ok(pair.joined, 'each pair explains itself once joined');
  }
});

test('mural: joining every correct pair completes the picture', () => {
  const state = createMuralState();
  MURAL_PAIRS.forEach((pair, index) => {
    const result = tryJoin(state, pair.dark.id, pair.light.id);
    assert.equal(result.correct, true);
    assert.equal(result.complete, index === MURAL_PAIRS.length - 1);
  });
  assert.equal(isComplete(state), true);
  assert.equal(state.mistakes, 0);
});

test('mural: a mismatch is rejected, explained, and costs no progress', () => {
  const state = createMuralState();
  const [first, second] = MURAL_PAIRS;
  const result = tryJoin(state, first.dark.id, second.light.id);
  assert.equal(result.correct, false);
  assert.equal(state.matched.length, 0);
  assert.equal(state.mistakes, 1);
  assert.match(mismatchMessage(first.dark.id, second.light.id), /not two halves/i);

  // The right pairing still works afterwards.
  assert.equal(tryJoin(state, first.dark.id, first.light.id).correct, true);
});

test('mural: joining the same pair twice does not double-count it', () => {
  const state = createMuralState();
  const pair = MURAL_PAIRS[0];
  tryJoin(state, pair.dark.id, pair.light.id);
  tryJoin(state, pair.dark.id, pair.light.id);
  assert.equal(state.matched.length, 1);
});

test('mural: the strongest hint names a genuinely unmatched pair', () => {
  const state = createMuralState();
  tryJoin(state, MURAL_PAIRS[0].dark.id, MURAL_PAIRS[0].light.id);
  const hint = hintForMural(state, 3);
  const next = MURAL_PAIRS[1];
  assert.ok(hint.includes(next.dark.label), 'hint points at a pair still missing');
  assert.ok(hint.includes(next.light.label));
  assert.ok(!hint.includes(MURAL_PAIRS[0].dark.label), 'hint never repeats a solved pair');
});

/* ------------------------------------------------------------------------ */

test('storykeeper: every question has exactly one valid answer', () => {
  for (const question of QUESTIONS) {
    const ids = question.answers.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes(question.correct), `${question.id} must have a real correct answer`);
    assert.ok(question.hint && question.afterword);
  }
});

test('storykeeper: three right answers finish the trial flawlessly', () => {
  const state = createQuizState();
  for (const question of QUESTIONS) {
    assert.equal(currentQuestion(state).id, question.id);
    const result = answerQuestion(state, question.correct);
    assert.equal(result.correct, true);
  }
  assert.equal(state.finished, true);
  assert.equal(state.correctCount, QUESTIONS.length);
  assert.equal(wasFlawless(state), true);
});

test('storykeeper: wrong answers only delay, and drop the flawless run', () => {
  const state = createQuizState();
  const first = QUESTIONS[0];
  const wrong = first.answers.find((a) => a.id !== first.correct);

  assert.equal(answerQuestion(state, wrong.id).correct, false);
  assert.equal(state.index, 0, 'stays on the same question');
  assert.equal(answerQuestion(state, first.correct).correct, true);

  for (const question of QUESTIONS.slice(1)) answerQuestion(state, question.correct);
  assert.equal(state.finished, true);
  assert.equal(wasFlawless(state), false);
});

test('storykeeper: the strongest hint quotes the correct answer', () => {
  const state = createQuizState();
  for (const question of QUESTIONS) {
    const answer = question.answers.find((a) => a.id === question.correct);
    assert.ok(hintForQuestion(state, 3).includes(answer.text));
    // The second-level hint must eliminate something that is genuinely wrong.
    const level2 = hintForQuestion(state, 2);
    assert.ok(!level2.includes(answer.text), 'level 2 never rules out the right answer');
    answerQuestion(state, question.correct);
  }
});

test('storykeeper: the trivia answers agree with the rest of the game', () => {
  // Question three asks which symbol defeats the Scroll; the cottage puzzle
  // must give the same answer, or the hall would be lying.
  const question = QUESTIONS.find((q) => q.id === 'trial');
  const answer = question.answers.find((a) => a.id === question.correct);
  assert.equal(answer.text.toLowerCase(), counterTo('scroll'));
});
