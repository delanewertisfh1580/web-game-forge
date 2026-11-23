# Правила и конвенции web-game-forge

Обязательны для всех агентов. При конфликте с разовым указанием пользователя
уточни у пользователя; при конфликте между агентами побеждает spec + contract.

## 1. SDD-дисциплина

1. **Spec до кода.** Нетривиальная задача (>1 файла, публичный API, конфиг-схема,
   скрипты, тесты) начинается с `openspec/work/SPEC-NNN.json`.
2. **Требования наблюдаемы.** Формулируй «система должна …», а не «добавить
   функцию X». Каждое требование получает `R1…Rn` и попадает в verification.
3. **Один агент — один spec.** Не смешивай в одном spec несвязанные зоны.
4. **Контракт на стыке.** Передача работы другому агенту фиксируется
   `CONTRACT-NNN.json`: пути, интерфейсы, инварианты, что вне зоны.
5. **Отчёт с доказательствами.** `REPORT-NNN.json` содержит реальные команды и
   их результат (`pass`/`fail`/`skipped`). Пропущенная проверка — не «pass».
6. **DoD закрывает main.** Пункты `DOD-NNN.json` с `required: true` должны иметь
   evidence; иначе задача возвращается исполнителю.
7. **Отклонение фиксируется.** Если сделано не по spec — раздел `deviations`,
   а не тихое изменение требований.

## 2. Безсборочность и зависимости

- Движок — нативные ES-модули. Сборки, транспиляции, бандлера нет.
- Импорты только с расширением: `import { x } from './x.js'`; пакеты — через
  `importmap` (`pixi.js`, `three`, `three/addons/`, `gsap`, `json5`).
- Версии CDN зафиксированы: PixiJS `8.6.6`, Three `0.170.0`, GSAP `3.12.5`,
  JSON5 `2.2.3`. Менять — только по spec и с обновлением README-таблицы.
- Новые зависимости запрещены. Если кажется, что нужна библиотека — сначала
  проверь, есть ли решение в `engine/` (tween, spatial-hash, pool, rng).
- `engine/assets.js` — единственная точка загрузки ассетов; `PIXI.Assets`,
  `THREE.TextureLoader`, `GLTFLoader` подключаются динамически.
- TypeScript, JSX, декораторы в `engine/` не используются. JSDoc — используется.

## 3. Стиль кода

Повторяй существующий стиль (`engine/*.js`):

- 2 пробела, одинарные кавычки, точки с запятой, trailing comma не форсируется.
- Фабрики: `export function createX(options = {}) { … return { … }; }`
  (`createInputManager`, `createSceneManager`). Классы — только инфраструктура
  (`Renderer2D`, `Renderer3D`, `GameLoop`, `SpatialHash`).
- Приватные поля — префикс `_` (`_accumulator`, `_hooksInstalled`).
- Комментарии-заголовки модулей в формате:
  ```js
  /**
   * loop.js — fixed timestep game loop.
   * @module loop
   */
  ```
- JSDoc для публичных функций: `@param`, `@returns`.
- Ошибки — через `new Error('[ComponentName] message')`.
- Не оставляй `console.log` в рантайме (кроме `debug.js` и осознанных
  `console.warn` при восстановимых сбоях).
- Публичный API добавляется в `engine/index.js` (re-export) и в README-таблицу.

## 4. Особенности движка, на которых легко ошибиться

**PixiJS v8**
- `const app = new PIXI.Application(); await app.init({...})` — не конструктор с opts.
- У спрайт-листа анимации лежат в `texture.animations`; `texture.baseTexture`
  в v8 нет.
- `app.destroy(true, { children: true })` — сигнатура v8, вызов обёрнут в try/catch.
- 2D-частицы рисуются через `PIXI.Graphics`/`Container`, не через
  `ParticleContainer` (осознанное решение).

**Three.js r170**
- Импорт addons — только `three/addons/...` (пин в importmap).
- `THREE` грузится динамически (`await import('three')`), чтобы 2D-прототипы не
  тянули 3D-бандл.
- 3D-частицы — `Points` + `BufferGeometry`; размер/альфа — через
  `ShaderMaterial` (`aSize`/`aAlpha`).
- `game.ctx.camera` — сырой `THREE.PerspectiveCamera`; `game.camera` — обёртка
  (`orbit`/`follow`/`shake`). Не путать в примерах.

**Цикл и подписки**
- Fixed timestep + accumulator в `engine/loop.js`; `maxAccumulator` защищает от
  «спирали смерти».
- Хуки ставятся один раз (`_hooksInstalled`). Не вызывай `_installHooks()`
  вручную.
- `game.ready()` резолвится в конце `createGame()`, не в `start()`.
- Всё, что создаётся, освобождается в `game.destroy()`; эмиттеры с
  `autoDestroyAfter` удаляются сами.

**Данные**
- `deepMerge` заменяет массивы целиком, не мержит.
- JSON5-конфиги наследуются через `$extend`; кэш сбрасывается
  `clearConfigCache()`.
