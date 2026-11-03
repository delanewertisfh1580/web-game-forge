/**
 * Sprites module — helpers for loading and creating sprites.
 */
import * as PIXI from 'pixi.js';

/**
 * Load a sprite sheet or texture for 2D renderer.
 * @param {import('./renderer2d.js').Renderer2D} renderer
 * @param {string} url
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function loadSpriteSheet2D(renderer, url, config = {}) {
  return renderer.loadSpriteSheet(url, config);
}

/**
 * Create a simple colored rectangle sprite (for prototyping without assets).
 */
export function createRectSprite2D(renderer, options = {}) {
  const gfx = new PIXI.Graphics();
  const w = options.width ?? 50;
  const h = options.height ?? 50;
  const color = options.color ?? 0x44aaff;

  gfx.rect(0, 0, w, h);
  gfx.fill(color);

  gfx.x = options.x ?? 0;
  gfx.y = options.y ?? 0;

  renderer.app.stage.addChild(gfx);
  return gfx;
}

/**
 * Create a simple circle sprite (for prototyping).
 */
export function createCircleSprite2D(renderer, options = {}) {
  const gfx = new PIXI.Graphics();
  const radius = options.radius ?? 25;
  const color = options.color ?? 0x44aaff;

  gfx.circle(0, 0, radius);
  gfx.fill(color);

  gfx.x = options.x ?? 0;
  gfx.y = options.y ?? 0;

  renderer.app.stage.addChild(gfx);
  return gfx;
}
