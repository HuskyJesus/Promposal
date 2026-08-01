/**
 * The interfaces for the three puzzles. All the rules live in the sibling
 * modules; this file only draws them, listens for taps and keys, and reports
 * back what happened.
 *
 * Every puzzle here is tap-or-key only — nothing needs to be dragged.
 */

import { el } from '../engine/ui.js';
import { svgIcon } from '../engine/icons.js';
import { drawSymbolGlyph } from '../engine/sprites.js';
import { config } from '../config.js';

import {
  SYMBOLS, SYMBOL_NAMES, ROUNDS, createTrialState, currentRound,
  submitChoice, feedbackForWrongChoice, hintForRound, counterTo
} from './guardianTrial.js';

import {
  darkPanels, lightPanels, createMuralState, tryJoin, isMatched,
  mismatchMessage, hintForMural, MURAL_PAIRS
} from './muralPairs.js';

import {
  createTrialState as createQuizState, currentQuestion, answerQuestion,
  hintForQuestion, wasFlawless, QUESTIONS
} from './storykeeperTrial.js';

/**
 * A canvas showing one of the three trial symbols. It is drawn at a generous
 * resolution and then sized by CSS, so the same glyph stays sharp whether the
 * layout gives it 108 pixels or 56.
 */
function symbolCanvas(symbol, className, palette) {
  const size = 128;
  const canvas = el('canvas', { width: size, height: size, class: className, 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d');
  drawSymbolGlyph(ctx, size / 2, size / 2, size * 0.38, symbol, palette || {});
  return canvas;
}

function feedbackNode() {
  return el('p', { class: 'puzzle-feedback', role: 'status', 'aria-live': 'polite' });
}

function setFeedback(node, text, tone = 'neutral') {
  node.dataset.tone = tone;
  const mark = tone === 'good' ? '✓' : tone === 'soft' ? '✻' : '·';
  node.replaceChildren(el('span', { class: 'tone-mark', 'aria-hidden': 'true', text: mark }), document.createTextNode(text));
}

/* =========================================================================
   Chapter 2 — the Trial of Stone, Scroll and Shears
   ========================================================================= */

export function runGuardianTrial(game) {
  const state = createTrialState();

  return game.ui.openPanel((close) => {
    const roundTrack = el('div', { class: 'round-track', role: 'img', 'aria-label': 'Round progress' });
    const guardianArt = el('div', { style: 'display:grid;place-items:center;margin-top:8px;' });
    const promptNode = el('p', { class: 'trivia-question' });
    const flavourNode = el('p', { class: 'panel-subtitle', style: 'margin-bottom:0;' });
    const feedback = feedbackNode();
    const grid = el('div', { class: 'choice-grid' });

    const renderRound = () => {
      const round = currentRound(state);
      roundTrack.replaceChildren(
        ...ROUNDS.map((r, i) =>
          el('span', {
            class: 'round-dot',
            dataset: { done: String(i < state.round), current: String(i === state.round) }
          })
        )
      );
      roundTrack.setAttribute('aria-label', `Round ${Math.min(state.round + 1, ROUNDS.length)} of ${ROUNDS.length}`);

      if (!round) return;
      guardianArt.replaceChildren(symbolCanvas(round.guardian, 'glyph-large'));
      promptNode.textContent = round.prompt;
      flavourNode.textContent = round.flavour;

      grid.replaceChildren(
        ...SYMBOLS.map((symbol) => {
          const card = el('button', {
            class: 'choice-card',
            type: 'button',
            'aria-label': `Answer with ${SYMBOL_NAMES[symbol]}`
          }, [
            symbolCanvas(symbol, 'glyph-small'),
            el('span', { text: SYMBOL_NAMES[symbol] })
          ]);
          card.addEventListener('click', () => onAnswer(symbol, card));
          return card;
        })
      );
    };

    const onAnswer = (symbol, card) => {
      const round = currentRound(state);
      if (!round) return;
      const result = submitChoice(state, symbol);

      if (result.correct) {
        card.dataset.state = 'right';
        card.append(el('span', { class: 'card-mark', text: 'Wins' }));
        [...grid.querySelectorAll('button')].forEach((b) => { b.disabled = true; });
        game.audio.success();
        setFeedback(feedback, `${SYMBOL_NAMES[symbol]} defeats ${SYMBOL_NAMES[result.guardian]}. The guardian bows and steps aside.`, 'good');

        setTimeout(() => {
          if (result.finished) {
            game.audio.threeChimes();
            close(true);
          } else {
            renderRound();
            setFeedback(feedback, 'The next guardian steps forward.', 'neutral');
          }
        }, 1100);
      } else {
        card.dataset.state = 'wrong';
        card.append(el('span', { class: 'card-mark', text: 'No' }));
        game.audio.gentleNo();
        setFeedback(feedback, feedbackForWrongChoice(result.guardian, symbol), 'soft');
        setTimeout(() => {
          card.dataset.state = '';
          card.querySelector('.card-mark')?.remove();
        }, 900);
      }
    };

    const hintButton = el('button', {
      class: 'menu-button quiet',
      type: 'button',
      text: `Ask ${config.guideName} for a hint`
    });
    hintButton.addEventListener('click', () => {
      const level = game.save.bumpHint('guardianTrial');
      game.audio.uiTap();
      setFeedback(feedback, `${config.guideName}: “${hintForRound(state, level)}”`, 'neutral');
    });

    renderRound();
    setFeedback(feedback, 'Choose the symbol that defeats the one the guardian is holding.', 'neutral');

    return el('div', { class: 'panel', role: 'dialog', 'aria-label': 'The Trial of Stone, Scroll and Shears' }, [
      el('h2', { class: 'panel-title', text: 'Stone, Scroll and Shears' }),
      el('p', { class: 'panel-subtitle', text: 'Answer each guardian with the symbol that defeats theirs.' }),
      roundTrack,
      guardianArt,
      promptNode,
      flavourNode,
      grid,
      feedback,
      el('div', { class: 'panel-actions' }, [
        hintButton,
        el('button', {
          class: 'menu-button quiet',
          type: 'button',
          text: 'Step back for a moment',
          onClick: () => { game.audio.uiTap(); close(false); }
        })
      ])
    ]);
  });
}

/* =========================================================================
   Chapter 3a — the divided mural
   ========================================================================= */

export function runMuralPuzzle(game) {
  const state = createMuralState();

  return game.ui.openPanel((close) => {
    const feedback = feedbackNode();
    const darkColumn = el('div', { class: 'mural-column', role: 'group', 'aria-label': 'Dark half of the mural' });
    const lightColumn = el('div', { class: 'mural-column', role: 'group', 'aria-label': 'Light half of the mural' });
    const progress = el('p', { class: 'panel-subtitle', role: 'status', 'aria-live': 'polite' });

    const render = () => {
      progress.textContent = `${state.matched.length} of ${MURAL_PAIRS.length} panels joined`;

      const build = (panel, side) => {
        const matched = isMatched(state, panel.pairId);
        const selected = side === 'dark' && state.selectedDark === panel.id;
        const button = el('button', {
          class: 'mural-tile',
          type: 'button',
          dataset: { side, selected: String(selected), matched: String(matched) },
          'aria-pressed': side === 'dark' ? String(selected) : undefined,
          'aria-label': `${panel.label}. ${matched ? 'Already joined.' : side === 'dark' ? 'Dark half.' : 'Light half.'}`
        }, [
          svgIcon(panel.icon, { size: 42, color: side === 'dark' ? '#dde5f2' : '#201b28', stroke: side === 'dark' ? '#dde5f2' : '#201b28' }),
          el('span', { text: panel.label })
        ]);
        button.disabled = matched;
        button.addEventListener('click', () => onPick(panel, side));
        return button;
      };

      darkColumn.replaceChildren(...darkPanels().map((p) => build(p, 'dark')));
      lightColumn.replaceChildren(...lightPanels().map((p) => build(p, 'light')));
    };

    const onPick = (panel, side) => {
      if (side === 'dark') {
        state.selectedDark = state.selectedDark === panel.id ? null : panel.id;
        game.audio.uiTap();
        render();
        setFeedback(feedback, state.selectedDark
          ? `“${panel.label}” lifts off the wall and waits. Now choose its opposite from the light half.`
          : 'Panel set back down.', 'neutral');
        return;
      }

      if (!state.selectedDark) {
        game.audio.uiTap();
        setFeedback(feedback, 'Choose a panel from the dark half first, then its opposite here.', 'neutral');
        return;
      }

      const darkId = state.selectedDark;
      const result = tryJoin(state, darkId, panel.id);
      render();

      if (result.correct) {
        game.audio.collect();
        setFeedback(feedback, result.joined, 'good');
        if (result.complete) {
          setTimeout(() => {
            game.audio.threeChimes();
            close(true);
          }, 1200);
        }
      } else {
        game.audio.gentleNo();
        setFeedback(feedback, mismatchMessage(darkId, panel.id), 'soft');
      }
    };

    const hintButton = el('button', {
      class: 'menu-button quiet',
      type: 'button',
      text: `Ask ${config.guideName} for a hint`
    });
    hintButton.addEventListener('click', () => {
      const level = game.save.bumpHint('mural');
      game.audio.uiTap();
      setFeedback(feedback, `${config.guideName}: “${hintForMural(state, level)}”`, 'neutral');
    });

    render();
    setFeedback(feedback, 'Pick a panel from the dark half, then the panel on the light half that completes the same idea.', 'neutral');

    return el('div', { class: 'panel', role: 'dialog', 'aria-label': 'The divided mural' }, [
      el('h2', { class: 'panel-title', text: 'The Divided Mural' }),
      el('p', { class: 'panel-subtitle', text: 'Two halves of one picture, waiting to be introduced.' }),
      progress,
      el('div', { class: 'mural-board' }, [
        darkColumn,
        el('div', { class: 'mural-divider', 'aria-hidden': 'true' }),
        lightColumn
      ]),
      feedback,
      el('div', { class: 'panel-actions' }, [
        hintButton,
        el('button', {
          class: 'menu-button quiet',
          type: 'button',
          text: 'Step back for a moment',
          onClick: () => { game.audio.uiTap(); close(false); }
        })
      ])
    ]);
  });
}

/* =========================================================================
   Chapter 3b — the Storykeeper's Trial
   ========================================================================= */

export function runStorykeeperTrial(game) {
  const state = createQuizState();

  return game.ui.openPanel((close) => {
    const counter = el('p', { class: 'panel-subtitle' });
    const questionNode = el('h3', { class: 'trivia-question' });
    const answers = el('div', { class: 'answer-list' });
    const feedback = feedbackNode();

    const render = () => {
      const question = currentQuestion(state);
      if (!question) return;
      counter.textContent = `Question ${state.index + 1} of ${QUESTIONS.length}`;
      questionNode.textContent = question.prompt;
      answers.replaceChildren(
        ...question.answers.map((answer, i) => {
          const button = el('button', {
            class: 'answer-button',
            type: 'button'
          }, [
            el('span', { class: 'key', 'aria-hidden': 'true', text: String.fromCharCode(65 + i) }),
            el('span', { text: answer.text })
          ]);
          button.addEventListener('click', () => onAnswer(answer.id, button));
          return button;
        })
      );
    };

    const onAnswer = (answerId, button) => {
      const result = answerQuestion(state, answerId);
      if (!result.question) return;

      if (result.correct) {
        button.dataset.state = 'right';
        [...answers.querySelectorAll('button')].forEach((b) => { b.disabled = true; });
        game.audio.success();
        setFeedback(feedback, result.question.afterword, 'good');
        setTimeout(() => {
          if (result.finished) {
            game.audio.threeChimes();
            close({ solved: true, flawless: wasFlawless(state) });
          } else {
            render();
            setFeedback(feedback, 'The hall asks another.', 'neutral');
          }
        }, 1300);
      } else {
        button.dataset.state = 'wrong';
        button.disabled = true;
        game.audio.gentleNo();
        setFeedback(feedback, 'Not quite — the hall does not mind at all. Try another.', 'soft');
      }
    };

    const hintButton = el('button', {
      class: 'menu-button quiet',
      type: 'button',
      text: `Ask ${config.guideName} for a hint`
    });
    hintButton.addEventListener('click', () => {
      const level = game.save.bumpHint('storykeeper');
      game.audio.uiTap();
      setFeedback(feedback, `${config.guideName}: “${hintForQuestion(state, level)}”`, 'neutral');
    });

    render();
    setFeedback(feedback, 'Three questions. There is no penalty for a wrong answer — the hall is only curious.', 'neutral');

    return el('div', { class: 'panel', role: 'dialog', 'aria-label': "The Storykeeper's Trial" }, [
      el('h2', { class: 'panel-title', text: "The Storykeeper's Trial" }),
      counter,
      questionNode,
      answers,
      feedback,
      el('div', { class: 'panel-actions' }, [
        hintButton,
        el('button', {
          class: 'menu-button quiet',
          type: 'button',
          text: 'Step back for a moment',
          onClick: () => { game.audio.uiTap(); close({ solved: false, flawless: false }); }
        })
      ])
    ]);
  });
}

