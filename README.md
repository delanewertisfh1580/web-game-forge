# my-engine — Game Prototyping Engine

Безсборочный движок для быстрых HTML-прототипов игр. Каждый прототип — отдельный HTML-файл, подключённый к общему движку через Import Map.

## Быстрый старт

```bash
# Запустить локальный сервер из корня репозитория
python3 -m http.server 8000

# Открыть в браузере:
# http://localhost:8000/examples/2d-particles.html
# http://localhost:8000/examples/3d-shader.html
# http://localhost:8000/examples/config-override.html
```

> ⚠️ Обязательно через HTTP-сервер (не `file://`), т.к. ES-модули и import maps требуют CORS.

## Архитектура

```
engine/          ← общий движок (переиспользуется всеми прототипами)
  index.js       ← точка входа, createGame()
  config.js      ← дефолтный конфиг
  loop.js        ← игровой цикл (fixed timestep + accumulator)
  renderer2d.js  ← PixiJS v8 обёртка
  renderer3d.js  ← Three.js обёртка
  particles.js   ← системы частиц (2D + 3D)
  sprites.js     ← загрузка спрайтов
  shaders.js     ← встроенные шейдеры (wave, dissolve)
  json5-loader.js← загрузка JSON5 с $extend
  utils/
    deep-merge.js

config/
  base.json5     ← базовый конфиг (расширяется через $extend)

examples/        ← каждый файл — самостоятельный прототип
  2d-particles.html
  3d-shader.html
  config-override.html
```

### Как это работает

1. Каждый HTML-файл содержит `<script type="importmap">`, который маппит:
   - `my-engine` → `../engine/index.js`
   - `pixi.js` → CDN (jsdelivr)
   - `three` → CDN
   - `gsap` → CDN
   - `json5` → CDN

2. Движок импортирует зависимости как bare specifiers (`import * from 'pixi.js'`), которые резолвятся через import map хостового HTML.

3. Прототип вызывает `createGame(overrides)` — передаёт только отличия от базы. Движок делает deep merge и инициализирует рендерер/цикл/частицы.

4. Анимации, частицы, спрайты, шейдеры и 3D — общие, не дублируются между прототипами.

## Публичный API

### `createGame(userConfig?)` → `Promise<Game>`

Async-функция. Создаёт и настраивает игру.

**Параметры `userConfig`:**

| Ключ | Тип | По умолчанию | Описание |
|------|-----|-------------|----------|
| `mode` | `'2d' \| '3d'` | `'2d'` | Режим рендеринга |
| `width` | `number` | `800` | Ширина canvas |
| `height` | `number` | `600` | Высота canvas |
| `backgroundColor` | `number` | `0x1a1a2e` | Цвет фона (hex) |
| `particleCapacity` | `number` | `1000` | Макс. частиц на систему |
| `mount` | `string \| HTMLElement` | `'#game'` | CSS-селектор или элемент |
| `factories` | `object` | `{}` | Подмена фабрик (см. ниже) |
| `hooks` | `object` | `{}` | Хуки: `onUpdate`, `onResize`, `onDestroy` |

**Возвращаемый объект `Game`:**

| Метод | Описание |
|-------|----------|
| `start()` | Запускает игровой цикл |
| `stop()` | Останавливает цикл |
| `destroy()` | Полная очистка ресурсов |
| `addParticleSystem(config)` | Создаёт систему частиц |
| `loadSpriteSheet(url, config)` | Загружает спрайт-лист (2D) |
| `setShader(name, material)` | Устанавливает шейдер (3D) |
| `onUpdate(fn)` | Добавляет update-хук `(ctx, dt) => void` |
| `resize(w, h)` | Изменяет размер canvas |
| `ctx` | Контекст: `{ config, renderer, scene, app, mode, camera }` |

### Фабрики (`factories`)

Подменяют стандартное поведение:

```js
createGame({
  factories: {
    renderer2d: () => new MyCustomRenderer2D(),
    renderer3d: () => new MyCustomRenderer3D(),
    particleSystem: (renderer, config) => myCustomEmitter(renderer, config),
    spriteLoader: (renderer, url, config) => myCustomLoader(renderer, url, config),
    shaderMaterial: (name, THREE) => myCustomShader(name, THREE),
  }
})
```

### Хуки (`hooks`)

```js
createGame({
  hooks: {
    onUpdate(ctx, dt) { /* каждый кадр */ },
    onResize(ctx) { /* при resize() */ },
    onDestroy(ctx) { /* при destroy() */ },
  }
})
```

### `loadJson5Config(url)` → `Promise<object>`

Загружает JSON5-конфиг. Поддерживает `$extend` для наследования:

```json5
// my-config.json5
{
  $extend: '../config/base.json5',
  width: 1024,
  backgroundColor: 0xff0000,
}
```

Цепочки `$extend` разрешаются рекурсивно. Циклы обнаруживаются и вызывают ошибку.

### Встроенные шейдеры

- **`wave`** — синусоидальное смещение вершин (океан/поверхность)
- **`dissolve`** — растворение меша с edge glow

```js
import { createShaderMaterial } from 'my-engine';
import * as THREE from 'three';

const mat = createShaderMaterial('wave', THREE);
mat.uniforms.uAmplitude.value = 0.5;
```

## Как добавить новый прототип

1. Скопируйте любой пример из `examples/` в новый файл.
2. Измените import map (обычно не нужно — он одинаковый).
3. В `<script type="module">` вызовите `createGame()` с вашими overrides.
4. Добавьте логику через хуки и API.

Минимальный шаблон:

```html
<!DOCTYPE html>
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
</html>
```

## Зафиксированные версии CDN

| Библиотека | Версия | CDN |
|-----------|--------|-----|
| PixiJS | 8.6.6 | jsdelivr |
| Three.js | 0.170.0 | jsdelivr |
| GSAP | 3.12.5 | jsdelivr |
| JSON5 | 2.2.3 | jsdelivr |

## Ограничения и допущения

- **Нет сборки.** Только нативные ES-модули + import maps. Работает в Chrome 89+, Firefox 108+, Safari 16.4+.
- **Нет TypeScript/JSX.** Чистый JavaScript.
- **Статический сервер обязателен.** `file://` не работает из-за CORS для ES-модулей.
- **Массивы не мержатся.** При deep merge массивы полностью заменяются.
- **2D-рендерер** использует PixiJS Graphics для частиц (не ParticleContainer) для простоты. Можно подменить через фабрику.
- **3D-частицы** — Points + BufferGeometry. Шейдеры для частиц не поддерживаются из коробки (можно через кастомную фабрику).
- **Один рендерер на игру.** Нельзя смешивать 2D и 3D в одном экземпляре.

## Лицензия

MIT / Public Domain — используйте как угодно.
