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
import { createInputManager } from './input.js';
import { createAssetManager } from './assets.js';
import { createTweenManager } from './tween.js';
import { createAudioManager } from './audio.js';
import { createCamera2D } from './camera2d.js';
import { createCamera3D } from './camera3d.js';
import { createSceneManager } from './scenes.js';
import { createHUDManager } from './hud.js';
import { createDebugOverlay } from './debug.js';
import { createRNG } from './rng.js';
import { createEventBus } from './events.js';
import { createSaveManager } from './save.js';
import { Pool } from './pool.js';
import { SpatialHash } from './spatial-hash.js';
import { createAnimator, createStateMachine } from './animation.js';

/**
 * Create a game instance.
 * @param {object} userConfig - User overrides merged on top of DEFAULT_CONFIG.
 * @returns {Promise<object>} Game instance.
 */
export async function createGame(userConfig = {}) {
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
    throw new Error(`[createGame] Mount element not found: "${config.mount}".`);
  }

  // Initialize renderer
  let renderer;
  if (config.mode === '2d') {
    renderer = config.factories?.renderer2d
      ? config.factories.renderer2d()
      : new Renderer2D();
    await renderer.init({
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
      mount: mountEl,
    });
  } else {
    renderer = config.factories?.renderer3d
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

  // Context
  // NOTE: ctx.camera is the raw THREE.PerspectiveCamera in 3D mode.
  // For the camera wrapper (orbit/follow/shake), use game.camera instead.
  const ctx = {
    config,
    renderer,
    scene: config.mode === '2d' ? renderer.app?.stage : renderer.scene,
    app: config.mode === '2d' ? renderer.app : renderer.renderer,
    mode: config.mode,
    camera: config.mode === '3d' ? renderer.camera : null,
  };

  // Registries
  const emitters = [];
  const animators = [];
  const shaderMaterials = {};
  const plugins = [];
  const sceneUpdateFns = [];

  // === Initialize all subsystems ===

  // Events
  const events = createEventBus();

  // RNG
  const rng = createRNG(config.seed ?? Date.now());

  // Input
  const input = createInputManager(config.input ?? {});
  if (config.mode === '2d' && renderer.app?.canvas) {
    input.setCanvas(renderer.app.canvas);
  } else if (config.mode === '3d' && renderer.renderer?.domElement) {
    input.setCanvas(renderer.renderer.domElement);
  }

  // Assets
  const assets = createAssetManager({ baseUrl: config.assets?.baseUrl ?? '' });

  // Tweens
  const tweens = createTweenManager();

  // Audio
  const audio = createAudioManager();

  // Camera
  let camera;
  if (config.mode === '2d') {
    camera = createCamera2D();
  } else {
    const domEl = renderer.renderer?.domElement || mountEl;
    camera = createCamera3D(renderer.camera, domEl);
  }

  // Scenes
  const scenes = createSceneManager();

  // HUD
  const hud = createHUDManager(mountEl);

  // Save
  const save = createSaveManager(config.saveKey ?? 'default', {
    version: config.saveVersion ?? 1,
    migrations: config.saveMigrations ?? {},
    defaults: config.saveDefaults ?? {},
  });

  // Ready promise — resolved at end of createGame (NOT in start)
  // Fix #2: Promise создаётся ДО объекта game, но executor НЕ обращается к game (избегаем TDZ)
  let _readyResolveFn = null;
  const _readyPromise = new Promise((resolve) => { _readyResolveFn = resolve; });

  // === Game object (needed before debug so debug gets real game) ===
  const game = {
    ctx,
    config,
    events,
    rng,
    input,
    assets,
    tweens,
    audio,
    camera,
    scenes,
    hud,
    save,
    debug: null, // set below after game is created

    // Pause state
    _paused: false,
    get isPaused() { return game._paused; },

    pause() {
      if (game._paused) return game;
      game._paused = true;
      loop.stop();
      events.emit('game:pause');
      return game;
    },

    resume() {
      if (!game._paused) return game;
      game._paused = false;
      if (!game._hooksInstalled) game._installHooks();
      loop.start();
      events.emit('game:resume');
      return game;
    },

    ready() {
      return _readyPromise;
    },

    // Hooks installation flag (fix #1: prevent duplicate hooks on start/resume)
    _hooksInstalled: false,

    _installHooks() {
      if (game._hooksInstalled) return;
      game._hooksInstalled = true;

      // Register user hooks
      if (config.hooks?.onUpdate) {
        loop.addHook((dt) => config.hooks.onUpdate(ctx, dt));
      }

      // Main update tick
      loop.addHook((dt) => {
        if (game._paused) return;

        // Update input
        input.update();

        // Update tweens
        tweens.update(dt);

        // Update animators
        for (const a of animators) a.update(dt);

        // Update scenes
        scenes.update(dt);

        // Scene update callbacks (fix #8)
        for (const fn of sceneUpdateFns) {
          try { fn(dt); } catch (e) { console.error('[game] onSceneUpdate error:', e); }
        }

        // Update emitters (with autoDestroyAfter support)
        for (let i = emitters.length - 1; i >= 0; i--) {
          const emitter = emitters[i];
          emitter.update(dt);
          if (emitter._autoDestroyTimer !== undefined) {
            emitter._autoDestroyTimer -= dt;
            if (emitter._autoDestroyTimer <= 0) {
              emitter.destroy();
              emitters.splice(i, 1);
            }
          }
        }

        // Update shader uniforms
        for (const [name, mat] of Object.entries(shaderMaterials)) {
          if (mat.uniforms?.uTime) {
            mat.uniforms.uTime.value += dt;
          }
        }

        // Update camera
        if (config.mode === '2d') {
          camera.update(dt, config.width, config.height);
          if (ctx.scene) camera.applyTo(ctx.scene);
        } else {
          camera.update(dt);
        }

        // Update debug (outside paused check so FPS shows during pause)
        if (game.debug) game.debug.update(dt);

        // End input frame
        input.endFrame();

        // Plugins
        for (const plugin of plugins) {
          if (plugin.update) plugin.update(dt);
        }
      });

      // For 3D mode, render each frame
      if (config.mode === '3d') {
        loop.addHook(() => {
          renderer.render();
        });
      }
    },

    start() {
      game._installHooks();
      loop.start();
      events.emit('game:start');
      return game;
    },

    stop() {
      loop.stop();
      events.emit('game:stop');
      return game;
    },

    destroy() {
      loop.destroy();
      for (const emitter of emitters) emitter.destroy();
      emitters.length = 0;
      for (const a of animators) a.destroy();
      animators.length = 0;
      if (config.hooks?.onDestroy) config.hooks.onDestroy(ctx);

      // Destroy subsystems
      input.destroy();
      tweens.destroy();
      audio.destroy();
      camera.destroy();
      scenes.destroy();
      hud.destroy();
      if (game.debug) game.debug.destroy();
      events.destroy();
      save.destroy();
      assets.destroy();

      for (const plugin of plugins) {
        if (plugin.destroy) plugin.destroy();
      }
      plugins.length = 0;
      sceneUpdateFns.length = 0;

      game._hooksInstalled = false;
      renderer.destroy();
      return null;
    },

    /**
     * Add a particle system.
     * @param {object} particleConfig
     * @param {object} [options]
     * @param {number} [options.autoDestroyAfter] - seconds until auto-destroy
     * @returns {object} emitter with update/destroy
     */
    addParticleSystem(particleConfig = {}, options = {}) {
      let emitter;
      if (config.factories?.particleSystem) {
        emitter = config.factories.particleSystem(renderer, particleConfig);
      } else if (config.mode === '2d') {
        emitter = createParticleEmitter2D(renderer, particleConfig);
      } else {
        emitter = createParticleEmitter3D(renderer, particleConfig);
      }

      if (options.autoDestroyAfter !== undefined && options.autoDestroyAfter > 0) {
        emitter._autoDestroyTimer = options.autoDestroyAfter;
      }

      emitters.push(emitter);
      return emitter;
    },

    /**
     * Create and register an animator for a sprite.
     * @param {object} sprite - PixiJS Sprite or Container
     * @returns {Animator}
     */
    animator(sprite) {
      const a = createAnimator(sprite);
      animators.push(a);
      return a;
    },

    /**
     * Register an existing animator controller.
     * @param {Animator} animator
     */
    addAnimator(animator) {
      animators.push(animator);
      return game;
    },

    async loadSpriteSheet(url, spriteConfig = {}) {
      if (config.mode !== '2d') {
        throw new Error('[createGame] loadSpriteSheet is only available in 2D mode.');
      }
      if (config.factories?.spriteLoader) {
        return config.factories.spriteLoader(renderer, url, spriteConfig);
      }
      return renderer.loadSpriteSheet(url, spriteConfig);
    },

    async setShader(name, materialOrConfig) {
      if (config.mode !== '3d') {
        throw new Error('[createGame] setShader is only available in 3D mode.');
      }
      let material;
      if (materialOrConfig?.isMaterial) {
        material = materialOrConfig;
      } else if (config.factories?.shaderMaterial) {
        material = config.factories.shaderMaterial(name, materialOrConfig);
      } else if (typeof materialOrConfig === 'string') {
        const THREE = await import('three');
        material = createShaderMaterial(materialOrConfig, THREE);
      } else {
        const THREE = await import('three');
        material = createShaderMaterial(materialOrConfig, THREE);
      }
      shaderMaterials[name] = material;
      return material;
    },

    onUpdate(fn) {
      loop.addHook((dt) => fn(ctx, dt));
      return game;
    },

    /**
     * Register a scene update callback.
     * Called each frame after scenes.update(dt), only when not paused.
     * @param {function} fn - (dt) => void
     */
    onSceneUpdate(fn) {
      sceneUpdateFns.push(fn);
      return game;
    },

    resize(width, height) {
      config.width = width;
      config.height = height;
      renderer.resize(width, height);
      if (config.hooks?.onResize) config.hooks.onResize(ctx);
      return game;
    },

    /**
     * Register a plugin.
     * @param {function} pluginFn - (game) => { start?, update?, stop?, destroy? }
     */
    use(pluginFn) {
      const plugin = pluginFn(game);
      plugins.push(plugin);
      if (plugin.start) plugin.start();
      return game;
    },

    /** @returns {number} count of active emitters */
    get emitterCount() { return emitters.length; },
  };

  // Debug — created after game so it has real reference (fix #9)
  const debug = createDebugOverlay(game);
  game.debug = debug;

  // Load assets if specified
  if (config.assets?.manifest) {
    try {
      await assets.load(config.assets.manifest, { audioManager: audio });
    } catch (e) {
      console.warn('[createGame] Asset loading failed:', e);
    }
  }

  // Setup initial scene
  if (config.initialScene && scenes.has(config.initialScene)) {
    await scenes.go(config.initialScene, config.initialSceneData ?? {});
  }

  // Setup HUD panels
  if (config.hud?.panels) {
    for (const [id, opts] of Object.entries(config.hud.panels)) {
      hud.panel(id, opts);
    }
  }

  // Setup plugins
  if (config.plugins) {
    for (const pluginFn of config.plugins) {
      game.use(pluginFn);
    }
  }

  // Enable debug if configured
  if (config.debug) {
    debug.setVisible(true);
  }

  // Resolve ready promise (fix #2: ready resolves here, not in start)
  _readyResolveFn(game);

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
export { createInputManager } from './input.js';
export { createAssetManager } from './assets.js';
export { createTweenManager, Easing } from './tween.js';
export { createAudioManager } from './audio.js';
export { createCamera2D } from './camera2d.js';
export { createCamera3D } from './camera3d.js';
export { createSceneManager } from './scenes.js';
export { createHUDManager } from './hud.js';
export { createDebugOverlay } from './debug.js';
export { createRNG } from './rng.js';
export { createEventBus } from './events.js';
export { createSaveManager } from './save.js';
export { Pool } from './pool.js';
export { SpatialHash } from './spatial-hash.js';
export { createAnimator, createStateMachine } from './animation.js';
