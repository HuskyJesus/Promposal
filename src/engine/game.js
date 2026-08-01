/**
 * The game shell: owns the loop, the scene stack, the pause menu, and the
 * shared "award a story fragment" ceremony that ends each chapter.
 */

import { config, fill } from '../config.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { SaveStore } from './save.js';
import { UI, el, wait } from './ui.js';

export class Game {
  constructor() {
    this.save = new SaveStore();
    this.settings = this.save.settings;
    this.audio = new AudioEngine(this.settings);
    this.renderer = new Renderer(document.getElementById('stage'));
    this.input = new Input({
      stickZone: document.getElementById('stick-zone'),
      stickBase: document.getElementById('stick-base'),
      stickKnob: document.getElementById('stick-knob'),
      interactButton: document.getElementById('interact-button')
    });
    this.ui = new UI({ audio: this.audio, settings: this.settings });
    this.ui.dialogue.heroName = config.heroName;
    this.audio.onCaption = (text) => this.ui.caption(text);

    this.scenes = new Map();
    this.scene = null;
    this.paused = false;
    this.time = 0;
    this.lastFrame = 0;
    this.running = false;

    this.#bindShell();
    this.#applyMotionPreference();
  }

  register(name, factory) {
    this.scenes.set(name, factory);
  }

