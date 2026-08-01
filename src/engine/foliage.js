/**
 * Woodland composition.
 *
 * Two jobs: caching a small set of tree sprites so a forest costs almost
 * nothing to draw, and placing them so a scene reads as a *place* — a wall of
 * trees around the edge, a few stands inside, and clearings that make it
 * obvious where the player can walk.
 */

import { drawTree, makeSprite, makeRandom } from './art.js';

/** Drawing box and ground anchor for each silhouette, in units of `scale`. */
const SPECIES_BOX = {
  oak: { width: 130, height: 130, anchorX: 65, anchorY: 116, radius: 15 },
  pine: { width: 96, height: 176, anchorX: 48, anchorY: 162, radius: 12 },
  birch: { width: 92, height: 122, anchorX: 46, anchorY: 108, radius: 10 },
  willow: { width: 116, height: 116, anchorX: 58, anchorY: 100, radius: 14 },
  shrub: { width: 72, height: 52, anchorX: 36, anchorY: 42, radius: 11 }
};

/** How often each silhouette appears; oaks carry the wood, the rest season it. */
const SPECIES_MIX = ['oak', 'oak', 'oak', 'pine', 'pine', 'birch', 'birch', 'willow', 'shrub', 'shrub'];

/**
 * Pre-renders a spread of trees — several sizes of each silhouette, each with
 * its own colour drift — so scenes can blit them instead of redrawing paths.
 */
export function buildTreeSprites(palette, seed = 1) {
  const random = makeRandom(seed);
  const sprites = [];
  SPECIES_MIX.forEach((species, index) => {
    const box = SPECIES_BOX[species];
    const scale = species === 'shrub'
      ? 0.85 + random() * 0.45
      : 0.9 + random() * 0.55;
    sprites.push({
      species,
      scale,
      radius: box.radius * scale,
      sprite: makeSprite({
        width: box.width * scale,
        height: box.height * scale,
        anchorX: box.anchorX * scale,
        anchorY: box.anchorY * scale,
        paint: (ctx) => drawTree(ctx, 0, 0, scale, palette, 900 + index * 37, species)
      })
    });
  });
  return sprites;
}

function tooClose(placed, x, y, spacing) {
  for (const t of placed) {
    if (Math.hypot(t.x - x, t.y - y) < spacing) return true;
  }
  return false;
}

function inClearing(clearings, x, y) {
  for (const c of clearings) {
    if (Math.hypot(c.x - x, c.y - y) < c.r) return true;
  }
  return false;
}

/**
 * Places trees in three passes.
 *
 * 1. A border thicket that closes the scene in and hides the map edges.
 * 2. Named interior stands, so the wood has structure instead of noise.
 * 3. A light scatter of shrubs to soften whatever gaps remain.
 *
 * Nothing is ever placed inside a clearing, which is what keeps the paths and
 * the places the player must reach legible.
 */
export function scatterWoodland({
  seed = 1, sprites, bounds, clearings = [], border, stands = [], minSpacing = 76, fill = 0
}) {
  const random = makeRandom(seed);
  const placed = [];

  const pick = (preferShrub = false) => {
    const pool = preferShrub
      ? sprites.filter((s) => s.species === 'shrub')
      : sprites.filter((s) => s.species !== 'shrub');
    return pool[Math.floor(random() * pool.length)] || sprites[0];
  };

  const tryPlace = (x, y, entry) => {
    if (x < bounds.x || x > bounds.x + bounds.width) return false;
    if (y < bounds.y || y > bounds.y + bounds.height) return false;
    if (inClearing(clearings, x, y)) return false;
    if (tooClose(placed, x, y, minSpacing)) return false;
    placed.push({ x, y, species: entry.species, radius: entry.radius, sprite: entry.sprite });
    return true;
  };

  // 1. Border thicket, walked around the rectangle rather than scattered, so
  //    the edge reads as a continuous wall of trees.
  if (border) {
    const { thickness, count } = border;
    for (let i = 0; i < count * 6 && placed.length < count; i++) {
      const side = random();
      const depth = random() * thickness;
      let x;
      let y;
      if (side < 0.34) {
        x = bounds.x + random() * bounds.width;
        y = bounds.y + depth;
      } else if (side < 0.68) {
        x = bounds.x + random() * bounds.width;
        y = bounds.y + bounds.height - depth;
      } else if (side < 0.84) {
        x = bounds.x + depth;
        y = bounds.y + random() * bounds.height;
      } else {
        x = bounds.x + bounds.width - depth;
        y = bounds.y + random() * bounds.height;
      }
      tryPlace(x, y, pick());
    }
  }

  // 2. Interior stands.
  for (const stand of stands) {
    for (let i = 0; i < stand.count * 5; i++) {
      if (placed.filter((t) => Math.hypot(t.x - stand.x, t.y - stand.y) < stand.spread * 1.6).length >= stand.count) break;
      const angle = random() * Math.PI * 2;
      const dist = random() * stand.spread;
      tryPlace(stand.x + Math.cos(angle) * dist, stand.y + Math.sin(angle) * dist * 0.7, pick());
    }
  }

  // 3. A few shrubs to break up whatever is left.
  for (let i = 0; i < fill * 8 && placed.filter((t) => t.species === 'shrub').length < fill; i++) {
    tryPlace(
      bounds.x + random() * bounds.width,
      bounds.y + random() * bounds.height,
      pick(true)
    );
  }

  return placed;
}
