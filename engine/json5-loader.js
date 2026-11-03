/**
 * JSON5 config loader with $extend support.
 * Resolves $extend chains, detects cycles, deep-merges configs.
 */
import JSON5 from 'json5';
import { deepMerge } from './utils/deep-merge.js';

const _cache = new Map();

/**
 * Load a JSON5 config from URL. Supports $extend for inheritance.
 * @param {string} url - URL to fetch
 * @param {string[]} _visited - internal cycle detection
 * @returns {Promise<object>} merged config object
 */
export async function loadJson5Config(url, _visited = []) {
  // Normalize URL for cycle detection
  const normalizedUrl = new URL(url, window.location.href).href;

  if (_visited.includes(normalizedUrl)) {
    throw new Error(
      `[Json5Loader] Circular $extend detected! Chain: ${[..._visited, normalizedUrl].join(' → ')}`
    );
  }

  // Check cache
  if (_cache.has(normalizedUrl) && _visited.length === 0) {
    return _cache.get(normalizedUrl);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[Json5Loader] Failed to load ${url}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  let config = JSON5.parse(text);

  // Handle $extend
  if (config.$extend) {
    const basePath = config.$extend;
    // Resolve relative to current URL
    const baseUrl = new URL(basePath, url).href;

    const baseConfig = await loadJson5Config(baseUrl, [..._visited, normalizedUrl]);

    // Remove $extend key before merging
    const { $extend, ...childConfig } = config;
    config = deepMerge(baseConfig, childConfig);
  }

  // Cache top-level loads
  if (_visited.length === 0) {
    _cache.set(normalizedUrl, config);
  }

  return config;
}

/**
 * Clear the config cache (useful for hot-reload scenarios).
 */
export function clearConfigCache() {
  _cache.clear();
}
