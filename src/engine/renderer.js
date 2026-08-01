/**
 * Canvas plumbing: device-pixel-ratio handling, a camera that keeps a constant
 * amount of world visible whatever the phone's shape, and the layered draw
 * helpers scenes use (painted background buffer + live foreground).
 */

const MIN_VIEW_HEIGHT = 320;
const MAX_VIEW_HEIGHT = 580;

/**
 * Retina phones gain nothing visible above 2x for artwork this soft, and the
 * fill rate costs a lot. Weaker devices drop further still.
 */
function targetPixelRatio() {
  const raw = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const modest = cores <= 4 || memory <= 3;
  return Math.min(raw, modest ? 1.5 : 2);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.width = 0;   // CSS pixels
    this.height = 0;  // CSS pixels
    this.camera = { x: 0, y: 0, viewHeight: 460, zoom: 1 };
    /** Short zoom-in used to emphasise a discovery. */
    this.emphasis = 0;
    this.quality = 1;
    this.resize();
  }

  /**
   * Matches the drawing buffer to the element's real size. Called on resize,
   * rotation and whenever the mobile browser's toolbars change the viewport.
   * Camera state is untouched, so nothing jumps when the bars slide away.
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width || window.innerWidth));
    const cssHeight = Math.max(1, Math.round(rect.height || window.innerHeight));
    this.dpr = targetPixelRatio();

    const bufferWidth = Math.round(cssWidth * this.dpr);
    const bufferHeight = Math.round(cssHeight * this.dpr);
    this.width = cssWidth;
    this.height = cssHeight;
    // Assigning width/height clears the canvas, so only do it when it changed.
    if (this.canvas.width !== bufferWidth || this.canvas.height !== bufferHeight) {
      this.canvas.width = bufferWidth;
      this.canvas.height = bufferHeight;
    }

    // Portrait phones get a taller slice of the world so the heroine and the
    // scenery around her both stay on screen.
    const aspect = cssWidth / cssHeight;
    const target = aspect < 1 ? 560 - aspect * 50 : 470 - (aspect - 1) * 40;
    this.camera.viewHeight = Math.max(MIN_VIEW_HEIGHT, Math.min(MAX_VIEW_HEIGHT, target));
  }

  get scale() {
    return (this.height / this.camera.viewHeight) * this.camera.zoom;
  }

  get viewWidth() {
    return this.width / this.scale;
  }

  get viewHeight() {
    return this.height / this.scale;
  }

  /** Clears the frame to a flat colour. */
  clear(color = '#000') {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Switch to world coordinates, following the camera. */
  beginWorld() {
    const { ctx } = this;
    const s = this.scale * this.dpr;
    ctx.setTransform(
      s, 0, 0, s,
      -this.camera.x * s + (this.width * this.dpr) / 2,
      -this.camera.y * s + (this.height * this.dpr) / 2
    );
  }

  /** Switch to screen coordinates measured in CSS pixels. */
  beginScreen() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /** Visible world rectangle, used to skip drawing anything off screen. */
  viewBounds(padding = 0) {
    const halfW = this.viewWidth / 2 + padding;
    const halfH = this.viewHeight / 2 + padding;
    return {
      left: this.camera.x - halfW,
      right: this.camera.x + halfW,
      top: this.camera.y - halfH,
      bottom: this.camera.y + halfH
    };
  }

  /** Converts a screen point (CSS pixels) into world coordinates. */
  screenToWorld(screenX, screenY) {
    const s = this.scale;
    return {
      x: this.camera.x + (screenX - this.width / 2) / s,
      y: this.camera.y + (screenY - this.height / 2) / s
    };
  }

  /** Keeps the camera inside the world, centring it when the world is small. */
  followCamera(targetX, targetY, world, lerp = 1) {
    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;
    let x = targetX;
    let y = targetY;
    if (world) {
      x = world.width <= this.viewWidth ? world.width / 2 : Math.max(halfW, Math.min(world.width - halfW, x));
      y = world.height <= this.viewHeight ? world.height / 2 : Math.max(halfH, Math.min(world.height - halfH, y));
    }
    this.camera.x += (x - this.camera.x) * lerp;
    this.camera.y += (y - this.camera.y) * lerp;
  }

  snapCamera(x, y, world) {
    this.camera.zoom = 1;
    this.emphasis = 0;
    this.followCamera(x, y, world, 1);
  }

  /** A brief push-in on a discovery. Ignored when motion is reduced. */
  emphasise(amount = 0.06) {
    this.emphasis = Math.max(this.emphasis, amount);
  }

  updateCamera(dt, reducedMotion) {
    if (reducedMotion) {
      this.emphasis = 0;
      this.camera.zoom = 1;
      return;
    }
    if (this.emphasis > 0.001) {
      this.emphasis = Math.max(0, this.emphasis - dt * 0.12);
    } else {
      this.emphasis = 0;
    }
    const target = 1 + this.emphasis;
    this.camera.zoom += (target - this.camera.zoom) * Math.min(1, dt * 6);
  }
}

/**
 * An offscreen canvas that a scene paints its static artwork into exactly once.
 * Re-drawing hundreds of trees every frame is what makes canvas games stutter
 * on phones; painting them once and blitting the result does not.
 */
export function createBuffer(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  paint(ctx, canvas.width, canvas.height);
  return canvas;
}
