/**
 * animation.js — sprite animation + state machine.
 * @module animation
 */

/**
 * Create an animator for a sprite/container.
 * @param {object} sprite - PixiJS Sprite or Container
 * @returns {Animator}
 */
export function createAnimator(sprite) {
  const animations = new Map();
  let current = null;
  let currentName = null;
  let frameIndex = 0;
  let elapsed = 0;
  let paused = false;

  return {
    /**
     * Add an animation.
     * @param {string} name
     * @param {object} config
     * @param {Array} config.frames - array of textures or frame data
     * @param {number} [config.fps=12]
     * @param {boolean} [config.loop=true]
     * @param {function} [config.onEnd] - called when non-looping animation ends
     */
    add(name, config) {
      animations.set(name, {
        frames: config.frames,
        fps: config.fps ?? 12,
        loop: config.loop !== false,
        onEnd: config.onEnd ?? null,
      });
    },

    /**
     * Play an animation.
     * @param {string} name
     * @param {boolean} [force=false] - restart even if already playing
     */
    play(name, force = false) {
      if (!animations.has(name)) {
        console.warn(`[animator] Unknown animation: ${name}`);
        return;
      }
      if (currentName === name && !force) return;
      current = animations.get(name);
      currentName = name;
      frameIndex = 0;
      elapsed = 0;
      paused = false;
      applyFrame();
    },

    /** Pause current animation */
    pause() { paused = true; },

    /** Resume current animation */
    resume() { paused = false; },

    /** Stop animation (show first frame) */
    stop() {
      current = null;
      currentName = null;
      frameIndex = 0;
      elapsed = 0;
    },

    /**
     * Update animation (call each frame).
     * @param {number} dt - delta time in seconds
     */
    update(dt) {
      if (!current || paused) return;

      elapsed += dt;
      const frameDuration = 1 / current.fps;

      while (elapsed >= frameDuration) {
        elapsed -= frameDuration;
        frameIndex++;

        if (frameIndex >= current.frames.length) {
          if (current.loop) {
            frameIndex = 0;
          } else {
            frameIndex = current.frames.length - 1;
            if (current.onEnd) current.onEnd();
            current = null;
            currentName = null;
            return;
          }
        }
      }

      applyFrame();
    },

    /** @returns {string|null} current animation name */
    get currentName() { return currentName; },

    /** @returns {boolean} is playing */
    get isPlaying() { return current !== null && !paused; },

    /** Remove all animations */
    clear() {
      animations.clear();
      current = null;
      currentName = null;
    },

    destroy() {
      this.clear();
    },
  };

  function applyFrame() {
    if (!current || !sprite) return;
    const frame = current.frames[frameIndex];
    if (!frame) return;

    // If sprite has texture property (PixiJS Sprite)
    if (sprite.texture !== undefined) {
      sprite.texture = frame;
    }
    // If frames are objects with apply method
    else if (typeof frame === 'object' && frame.apply) {
      frame.apply(sprite);
    }
  }
}

/**
 * Create a simple state machine.
 * @param {object} initial - initial state name
 * @param {object} states - { stateName: { enter?, exit?, update? } }
 * @returns {StateMachine}
 */
export function createStateMachine(initial, states) {
  let current = initial;
  let currentState = states[initial];

  if (currentState?.enter) currentState.enter();

  return {
    /** Current state name */
    get current() { return current; },

    /**
     * Transition to a new state.
     * @param {string} name
     * @param {any} [data] - passed to enter()
     */
    go(name, data) {
      if (!states[name]) {
        console.warn(`[stateMachine] Unknown state: ${name}`);
        return;
      }
      if (currentState?.exit) currentState.exit();
      current = name;
      currentState = states[name];
      if (currentState?.enter) currentState.enter(data);
    },

    /**
     * Update current state.
     * @param {number} dt
     */
    update(dt) {
      if (currentState?.update) currentState.update(dt);
    },

    /** Check if in a specific state */
    is(name) { return current === name; },

    destroy() {
      if (currentState?.exit) currentState.exit();
      current = null;
      currentState = null;
    },
  };
}
