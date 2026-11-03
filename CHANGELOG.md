# Changelog

All notable changes to my-engine are documented here.

## [Unreleased]

### Added
- **engine/boot.js** — shared error bootstrap; catches `window.error`, `unhandledrejection`, and `console.error`; shows red banner in DOM
- **engine/events.js** — pub/sub event bus (`createEventBus`)
- **engine/rng.js** — seedable PRNG via mulberry32 (`createRNG`)
- **engine/pool.js** — generic object pool (`Pool` class)
- **engine/spatial-hash.js** — spatial hash grid for broad-phase collisions (`SpatialHash`)
- **engine/save.js** — localStorage wrapper with versioned schema + migrations (`createSaveManager`)
- **engine/tween.js** — lightweight tween engine with 15+ easing functions (`createTweenManager`, `Easing`)
- **engine/input.js** — keyboard + mouse + touch with action map (`createInputManager`)
- **engine/audio.js** — WebAudio wrapper with preload, play, unlock (`createAudioManager`)
- **engine/assets.js** — manifest-based asset loader with caching (`createAssetManager`)
- **engine/camera2d.js** — 2D camera: follow, clamp, shake, zoom (`createCamera2D`)
- **engine/camera3d.js** — 3D orbit/follow camera for Three.js (`createCamera3D`)
- **engine/scenes.js** — scene manager with fade transitions (`createSceneManager`)
- **engine/hud.js** — DOM-based HUD overlay (`createHUDManager`)
- **engine/debug.js** — debug overlay toggled with `~` key (`createDebugOverlay`)
- **game.ready()** — Promise that resolves when game is initialized
- **game.pause() / game.resume() / game.isPaused** — pause control
- **game.scene.update(fn)** — convenience proxy to extend current scene
- **game.use(pluginFn)** — plugin system
- **examples/platformer.html** — full mini-platformer with tiles, coins, scenes, camera
- **examples/twin-stick.html** — twin-stick shooter with Pool, SpatialHash, screen shake
- **examples/3d-orbit.html** — 3D orbit camera + click-to-shoot + particles
- **examples/_smoke.html** — automated smoke test for all modules
- **scripts/new-game.sh** — scaffold new prototypes from template
- **scripts/verify.sh** — verify all examples load via HTTP
- **templates/prototype.html** — template for new-game.sh
- **config/override.json5** — example of `$extend` inheritance

### Changed
- **engine/index.js** — fully rewritten to integrate all subsystems; `createGame` now initializes input, assets, tweens, audio, camera, scenes, hud, save, debug, events, rng
- **createGame** now accepts new config keys: `input`, `assets`, `initialScene`, `plugins`, `hud`, `seed`, `debug`, `saveKey`, `saveVersion`, `saveMigrations`, `saveDefaults`

## [0.1.0] — Initial Release

### Fixed
- **engine/renderer2d.js** — removed `texture.baseTexture` (PixiJS v7 API); now checks `texture.animations` directly (v8 API)
- **engine/renderer2d.js** — fixed `app.destroy()` call for PixiJS v8 compatibility (wrapped in try/catch)

### Added
- Core engine with 2D (PixiJS 8) and 3D (Three.js) renderers
- Particle systems (2D + 3D)
- Built-in shaders: `wave`, `dissolve`
- JSON5 config loader with `$extend` inheritance
- Fixed-timestep game loop
- Deep merge utility (arrays replaced, objects recursive)
- Three examples: 2d-particles, 3d-shader, config-override
- README with full API documentation