- `localStorage` может быть недоступен (private mode) — `save.js` это учитывает.
- `AudioContext` разблокируется по первому user gesture.

## 5. Прототипы и примеры

- Один прототип = отдельный HTML-файл; `#game` — точка монтирования по
  умолчанию.
- `importmap` копируется из `templates/prototype.html`, пути относительные
  (`../engine/index.js` для `examples/`, `../../engine/` для
  `prototypes/<name>/`).
- Открывать только по HTTP: `bash scripts/dev.sh` или
  `python3 -m http.server 8000`. `file://` не работает.
- Всегда: `window.addEventListener('beforeunload', () => game.destroy())`.
- Пауза: не путай `game.pause()` (останавливает цикл, ввод тоже) с локальным
  флагом паузы, когда нужен активный ввод/рендер.
- Мусор (эмиттеры, твины, таймеры) удаляется по завершении; для частиц —
  `autoDestroyAfter`.
- Новый прототип создаётся `bash scripts/new-game.sh <name>` (не копипастой).

## 6. Лестница проверки

Выполняй минимально достаточное, снизу вверх:

1. `node --check <file>` — синтаксис каждого изменённого `.js`.
2. `bash scripts/verify.sh` — все `examples/*.html` и `prototypes/*/index.html`
   отдают HTTP 200 (скрипт сам поднимает сервер).
3. `examples/_smoke.html` — зелёный smoke-набор после изменений рантайма
   (проверяет `qa-regression`; упомяни в отчёте, если не открывал браузер).
4. Ручная проверка в браузере — когда меняется визуальное/интерактивное
   поведение. Без неё не утверждай, что «выглядит правильно».
5. `node .opencode/openspec/validate.mjs` — перед сдачей документов OpenSpec.

Нельзя: удалять проверки, ослаблять assert, глотать ошибки, подменять реальный
запуск «рассуждением о том, что должно работать».

## 7. Документация и история

- `CHANGELOG.md` ведёт `main`: секция `[Unreleased]`, нумерованные записи в
  стиле существующих bug-fix-блоков (что было сломано → как исправлено).
- README обновляется при изменении публичного API, конфиг-ключей, скриптов,
  версий CDN.
- Комментарии в коде — по делу, на английском (как в `engine/`); общение агентов
  и коммит-сообщения — на русском или английском, но единообразно внутри задачи.

## 8. Память и индекс

- Начало сессии: `node .opencode/scripts/memory.mjs show`.
- Перед правкой незнакомого места: `bash .opencode/vector-index/search.sh "<термины>"`.
- После структурных изменений (`engine/`, `config/`, `examples/`, `scripts/`):
  `bash .opencode/vector-index/reindex.sh --quiet`. Плагин
  `.opencode/plugins/sdd-reindex.js` пересобирает индекс автоматически на
  `file.edited` (с дебаунсом), но ручной прогон перед сдачей всё равно обязателен.
- Конец задачи: `node .opencode/scripts/memory.mjs end --auto`. В OpenCode v1 нет
  события конца сессии, поэтому это явный шаг main-агента, а не хук. Плюс при
  необходимости:
  ```bash
  node .opencode/scripts/memory.mjs fact "…" --source path/to/file
  node .opencode/scripts/memory.mjs decision --title "…" --decision "…"
  ```
- В память попадают только durable-факты и решения. Не записывай туда прогресс
  по строкам, секреты, URL с токенами.

## 9. Ассеты без MCP

- Скачивание: `.opencode/scripts/fetch-assets.sh` (curl, allow-list расширений,
  `--force`, `--sha256`, `--manifest`).
- Хранение: `assets/tex/`, `assets/audio/`, `assets/models/` (в `.gitignore`).
- Runtime: `game.assets.load({ tex: [...], audio: [...] })` или
  `game.loadSpriteSheet()`; аудио — `game.audio.preload()`.
- Никаких MCP-серверов, генераторов изображений и внешних API на этапе игры.

## 10. Git

- Не коммить и не пушить без просьбы. Не переписывай историю.
- Не смешивай в одной правке несвязанные зоны.
- `dist/`, `node_modules/`, `index.db`, `assets/` — не в коммит.

## 11. Общий Definition of Done

Задача закрыта, только если всё ниже верно:

- [ ] Все `must`-требования spec реализованы и имеют evidence.
- [ ] Изменены только пути из зоны прав агента (см. матрицу в `AGENTS.md`).
- [ ] `node --check` для изменённых `.js`; `scripts/verify.sh` проходит, если
      затронуты примеры/движок/конфиги.
- [ ] Ничего не сломано в существующих примерах: поведение по умолчанию
      сохранено или breaking change описан в spec и README.
- [ ] Нет новых зависимостей, MCP, сборки, `console.log`-мусора.
- [ ] `REPORT-NNN.json` заполнен, `memoryUpdated: true` (или объяснено, почему
      память не менялась), документы проходят `validate.mjs`.
- [ ] Индекс пересобран после структурных изменений.
- [ ] Итоговое сообщение пользователю: что сделано, чем проверено, что не
      проверено и какие ограничения остались.
