/**
 * Game loop with fixed timestep and accumulator.
 * Supports multiple update hooks.
 */
export class GameLoop {
  constructor(options = {}) {
    this.fixedDt = options.fixedDt ?? (1 / 60); // 60 Hz fixed step
    this.maxAccumulator = options.maxAccumulator ?? 0.25; // prevent spiral of death
    this._hooks = [];
    this._running = false;
    this._rafId = null;
    this._lastTime = 0;
    this._accumulator = 0;
  }

  addHook(fn) {
    if (typeof fn === 'function') {
      this._hooks.push(fn);
    }
  }

  removeHook(fn) {
    this._hooks = this._hooks.filter(h => h !== fn);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._tick();
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  destroy() {
    this.stop();
    this._hooks = [];
  }

  _tick() {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((now) => {
      const elapsed = (now - this._lastTime) / 1000;
      this._lastTime = now;
      this._accumulator += Math.min(elapsed, this.maxAccumulator);

      while (this._accumulator >= this.fixedDt) {
        for (const hook of this._hooks) {
          hook(this.fixedDt);
        }
        this._accumulator -= this.fixedDt;
      }

      this._tick();
    });
  }
}
