/**
 * my-engine — main entry point.
 * 
 * Usage (in HTML with import map):
 *   import { createGame } from 'my-engine';
 *   const game = await createGame({ mode: '2d', width: 800, height: 600 });
 *   game.start();
 */

import { DEFAULT_CONFIG } from './config.js';
import { deepMerge } from './utils/deep-merge.js';
import { GameLoop } from './loop.js';
import { Renderer2D } from './renderer2d.js';
import { Renderer3D } from './renderer3d.js';
import { createShaderMaterial } from './shaders.js';
import { createParticleEmitter2D, createParticleEmitter3D } from './particles.js';
import { loadJson5Config, clearConfigCache } from './json5-loader.js';

/**
 * Create a game instance.
 * @param {object} userConfig - User overrides merged on top of DEFAULT_CONFIG.
 * @returns {Promise<object>} Game instance with start/stop/destroy/etc.
 */
export async function createGame(userConfig = {}) {
  // Deep merge config
  const config = deepMerge(DEFAULT_CONFIG, userConfig);

  // Validate mode
  if (config.mode !== '2d' && config.mode !== '3d') {
    throw new Error(`[createGame] Unknown mode "${config.mode}". Use '2d' or '3d'.`);
  }

  // Resolve mount element
  let mountEl;
  if (config.mount instanceof HTMLElement) {
    mountEl = config.mount;
  } else if (typeof config.mount === 'string') {
    mountEl = document.querySelector(config.mount);
  }
  if (!mountEl) {
    throw new Error(`[createGame] Mount element not found: "${config.mount}". Make sure the element exists in the DOM.`);
  }

  // Initialize renderer
  let renderer;
  if (config.mode === '2d') {
    renderer = config.factories.renderer2d
      ? config.factories.renderer2d()
      : new Renderer2D();
    await renderer.init({
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
      mount: mountEl,
    });
  } else {
    renderer = config.factories.renderer3d
      ? config.factories.renderer3d()
      : new Renderer3D();
    renderer.init({
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
      mount: mountEl,
    });
  }

  // Create game loop
  const loop = new GameLoop();

  // Context exposed to hooks and user code
  const ctx = {
    config,
    renderer,
    scene: config.mode === '2d' ? renderer.app?.stage : renderer.scene,
    app: config.mode === '2d' ? renderer.app : renderer.renderer,
    mode: config.mode,
    camera: config.mode === '3d' ? renderer.camera : null,
  };

  // Particle emitters registry
  const emitters = [];

  // Shader materials registry (3D)
  const shaderMaterials = {};

  // Game object
  const game = {
    ctx,
    config,

    /**
     * Start the game loop.
     */
    start() {
      // Register user hooks
      if (config.hooks.onUpdate) {
        loop.addHook((dt) => config.hooks.onUpdate(ctx, dt));
      }

      // Main update tick
      loop.addHook((dt) => {
        // Update all emitters
        for (const emitter of emitters) {
          emitter.update(dt);
        }

        // Update shader uniforms
        for (const [name, mat] of Object.entries(shaderMaterials)) {
          if (mat.uniforms && mat.uniforms.uTime) {
            mat.uniforms.uTime.value += dt;
          }
        }
      });

      // For 3D mode, render each frame
      if (config.mode === '3d') {
        loop.addHook(() => {
          renderer.render();
        });
      }

      loop.start();
      return game;
    },

    /**
     * Stop the game loop.
     */
    stop() {
      loop.stop();
      return game;
    },

    /**
     * Destroy the game and clean up resources.
     */
    destroy() {
      loop.destroy();
      for (const emitter of emitters) {
        emitter.destroy();
      }
      emitters.length = 0;
      if (config.hooks.onDestroy) {
        config.hooks.onDestroy(ctx);
      }
      renderer.destroy();
      return null;
    },

    /**
     * Add a particle system.
     * @param {object} particleConfig
     * @returns {object} emitter with update/destroy
     */
    addParticleSystem(particleConfig = {}) {
      let emitter;
      if (config.factories.particleSystem) {
        emitter = config.factories.particleSystem(renderer, particleConfig);
      } else if (config.mode === '2d') {
        emitter = createParticleEmitter2D(renderer, particleConfig);
      } else {
        emitter = createParticleEmitter3D(renderer, particleConfig);
      }
      emitters.push(emitter);
      return emitter;
    },

    /**
     * Load a sprite sheet (2D only).
     * @param {string} url
     * @param {object} spriteConfig
     * @returns {Promise<object>}
     */
    async loadSpriteSheet(url, spriteConfig = {}) {
      if (config.mode !== '2d') {
        throw new Error('[createGame] loadSpriteSheet is only available in 2D mode.');
      }
      if (config.factories.spriteLoader) {
        return config.factories.spriteLoader(renderer, url, spriteConfig);
      }
      return renderer.loadSpriteSheet(url, spriteConfig);
    },

    /**
     * Set a shader material (3D only).
     * @param {string} name
     * @param {object|string} materialOrConfig - ShaderMaterial instance, shader name, or shader config
     * @returns {Promise<object>} The material
     */
    async setShader(name, materialOrConfig) {
      if (config.mode !== '3d') {
        throw new Error('[createGame] setShader is only available in 3D mode.');
      }

      let material;
      if (materialOrConfig && materialOrConfig.isMaterial) {
        // Already a Three.js material
        material = materialOrConfig;
      } else if (config.factories.shaderMaterial) {
        material = config.factories.shaderMaterial(name, materialOrConfig);
      } else if (typeof materialOrConfig === 'string') {
        // Import THREE for createShaderMaterial
        const THREE = await import('three');
        material = createShaderMaterial(materialOrConfig, THREE);
      } else {
        const THREE = await import('three');
        material = createShaderMaterial(materialOrConfig, THREE);
      }

      shaderMaterials[name] = material;
      return material;
    },

    /**
     * Register an update hook.
     * @param {function} fn - (ctx, dt) => void
     */
    onUpdate(fn) {
      loop.addHook((dt) => fn(ctx, dt));
      return game;
    },

    /**
     * Resize the game.
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
      config.width = width;
      config.height = height;
      renderer.resize(width, height);
      if (config.hooks.onResize) {
        config.hooks.onResize(ctx);
      }
      return game;
    },
  };

  return game;
}

// Re-exports
export { Renderer2D } from './renderer2d.js';
export { Renderer3D } from './renderer3d.js';
export { GameLoop } from './loop.js';
export { SHADERS, createShaderMaterial } from './shaders.js';
export { createParticleEmitter2D, createParticleEmitter3D } from './particles.js';
export { loadJson5Config, clearConfigCache } from './json5-loader.js';
export { deepMerge } from './utils/deep-merge.js';
export { DEFAULT_CONFIG } from './config.js';
