# my-engine — Game Prototyping Engine

Безсборочный движок для быстрых HTML-прототипов игр. Каждый прототип — отдельный HTML-файл, подключённый к общему движку через Import Map.

**v0.3.0** — 23 модуля, 7 примеров, 12 regression fixes, animation module.

## Быстрый старт

```bash
# Запустить локальный сервер из корня репозитория
python3 -m http.server 8000

# Открыть в браузере:
# http://localhost:8000/examples/_smoke.html       ← smoke-тест всех модулей
# http://localhost:8000/examples/2d-particles.html  ← PixiJS частицы
# http://localhost:8000/examples/3d-shader.html     ← Three.js шейдеры
# http://localhost:8000/examples/platformer.html    ← мини-платформер
# http://localhost:8000/examples/twin-stick.html    ← twin-stick shooter
# http://localhost:8000/examples/3d-orbit.html      ← 3D orbit shooter
# http://localhost:8000/examples/config-override.html ← JSON5 $extend

# Создать новый прототип:
chmod +x scripts/new-game.sh
./scripts/new-game.sh my-game

# Проверить что всё работает:
chmod +x scripts/verify.sh
./scripts/verify.sh
```

> ⚠️ Обязательно через HTTP-сервер (не `file://`), т.к. ES-модули и import maps требуют CORS.

## Аудит и исправления

### Что было сломано (v0.1.0) и починено:
1. **`renderer2d.js:52`** — `texture.baseTexture` не существует в PixiJS v8. Исправлено на проверку `texture.animations`.
2. **`renderer2d.js:151`** — `app.destroy(true, { children: true })` — в v8 другая сигнатура. Обёрнуто в try/catch.
3. **`particles.js`** — лишний реэкспорт Renderer2D/Renderer3D (убран).

Все изменения зафиксированы в [CHANGELOG.md](./CHANGELOG.md).

## Архитектура

```
engine/               ← общий движок (переиспользуется всеми прототипами)
  index.js            ← createGame() + все реэкспорты
  config.js           ← DEFAULT_CONFIG
  loop.js             ← GameLoop (fixed timestep + accumulator)
  renderer2d.js       ← Renderer2D (PixiJS v8)
  renderer3d.js       ← Renderer3D (Three.js)
  particles.js        ← 2D + 3D particle emitters
  sprites.js          ← sprite helpers
  shaders.js          ← built-in: wave, dissolve
  json5-loader.js     ← JSON5 с $extend
  input.js            ← keyboard/mouse/touch + action map
  assets.js           ← manifest loader + cache
  tween.js            ← tween engine + 15 easings
  audio.js            ← WebAudio wrapper
  camera2d.js         ← follow/clamp/shake/zoom
  camera3d.js         ← orbit/follow camera
  scenes.js           ← scene manager + transitions
  pool.js             ← object pool
  spatial-hash.js     ← broad-phase collisions
  save.js             ← localStorage + migrations
  hud.js              ← DOM-based HUD
  debug.js            ← debug overlay (~ key)
  rng.js              ← seedable PRNG
  events.js           ← pub/sub bus
  boot.js             ← error bootstrap
  utils/deep-merge.js

config/
  base.json5          ← базовый конфиг
  override.json5      ← пример $extend

examples/             ← каждый файл — самостоятельный прототип
  _smoke.html         ← smoke-тест всех модулей
  2d-particles.html
  3d-shader.html
  config-override.html
  platformer.html     ← мини-платформер
  twin-stick.html     ← twin-stick shooter
  3d-orbit.html       ← 3D orbit + shooting

scripts/
  new-game.sh         ← создать новый прототип
  verify.sh           ← проверить что всё работает

templates/
  prototype.html      ← шаблон для new-game.sh
```

## Публичный API

### `createGame(userConfig?)` → `Promise<Game>`

Async-функция. Создаёт и настраивает игру со всеми подсистемами.

**Конфиг:**

| Ключ | Тип | По умолчанию | Описание |
|------|-----|-------------|----------|
| `mode` | `'2d' \| '3d'` | `'2d'` | Режим рендеринга |
| `width` | `number` | `800` | Ширина canvas |
| `height` | `number` | `600` | Высота canvas |
| `backgroundColor` | `number` | `0x1a1a2e` | Цвет фона (hex) |
| `mount` | `string \| HTMLElement` | `'#game'` | CSS-селектор или элемент |
| `input` | `object` | `{}` | Action map: `{ jump: ['Space'], fire: ['Mouse0'] }` |
| `assets` | `object` | `{}` | `{ manifest: { tex: [...], audio: [...] }, baseUrl }` |
| `seed` | `number` | `Date.now()` | Seed для RNG |
| `debug` | `boolean` | `false` | Показать debug overlay |
| `initialScene` | `string` | — | Имя начальной сцены |
| `plugins` | `function[]` | `[]` | Массив плагинов |
| `hud` | `object` | `{}` | `{ panels: { id: { position, rows } } }` |
| `saveKey` | `string` | `'default'` | Ключ для localStorage |
| `factories` | `object` | `{}` | Подмена фабрик |
| `hooks` | `object` | `{}` | `{ onUpdate, onResize, onDestroy }` |

