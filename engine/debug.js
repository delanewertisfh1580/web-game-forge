/**
 * debug.js — debug overlay (toggle with ~ key).
 * @module debug
 */

/**
 * Create a debug overlay.
 * @param {object} game - game instance
 * @returns {DebugOverlay}
 */
export function createDebugOverlay(game) {
  const panel = document.createElement('div');
  panel.id = '__debug-overlay';
  panel.style.cssText = 'position:fixed;top:8px;right:8px;background:rgba(0,0,0,.85);color:#0f0;font:12px/1.5 monospace;padding:10px 14px;border-radius:6px;z-index:10000;display:none;min-width:200px;pointer-events:auto;';
  document.body.appendChild(panel);

  let visible = false;
  let frameCount = 0;
  let fpsAccum = 0;
  let fps = 0;
  let frameTime = 0;
  let paused = false;

  const stats = {
    entities: 0,
    particles: 0,
    tweens: 0,
    pools: 0,
  };

  function toggle() {
    visible = !visible;
    panel.style.display = visible ? 'block' : 'none';
  }

  // Listen for ~ (Backquote)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote' || e.key === '`' || e.key === '~') {
      toggle();
    }
  });

  return {
    /** Update debug info (call each frame) */
    update(dt) {
      frameCount++;
      fpsAccum += dt;
      frameTime = dt * 1000;
      if (fpsAccum >= 0.5) {
        fps = Math.round(frameCount / fpsAccum);
        frameCount = 0;
        fpsAccum = 0;
      }

      if (visible) {
        // Gather stats
        if (game.tweens) stats.tweens = game.tweens.count;
        if (game.ctx.renderer && game.ctx.renderer.particleContainers) {
          stats.particles = 0;
          for (const [, data] of game.ctx.renderer.particleContainers) {
            stats.particles += data.particles.length;
          }
        }
        if (game.ctx.renderer && game.ctx.renderer.particleSystems) {
          for (const [, sys] of game.ctx.renderer.particleSystems) {
            stats.particles += sys.lifetimes.filter(l => l > 0).length;
          }
        }

        panel.innerHTML = `
          <div style="color:#ff0;font-weight:bold;margin-bottom:4px">⚙ DEBUG</div>
          <div>FPS: ${fps}</div>
          <div>Frame: ${frameTime.toFixed(1)}ms</div>
          <div>Particles: ${stats.particles}</div>
          <div>Tweens: ${stats.tweens}</div>
          <div>Mode: ${game.config.mode}</div>
          <div>Scene: ${game.scenes?.current ?? 'none'}</div>
          <div>Paused: ${paused}</div>
          <hr style="border-color:#333;margin:6px 0">
          <div style="font-size:11px;opacity:.6">~ toggle | P pause</div>
        `;
      }
    },

    /** Set a custom stat */
    setStat(key, value) {
      stats[key] = value;
    },

    /** Toggle pause */
    togglePause() {
      paused = !paused;
      if (paused) game.pause?.();
      else game.resume?.();
      return paused;
    },

    /** Is paused via debug? */
    get isPaused() { return paused; },

    /** Show/hide */
    setVisible(v) {
      visible = v;
      panel.style.display = v ? 'block' : 'none';
    },

    /** @returns {boolean} */
    get isVisible() { return visible; },

    destroy() {
      panel.remove();
    },
  };
}
