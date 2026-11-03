/**
 * rng.js — seedable PRNG (mulberry32).
 * @module rng
 */

/**
 * Create a seeded random number generator.
 * @param {number} seed
 * @returns {RNG}
 */
export function createRNG(seed = Date.now()) {
  let s = seed | 0;

  /** @returns {number} float in [0, 1) */
  function next() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    /** Current seed */
    get seed() { return s; },

    /** Reset with a new seed */
    reseed(newSeed) { s = newSeed | 0; },

    /** @returns {number} float in [0, 1) */
    random() { return next(); },

    /** @returns {number} float in [a, b) */
    range(a, b) { return a + next() * (b - a); },

    /** @returns {number} integer in [a, b] inclusive */
    int(a, b) { return Math.floor(a + next() * (b - a + 1)); },

    /** @returns {boolean} true with probability p */
    chance(p) { return next() < p; },

    /** @returns {any} random element from array */
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },

    /** Shuffle array in place (Fisher-Yates) */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    /** @returns {number} Gaussian-distributed (Box-Muller) */
    gaussian(mean = 0, std = 1) {
      const u1 = next() || 1e-10;
      const u2 = next();
      return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
  };
}
