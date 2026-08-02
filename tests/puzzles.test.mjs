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

import { GOSSIP } from '../src/data/gossip.js';

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

test('storykeeper: the guardian question agrees with the cottage puzzle', () => {
  // It asks which guardian wins by covering its opponent beyond recognition.
  // That is whatever the cottage rules say defeats Stone, or the hall is lying.
  const question = QUESTIONS.find((q) => q.id === 'guardians');
  const answer = question.answers.find((a) => a.id === question.correct);
  assert.equal(answer.text.toLowerCase(), counterTo('stone'));
});

test('storykeeper: the mural question agrees with the mural itself', () => {
  const question = QUESTIONS.find((q) => q.id === 'mural');
  const answer = question.answers.find((a) => a.id === question.correct);
  const inkPair = MURAL_PAIRS.find((pair) => pair.dark.id === 'ink');
  // "The empty page" must name the same panel the mural joins the ink to.
  assert.ok(
    answer.text.toLowerCase().includes(inkPair.light.id),
    `${answer.text} should name the ${inkPair.light.id}`
  );
});

test('storykeeper: the sparrow question agrees with what the sparrow said', () => {
  const question = QUESTIONS.find((q) => q.id === 'sparrow');
  const answer = question.answers.find((a) => a.id === question.correct);
  const spoken = GOSSIP.bird.lines.map((line) => line.text).join(' ');
  assert.ok(
    spoken.includes(answer.text),
    `the sparrow never says "${answer.text}"`
  );
  // And no wrong answer may also appear in what she said.
  for (const wrong of question.answers.filter((a) => a.id !== question.correct)) {
    assert.ok(!spoken.includes(wrong.text), `"${wrong.text}" is also in the sparrow's report`);
  }
});

test('storykeeper: no question can be answered by elimination alone', () => {
  for (const question of QUESTIONS) {
    assert.ok(question.answers.length >= 3, `${question.id} needs real alternatives`);
    for (const answer of question.answers) {
      assert.ok(answer.text.trim().length > 0);
    }
    const texts = question.answers.map((a) => a.text.toLowerCase());
    assert.equal(new Set(texts).size, texts.length, `${question.id} repeats an option`);
    // The correct answer must not be the only one the prompt does not mention,
    // and must not be the longest option, which is the usual accidental tell.
    const correct = question.answers.find((a) => a.id === question.correct);
    const longest = Math.max(...question.answers.map((a) => a.text.length));
    assert.ok(
      correct.text.length < longest || texts.filter((t) => t.length === longest).length > 1,
      `${question.id}: the right answer is the longest option`
    );
  }
});

test('mural: the two halves are hung in different orders', () => {
  const dark = darkPanels();
  const light = lightPanels();
  assert.equal(dark.length, light.length);
  dark.forEach((panel, i) => {
    assert.notEqual(
      panel.pairId, light[i].pairId,
      `row ${i + 1} pairs with itself, which gives the puzzle away`
    );
  });
  // Every pair must still appear exactly once on each side.
  assert.deepEqual(
    [...dark.map((p) => p.pairId)].sort(),
    MURAL_PAIRS.map((p) => p.id).sort()
  );
  assert.deepEqual(
    [...light.map((p) => p.pairId)].sort(),
    MURAL_PAIRS.map((p) => p.id).sort()
  );
});

test('mural: the arrangement does not shift while she is solving it', () => {
  const before = darkPanels().map((p) => p.id).join(',') + '|' + lightPanels().map((p) => p.id).join(',');
  const state = createMuralState();
  tryJoin(state, MURAL_PAIRS[0].dark.id, MURAL_PAIRS[1].light.id);  // a mistake
  tryJoin(state, MURAL_PAIRS[0].dark.id, MURAL_PAIRS[0].light.id);  // and a match
  const after = darkPanels().map((p) => p.id).join(',') + '|' + lightPanels().map((p) => p.id).join(',');
  assert.equal(after, before);
});
