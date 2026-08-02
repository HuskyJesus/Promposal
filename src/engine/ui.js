/**
 * Everything the player reads or taps outside the world: the dialogue box,
 * overlay panels (menus, puzzles, storybook pages), the HUD, audio captions
 * and the page-turn transition.
 *
 * These are real DOM elements rather than shapes drawn on the canvas, which is
 * what makes the game reachable by screen readers and by the keyboard.
 */

import { drawPortrait } from './sprites.js';
import { fill } from '../config.js';
import { SPEAKER_THEMES } from './theme.js';

/** Small helper for building elements without a template language. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(viewBox, markup, className) {
  const node = document.createElementNS(SVG_NS, 'svg');
  node.setAttribute('viewBox', viewBox);
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  if (className) node.setAttribute('class', className);
  node.innerHTML = markup;
  return node;
}

/** Gold filigree for one corner of an illustrated frame. */
function frameCorner(position) {
  return svg('0 0 64 64', `
    <g fill="none" stroke="var(--c-gold)" stroke-width="2.4" stroke-linecap="round">
      <path d="M6 30V12a6 6 0 0 1 6-6h18"/>
      <path d="M14 30V18a4 4 0 0 1 4-4h12" opacity=".65"/>
      <path d="M30 6c6 0 10 3 12 7M6 30c0 6 3 10 7 12" opacity=".5"/>
    </g>
    <g fill="var(--c-gold)">
      <circle cx="12" cy="12" r="3"/>
      <path d="M34 10c3 1 5 3 6 6-3-1-5-3-6-6ZM10 34c1 3 3 5 6 6-1-3-3-5-6-6Z" opacity=".75"/>
    </g>`, `frame-corner frame-corner-${position}`);
}

/** Three silver stars, the mark that runs through the whole story. */
export function threeStarsMark(className = 'three-stars') {
  return svg('0 0 120 34', `
    <g fill="var(--c-silver)">
      <path d="M60 2 64 14 76 18 64 22 60 34 56 22 44 18 56 14Z"/>
      <path d="M20 10 23 18 31 21 23 24 20 32 17 24 9 21 17 18Z" opacity=".85"/>
      <path d="M100 10 103 18 111 21 103 24 100 32 97 24 89 21 97 18Z" opacity=".85"/>
    </g>`, className);
}

/**
 * An illustrated storybook frame: filigree corners, three stars at the head,
 * and a soft lavender glow. Used for the moments that should not look like a
 * dialog box.
 */
export function ornateFrame(children, { className = '', label, stars = true } = {}) {
  return el('div', { class: `ornate ${className}`.trim(), role: 'dialog', 'aria-label': label }, [
    frameCorner('tl'), frameCorner('tr'), frameCorner('bl'), frameCorner('br'),
    stars ? threeStarsMark() : null,
    el('div', { class: 'ornate-inner' }, children)
  ]);
}

export class UI {
  constructor({ audio, settings }) {
    this.audio = audio;
    this.settings = settings;

    this.hud = document.getElementById('hud');
    this.chapterLabel = document.getElementById('chapter-label');
    this.objectiveLabel = document.getElementById('objective-label');
    this.fragmentTrack = document.getElementById('fragment-track');
    this.hintButton = document.getElementById('hint-button');
    this.menuButton = document.getElementById('menu-button');
    this.touchControls = document.getElementById('touch-controls');
    this.interactButton = document.getElementById('interact-button');
    this.interactLabel = document.getElementById('interact-label');
    this.interactGlyph = document.getElementById('interact-glyph');
    this.overlay = document.getElementById('overlay');
    this.captionNode = document.getElementById('caption');
    this.pageTurnNode = document.getElementById('page-turn');

    this.dialogue = new DialogueBox({ audio, settings });
    this.captionTimer = 0;
    this.lastFocused = null;
    this.panelStack = [];

    /** The game listens so the rotate hint never sits on top of a panel. */
    this.onPanelChange = () => {};

    this.overlay.addEventListener('keydown', (event) => this.#handleOverlayKey(event));
    // The thumb stick and action button step aside while she is reading, so
    // no line of dialogue ever sits underneath a control.
    this.dialogue.onVisibilityChange = (talking) => {
      this.touchControls.dataset.stowed = String(talking);
    };
    this.#buildFragmentTrack();
    this.#trackHudGutter();
  }

  /**
   * Keeps the chapter title centred in the play area rather than centred in
   * whatever space the buttons happen to leave over.
   *
   * The menu button on the left and the fragment track plus hint button on the
   * right are different widths, so a flex row puts the title off centre. The
   * title is absolutely centred instead, and this measures the wider of the two
   * groups so it can be given a matching gutter on both sides and never run
   * underneath either. When the phone is too narrow for that to leave room for
   * words, the title drops to its own line below the buttons, still centred.
   */
  #trackHudGutter() {
    const hudRoot = document.documentElement;
    const measure = () => {
      const left = this.menuButton.offsetWidth;
      const right = this.hud.querySelector('.hud-right')?.offsetWidth ?? 0;
      const gutter = Math.max(left, right) + 10;
      hudRoot.style.setProperty('--hud-gutter', `${Math.round(gutter)}px`);
      const room = this.hud.clientWidth - gutter * 2;
      this.hud.dataset.stacked = String(room < 150);
    };

    measure();
    if (typeof ResizeObserver === 'function') {
      this.hudObserver = new ResizeObserver(measure);
      this.hudObserver.observe(this.hud);
      this.hudObserver.observe(this.menuButton);
      const right = this.hud.querySelector('.hud-right');
      if (right) this.hudObserver.observe(right);
    } else {
      // Older Safari: remeasure on the events that can change the layout.
      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', () => setTimeout(measure, 120));
    }
  }

