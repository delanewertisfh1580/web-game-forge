/**
 * debug.js — debug overlay (toggle with ~ key, pause with P).
 * @module debug
 */

/**
 * Create a debug overlay.
 * @param {object} game - real game instance (with pause/resume methods)
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
  let lastTime = performance.now();
  let _rafId = null;
  let _destroyed = false;

  const stats = {
    entities: 0,
    particles: 0,
    tweens: 0,
    pools: 0,
  };

  function toggle() {
    visible = !visible;
    panel.style.display = visible ? 'block' : 'none';
    if (visible) renderPanel();
  }

  function togglePause() {
    if (!game) return;
    if (game.isPaused) {
      game.resume();
    } else {
      game.pause();
    }
  }

  function renderPanel() {
    if (!visible || _destroyed) return;

    // Gather stats
    if (game?.tweens) stats.tweens = game.tweens.count;
    if (game?.ctx?.renderer?.particleContainers) {
      stats.particles = 0;
      for (const [, data] of game.ctx.renderer.particleContainers) {
        stats.particles += data.particles.length;
      }
    }
    if (game?.ctx?.renderer?.particleSystems) {
      stats.particles = 0;
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
      <div>Mode: ${game?.config?.mode ?? '?'}</div>
      <div>Scene: ${game?.scenes?.current ?? 'none'}</div>
      <div>Paused: ${game?.isPaused ?? false}</div>
      <div>Emitters: ${game?.emitterCount ?? 0}</div>
      <hr style="border-color:#333;margin:6px 0">
      <div style="font-size:11px;opacity:.6">~ toggle | P pause/resume</div>
    `;
  }

  // Independent RAF loop so debug works even when game is paused (fix #9)
  function tick() {
    if (_destroyed) return;
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    frameCount++;
    fpsAccum += dt;
    frameTime = dt * 1000;
    if (fpsAccum >= 0.5) {
      fps = Math.round(frameCount / fpsAccum);
      frameCount = 0;
      fpsAccum = 0;
    }

    if (visible) renderPanel();
    _rafId = requestAnimationFrame(tick);
  }
  _rafId = requestAnimationFrame(tick);

  // Listen for ~ (Backquote) and P
  const keyHandler = (e) => {
    if (e.code === 'Backquote' || e.key === '`' || e.key === '~') {
      toggle();
    } else if (e.code === 'KeyP' && visible) {
      togglePause();
    }
  };
  window.addEventListener('keydown', keyHandler);

  return {
    /** Update debug info (called from game loop, but also works via RAF) */
    update(dt) {
      // Frame timing is now handled by independent RAF
      // This method is kept for API compatibility
    },

    /** Set a custom stat */
    setStat(key, value) {
      stats[key] = value;
    },

    /** Toggle pause via debug */
    togglePause,

    /** Is paused via debug? */
    get isPaused() { return game?.isPaused ?? false; },

    /** Show/hide */
    setVisible(v) {
      visible = v;
      panel.style.display = v ? 'block' : 'none';
      if (v) renderPanel();
    },

    /** @returns {boolean} */
    get isVisible() { return visible; },

    destroy() {
      _destroyed = true;
      if (_rafId !== null) cancelAnimationFrame(_rafId);
      window.removeEventListener('keydown', keyHandler);
      panel.remove();
    },
  };
}