**Объект Game:**

| Свойство/Метод | Описание |
|----------------|----------|
| `game.ctx` | Контекст: `{ config, renderer, scene, app, mode, camera }` |
| `game.config` | Мержёный конфиг |
| `game.input` | Input manager |
| `game.assets` | Asset manager |
| `game.tweens` | Tween manager |
| `game.audio` | Audio manager |
| `game.camera` | Camera (2D или 3D) |
| `game.scenes` | Scene manager |
| `game.hud` | HUD manager |
| `game.save` | Save manager |
| `game.debug` | Debug overlay |
| `game.rng` | Seeded RNG |
| `game.events` | Event bus |
| `game.scene` | Convenience proxy для текущей сцены |
| `game.isPaused` | `boolean` |
| `game.start()` | Запуск |
| `game.stop()` | Остановка |
| `game.destroy()` | Полная очистка |
| `game.pause()` | Пауза |
| `game.resume()` | Возобновление |
| `game.ready()` | Promise, резолвится при готовности |
| `game.addParticleSystem(config)` | Добавить частицы |
| `game.loadSpriteSheet(url, config)` | Загрузить спрайт (2D) |
| `game.setShader(name, material)` | Установить шейдер (3D) |
| `game.onUpdate(fn)` | Добавить update-хук |
| `game.resize(w, h)` | Изменить размер |
| `game.use(pluginFn)` | Зарегистрировать плагин |

### Подсистемы

#### `game.input`
```js
game.input.isDown('jump')      // удерживается?
game.input.isPressed('jump')   // нажато в этом кадре?
game.input.isReleased('jump')  // отпущено?
game.input.axis('move')        // { x, y } от WASD/стрелок
game.input.mouse               // { x, y, buttons }
game.input.touches             // массив тачей
game.input.on('fire', cb)      // callback на нажатие
```

#### `game.tweens`
```js
const tw = game.tweens.to(obj, { x: 100 }, {
  duration: 0.5,
  ease: 'easeOutQuad',  // или функция
  yoyo: true,
  repeat: 3,            // или Infinity
  delay: 0.2,
  onUpdate: (obj, t) => {},
  onComplete: (obj) => {},
});
game.tweens.kill(tw);
game.tweens.killAll();
```

Easing: `linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInOutQuart`, `easeInElastic`, `easeOutElastic`, `easeInBack`, `easeOutBack`, `easeOutBounce`.

#### `game.audio`
```js
await game.audio.preload('jump', 'sfx/jump.ogg');
game.audio.play('jump', { loop: false, volume: 0.8, rate: 1 });
game.audio.stop('jump');
game.audio.stopAll();
game.audio.setVolume(0.5);
game.audio.setMuted(true);
game.audio.toggleMute();
```

#### `game.camera` (2D)
```js
game.camera.follow(target, { lerp: 0.1, deadzone: 20 });
game.camera.clamp({ x: 0, y: 0, w: 2000, h: 1000 });
game.camera.shake(0.3, 5);
game.camera.zoomTo(2, 0.5);
```

#### `game.camera` (3D)
```js
game.camera.orbit({ target: { x:0, y:0, z:0 } });
game.camera.follow(mesh);
game.camera.shake(0.3, 0.2);
```

#### `game.scenes`
```js
game.scenes.add('menu', {
  init() {},
  enter(data) {},
  update(dt) {},
  exit() {},
  destroy() {},
});
await game.scenes.go('play', { transition: 'fade', duration: 0.4, data: {} });
game.scenes.current;  // имя текущей сцены
```

#### `game.hud`
```js
game.hud.setText('score', 'Score: 0', { position: 'top-left' });
game.hud.button('restart', () => resetGame(), { position: 'top-right' });
game.hud.panel('stats', { position: 'bottom-left', rows: [...] });
game.hud.updatePanelRow('stats', 'FPS', 60);
game.hud.removeText('score');
game.hud.clear();
```

#### `game.rng`
```js
game.rng.random()        // [0, 1)
game.rng.range(5, 10)    // [5, 10)
game.rng.int(1, 6)       // [1, 6]
game.rng.chance(0.3)     // true с вероятностью 30%
game.rng.pick([1,2,3])   // случайный элемент
game.rng.shuffle(arr)    // Fisher-Yates
game.rng.gaussian(0, 1)  // нормальное распределение
```

#### `game.events`
```js
const unsub = game.events.on('coin:pickup', (data) => {});
game.events.emit('coin:pickup', { value: 10 });
game.events.once('game:over', () => {});
unsub();  // отписаться
```

#### `game.save`
```js
game.save.set('highscore', 1000);
game.save.get('highscore', 0);  // с дефолтом
game.save.has('highscore');
game.save.reset();
```

#### `game.debug`
- Нажать `~` (Backquote) для toggle
- Показывает: FPS, frame time, particles, tweens, mode, scene, paused

