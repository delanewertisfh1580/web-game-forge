/**
 * assets.js — manifest-based asset loader with caching.
 * @module assets
 */

const globalCache = new Map();

/**
 * Create an asset manager.
 * @param {object} [options]
 * @param {string} [options.baseUrl=''] - prefix for all URLs
 * @returns {AssetManager}
 */
export function createAssetManager(options = {}) {
  const baseUrl = options.baseUrl ?? '';
  const cache = options.sharedCache !== false ? globalCache : new Map();
  let _onProgress = null;

  function resolveUrl(url) {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url;
    return baseUrl + url;
  }

  async function loadTexture(url) {
    const resolved = resolveUrl(url);
    if (cache.has(resolved)) return cache.get(resolved);
    // Try PixiJS if available, otherwise create Image
    try {
      const PIXI = await import('pixi.js');
      const texture = await PIXI.Assets.load(resolved);
      cache.set(resolved, texture);
      return texture;
    } catch {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { cache.set(resolved, img); resolve(img); };
        img.onerror = reject;
        img.src = resolved;
      });
    }
  }

  async function loadAudio(url, audioManager) {
    const resolved = resolveUrl(url);
    if (cache.has(resolved)) return cache.get(resolved);
    if (audioManager) {
      const name = url.split('/').pop().split('.')[0];
      await audioManager.preload(name, resolved);
      cache.set(resolved, name);
      return name;
    }
    return null;
  }

  async function loadGLB(url) {
    const resolved = resolveUrl(url);
    if (cache.has(resolved)) return cache.get(resolved);
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(resolved, (gltf) => {
        cache.set(resolved, gltf);
        resolve(gltf);
      }, undefined, reject);
    });
  }

  async function loadJSON(url) {
    const resolved = resolveUrl(url);
    if (cache.has(resolved)) return cache.get(resolved);
    const resp = await fetch(resolved);
    const data = await resp.json();
    cache.set(resolved, data);
    return data;
  }

  async function loadText(url) {
    const resolved = resolveUrl(url);
    if (cache.has(resolved)) return cache.get(resolved);
    const resp = await fetch(resolved);
    const data = await resp.text();
    cache.set(resolved, data);
    return data;
  }

  return {
    /**
     * Load a manifest of assets.
     * @param {object} manifest - { tex: ['a.png'], audio: ['s.ogg'], glb: ['m.glb'], json: ['d.json'] }
     * @param {object} [extra] - { audioManager }
     * @returns {Promise<object>} loaded assets by key
     */
    async load(manifest, extra = {}) {
      const results = {};
      const tasks = [];
      let total = 0;
      let loaded = 0;

      for (const [type, urls] of Object.entries(manifest)) {
        if (!Array.isArray(urls)) continue;
        for (const url of urls) {
          total++;
          tasks.push((async () => {
            let result;
            switch (type) {
              case 'tex': case 'texture': case 'image':
                result = await loadTexture(url); break;
              case 'audio': case 'sound':
                result = await loadAudio(url, extra.audioManager); break;
              case 'glb': case 'gltf': case 'model':
                result = await loadGLB(url); break;
              case 'json': case 'data':
                result = await loadJSON(url); break;
              case 'text':
                result = await loadText(url); break;
              default:
                result = await loadText(url);
            }
            loaded++;
            if (_onProgress) _onProgress(loaded, total);
            return { type, url, result };
          })());
        }
      }

      const all = await Promise.all(tasks);
      for (const { type, url, result } of all) {
        const key = url.split('/').pop().split('.')[0];
        if (!results[type]) results[type] = {};
        results[type][key] = result;
      }
      return results;
    },

    /** Set progress callback */
    onProgress(fn) { _onProgress = fn; },

    /** Get a cached asset by URL */
    get(url) { return cache.get(resolveUrl(url)); },

    /** Check if asset is cached */
    has(url) { return cache.has(resolveUrl(url)); },

    /** Clear cache */
    clear() { cache.clear(); },

    destroy() { /* cache is global, don't clear */ },
  };
}
