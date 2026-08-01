/**
 * Input: keyboard (WASD + arrows), an on-screen thumb stick, and the
 * interaction button. All three feed the same movement vector so scenes never
 * need to know how the player is playing.
 */

const MOVE_KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0]
};

const CONFIRM_KEYS = new Set(['Space', 'Enter', 'KeyE', 'NumpadEnter']);

export class Input {
  constructor({ stickZone, stickBase, stickKnob, interactButton }) {
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.stickId = null;
    this.stickOrigin = { x: 0, y: 0 };
    this.confirmQueued = false;
    this.cancelQueued = false;
    this.enabled = true;
    /** Called with client coordinates when the world itself is tapped. */
    this.onStageTap = null;
    this.tapStart = null;

    this.stickZone = stickZone;
    this.stickBase = stickBase;
    this.stickKnob = stickKnob;
    this.interactButton = interactButton;

    this.#bindKeyboard();
    this.#bindStick();
    this.#bindInteract();
    this.#bindStageTap();
    this.#blockBrowserGestures();
  }

  #bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      const typingInField = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (typingInField) return;

      if (MOVE_KEYS[event.code]) {
        this.keys.add(event.code);
        event.preventDefault();
        return;
      }
      if (CONFIRM_KEYS.has(event.code)) {
        // Space/Enter on a focused button must stay a button press.
        const onButton = event.target instanceof HTMLElement && event.target.closest('button, a, [tabindex]');
        if (!onButton) {
          this.confirmQueued = true;
          event.preventDefault();
        }
      }
      if (event.code === 'Escape') {
        this.cancelQueued = true;
      }
    });

    window.addEventListener('keyup', (event) => {
      if (MOVE_KEYS[event.code]) this.keys.delete(event.code);
    });

    // Dropped keys when the tab loses focus would otherwise stick "on".
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  #bindStick() {
    const zone = this.stickZone;
    if (!zone) return;
    const radius = 58;

    const place = (clientX, clientY) => {
      const rect = zone.getBoundingClientRect();
      this.stickBase.style.left = `${clientX - rect.left}px`;
      this.stickBase.style.top = `${clientY - rect.top}px`;
    };

    zone.addEventListener('pointerdown', (event) => {
      if (!this.enabled || this.stickId !== null) return;
      this.stickId = event.pointerId;
      // Capture can be refused (a synthetic event, a pointer the browser has
      // already taken back); the stick must keep working either way.
      try { zone.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
      this.stickOrigin = { x: event.clientX, y: event.clientY };
      place(event.clientX, event.clientY);
      this.stickBase.dataset.active = 'true';
      this.stickKnob.style.transform = 'translate(0px, 0px)';
      event.preventDefault();
    });

    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.stickId) return;
      let dx = event.clientX - this.stickOrigin.x;
      let dy = event.clientY - this.stickOrigin.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }
      this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 8;
      if (dist < dead) {
        this.stick = { x: 0, y: 0 };
      } else {
        this.stick = { x: dx / radius, y: dy / radius };
      }
      event.preventDefault();
    });

    const end = (event) => {
      if (event.pointerId !== this.stickId) return;
      this.stickId = null;
      this.stick = { x: 0, y: 0 };
      this.stickBase.dataset.active = 'false';
      this.stickKnob.style.transform = 'translate(0px, 0px)';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    // A finger dragged off the element, or capture stolen by the browser,
    // must never leave her walking forever.
    zone.addEventListener('lostpointercapture', end);
    zone.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') end(event);
    });
  }

  /**
   * A short tap on the world (rather than a drag on the stick) is offered to
   * the scene, so tapping the thing in front of her also works. The action
   * button remains the reliable path — this never replaces it.
   */
  #bindStageTap() {
    const surface = document.getElementById('app');
    if (!surface) return;

    surface.addEventListener('pointerdown', (event) => {
      if (this.#onInterface(event.target)) {
        this.tapStart = null;
        return;
      }
      this.tapStart = { x: event.clientX, y: event.clientY, at: performance.now(), id: event.pointerId };
    });

    surface.addEventListener('pointerup', (event) => {
      const start = this.tapStart;
      this.tapStart = null;
      if (!start || start.id !== event.pointerId || !this.enabled) return;
      if (this.#onInterface(event.target)) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      const elapsed = performance.now() - start.at;
      if (moved < 14 && elapsed < 350) this.onStageTap?.(event.clientX, event.clientY);
    });

    surface.addEventListener('pointercancel', () => { this.tapStart = null; });
  }

  #onInterface(target) {
    return target instanceof HTMLElement
      && Boolean(target.closest('button, .overlay, .dialogue, .rotate-hint, .hud'));
  }

  #bindInteract() {
    if (!this.interactButton) return;
    this.interactButton.addEventListener('click', () => {
      this.confirmQueued = true;
    });
  }

  /** Keeps the browser from scrolling, zooming or selecting during play. */
  #blockBrowserGestures() {
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('#stage, .touch-controls')) e.preventDefault();
    });
    document.addEventListener('touchmove', (e) => {
      // Allow scrolling inside panels; block it everywhere else.
      const scrollable = e.target instanceof HTMLElement && e.target.closest('.panel, .overlay, .story-page');
      if (!scrollable && e.cancelable) e.preventDefault();
    }, { passive: false });

    // Double-tap zoom guard that still lets buttons receive their click.
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 320 && e.cancelable) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
  }

  releaseAll() {
    this.keys.clear();
    this.stick = { x: 0, y: 0 };
    this.stickId = null;
    if (this.stickBase) this.stickBase.dataset.active = 'false';
  }

  /** Normalised movement vector, -1..1 on each axis. */
  axis() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = this.stick.x;
    let y = this.stick.y;
    for (const code of this.keys) {
      const [kx, ky] = MOVE_KEYS[code];
      x += kx;
      y += ky;
    }
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    return { x, y };
  }

  /** True once per press. */
  takeConfirm() {
    if (!this.confirmQueued) return false;
    this.confirmQueued = false;
    return true;
  }

  takeCancel() {
    if (!this.cancelQueued) return false;
    this.cancelQueued = false;
    return true;
  }
}
