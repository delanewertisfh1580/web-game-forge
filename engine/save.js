/**
 * save.js — localStorage wrapper with versioned schema + migrations.
 * @module save
 */

/**
 * Create a save manager.
 * @param {string} gameKey - unique key for this game
 * @param {object} [options]
 * @param {number} [options.version=1] - current schema version
 * @param {object} [options.migrations] - { 2: (data) => data, 3: (data) => data, ... }
 * @param {object} [options.defaults] - default values
 * @returns {SaveManager}
 */
export function createSaveManager(gameKey, options = {}) {
  const version = options.version ?? 1;
  const migrations = options.migrations ?? {};
  const defaults = options.defaults ?? {};
  const storageKey = `myengine_${gameKey}`;

  function loadRaw() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function saveRaw(data) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('[save] Failed to save:', e);
    }
  }

  // Load and migrate
  let data = loadRaw();
  if (data) {
    const savedVersion = data._version ?? 1;
    if (savedVersion < version) {
      for (let v = savedVersion + 1; v <= version; v++) {
        if (migrations[v]) {
          data = migrations[v](data);
        }
      }
      data._version = version;
      saveRaw(data);
    }
  } else {
    data = { _version: version, ...defaults };
    saveRaw(data);
  }

  return {
    /** Get a value by key */
    get(key, fallback) {
      return data[key] !== undefined ? data[key] : fallback;
    },

    /** Set a value and persist */
    set(key, value) {
      data[key] = value;
      saveRaw(data);
    },

    /** Delete a key */
    remove(key) {
      delete data[key];
      saveRaw(data);
    },

    /** Check if key exists */
    has(key) {
      return key in data;
    },

    /** Get all data (excluding internal keys) */
    getAll() {
      const { _version, ...rest } = data;
      return { ...rest };
    },

    /** Reset to defaults */
    reset() {
      data = { _version: version, ...defaults };
      saveRaw(data);
    },

    /** Current schema version */
    get version() { return version; },

    /** Clear all storage for this game */
    clear() {
      localStorage.removeItem(storageKey);
      data = { _version: version, ...defaults };
    },

    destroy() { /* no-op, localStorage is global */ },
  };
}
