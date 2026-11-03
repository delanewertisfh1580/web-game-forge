import { useState } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🎮 my-engine</h1>
          <p className="text-gray-400 text-lg">
            Zero-build game prototyping engine — HTML + ES Modules + Import Maps
          </p>
        </header>

        <nav className="flex gap-2 mb-6 border-b border-gray-800 pb-4">
          {['overview', 'examples', 'api', 'quickstart'].map(tab => (
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
              </p>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Architecture</h2>
              <pre className="text-sm text-gray-400 font-mono leading-relaxed">{`engine/
  index.js          ← createGame() + re-exports
  config.js         ← default config
  loop.js           ← game loop (fixed timestep)
  renderer2d.js     ← PixiJS v8 wrapper
  renderer3d.js     ← Three.js wrapper
  particles.js      ← 2D + 3D particle systems
  sprites.js        ← sprite loading helpers
  shaders.js        ← built-in shaders (wave, dissolve)
  json5-loader.js   ← JSON5 with $extend inheritance
  utils/deep-merge.js

config/
  base.json5        ← base config (extend via $extend)

examples/
  2d-particles.html
  3d-shader.html
  config-override.html`}</pre>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Pinned CDN Versions</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="pb-2">Library</th>
                    <th className="pb-2">Version</th>
                    <th className="pb-2">CDN</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr><td className="py-1">PixiJS</td><td>8.6.6</td><td>jsdelivr</td></tr>
                  <tr><td className="py-1">Three.js</td><td>0.170.0</td><td>jsdelivr</td></tr>
                  <tr><td className="py-1">GSAP</td><td>3.12.5</td><td>jsdelivr</td></tr>
                  <tr><td className="py-1">JSON5</td><td>2.2.3</td><td>jsdelivr</td></tr>
                </tbody>
              </table>
            </section>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-2 text-green-400">2D Particles</h2>
              <p className="text-gray-400 mb-3">Fire-like particles flowing upward + sparkles. PixiJS 8.</p>
              <a
                href="/examples/2d-particles.html"
                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Open Example →
              </a>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-2 text-blue-400">3D Shader</h2>
              <p className="text-gray-400 mb-3">Wave shader on plane + dissolve icosahedron + 3D particles. Three.js.</p>
              <a
                href="/examples/3d-shader.html"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Open Example →
              </a>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-2 text-purple-400">Config Override</h2>
              <p className="text-gray-400 mb-3">Loads base.json5, overrides deltas. Shows JSON5 inheritance + deep merge.</p>
              <a
                href="/examples/config-override.html"
                className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Open Example →
              </a>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-6">
            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">createGame(userConfig?) → Promise&lt;Game&gt;</h2>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <h3 className="font-mono text-yellow-400 mb-1">Config options:</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li><code className="text-gray-200">mode</code> — '2d' | '3d' (default: '2d')</li>
                    <li><code className="text-gray-200">width</code>, <code className="text-gray-200">height</code> — canvas size</li>
                    <li><code className="text-gray-200">backgroundColor</code> — hex color</li>
                    <li><code className="text-gray-200">mount</code> — CSS selector or HTMLElement</li>
                    <li><code className="text-gray-200">factories</code> — override particleSystem, spriteLoader, etc.</li>
                    <li><code className="text-gray-200">hooks</code> — onUpdate, onResize, onDestroy</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-mono text-yellow-400 mb-1">Game methods:</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li><code className="text-gray-200">start()</code> / <code className="text-gray-200">stop()</code> / <code className="text-gray-200">destroy()</code></li>
                    <li><code className="text-gray-200">addParticleSystem(config)</code></li>
                    <li><code className="text-gray-200">loadSpriteSheet(url, config)</code> — 2D only</li>
                    <li><code className="text-gray-200">setShader(name, material)</code> — 3D only</li>
                    <li><code className="text-gray-200">onUpdate(fn)</code></li>
                    <li><code className="text-gray-200">resize(w, h)</code></li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">loadJson5Config(url)</h2>
              <p className="text-gray-400 text-sm">
                Loads JSON5 with <code className="text-gray-200">$extend</code> inheritance. Detects cycles.
                Deep-merges parent and child configs.
              </p>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Built-in Shaders</h2>
              <div className="space-y-2 text-sm text-gray-400">
                <p><code className="text-green-400">wave</code> — sinusoidal vertex displacement</p>
                <p><code className="text-green-400">dissolve</code> — noise-based dissolve with edge glow</p>
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

# Open in browser:
open http://localhost:8000/examples/2d-particles.html`}</pre>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Minimal Template</h2>
              <pre className="text-sm text-gray-400 font-mono bg-gray-950 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">{`<!DOCTYPE html>
<html>
<head>
  <script type="importmap">
  {
    "imports": {
      "my-engine": "../engine/index.js",
      "pixi.js": "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs",
      "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/",
      "gsap": "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm",
      "json5": "https://cdn.jsdelivr.net/npm/json5@2.2.3/+esm"
    }
  }
  </script>
</head>
<body>
  <div id="game"></div>
  <script type="module">
    import { createGame } from 'my-engine';
    const game = await createGame({ mode: '2d', width: 800, height: 600 });
    game.addParticleSystem({ x: 400, y: 300, emitRate: 50 });
    game.start();
  </script>
</body>
</html>`}</pre>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400">Requirements</h2>
              <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                <li>Modern browser (Chrome 89+, Firefox 108+, Safari 16.4+)</li>
                <li>Static HTTP server (not file://)</li>
                <li>No npm, no build step, no node_modules</li>
              </ul>
            </section>
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-gray-800 text-center text-gray-600 text-sm">
          my-engine — zero-build game prototyping engine
        </footer>
      </div>
    </div>
  );
}

export default App;
