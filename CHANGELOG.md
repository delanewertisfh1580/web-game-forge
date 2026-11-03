# Changelog

All notable changes to my-engine are documented here.

## [Unreleased]

### Fixed (regression fixes from audit)

1. **engine/index.js — start()/resume() duplicate hooks** (Bug #1)
   - `start()` added hooks on every call; `resume()` called `loop.start()` which re-ran init.
   - **Fix**: Added `_hooksInstalled` flag and `_installHooks()` method. `start()` only installs hooks once. `resume()` just restarts the loop without re-creating hooks.

2. **engine/index.js — game.ready() hangs until start()** (Bug #2)
   - `_readyPromise` was resolved only in `start()`, so `await game.ready()` before `start()` would hang forever.
   - **Fix**: `_readyPromise` is now resolved at the end of `createGame()`, after all setup (assets, scenes, plugins, HUD).

3. **engine/camera3d.js — crash in orbit({minR, maxR})** (Bug #3)
   - `const minRadius = 2;` then `minRadius = opts.minR;` → TypeError: assignment to constant.
   - **Fix**: Changed to `let minRadius = 2; let maxRadius = 50;`. Also added `{ passive: false }` to wheel listener so `preventDefault()` works.

4. **engine/hud.js — applyPosition doesn't reset transform** (Bug #4)
   - Switching from 'center' to 'top-left' left `translate(-50%,-50%)` in place.
   - **Fix**: `applyPosition()` now always resets `el.style.transform = ''` before setting new position.

5. **engine/hud.js — cssText accumulates** (Bug #5)
   - `el.style.cssText += ';' + opts.style` kept appending styles on every `setText()` call.
   - **Fix**: Store base styles as constants (`TEXT_BASE_STYLE`, `BUTTON_BASE_STYLE`, `PANEL_BASE_STYLE`) and rebuild `cssText` from scratch each time: `el.style.cssText = BASE + (opts.style ? ';' + opts.style : '')`.

6. **examples/platformer.html — pause without resume** (Bug #6)
   - `game.pause()` stopped the loop, so `isPressed('pause')` was never called again → stuck forever.
   - **Fix**: Replaced with local `scenePaused` flag. Escape toggles the flag; when paused, physics/spawning are skipped but input and rendering continue.

7. **examples/3d-orbit.html — particle system leak** (Bug #7)
   - Every hit created a new particle system that was never destroyed.
   - **Fix**: Added `autoDestroyAfter` option to `game.addParticleSystem(config, { autoDestroyAfter: seconds })`. Emitters auto-destroy after the specified time. Example now uses `{ autoDestroyAfter: 1.5 }`.

8. **engine/index.js — game.scene.update(fn) accumulates wrappers** (Bug #8)
   - Each call wrapped the already-wrapped update function.
   - **Fix**: Removed `game.scene.update()` proxy. Added `game.onSceneUpdate(fn)` which pushes to an array; all callbacks are called each frame after `scenes.update(dt)`.

9. **engine/debug.js — pause/resume don't work** (Bug #9)
   - `createDebugOverlay()` was called with `{ pause: null, resume: null }` instead of the real game. Also, debug `update()` ran inside the game loop, so it stopped updating when paused.
   - **Fix**: Debug is now created after game object, receiving the real game reference. `togglePause()` calls `game.pause()/game.resume()`. Debug now runs on its own RAF loop so it shows FPS even during pause. Added `P` key binding for pause toggle when debug is visible.

10. **engine/renderer3d.js — per-particle size not applied** (Bug #10)
    - `PointsMaterial` ignores the `size` attribute. Color fade was nearly invisible.
    - **Fix**: Replaced `PointsMaterial` with `ShaderMaterial` using custom attributes `aSize` and `aAlpha`. Vertex shader sets `gl_PointSize` from `aSize`. Fragment shader uses `aAlpha` for fade-out with circular soft-edge points.

11. **engine/assets.js — loadTexture always imports pixi.js** (Bug #11)
    - `await import('pixi.js')` crashes in 3D-only projects without pixi.js in import map.
    - **Fix**: Added `engine` option: `'pixi' | 'three' | 'image' | 'auto'`. In `'auto'` mode, tries Three.js TextureLoader first (lighter), then PixiJS, then native Image.

12. **engine/index.js — ctx.camera documentation** (Bug #12)
    - In 3D mode, `ctx.camera` is the raw `THREE.PerspectiveCamera` while `game.camera` is the wrapper.
    - **Fix**: Added explicit comment in code. Documented in README.

### Added

- **game.animator(sprite)** — создать и зарегистрировать аниматор
- **game.addAnimator(anim)** — зарегистрировать существующий аниматор
- **examples/animation.html** — пример спрайтовой анимации
- **scripts/dev.sh** — hot reload dev server (Python, SSE)
- **engine/dev-client.js** — клиент для hot reload
- **scripts/export.sh** — экспорт в single-file HTML

### Fixed (regression test improvements)

- **game.resume()** — вызывает `_installHooks()` если хуки ещё не установлены (fix для pause→resume без start)
- **game.destroy()** — сбрасывает `_hooksInstalled = false`
- **_smoke.html Regression #1** — переписан на tickUntil с реальной проверкой скорости tween
- **_smoke.html Regression #2** — переписан на Promise.race без самопального throw
- **_smoke.html Regression #7, #8, Plugin-test** — переписаны на tickUntil для устранения флейков
- **_smoke.html** — добавлены тесты: animation createAnimator, createStateMachine, game.animator()

### Added (continued)

- **engine/animation.js** — sprite animation + state machine
  - `createAnimator(sprite)` — frame-based animation with `add()`, `play()`, `update(dt)`, `pause()`, `resume()`
  - `createStateMachine(initial, states)` — FSM with `go(name, data)`, `update(dt)`, `is(name)`
- **game.onSceneUpdate(fn)** — register callbacks called each frame after scene update
- **game.addParticleSystem(config, { autoDestroyAfter })** — auto-cleanup for temporary effects
- **game.emitterCount** — getter for active emitter count
- **Regression tests** in `_smoke.html` for all 12 bugs above
- **Debug overlay improvements**: independent RAF loop, P key for pause, shows emitter count

## [0.2.0] — Major expansion

### Added
- 15 new modules: input, assets, tween, audio, camera2d, camera3d, scenes, pool, spatial-hash, save, hud, debug, rng, events, boot
- 3 new examples: platformer, twin-stick, 3d-orbit
- Plugin system via `game.use()`
- scripts/new-game.sh, scripts/verify.sh
- templates/prototype.html

## [0.1.0] — Initial Release

### Added
- Core engine with 2D (PixiJS 8) and 3D (Three.js) renderers
- Particle systems, built-in shaders (wave, dissolve)
- JSON5 config loader with `$extend`
- Fixed-timestep game loop
- 3 initial examples
