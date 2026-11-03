/**
 * pool.js — generic object pool.
 * @module pool
 */

/**
 * Create an object pool.
 * @param {function} factory - () => object
 * @param {function} [reset] - (obj) => void, called on acquire
 * @param {number} [initialSize=0] - pre-allocate this many
 * @returns {Pool}
 */
export class Pool {
  constructor(factory, reset = null, initialSize = 0) {
    this._factory = factory;
    this._reset = reset;
    this._free = [];
    this._active = new Set();

    for (let i = 0; i < initialSize; i++) {
      this._free.push(factory());
    }
  }

  /** @returns {object} an object from the pool */
  acquire() {
    const obj = this._free.length > 0 ? this._free.pop() : this._factory();
    if (this._reset) this._reset(obj);
    this._active.add(obj);
    return obj;
  }

  /** Release an object back to the pool */
  release(obj) {
    if (this._active.has(obj)) {
      this._active.delete(obj);
      this._free.push(obj);
    }
  }

  /** Iterate over active objects */
  forEach(fn) {
    for (const obj of this._active) fn(obj);
  }

  /** @returns {number} count of active objects */
  get activeCount() { return this._active.size; }

  /** @returns {number} count of free objects */
  get freeCount() { return this._free.length; }

  /** Release all active objects */
  releaseAll() {
    for (const obj of this._active) this._free.push(obj);
    this._active.clear();
  }

  /** Destroy the pool */
  destroy() {
    this._free.length = 0;
    this._active.clear();
  }
}
