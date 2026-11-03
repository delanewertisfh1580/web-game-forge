/**
 * input.js — keyboard + mouse + touch input with action map.
 * @module input
 */

/**
 * Create an input manager.
 * @param {object} [actionMap] - { jump: ['Space','KeyW'], fire: ['Mouse0'] }
 * @returns {InputManager}
 */
export function createInputManager(actionMap = {}) {
  const keys = new Set();
  const keysPrev = new Set();
  const mouse = { x: 0, y: 0, buttons: new Set(), buttonsPrev: new Set() };
  const touches = [];
  const listeners = {};
  let canvas = null;

  function addListener(el, type, fn, opts) {
    el.addEventListener(type, fn, opts);
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push({ el, fn, opts });
  }

  function getActionKeys(action) {
    return actionMap[action] || [];
  }

  function isKeyAction(action) {
    return getActionKeys(action).some(k => !k.startsWith('Mouse'));
  }

  function isMouseAction(action) {
    return getActionKeys(action).some(k => k.startsWith('Mouse'));
  }

  const manager = {
    /** Current mouse state */
    mouse,

    /** Current touches */
    get touches() { return touches; },

    /** Set the canvas/DOM element for mouse coordinates */
    setCanvas(el) {
      canvas = el;
    },

    /** Update action map */
    setActionMap(map) {
      Object.assign(actionMap, map);
    },

    /**
     * Is action currently held down?
     * @param {string} action
     * @returns {boolean}
     */
    isDown(action) {
      for (const k of getActionKeys(action)) {
        if (k.startsWith('Mouse')) {
          if (mouse.buttons.has(k)) return true;
        } else {
          if (keys.has(k)) return true;
        }
      }
      return false;
    },

    /**
     * Was action just pressed this frame?
     * @param {string} action
     * @returns {boolean}
     */
    isPressed(action) {
      for (const k of getActionKeys(action)) {
        if (k.startsWith('Mouse')) {
          if (mouse.buttons.has(k) && !mouse.buttonsPrev.has(k)) return true;
        } else {
          if (keys.has(k) && !keysPrev.has(k)) return true;
        }
      }
      return false;
    },

    /**
     * Was action just released this frame?
     * @param {string} action
     * @returns {boolean}
     */
    isReleased(action) {
      for (const k of getActionKeys(action)) {
        if (k.startsWith('Mouse')) {
          if (!mouse.buttons.has(k) && mouse.buttonsPrev.has(k)) return true;
        } else {
          if (!keys.has(k) && keysPrev.has(k)) return true;
        }
      }
      return false;
    },

    /**
     * Get axis value (WASD/arrows → {x, y} in [-1, 1]).
     * @param {string} [name='move']
     * @returns {{x:number,y:number}}
     */
    axis(name = 'move') {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      // Normalize diagonal
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        x *= inv; y *= inv;
      }
      return { x, y };
    },

    /**
     * Register a callback for an action (fires on press).
     * @param {string} action
     * @param {function} cb
     */
    on(action, cb) {
      if (!manager._actionCallbacks) manager._actionCallbacks = {};
      if (!manager._actionCallbacks[action]) manager._actionCallbacks[action] = [];
      manager._actionCallbacks[action].push(cb);
    },

    /**
     * Unregister a callback.
     * @param {string} action
     * @param {function} cb
     */
    off(action, cb) {
      if (!manager._actionCallbacks || !manager._actionCallbacks[action]) return;
      manager._actionCallbacks[action] = manager._actionCallbacks[action].filter(f => f !== cb);
    },

    /** Call at end of frame to update prev state */
    endFrame() {
      keysPrev.clear();
      for (const k of keys) keysPrev.add(k);
      mouse.buttonsPrev.clear();
      for (const b of mouse.buttons) mouse.buttonsPrev.add(b);
    },

    /** Update per-frame (check callbacks) */
    update() {
      if (manager._actionCallbacks) {
        for (const action in manager._actionCallbacks) {
          if (manager.isPressed(action)) {
            for (const cb of manager._actionCallbacks[action]) {
              try { cb(); } catch (e) { console.error('[input] callback error:', e); }
            }
          }
        }
      }
    },

    /** Install DOM listeners */
    install(targetEl) {
      const el = targetEl || window;

      addListener(window, 'keydown', (e) => {
        keys.add(e.code);
      });
      addListener(window, 'keyup', (e) => {
        keys.delete(e.code);
      });

      const mouseTarget = canvas || el;
      addListener(mouseTarget, 'mousemove', (e) => {
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          mouse.x = e.clientX - rect.left;
          mouse.y = e.clientY - rect.top;
        } else {
          mouse.x = e.clientX;
          mouse.y = e.clientY;
        }
      });
      addListener(mouseTarget, 'mousedown', (e) => {
        mouse.buttons.add(`Mouse${e.button}`);
      });
      addListener(mouseTarget, 'mouseup', (e) => {
        mouse.buttons.delete(`Mouse${e.button}`);
      });
      addListener(mouseTarget, 'contextmenu', (e) => e.preventDefault());

      // Touch
      addListener(mouseTarget, 'touchstart', (e) => {
        touches.length = 0;
        for (const t of e.touches) {
          const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
          touches.push({ id: t.identifier, x: t.clientX - rect.left, y: t.clientY - rect.top });
        }
        if (touches.length > 0) mouse.buttons.add('Mouse0');
      });
      addListener(mouseTarget, 'touchmove', (e) => {
        touches.length = 0;
        for (const t of e.touches) {
          const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
          touches.push({ id: t.identifier, x: t.clientX - rect.left, y: t.clientY - rect.top });
        }
        if (touches.length > 0) {
          mouse.x = touches[0].x;
          mouse.y = touches[0].y;
        }
      });
      addListener(mouseTarget, 'touchend', (e) => {
        touches.length = 0;
        for (const t of e.touches) {
          const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
          touches.push({ id: t.identifier, x: t.clientX - rect.left, y: t.clientY - rect.top });
        }
        if (touches.length === 0) mouse.buttons.delete('Mouse0');
      });
    },

    /** Remove all listeners */
    destroy() {
      for (const type in listeners) {
        for (const { el, fn, opts } of listeners[type]) {
          el.removeEventListener(type, fn, opts);
        }
      }
      keys.clear();
      keysPrev.clear();
      mouse.buttons.clear();
      mouse.buttonsPrev.clear();
      touches.length = 0;
    },
  };

  manager.install();
  return manager;
}
