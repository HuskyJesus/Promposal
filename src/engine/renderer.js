/**
 * Canvas plumbing: device-pixel-ratio handling, a camera that keeps a constant
 * amount of world visible whatever the phone's shape, and the layered draw
 * helpers scenes use (painted background buffer + live foreground).
 */

const MIN_VIEW_HEIGHT = 360;
const MAX_VIEW_HEIGHT = 620;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.width = 0;   // CSS pixels
    this.height = 0;  // CSS pixels
    this.camera = { x: 0, y: 0, viewHeight: 360 };
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    // Cap the ratio: a 3x phone display gains nothing visible but costs a lot.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.width = cssWidth;
    this.height = cssHeight;
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);

    // Portrait phones get a taller slice of the world so the character and the
    // scenery around her still both fit on screen.
    const aspect = cssWidth / cssHeight;
    const target = aspect < 1 ? 600 - aspect * 60 : 520 - (aspect - 1) * 45;
    this.camera.viewHeight = Math.max(MIN_VIEW_HEIGHT, Math.min(MAX_VIEW_HEIGHT, target));
  }

  get scale() {
    return this.height / this.camera.viewHeight;
  }

  get viewWidth() {
    return this.width / this.scale;
  }

  get viewHeight() {
    return this.camera.viewHeight;
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
    ctx.setTransform(s, 0, 0, s, -this.camera.x * s + (this.width * this.dpr) / 2, -this.camera.y * s + (this.height * this.dpr) / 2);
  }

  /** Switch to screen coordinates measured in CSS pixels. */
  beginScreen() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
    this.followCamera(x, y, world, 1);
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