### Плагины
```js
game.use((game) => ({
  start() { /* вызывается при game.use() */ },
  update(dt) { /* каждый кадр */ },
  destroy() { /* при game.destroy() */ },
}));
```

## Как добавить новый прототип

```bash
./scripts/new-game.sh my-game
# Создаст prototypes/my-game/index.html + config.json5
```

Или вручную — скопируйте любой пример, поменяйте overrides.

Минимальный шаблон:

```html
<!DOCTYPE html>
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
</html>
```

## Зафиксированные версии CDN

| Библиотека | Версия | CDN |
|-----------|--------|-----|
| PixiJS | 8.6.6 | jsdelivr |
| Three.js | 0.170.0 | jsdelivr |
| GSAP | 3.12.5 | jsdelivr |
| JSON5 | 2.2.3 | jsdelivr |

## Аудит и регрессионные фиксы (v0.3.0)

Все 13 подтверждённых багов исправлены и покрыты тестами в `examples/_smoke.html`:

| # | Файл | Проблема | Фикс |
|---|------|----------|------|
| 1 | index.js | start()/resume() дублировали хуки | Флаг `_hooksInstalled`, `_installHooks()` |
| 2 | index.js | game.ready() висел до start() | Резолвится в конце createGame |
| 3 | camera3d.js | crash в orbit({minR,maxR}) | `const` → `let`, passive:false |
| 4 | hud.js | transform не сбрасывался | `el.style.transform = ''` |
| 5 | hud.js | cssText копился | Пересборка из base + opts.style |
| 6 | platformer.html | pause без resume | Локальный `scenePaused` флаг |
| 7 | 3d-orbit.html | утечка particle systems | `autoDestroyAfter` опция |
| 8 | index.js | game.scene.update накапливал обёртки | `game.onSceneUpdate(fn)` |
| 9 | debug.js | pause/resume не работали | Реальный game ref, отдельный RAF |
| 10 | renderer3d.js | per-particle size не работал | ShaderMaterial с aSize/aAlpha |
| 11 | assets.js | loadTexture тянул pixi.js | `engine: 'pixi'|'three'|'image'|'auto'` |
| 12 | index.js | ctx.camera не документирован | Комментарий + README |
| 13 | _smoke.html | не покрывал новые тесты | +12 regression tests |

## Новые API (v0.3.0)

### `game.onSceneUpdate(fn)`
Регистрирует callback, вызываемый каждый кадр после `scenes.update(dt)`.
```js
game.onSceneUpdate((dt) => {
  // вызывается после текущей сцены
});
```

### `game.addParticleSystem(config, { autoDestroyAfter })`
Добавляет частицы с автоудалением через N секунд:
```js
game.addParticleSystem({ capacity: 50, ... }, { autoDestroyAfter: 1.5 });
```

### `game.emitterCount`
Количество активных particle emitters.

### `createAnimator(sprite)` — engine/animation.js
Спрайтовая анимация:
```js
const anim = createAnimator(sprite);
anim.add('idle', { frames: [tex0, tex1], fps: 8, loop: true });
anim.add('jump', { frames: [tex2, tex3], fps: 12, loop: false, onEnd: () => anim.play('idle') });
anim.play('idle');
anim.update(dt); // из main-tick
```

### `createStateMachine(initial, states)` — engine/animation.js
Конечный автомат:
```js
const fsm = createStateMachine('idle', {
  idle: { enter() {}, update(dt) {}, exit() {} },
  run:  { enter() {}, update(dt) {}, exit() {} },
});
fsm.go('run');
fsm.update(dt);
```

### Debug overlay (v0.3.0)
- `~` — toggle overlay
- `P` — pause/resume (когда overlay виден)
- Показывает FPS даже при паузе (независимый RAF)
- Показывает emitter count

### ctx.camera vs game.camera (3D)
- `game.ctx.camera` — сырой `THREE.PerspectiveCamera`
- `game.camera` — обёртка `createCamera3D` с orbit/follow/shake

## Ограничения и допущения

- **Нет сборки.** Только нативные ES-модули + import maps. Chrome 89+, Firefox 108+, Safari 16.4+.
- **Нет TypeScript/JSX.** Чистый JavaScript.
- **Статический сервер обязателен.** `file://` не работает из-за CORS.
- **Массивы не мержатся.** При deep merge массивы полностью заменяются.
- **2D-рендерер** использует PixiJS Graphics для частиц (не ParticleContainer).
- **3D-частицы** — Points + BufferGeometry.
- **Один рендерер на игру.** Нельзя смешивать 2D и 3D.
- **AudioContext** разблокируется по первому user gesture (pointerdown/keydown/touchstart).
- **localStorage** — синхронный, может быть недоступен в private browsing.

## Ручная проверка

1. `python3 -m http.server 8000`
2. Открыть `http://localhost:8000/examples/_smoke.html` — все тесты должны быть зелёными
3. Открыть каждый example — должен видеть анимацию/сцену без красных баннеров
4. Нажать `~` в любом примере — должен появиться debug overlay
5. `./scripts/verify.sh` — должен пройти все HTTP-проверки

## Лицензия

MIT / Public Domain — используйте как угодно.
