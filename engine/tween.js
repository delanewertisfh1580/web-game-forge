/**
 * tween.js — lightweight tween engine.
 * @module tween
 */

/** Easing functions */
export const Easing = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: t => t * t * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: t => t * t * t * t,
  easeOutQuart: t => 1 - (--t) * t * t * t,
  easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  easeInElastic: t => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI),
  easeOutElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1,
  easeInBack: t => t * t * (2.70158 * t - 1.70158),
  easeOutBack: t => 1 + (--t) * t * (2.70158 * t + 1.70158),
  easeOutBounce: t => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
};

/**
 * Create a tween manager.
 * @returns {TweenManager}
 */
export function createTweenManager() {
  const tweens = [];

  function createTween(obj, target, options = {}) {
    const tween = {
      obj,
      target,
      start: {},
      duration: options.duration ?? 0.5,
      elapsed: 0,
      ease: typeof options.ease === 'string' ? (Easing[options.ease] || Easing.linear) : (options.ease || Easing.linear),
      yoyo: options.yoyo ?? false,
      repeat: options.repeat ?? 0,
      repeatCount: 0,
      delay: options.delay ?? 0,
      delayElapsed: 0,
      direction: 1, // 1 = forward, -1 = backward (yoyo)
      onUpdate: options.onUpdate ?? null,
      onComplete: options.onComplete ?? null,
      active: true,
      paused: false,
    };

    // Capture start values
    for (const key in target) {
      tween.start[key] = obj[key];
    }

    tweens.push(tween);
    return tween;
  }

  function updateTween(tween, dt) {
    if (!tween.active || tween.paused) return;

    // Handle delay
    if (tween.delayElapsed < tween.delay) {
      tween.delayElapsed += dt;
      return;
    }

    tween.elapsed += dt * tween.direction;
    let t = Math.min(Math.max(tween.elapsed / tween.duration, 0), 1);
    const easedT = tween.ease(t);

    // Interpolate
    for (const key in tween.target) {
      tween.obj[key] = tween.start[key] + (tween.target[key] - tween.start[key]) * easedT;
    }

    if (tween.onUpdate) tween.onUpdate(tween.obj, easedT);

    // Check completion
    if (t >= 1 || t <= 0) {
      if (tween.yoyo) {
        tween.direction *= -1;
        tween.elapsed = tween.direction === 1 ? 0 : tween.duration;
      } else if (tween.repeat > 0 || tween.repeat === Infinity) {
        tween.elapsed = 0;
        tween.repeatCount++;
        if (tween.repeat !== Infinity && tween.repeatCount >= tween.repeat) {
          tween.active = false;
          if (tween.onComplete) tween.onComplete(tween.obj);
        }
      } else {
        tween.active = false;
        if (tween.onComplete) tween.onComplete(tween.obj);
      }
    }
  }

  return {
    /**
     * Create a tween.
     * @param {object} obj - target object
     * @param {object} target - { x: 100, y: 50, ... }
     * @param {object} options - { duration, ease, yoyo, repeat, delay, onUpdate, onComplete }
     * @returns {object} tween handle
     */
    to(obj, target, options = {}) {
      return createTween(obj, target, options);
    },

    /** Kill a specific tween */
    kill(tween) {
      tween.active = false;
      const idx = tweens.indexOf(tween);
      if (idx >= 0) tweens.splice(idx, 1);
    },

    /** Kill all tweens */
    killAll() {
      for (const t of tweens) t.active = false;
      tweens.length = 0;
    },

    /** @returns {number} active tween count */
    get count() { return tweens.filter(t => t.active).length; },

    /** Update all tweens (called by game loop) */
    update(dt) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        updateTween(tweens[i], dt);
        if (!tweens[i].active) tweens.splice(i, 1);
      }
    },

    destroy() {
      this.killAll();
    },
  };
}
