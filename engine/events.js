/**
 * events.js — simple pub/sub event bus.
 * @module events
 */

/**
 * Create a new event bus.
 * @returns {EventBus}
 */
export function createEventBus() {
  const listeners = new Map();

  return {
    /**
     * Subscribe to an event.
     * @param {string} event
     * @param {function} fn
     * @returns {function} unsubscribe function
     */
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => this.off(event, fn);
    },

    /**
     * Subscribe once.
     * @param {string} event
     * @param {function} fn
     */
    once(event, fn) {
      const wrapper = (...args) => {
        this.off(event, wrapper);
        fn(...args);
      };
      wrapper._original = fn;
      return this.on(event, wrapper);
    },

    /**
     * Unsubscribe.
     * @param {string} event
     * @param {function} fn
     */
    off(event, fn) {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(fn);
      // Also try to remove 'once' wrapper
      for (const wrapper of set) {
        if (wrapper._original === fn) set.delete(wrapper);
      }
      if (set.size === 0) listeners.delete(event);
    },

    /**
     * Emit an event.
     * @param {string} event
     * @param {...any} args
     */
    emit(event, ...args) {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(...args); } catch (e) { console.error(`[events] Error in handler for "${event}":`, e); }
      }
    },

    /**
     * Remove all listeners.
     */
    clear() {
      listeners.clear();
    },

    /**
     * Destroy the bus.
     */
    destroy() {
      this.clear();
    },
  };
}
