import { useState } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const examples = [
    { name: '2D Particles', file: '2d-particles.html', color: 'green', desc: 'PixiJS 8 particles with fire + sparkles' },
    { name: '3D Shader', file: '3d-shader.html', color: 'blue', desc: 'Three.js wave/dissolve shaders + 3D particles' },
    { name: 'Config Override', file: 'config-override.html', color: 'purple', desc: 'JSON5 $extend inheritance + deep merge' },
    { name: 'Platformer', file: 'platformer.html', color: 'yellow', desc: 'Full mini-platformer with tiles, coins, scenes' },
    { name: 'Twin-Stick', file: 'twin-stick.html', color: 'red', desc: 'Twin-stick shooter with Pool + SpatialHash' },
    { name: '3D Orbit', file: '3d-orbit.html', color: 'cyan', desc: '3D orbit camera + click-to-shoot' },
    { name: 'Smoke Test', file: '_smoke.html', color: 'emerald', desc: 'Automated module verification' },
  ];

  const modules = [
    { name: 'input.js', desc: 'Keyboard + mouse + touch with action map' },
    { name: 'assets.js', desc: 'Manifest-based loader with caching' },
    { name: 'tween.js', desc: 'Lightweight tween engine, 15+ easings' },
    { name: 'audio.js', desc: 'WebAudio wrapper with unlock' },
    { name: 'camera2d.js', desc: 'Follow, clamp, shake, zoom' },
    { name: 'camera3d.js', desc: 'Orbit/follow camera for Three.js' },
    { name: 'scenes.js', desc: 'Scene manager with fade transitions' },
    { name: 'pool.js', desc: 'Generic object pool' },
    { name: 'spatial-hash.js', desc: 'Spatial grid for collisions' },
    { name: 'save.js', desc: 'localStorage with versioned migrations' },
    { name: 'hud.js', desc: 'DOM-based HUD overlay' },
    { name: 'debug.js', desc: 'Debug overlay (~ key)' },
    { name: 'rng.js', desc: 'Seedable PRNG (mulberry32)' },
    { name: 'events.js', desc: 'Pub/sub event bus' },
    { name: 'boot.js', desc: 'Error bootstrap (red banner)' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🎮 my-engine</h1>
          <p className="text-gray-400 text-lg">
            Zero-build game prototyping engine — HTML + ES Modules + Import Maps
          </p>
          <p className="text-gray-500 text-sm mt-1">v0.2.0 — 15 modules, 7 examples, full plugin system</p>
        </header>

        <nav className="flex gap-2 mb-6 border-b border-gray-800 pb-4 flex-wrap">
          {['overview', 'examples', 'modules', 'api', 'quickstart'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">What is this?</h2>
              <p className="text-gray-300 leading-relaxed">
                A reusable engine for fast HTML game prototypes. Each prototype is a single HTML file
                that connects to a shared engine via Import Maps. No bundler, no npm, no build step.
                15 optional modules, all integrated into <code className="text-yellow-400">createGame()</code>.
              </p>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Architecture</h2>
              <pre className="text-sm text-gray-400 font-mono leading-relaxed overflow-x-auto">{`engine/
  index.js          ← createGame() + all re-exports
  config.js         ← DEFAULT_CONFIG
  loop.js           ← fixed timestep game loop
  renderer2d.js     ← PixiJS v8 wrapper
  renderer3d.js     ← Three.js wrapper
  particles.js      ← 2D + 3D particle systems
  sprites.js        ← sprite helpers
  shaders.js        ← built-in: wave, dissolve
  json5-loader.js   ← JSON5 with $extend
  input.js          ← keyboard/mouse/touch + action map
  assets.js         ← manifest loader + cache
  tween.js          ← tween engine + easings
  audio.js          ← WebAudio wrapper
  camera2d.js       ← follow/clamp/shake/zoom
  camera3d.js       ← orbit/follow camera
  scenes.js         ← scene manager + transitions
  pool.js           ← object pool
  spatial-hash.js   ← broad-phase collisions
  save.js           ← localStorage + migrations
  hud.js            ← DOM-based HUD
  debug.js          ← debug overlay (~ key)
  rng.js            ← seedable PRNG
  events.js         ← pub/sub bus
  boot.js           ← error bootstrap`}</pre>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Game Object API</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {['game.ctx', 'game.config', 'game.input', 'game.assets', 'game.tweens',
                  'game.audio', 'game.camera', 'game.scenes', 'game.hud', 'game.save',
                  'game.debug', 'game.rng', 'game.events', 'game.onSceneUpdate'].map(prop => (
                  <div key={prop} className="bg-gray-800 rounded px-3 py-1 font-mono text-green-400">{prop}</div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {['start()', 'stop()', 'destroy()', 'pause()', 'resume()', 'ready()',
                  'addParticleSystem()', 'loadSpriteSheet()', 'setShader()', 'onUpdate()',
                  'resize()', 'use(plugin)'].map(m => (
                  <div key={m} className="bg-gray-800 rounded px-3 py-1 font-mono text-yellow-400">game.{m}</div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="space-y-4">
            {examples.map(ex => (
              <div key={ex.file} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h2 className={`text-xl font-semibold mb-2 text-${ex.color}-400`}>{ex.name}</h2>
                <p className="text-gray-400 mb-3">{ex.desc}</p>
                <a
                  href={`/examples/${ex.file}`}
                  className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Open Example →
                </a>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'modules' && (
          <div className="space-y-3">
            {modules.map(m => (
              <div key={m.name} className="bg-gray-900 rounded-lg p-4 border border-gray-800 flex items-center gap-4">
                <code className="text-green-400 font-mono text-sm min-w-[140px]">{m.name}</code>
                <span className="text-gray-400 text-sm">{m.desc}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-6">
            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">createGame(config?) → Promise&lt;Game&gt;</h2>
              <div className="text-sm text-gray-300 space-y-3">
                <div>
                  <h3 className="font-mono text-yellow-400 mb-1">Config keys:</h3>
                  <div className="grid grid-cols-2 gap-1 text-gray-400">
                    {[
                      ['mode', "'2d' | '3d'"],
                      ['width / height', 'number'],
                      ['backgroundColor', 'hex number'],
                      ['mount', "selector | HTMLElement"],
                      ['input', 'action map object'],
                      ['assets', '{ manifest, baseUrl }'],
                      ['seed', 'number (RNG seed)'],
                      ['debug', 'boolean'],
                      ['initialScene', 'string'],
                      ['plugins', 'array of plugin fns'],
                      ['hud', '{ panels: {...} }'],
                      ['saveKey', 'string'],
                      ['factories', 'override factories'],
                      ['hooks', '{ onUpdate, onResize, onDestroy }'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <code className="text-gray-200">{k}</code>
                        <span className="text-gray-500">— {v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Plugin Example</h2>
              <pre className="text-sm text-gray-400 font-mono bg-gray-950 p-4 rounded-lg overflow-x-auto">{`game.use((game) => ({
  start() { console.log('Plugin started!'); },
  update(dt) { /* called each frame */ },
  destroy() { /* cleanup */ },
}));`}</pre>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Override Cheat Sheet</h2>
              <div className="text-sm text-gray-400 space-y-2">
                <p><code className="text-green-400">Scene:</code> <code>game.scenes.add(name, {'{'} init, enter, update, exit {'}'})</code></p>
                <p><code className="text-green-400">Shader:</code> <code>await game.setShader('name', materialOrConfig)</code></p>
                <p><code className="text-green-400">Camera:</code> <code>game.camera.follow(target, {'{'} lerp, deadzone {'}'})</code></p>
                <p><code className="text-green-400">HUD:</code> <code>game.hud.setText('id', 'value', {'{'} position {'}'})</code></p>
                <p><code className="text-green-400">Audio:</code> <code>await game.audio.preload('name', url); game.audio.play('name')</code></p>
                <p><code className="text-green-400">RNG:</code> <code>game.rng.range(a, b); game.rng.pick(arr)</code></p>
                <p><code className="text-green-400">Save:</code> <code>game.save.set('key', value); game.save.get('key')</code></p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'quickstart' && (
          <div className="space-y-6">
            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Quick Start</h2>
              <pre className="text-sm text-gray-400 font-mono bg-gray-950 p-4 rounded-lg overflow-x-auto">{`# From repo root:
python3 -m http.server 8000

# Open examples:
open http://localhost:8000/examples/_smoke.html
open http://localhost:8000/examples/platformer.html

# Create a new prototype:
chmod +x scripts/new-game.sh
./scripts/new-game.sh my-game

# Verify all examples:
chmod +x scripts/verify.sh
./scripts/verify.sh`}</pre>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Minimal Template</h2>
              <pre className="text-sm text-gray-400 font-mono bg-gray-950 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">{`<!DOCTYPE html>
<html>
<head>
  <script type="importmap">
  { "imports": {
    "my-engine": "../engine/index.js",
    "pixi.js": "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs",
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/",
    "gsap": "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm",
    "json5": "https://cdn.jsdelivr.net/npm/json5@2.2.3/+esm"
  }}
  </script>
</head>
<body>
  <div id="game"></div>
  <script type="module" src="../engine/boot.js"></script>
  <script type="module">
    import { createGame } from 'my-engine';
    const game = await createGame({ mode: '2d', debug: true });
    game.hud.setText('hello', 'Hello!', { position: 'top-left' });
    game.addParticleSystem({ x: 400, y: 300 });
    game.start();
  </script>
</body>
</html>`}</pre>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Pinned CDN Versions</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="pb-2">Library</th>
                    <th className="pb-2">Version</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr><td className="py-1">PixiJS</td><td>8.6.6</td></tr>
                  <tr><td className="py-1">Three.js</td><td>0.170.0</td></tr>
                  <tr><td className="py-1">GSAP</td><td>3.12.5</td></tr>
                  <tr><td className="py-1">JSON5</td><td>2.2.3</td></tr>
                </tbody>
              </table>
            </section>
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-gray-800 text-center text-gray-600 text-sm">
          my-engine v0.2.0 — zero-build game prototyping engine
        </footer>
      </div>
    </div>
  );
}

export default App;
