/**
 * The title screen: a slow moonlit treeline with fireflies, the game's name,
 * and the way into the story. The prom question is never mentioned here.
 */

import { config } from '../config.js';
import { el } from '../engine/ui.js';
import { createBuffer } from '../engine/renderer.js';
import { AmbientDrift } from '../engine/particles.js';
import {
  paintNightSky, drawMoon, drawPersonalStar, drawTree, drawVignette,
  drawLampPost, makeRandom, drawThreeStars, rgba
} from '../engine/art.js';
import { PROLOGUE_PAGES } from '../data/dialogue.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.showsHud = false;
    this.time = 0;
    this.width = 1200;
    this.height = 700;
  }

  async enter() {
    this.game.audio.setMood('title');
    this.background = this.#paintBackdrop();
    this.fireflies = new AmbientDrift({
      count: 34,
      bounds: { x: 0, y: this.height * 0.45, width: this.width, height: this.height * 0.55 },
      style: 'firefly'
    });
    this.fireflies.palette = { core: '#ffe4a0' };
    // Not awaited: the menu lives alongside the animation instead of blocking it.
    this.#showMenu();
  }

  #paintBackdrop() {
    const { width, height } = this;
    return createBuffer(width, height, (ctx) => {
      paintNightSky(ctx, width, height, { top: '#100d22', bottom: '#2b2647', starCount: 130, seed: 5 });

      // Distant hills.
      ctx.fillStyle = '#191634';
      ctx.beginPath();
      ctx.moveTo(0, height * 0.62);
      ctx.quadraticCurveTo(width * 0.3, height * 0.5, width * 0.6, height * 0.62);
      ctx.quadraticCurveTo(width * 0.85, height * 0.72, width, height * 0.6);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Ground.
      ctx.fillStyle = '#15251f';
      ctx.fillRect(0, height * 0.78, width, height * 0.22);

      const random = makeRandom(17);
      const far = { bark: '#1d1a30', leaf: '#20304a', leafDark: '#182338', rim: '#8fa8d8' };
      for (let i = 0; i < 14; i++) {
        drawTree(ctx, random() * width, height * (0.68 + random() * 0.06), 0.7 + random() * 0.3, far, 100 + i);
      }
      const near = { bark: '#241b26', leaf: '#1f3a34', leafDark: '#16292a', rim: '#a8c2e8' };
      for (let i = 0; i < 8; i++) {
        drawTree(ctx, random() * width, height * (0.86 + random() * 0.12), 1.1 + random() * 0.5, near, 200 + i);
      }

      // A path leading out of frame, hinting the journey.
      ctx.fillStyle = rgba('#6a5c46', 0.35);
      ctx.beginPath();
      ctx.moveTo(width * 0.42, height);
      ctx.quadraticCurveTo(width * 0.5, height * 0.86, width * 0.56, height * 0.78);
      ctx.lineTo(width * 0.64, height * 0.78);
      ctx.quadraticCurveTo(width * 0.62, height * 0.88, width * 0.66, height);
      ctx.closePath();
      ctx.fill();
    });
  }

  #showMenu() {
    const game = this.game;
    const hasSave = game.save.hasProgress();

    game.ui.openPanel((close) => {
      const soundButton = el('button', {
        class: 'menu-button quiet',
        type: 'button',
        'aria-pressed': String(game.settings.sound)
      }, [
        el('span', { text: 'Sound' }),
        el('span', { class: 'state', text: game.settings.sound ? 'On' : 'Off' })
      ]);
      soundButton.addEventListener('click', () => {
        game.audio.unlock();
        game.settings.sound = !game.settings.sound;
        game.save.saveSettings();
        game.audio.applySettings();
        game.audio.uiTap();
        soundButton.lastChild.textContent = game.settings.sound ? 'On' : 'Off';
        soundButton.setAttribute('aria-pressed', String(game.settings.sound));
      });

      const actions = [];
      if (hasSave) {
        actions.push(el('button', {
          class: 'menu-button', type: 'button', text: 'Continue',
          onClick: () => { game.audio.unlock(); game.audio.uiTap(); close('continue'); }
        }));
      }
      actions.push(el('button', {
        class: 'menu-button', type: 'button', text: hasSave ? 'Begin again' : 'Start the story',
        onClick: () => { game.audio.unlock(); game.audio.uiTap(); close('start'); }
      }));
      actions.push(el('button', {
        class: 'menu-button quiet', type: 'button', text: 'How to play',
        onClick: () => { game.audio.unlock(); game.showHowToPlay(); }
      }));
      actions.push(soundButton);
      if (hasSave) {
        actions.push(el('button', {
          class: 'menu-button quiet danger', type: 'button', text: 'Erase saved progress',
          onClick: () => { game.audio.uiTap(); close('reset'); }
        }));
      }

      return el('div', { class: 'panel title-panel', role: 'dialog', 'aria-label': `${config.gameTitle} — main menu` }, [
        titleMark(),
        el('h1', { class: 'game-title', text: config.gameTitle }),
        el('p', { class: 'game-subtitle', text: config.gameSubtitle }),
        el('div', { class: 'panel-actions' }, actions),
        el('p', { class: 'title-footer', text: 'Best with sound. Works perfectly without it.' })
      ]);
    }, { clear: true }).then((action) => this.#handle(action));
  }

  async #handle(action) {
    const game = this.game;
    if (action === 'reset') {
      game.save.resetProgress();
      game.ui.setFragments(0);
      this.#showMenu();
      return;
    }

    if (action === 'continue') {
      game.ui.setFragments(game.save.progress.fragments.length);
      const chapter = game.save.progress.chapter || 'woods';
      await game.goTo(chapter, { continued: true });
      return;
    }

    // A fresh story: wipe the old one, then read the opening pages.
    game.save.beginNewStory();
    game.ui.setFragments(0);
    for (const page of PROLOGUE_PAGES) {
      await game.showStoryPage(page);
    }
    await game.goTo('woods', { fresh: true });
  }

  update(dt) {
    this.time += dt;
    this.fireflies.update(dt, this.time);
  }

  draw(renderer) {
    const ctx = renderer.ctx;
    renderer.clear('#100d22');
    renderer.beginScreen();

    // Cover the viewport with the backdrop, keeping its aspect ratio.
    const scale = Math.max(renderer.width / this.width, renderer.height / this.height);
    const w = this.width * scale;
    const h = this.height * scale;
    const ox = (renderer.width - w) / 2;
    const oy = (renderer.height - h) / 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.drawImage(this.background, 0, 0);

    drawMoon(ctx, this.width * 0.18, this.height * 0.2, 34, this.time);
    drawPersonalStar(ctx, this.width * 0.78, this.height * 0.24, this.time, 1.1);
    drawThreeStars(ctx, this.width * 0.5, this.height * 0.12, 0.9, '#dde5f2', [true, true, true], this.time);
    drawLampPost(ctx, this.width * 0.14, this.height * 0.95, 1.3, true, this.time);
    drawLampPost(ctx, this.width * 0.88, this.height * 0.99, 1.5, true, this.time + 1.4);

    this.fireflies.draw(ctx, this.time, this.fireflies.palette);
    ctx.restore();

    drawVignette(ctx, renderer.width, renderer.height, 0.62);
  }
}

/** The little emblem above the title: an open book under three stars. */
function titleMark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 96');
  svg.setAttribute('class', 'title-mark');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <g fill="none" stroke="var(--c-gold)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M100 44c-14-10-30-12-46-9v40c16-3 32-1 46 9 14-10 30-12 46-9V35c-16-3-32-1-46 9Z"/>
      <path d="M100 44v40"/>
      <path d="M28 30c8 6 14 14 18 24M172 30c-8 6-14 14-18 24" opacity="0.5"/>
    </g>
    <g fill="var(--c-silver)">
      <path d="M100 4 104 16 116 20 104 24 100 36 96 24 84 20 96 16Z"/>
      <path d="M62 14 65 22 73 25 65 28 62 36 59 28 51 25 59 22Z" opacity="0.85"/>
      <path d="M138 14 141 22 149 25 141 28 138 36 135 28 127 25 135 22Z" opacity="0.85"/>
    </g>`;
  return svg;
}