  #bindShell() {
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.#checkOrientation();
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.renderer.resize();
        this.#checkOrientation();
      }, 200);
    });

    this.ui.menuButton.addEventListener('click', () => {
      this.audio.unlock();
      this.openMenu();
    });
    this.ui.hintButton.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.uiTap();
      this.scene?.hint?.();
    });

    const rotateHint = document.getElementById('rotate-hint');
    document.getElementById('rotate-dismiss').addEventListener('click', () => {
      rotateHint.hidden = true;
      this.rotateDismissed = true;
    });

    // Any first gesture anywhere unlocks audio, per browser autoplay rules.
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
  }

  #applyMotionPreference() {
    const systemPrefers = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (systemPrefers && this.save.settings.reducedMotion === false && !this.save.settings.motionChosen) {
      this.settings.reducedMotion = true;
    }
    document.documentElement.dataset.reducedMotion = String(Boolean(this.settings.reducedMotion));
  }

  #checkOrientation() {
    const hint = document.getElementById('rotate-hint');
    const portrait = window.innerHeight > window.innerWidth;
    const playing = this.scene && this.scene.showsHud !== false;
    hint.hidden = !(portrait && playing && !this.rotateDismissed && !this.ui.panelOpen);
  }

  /* ------------------------------------------------------------ scene flow */

  /**
   * Swaps scenes behind a page-turn.
   *
   * A scene sets itself up in `enter()`, which happens while the page is
   * covering the screen, and plays its opening beat in `begin()`, which runs
   * once the page has finished turning — otherwise the transition would sit
   * on top of the first line of dialogue.
   */
  async goTo(name, payload = {}, { transition = true } = {}) {
    const factory = this.scenes.get(name);
    if (!factory) throw new Error(`Unknown scene: ${name}`);

    const swap = async () => {
      this.scene?.exit?.();
      this.ui.dialogue.root.hidden = true;
      const scene = factory(this);
      scene.name = name;
      this.scene = scene;
      this.ui.showHud(scene.showsHud !== false);
      this.ui.setHintAvailable(Boolean(scene.hint));
      this.ui.setInteractTarget(null);
      this.input.releaseAll();
      await scene.enter(payload);
      this.#checkOrientation();
    };

    if (transition) {
      await this.ui.pageTurn(swap);
    } else {
      await swap();
    }
    await this.scene?.begin?.(payload);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.#tick(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  #tick(dt) {
    this.time += dt;
    this.ui.dialogue.update(dt);

    if (this.input.takeCancel()) {
      if (this.ui.panelOpen) {
        this.ui.closeTopPanel();
      } else if (!this.ui.dialogue.active && this.scene?.showsHud !== false) {
        this.openMenu();
      }
    }

    if (this.input.takeConfirm()) {
      if (this.ui.dialogue.active) {
        this.ui.dialogue.advance();
      } else if (!this.ui.panelOpen) {
        this.scene?.interact?.();
      }
    }

    if (!this.paused) this.scene?.update?.(dt);
    this.scene?.draw?.(this.renderer);
  }

  /* -------------------------------------------------------------- ceremony */

  /** Shows one storybook page and waits for the reader. */
  showStoryPage({ title, paragraphs, buttonLabel = 'Turn the page', dropcap = true }) {
    return this.ui.openPanel((close) =>
      el('article', { class: 'story-page', role: 'document', 'aria-label': title || 'Story page' }, [
        title ? el('h2', { class: 'panel-title', text: title }) : null,
        ...paragraphs.map((text, i) =>
          el('p', { class: dropcap && i === 0 ? 'dropcap' : '', text: fill(text) })
        ),
        el('div', { class: 'panel-actions' }, [
          el('button', {
            class: 'menu-button',
            type: 'button',
            text: buttonLabel,
            onClick: () => { this.audio.pageTurn(); close(true); }
          })
        ])
      ])
    );
  }

  /**
   * The end-of-chapter ceremony: three chimes, a burst of light, and the
   * recovered page of the story.
   */
  async awardFragment(chapterId, { title, paragraphs }) {
    const isNew = this.save.addToSet('fragments', chapterId);
    const count = this.save.progress.fragments.length;
    this.audio.fragment();
    this.ui.setFragments(count, count - 1);
    if (this.scene?.celebrateFragment) this.scene.celebrateFragment();
    await wait(700);
    this.audio.threeChimes();
    await this.showStoryPage({
      title,
      paragraphs,
      buttonLabel: count < 3 ? 'Keep the fragment' : 'Take the final fragment'
    });
    return isNew;
  }

  /* ------------------------------------------------------------------ menu */

  openMenu() {
    if (this.ui.panelOpen) return;
    this.paused = true;
    this.input.releaseAll();
    this.audio.uiTap();

    const chapterName = CHAPTER_TITLES[this.save.progress.chapter] || 'your story';

    this.ui.openPanel((close) => {
      const soundButton = el('button', {
        class: 'menu-button',
        type: 'button',
        'aria-pressed': String(this.settings.sound)
      }, [el('span', { text: 'Sound' }), el('span', { class: 'state', text: this.settings.sound ? 'On' : 'Off' })]);
      soundButton.addEventListener('click', () => {
        this.settings.sound = !this.settings.sound;
        this.save.saveSettings();
        this.audio.applySettings();
        this.audio.uiTap();
        soundButton.lastChild.textContent = this.settings.sound ? 'On' : 'Off';
        soundButton.setAttribute('aria-pressed', String(this.settings.sound));
      });

      const musicButton = el('button', {
        class: 'menu-button',
        type: 'button',
        'aria-pressed': String(this.settings.music)
      }, [el('span', { text: 'Music' }), el('span', { class: 'state', text: this.settings.music ? 'On' : 'Off' })]);
      musicButton.addEventListener('click', () => {
        this.settings.music = !this.settings.music;
        this.save.saveSettings();
        this.audio.applySettings();
        this.audio.uiTap();
        musicButton.lastChild.textContent = this.settings.music ? 'On' : 'Off';
        musicButton.setAttribute('aria-pressed', String(this.settings.music));
      });

      const motionButton = el('button', {
        class: 'menu-button',
        type: 'button',
        'aria-pressed': String(this.settings.reducedMotion)
      }, [el('span', { text: 'Reduced motion' }), el('span', { class: 'state', text: this.settings.reducedMotion ? 'On' : 'Off' })]);
      motionButton.addEventListener('click', () => {
        this.settings.reducedMotion = !this.settings.reducedMotion;
        this.settings.motionChosen = true;
        this.save.saveSettings();
        document.documentElement.dataset.reducedMotion = String(this.settings.reducedMotion);
        this.audio.uiTap();
        motionButton.lastChild.textContent = this.settings.reducedMotion ? 'On' : 'Off';
        motionButton.setAttribute('aria-pressed', String(this.settings.reducedMotion));
      });

      const textButton = el('button', {
        class: 'menu-button',
        type: 'button'
      }, [el('span', { text: 'Text speed' }), el('span', { class: 'state', text: this.settings.textSpeed === 'instant' ? 'Instant' : 'Normal' })]);
      textButton.addEventListener('click', () => {
        this.settings.textSpeed = this.settings.textSpeed === 'instant' ? 'normal' : 'instant';
        this.save.saveSettings();
        this.audio.uiTap();
        textButton.lastChild.textContent = this.settings.textSpeed === 'instant' ? 'Instant' : 'Normal';
      });

      return el('div', { class: 'panel', role: 'dialog', 'aria-label': 'Game menu' }, [
        el('h2', { class: 'panel-title', text: 'A moment to rest' }),
        el('p', { class: 'panel-subtitle', text: `Currently in ${chapterName}` }),
        el('div', { class: 'panel-actions' }, [
          el('button', {
            class: 'menu-button',
            type: 'button',
            text: 'Return to the story',
            onClick: () => { this.audio.uiTap(); close('resume'); }
          }),
          soundButton,
          musicButton,
          motionButton,
          textButton,
          el('button', {
            class: 'menu-button quiet',
            type: 'button',
            text: 'How to play',
            onClick: async () => { await this.showHowToPlay(); }
          }),
          el('button', {
            class: 'menu-button quiet',
            type: 'button',
            text: 'Restart this chapter',
            onClick: async () => {
              const ok = await this.#confirm('Restart this chapter?', 'Your recovered fragments from other chapters stay safe.');
              if (ok) close('restart');
            }
          }),
          el('button', {
            class: 'menu-button quiet danger',
            type: 'button',
            text: 'Erase all progress',
            onClick: async () => {
              const ok = await this.#confirm('Erase everything?', 'The whole story starts again from the first page. This cannot be undone.');
              if (ok) close('reset');
            }
          })
        ])
      ]);
    }, { dismissable: true }).then(async (result) => {
      this.paused = false;
      this.#checkOrientation();
      if (result === 'restart') {
        const chapter = this.save.progress.chapter;
        this.save.restartChapter(chapter);
        this.ui.setFragments(this.save.progress.fragments.length);
        await this.goTo(chapter, { restarted: true });
      } else if (result === 'reset') {
        this.save.resetProgress();
        this.ui.setFragments(0);
        await this.goTo('title', {});
      }
    });
  }

  /** Yes/no question, stacked on top of whatever panel asked it. */
  #confirm(title, body) {
    return this.ui.openPanel((close) =>
      el('div', { class: 'panel', role: 'alertdialog', 'aria-label': title }, [
        el('h2', { class: 'panel-title', text: title }),
        el('p', { class: 'panel-subtitle', text: body }),
        el('div', { class: 'panel-actions row' }, [
          el('button', { class: 'menu-button', type: 'button', text: 'Not yet', onClick: () => { this.audio.uiTap(); close(false); } }),
          el('button', { class: 'menu-button danger', type: 'button', text: 'Yes, do it', onClick: () => { this.audio.uiTap(); close(true); } })
        ])
      ])
    , { dismissable: true }).then((value) => Boolean(value));
  }

  showHowToPlay() {
    return this.ui.openPanel((close) =>
      el('div', { class: 'panel', role: 'dialog', 'aria-label': 'How to play' }, [
        el('h2', { class: 'panel-title', text: 'How to play' }),
        el('div', { class: 'panel-prose' }, [
          el('p', { text: 'Move with the arrow keys or W A S D. On a phone, hold anywhere on the left half of the screen and drag — a soft circle appears under your thumb.' }),
          el('p', { text: 'When a small star appears above something, you can talk to it, read it, or pick it up. Press the round button at the bottom right, or press Space or Enter.' }),
          el('p', { text: 'Tap the dialogue box to hurry a line along, then again to continue.' }),
          el('p', { text: `The lamp button in the top right asks ${config.guideName} for a hint. Ask more than once and he becomes far less mysterious about it.` }),
          el('p', { text: 'Your progress saves by itself. You can close the page and return whenever you like.' })
        ]),
        el('div', { class: 'panel-actions' }, [
          el('button', { class: 'menu-button', type: 'button', text: 'Back', onClick: () => { this.audio.uiTap(); close(null); } })
        ])
      ])
    , { dismissable: true });
  }

  /** Moves the story forward to the next chapter and records it. */
  async advanceTo(chapter) {
    this.save.setChapter(chapter);
    await this.goTo(chapter, {});
  }
}

export const CHAPTER_TITLES = {
  woods: 'The Whispering Woods',
  cottage: 'The Enchanted Cottage',
  hall: 'The Monochrome Hall',
  garden: 'The Garden Beyond the Stars'
};