  #buildFragmentTrack() {
    this.fragmentTrack.replaceChildren();
    this.fragmentPips = [];
    for (let i = 0; i < 3; i++) {
      const pip = el('span', {
        class: 'fragment-pip',
        role: 'img',
        'aria-label': `Story fragment ${i + 1}: not yet found`,
        dataset: { filled: 'false' }
      });
      this.fragmentPips.push(pip);
      this.fragmentTrack.append(pip);
    }
  }

  /* ------------------------------------------------------------------ HUD */

  showHud(show) {
    this.hud.hidden = !show;
    this.touchControls.hidden = !show;
  }

  setChapter(title, objective = '') {
    this.chapterLabel.textContent = title;
    this.objectiveLabel.textContent = objective;
  }

  setObjective(text) {
    this.objectiveLabel.textContent = text;
  }

  setFragments(count, animateIndex = -1) {
    this.fragmentPips.forEach((pip, i) => {
      const filled = i < count;
      pip.dataset.filled = String(filled);
      pip.setAttribute('aria-label', `Story fragment ${i + 1}: ${filled ? 'recovered' : 'not yet found'}`);
      if (i === animateIndex && filled) {
        pip.classList.remove('just-earned');
        void pip.offsetWidth; // restart the animation
        pip.classList.add('just-earned');
      }
    });
  }

  /** Shows the interaction button's current target, or greys it out. */
  setInteractTarget(label) {
    const available = Boolean(label);
    this.interactButton.dataset.available = String(available);
    this.interactLabel.textContent = label || 'Look';
    this.interactButton.setAttribute('aria-label', available ? `${label} (Space)` : 'Nothing nearby to interact with');
    this.interactGlyph.textContent = available ? '✦' : '·';
  }

  setHintAvailable(available, pulse = false) {
    this.hintButton.hidden = !available;
    this.hintButton.classList.toggle('pulse', Boolean(pulse) && !this.settings.reducedMotion);
  }

  /* -------------------------------------------------------------- captions */

  /** Text for an audio cue, so nothing meaningful is sound-only. */
  caption(text) {
    if (!text) return;
    this.captionNode.textContent = text;
    this.captionNode.dataset.visible = 'true';
    clearTimeout(this.captionTimer);
    this.captionTimer = setTimeout(() => {
      this.captionNode.dataset.visible = 'false';
    }, 2600);
  }

  /* ---------------------------------------------------------------- panels */

  /**
   * Opens a panel. `build(close)` returns the panel element; `close(result)`
   * resolves the returned promise.
   *
   * Panels stack: opening "How to play" from the menu hides the menu and then
   * puts it back when the new panel closes.
   */
  openPanel(build, { clear = false, dismissable = false, scrim = 'full' } = {}) {
    return new Promise((resolve) => {
      const parent = this.panelStack[this.panelStack.length - 1];
      if (parent) {
        parent.nodes = [...this.overlay.children];
        parent.focused = document.activeElement;
      } else {
        this.lastFocused = document.activeElement;
      }

      this.overlay.hidden = false;
      this.overlay.dataset.clear = String(clear);
      this.overlay.dataset.scrim = scrim;
      this.overlay.replaceChildren();

      const entry = { resolve, clear, scrim, dismissable, nodes: [], focused: null };
      this.panelStack.push(entry);

      const close = (result) => {
        const index = this.panelStack.indexOf(entry);
        if (index === -1) return;
        this.panelStack.splice(index, 1);

        const previous = this.panelStack[this.panelStack.length - 1];
        if (previous) {
          this.overlay.dataset.clear = String(previous.clear);
          this.overlay.dataset.scrim = previous.scrim;
          this.overlay.replaceChildren(...previous.nodes);
          const target = previous.focused instanceof HTMLElement && this.overlay.contains(previous.focused)
            ? previous.focused
            : this.overlay.querySelector(FOCUSABLE);
          if (target instanceof HTMLElement) target.focus({ preventScroll: true });
        } else {
          this.overlay.replaceChildren();
          this.overlay.hidden = true;
          if (this.lastFocused instanceof HTMLElement && document.contains(this.lastFocused)) {
            this.lastFocused.focus({ preventScroll: true });
          }
        }
        this.onPanelChange();
        resolve(result);
      };

      entry.close = close;
      this.overlay.append(build(close));
      this.onPanelChange();

      const firstFocusable = this.overlay.querySelector(FOCUSABLE);
      if (firstFocusable instanceof HTMLElement) firstFocusable.focus({ preventScroll: true });
    });
  }

  /**
   * Closes the topmost panel if it allows it. Escape is routed through the
   * game loop rather than handled here, so a single press cannot both close a
   * panel and be read again as "open the menu".
   */
  closeTopPanel() {
    const entry = this.panelStack[this.panelStack.length - 1];
    if (!entry || !entry.dismissable) return false;
    entry.close(null);
    return true;
  }

  /** Keeps keyboard focus inside the topmost panel. */
  #handleOverlayKey(event) {
    const entry = this.panelStack[this.panelStack.length - 1];
    if (!entry) return;
    if (event.key !== 'Tab') return;
    const items = [...this.overlay.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  get panelOpen() {
    return !this.overlay.hidden;
  }

  /* ------------------------------------------------------------ transitions */

  /** Storybook page turn. `midpoint` runs while the page covers the screen. */
  async pageTurn(midpoint) {
    const instant = this.settings.reducedMotion;
    if (instant) {
      // Still a beat of darkness, just without the sweeping animation.
      this.pageTurnNode.dataset.playing = 'true';
      await wait(60);
      if (midpoint) await midpoint();
      this.pageTurnNode.dataset.playing = 'false';
      return;
    }
    this.audio.pageTurn();
    this.pageTurnNode.dataset.playing = 'true';
    await wait(440);
    if (midpoint) await midpoint();
    await wait(460);
    this.pageTurnNode.dataset.playing = 'false';
  }
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* -------------------------------------------------------------------------
   Dialogue
   ------------------------------------------------------------------------- */

const SPEAKER_STYLE = {
  theo: { name: 'Theo', portrait: 'theo' },
  hero: { name: null, portrait: 'hero' }, // filled with the heroine's name
  narrator: { name: 'The Story', portrait: 'narrator' },
  frog: { name: 'Bartholomew', portrait: 'frog' },
  bird: { name: 'A Breathless Sparrow', portrait: 'bird' },
  flowers: { name: 'Two Arguing Blossoms', portrait: 'flowers' },
  portrait: { name: 'A Painted Lady', portrait: 'portrait' },
  guardian: { name: 'A Guardian', portrait: 'guardian' }
};

export class DialogueBox {
  constructor({ audio, settings }) {
    this.audio = audio;
    this.settings = settings;
    this.root = document.getElementById('dialogue');
    this.nameNode = document.getElementById('dialogue-name');
    this.textNode = document.getElementById('dialogue-text');
    this.choicesNode = document.getElementById('dialogue-choices');
    this.advanceButton = document.getElementById('dialogue-advance');
    this.portraitHost = document.getElementById('dialogue-portrait');

    this.portraitCanvas = document.createElement('canvas');
    this.portraitCtx = this.portraitCanvas.getContext('2d');
    this.portraitHost.append(this.portraitCanvas);
    this.#sizePortrait();

    this.active = false;
    this.queue = [];
    this.current = null;
    this.revealed = 0;
    this.time = 0;
    this.resolve = null;
    this.heroName = 'You';
    this.awaitingChoice = false;
    this.lastAdvance = 0;
    /** Set by the UI so the thumb stick can step aside while she reads. */
    this.onVisibilityChange = () => {};

    this.root.addEventListener('click', (event) => {
      if (event.target.closest('.dialogue-choices')) return;
      this.advance();
    });
    window.addEventListener('resize', () => this.#sizePortrait());
  }

  #sizePortrait() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = this.portraitHost.getBoundingClientRect();
    const size = Math.max(48, Math.round((rect.width || 84)));
    this.portraitCanvas.width = Math.round(size * dpr);
    this.portraitCanvas.height = Math.round(size * dpr);
  }

  /**
   * Plays a list of lines. Each line is `{ who, text, mood?, name?, choices? }`.
   * Resolves with the id of the last chosen choice, or null.
   */
  play(lines) {
    this.queue = lines.slice();
    this.chosen = null;
    this.active = true;
    this.root.hidden = false;
    this.lastAdvance = performance.now();
    this.#sizePortrait();
    this.onVisibilityChange(true);
    this.#next();
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  #next() {
    if (this.queue.length === 0) {
      this.#finish();
      return;
    }
    const line = this.queue.shift();
    // Personalisation tokens are expanded here so no scene has to remember to.
    this.current = { ...line, text: fill(line.text), name: fill(line.name) };
    this.revealed = 0;
    this.awaitingChoice = false;
    this.choicesNode.hidden = true;
    this.choicesNode.replaceChildren();
    this.advanceButton.hidden = false;

    const style = SPEAKER_STYLE[this.current.who] || SPEAKER_STYLE.narrator;
    const speakerName = this.current.name || (this.current.who === 'hero' ? this.heroName : style.name);
    this.nameNode.textContent = speakerName || '';
    this.root.setAttribute('aria-label', `${speakerName || 'Story'} says: ${this.current.text}`);

    // Each speaker tints the box, on top of the portrait and the printed name.
    const theme = SPEAKER_THEMES[this.current.who] || SPEAKER_THEMES.narrator;
    this.root.dataset.speaker = this.current.who || 'narrator';
    this.root.style.setProperty('--speaker-accent', theme.accent);
    this.root.style.setProperty('--speaker-glow', theme.glow);

    if (this.settings.textSpeed === 'instant' || this.settings.reducedMotion) {
      this.revealed = this.current.text.length;
      this.#renderText();
      this.#maybeShowChoices();
    } else {
      this.textNode.textContent = '';
    }
  }

  #renderText() {
    const text = this.current.text.slice(0, Math.floor(this.revealed));
    this.textNode.textContent = text;
  }

  #maybeShowChoices() {
    if (!this.current.choices || this.awaitingChoice) return;
    this.awaitingChoice = true;
    this.advanceButton.hidden = true;
    this.choicesNode.hidden = false;
    this.choicesNode.replaceChildren(
      ...this.current.choices.map((choice) =>
        el('button', {
          type: 'button',
          text: fill(choice.label),
          onClick: () => {
            this.audio.uiTap();
            this.chosen = choice.id;
            if (choice.lines) this.queue = choice.lines.concat(this.queue);
            this.#next();
          }
        })
      )
    );
    const first = this.choicesNode.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }

  /**
   * Tap / Space: the first press completes the line, the next moves on.
   * A short guard stops one enthusiastic tap being read as two presses and
   * skipping a line unseen.
   */
  advance() {
    if (!this.active || this.awaitingChoice) return;
    const now = performance.now();
    if (now - this.lastAdvance < 180) return;
    this.lastAdvance = now;
    const full = this.current.text.length;
    if (this.revealed < full) {
      this.revealed = full;
      this.#renderText();
      this.#maybeShowChoices();
    } else {
      this.audio.uiTap();
      this.#next();
    }
  }

  #finish() {
    this.active = false;
    this.current = null;
    this.root.hidden = true;
    this.onVisibilityChange(false);
    const resolve = this.resolve;
    this.resolve = null;
    if (resolve) resolve(this.chosen);
  }

  update(dt) {
    if (!this.active || !this.current) return;
    this.time += dt;

    const full = this.current.text.length;
    if (this.revealed < full) {
      const charsPerSecond = 52;
      const before = Math.floor(this.revealed);
      this.revealed = Math.min(full, this.revealed + dt * charsPerSecond);
      const after = Math.floor(this.revealed);
      if (after !== before) {
        this.#renderText();
        if (after % 3 === 0) this.audio.blip();
      }
      if (this.revealed >= full) this.#maybeShowChoices();
    }

    // The portrait keeps breathing while the line is on screen.
    const style = SPEAKER_STYLE[this.current.who] || SPEAKER_STYLE.narrator;
    const size = this.portraitCanvas.width;
    this.portraitCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.portraitCtx.clearRect(0, 0, size, size);
    drawPortrait(this.portraitCtx, size, style.portrait, this.current.mood || 'happy', this.time);
  }
}
