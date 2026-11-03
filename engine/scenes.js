/**
 * scenes.js — scene manager with transitions.
 * @module scenes
 */

/**
 * Create a scene manager.
 * @returns {SceneManager}
 */
export function createSceneManager() {
  const scenes = new Map();
  let current = null;
  let currentName = null;
  let transitioning = false;

  return {
    /** Current scene name */
    get current() { return currentName; },

    /** Current scene object */
    get scene() { return current; },

    /** Is transitioning? */
    get isTransitioning() { return transitioning; },

    /**
     * Register a scene.
     * @param {string} name
     * @param {object} sceneDef - { init, enter, update, exit, destroy }
     */
    add(name, sceneDef) {
      scenes.set(name, {
        name,
        init: sceneDef.init || (() => {}),
        enter: sceneDef.enter || (() => {}),
        update: sceneDef.update || (() => {}),
        exit: sceneDef.exit || (() => {}),
        destroy: sceneDef.destroy || (() => {}),
        initialized: false,
      });
    },

    /**
     * Transition to a scene.
     * @param {string} name
     * @param {object} [opts]
     * @param {string} [opts.transition='none'] - 'none' | 'fade'
     * @param {number} [opts.duration=0.4]
     * @param {any} [opts.data] - data passed to enter()
     */
    async go(name, opts = {}) {
      if (transitioning) return;
      const scene = scenes.get(name);
      if (!scene) throw new Error(`[scenes] Unknown scene: "${name}"`);
      transitioning = true;

      const duration = opts.duration ?? 0.4;
      const transitionType = opts.transition ?? 'none';

      // Exit current
      if (current) {
        current.exit();
      }

      // Init new scene if needed
      if (!scene.initialized) {
        scene.init();
        scene.initialized = true;
      }

      // Transition
      if (transitionType === 'fade' && duration > 0) {
        await new Promise(resolve => {
          let overlay = document.getElementById('__scene-transition');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = '__scene-transition';
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:9998;pointer-events:none;transition:opacity ' + duration + 's;';
            document.body.appendChild(overlay);
          }
          overlay.style.opacity = '1';
          setTimeout(() => {
            current = scene;
            currentName = name;
            scene.enter(opts.data);
            setTimeout(() => {
              overlay.style.opacity = '0';
              setTimeout(() => {
                transitioning = false;
                resolve();
              }, duration * 1000);
            }, 50);
          }, duration * 1000);
        });
      } else {
        current = scene;
        currentName = name;
        scene.enter(opts.data);
        transitioning = false;
      }
    },

    /**
     * Update current scene (call each frame).
     * @param {number} dt
     */
    update(dt) {
      if (current && !transitioning) {
        current.update(dt);
      }
    },

    /** Get scene definition by name */
    get(name) { return scenes.get(name); },

    /** Check if scene exists */
    has(name) { return scenes.has(name); },

    /** Destroy all scenes */
    destroy() {
      for (const [, scene] of scenes) {
        scene.destroy();
      }
      scenes.clear();
      current = null;
      currentName = null;
      const overlay = document.getElementById('__scene-transition');
      if (overlay) overlay.remove();
    },
  };
}
