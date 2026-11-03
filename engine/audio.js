/**
 * audio.js — WebAudio wrapper with unlock, preload, play.
 * @module audio
 */

/**
 * Create an audio manager.
 * @returns {AudioManager}
 */
export function createAudioManager() {
  let ctx = null;
  let masterGain = null;
  const buffers = new Map();
  const sources = new Map();
  let muted = false;
  let masterVolume = 1;
  let unlocked = false;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.value = masterVolume;
    }
    return ctx;
  }

  function unlock() {
    if (unlocked) return;
    const c = ensureContext();
    if (c.state === 'suspended') c.resume();
    // Play silent buffer to unlock on iOS
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    unlocked = true;
  }

  // Auto-unlock on first user gesture
  const unlockHandler = () => {
    unlock();
    window.removeEventListener('pointerdown', unlockHandler);
    window.removeEventListener('keydown', unlockHandler);
    window.removeEventListener('touchstart', unlockHandler);
  };
  window.addEventListener('pointerdown', unlockHandler);
  window.addEventListener('keydown', unlockHandler);
  window.addEventListener('touchstart', unlockHandler);

  return {
    /** @returns {AudioContext} */
    get context() { return ensureContext(); },

    /**
     * Preload an audio file.
     * @param {string} name - identifier
     * @param {string} url - URL to fetch
     * @returns {Promise<void>}
     */
    async preload(name, url) {
      if (buffers.has(name)) return;
      const c = ensureContext();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await c.decodeAudioData(arrayBuffer);
      buffers.set(name, audioBuffer);
    },

    /**
     * Preload multiple files.
     * @param {object} manifest - { name: url, ... }
     * @param {function} [onProgress] - (loaded, total) => void
     * @returns {Promise<void>}
     */
    async preloadAll(manifest, onProgress) {
      const entries = Object.entries(manifest);
      let loaded = 0;
      for (const [name, url] of entries) {
        await this.preload(name, url);
        loaded++;
        if (onProgress) onProgress(loaded, entries.length);
      }
    },

    /**
     * Play a sound.
     * @param {string} name
     * @param {object} [options]
     * @param {boolean} [options.loop=false]
     * @param {number} [options.volume=1]
     * @param {number} [options.rate=1]
     * @returns {AudioBufferSourceNode|null}
     */
    play(name, options = {}) {
      const buffer = buffers.get(name);
      if (!buffer) {
        console.warn(`[audio] Sound "${name}" not loaded`);
        return null;
      }
      const c = ensureContext();
      if (c.state === 'suspended') c.resume();

      const source = c.createBufferSource();
      source.buffer = buffer;
      source.loop = options.loop ?? false;
      source.playbackRate.value = options.rate ?? 1;

      const gain = c.createGain();
      gain.gain.value = (options.volume ?? 1) * (muted ? 0 : 1);
      source.connect(gain);
      gain.connect(masterGain);

      source.start(0);
      const id = `${name}_${Date.now()}_${Math.random()}`;
      sources.set(id, { source, gain });
      source.onended = () => sources.delete(id);
      return source;
    },

    /** Stop a specific sound by name (stops all instances) */
    stop(name) {
      for (const [id, { source }] of sources) {
        if (id.startsWith(name + '_')) {
          try { source.stop(); } catch {}
          sources.delete(id);
        }
      }
    },

    /** Stop all sounds */
    stopAll() {
      for (const [id, { source }] of sources) {
        try { source.stop(); } catch {}
      }
      sources.clear();
    },

    /** Set master volume (0-1) */
    setVolume(v) {
      masterVolume = v;
      if (masterGain) masterGain.gain.value = muted ? 0 : v;
    },

    /** Mute/unmute */
    setMuted(m) {
      muted = m;
      if (masterGain) masterGain.gain.value = muted ? 0 : masterVolume;
    },

    /** @returns {boolean} */
    get isMuted() { return muted; },

    /** Toggle mute */
    toggleMute() {
      this.setMuted(!muted);
      return muted;
    },

    /** Destroy */
    destroy() {
      this.stopAll();
      if (ctx) {
        ctx.close();
        ctx = null;
      }
      buffers.clear();
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
      window.removeEventListener('touchstart', unlockHandler);
    },
  };
}
