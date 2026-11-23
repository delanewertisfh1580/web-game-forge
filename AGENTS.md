# web-game-forge — команда агентов

Этот файл — карта агентской среды. Конфиг OpenCode v1 — `opencode.json` в корне;
он подключает этот файл как инструкции, промт главного агента и правила ниже.
Прочитай его первым, затем `.opencode/prompts/rules.md` (конвенции) и
`.opencode/prompts/main-agent.md` (рабочий цикл).

## Раскладка и что реально читает OpenCode

```text
opencode.json                     # конфиг v1: default_agent, agent, permission, mcp
AGENTS.md                         # инструкции (авто-обнаружение)
.opencode/
  prompts/rules.md                # инструкции из opencode.json → instructions
  prompts/main-agent.md           # prompt главного агента ({file:...})
  agents/<role>.md                # субагенты: frontmatter + системный промт
  plugins/sdd-reindex.js          # file.edited → пересборка индекса
  memory.json  openspec/  vector-index/  scripts/  sdd.json
```

- OpenCode v1 читает `opencode.json` в корне, `AGENTS.md` и файлы из
  `.opencode/agents/` и `.opencode/plugins/`. Каталог `.opencode/prompts/` —
  просто файлы, на которые ссылаются `instructions` и `prompt`.
- Права субагентов заданы в YAML-frontmatter их markdown-файлов: это источник
  истины для OpenCode. Таблица ниже — сводка для человека; при расхождении
  правь frontmatter.
- `opencode.json` валидируется схемой OpenCode. Не добавляй туда свои ключи
  (`hooks`, `sdd`, `vectorIndex`) — они игнорируются. Метаданные среды лежат в
  `.opencode/sdd.json`.
- Хуков в конфиге v1 нет. Автоматизация — только плагин; память закрывает
  main-агент командой `memory.mjs end`.

## Проект в одном абзаце

`web-game-forge` (в коде — `my-engine`) — безсборочный движок для HTML-прототипов
игр на нативных ES-модулях. Каждый прототип — отдельный HTML-файл, который
подключает `engine/index.js` через `importmap` (`"my-engine"`). 23 модуля в
`engine/`, JSON5-конфиги с `$extend`, 2D на PixiJS v8.6.6, 3D на Three.js 0.170.0,
CDN-версии зафиксированы, сборки нет, TypeScript в движке нет.

> `src/`, корневой `index.html` и React-зависимости в `package.json` — это
> песочница Freebuff, а не движок. Их не трогаем.

## Принцип: OpenSpec — единственный язык передачи задач

Никаких устных договорённостей между агентами. Любая нетривиальная работа
описывается JSON-документом OpenSpec в `.opencode/openspec/work/`:

| kind | Назначение | Кто создаёт | Обяз. поля (кратко) |
|------|------------|-------------|---------------------|
| `spec` | Что и зачем делаем | `main` | requirements, affectedPaths, verification |
| `contract` | Передача работы между агентами | `main` / автор | from, to, deliverables, invariants |
| `report` | Что реально сделано и чем проверено | исполнитель | changes, verification, memoryUpdated |
| `dod` | Критерии приёмки задачи | `main` | items[] с evidence, checks[] |

Схема: `.opencode/openspec/schema.json` (JSON Schema 2020-12).
Валидатор: `node .opencode/openspec/validate.mjs`.
Шаблоны: `.opencode/openspec/templates/{spec,contract,report,dod}.json`.

Создание задачи:

```bash
cp .opencode/openspec/templates/spec.json .opencode/openspec/work/SPEC-001.json
cp .opencode/openspec/templates/dod.json  .opencode/openspec/work/DOD-001.json
# затем замени id (=SPEC-001 / DOD-001), title и заполни requirements
node .opencode/openspec/validate.mjs
```

## Состав команды

### `main` (primary, `opencode.json` → `.opencode/prompts/main-agent.md`)
Оркестратор. Принимает запрос, читает память и индекс, пишет spec/contract/dod,
делегирует работу, проверяет отчёты, обновляет `CHANGELOG.md`, память и
пересобирает индекс. Единственный, кто пишет `.opencode/**` (кроме
`openspec/work/**`), `README.md`, `CHANGELOG.md`.

### `engine-core` (`.opencode/agents/engine-core.md`)
Владелец рантайма `engine/**`. Отвечает за API `createGame()`, подсистемы, цикл,
рендереры, частицы, твины, ввод, сцены, HUD, сохранения. Не трогает конфиги
(`engine/config.js`, `engine/json5-loader.js` — зона `config-data`), примеры,
тесты и скрипты. Новые зависимости не добавляет.

### `prototype-dev` (`.opencode/agents/prototype-dev.md`)
Собирает прототипы и примеры: `examples/**` (кроме `_smoke.html`),
`templates/**`, `prototypes/**`. Пишет только игровую логику и разметку поверх
публичного API. Если движка не хватает — оформляет запрос контрактом, а не
патчит `engine/`.

### `config-data` (`.opencode/agents/config-data.md`)
Владелец данных и конфигурации: `config/**`, `engine/config.js`
(`DEFAULT_CONFIG`), `engine/json5-loader.js`, `prototypes/*/config.json5`.
Следит за `$extend`, семантикой `deepMerge` (массивы заменяются), балансом
частиц/шейдеров и обратной совместимостью дефолтов.

### `qa-regression` (`.opencode/agents/qa-regression.md`)
Владелец качества: `examples/_smoke.html` и `scripts/verify.sh`. Пишет
регрессионные проверки, воспроизводит баги, но не правит движок — сообщает о
дефектах через spec/report. Ослаблять проверки запрещено.

### `tooling-release` (`.opencode/agents/tooling-release.md`)
Инструменты и поставка: `scripts/**` (кроме `verify.sh`), `templates/**`
(шаблон прототипа), корневой `index.html`, `.opencode/scripts/**`. Отвечает за
`dev.sh`, `export.sh`, `new-game.sh`, `fetch-assets.sh`, `setup.sh`, `dist/`.

## Матрица прав

`✍` — можно писать, `👁` — только читать, `—` — нет доступа.

| Путь | main | engine-core | prototype-dev | config-data | qa-regression | tooling-release |
|------|:----:|:-----------:|:-------------:|:-----------:|:-------------:|:---------------:|
| `engine/**` (кроме двух файлов ниже) | ✍ | ✍ | 👁 | 👁 | 👁 | 👁 |
| `engine/config.js`, `engine/json5-loader.js` | ✍ | 👁 | 👁 | ✍ | 👁 | 👁 |
| `config/**` | ✍ | 👁 | 👁 | ✍ | 👁 | 👁 |
| `examples/**` (кроме `_smoke.html`) | ✍ | 👁 | ✍ | 👁 | 👁 | 👁 |
| `examples/_smoke.html` | ✍ | 👁 | 👁 | 👁 | ✍ | 👁 |
| `templates/**` | ✍ | 👁 | ✍ | 👁 | 👁 | ✍ |
| `prototypes/**` (кроме `config.json5`) | ✍ | 👁 | ✍ | 👁 | 👁 | 👁 |
| `prototypes/*/config.json5` | ✍ | 👁 | 👁 | ✍ | 👁 | 👁 |
| `scripts/**` (кроме `verify.sh`) | ✍ | 👁 | 👁 | 👁 | 👁 | ✍ |
| `scripts/verify.sh` | ✍ | 👁 | 👁 | 👁 | ✍ | 👁 |
| `index.html` (корень) | ✍ | 👁 | 👁 | 👁 | 👁 | ✍ |
| `.opencode/openspec/work/**` | ✍ | ✍ | ✍ | ✍ | ✍ | ✍ |
| `.opencode/**` (остальное) | ✍ | 👁 | 👁 | 👁 | 👁 | 👁 |
| `README.md`, `CHANGELOG.md` | ✍ | 👁 | 👁 | 👁 | 👁 | 👁 |
| `src/**`, React-часть `package.json` | 👁 | — | — | — | — | — |
| `node_modules/**` | — | — | — | — | — | — |

Правило конфликта: если задаче нужны два владельца — это два spec и один
`contract` с явными `deliverables`, а не правка чужой зоны.

## Конвейер

```
запрос
  │
  ├─ main: memory show + search.sh  → контекст
  ├─ main: SPEC-NNN.json (requirements + verification) + DOD-NNN.json
  ├─ main: CONTRACT-NNN.json на каждого исполнителя
  │
  ├─ sub-agent: читает spec+contract → работает в своей зоне
  │             → REPORT-NNN.json + DoD evidence
  │
  ├─ qa-regression: verify.sh + _smoke.html (если менялся рантайм)
  ├─ main: проверяет отчёт против DoD, принимает/возвращает
  └─ main: memory end --auto + решает, нужен ли CHANGELOG/README
           reindex.sh после структурных изменений
```

Минимальный путь для тривиальной правки (опечатка, одна строка в примере) —
без spec: сразу правка + `node --check` / `verify.sh` + запись в память. Всё,
что меняет публичный API, конфиг-схему, сборку или больше одного файла —
только через spec.

## Команды среды

```bash
# контекст
bash .opencode/vector-index/reindex.sh                 # пересобрать индекс
bash .opencode/vector-index/search.sh "camera shake"   # поиск по коду
node .opencode/scripts/memory.mjs show                 # память

# проверка
node --check engine/<file>.js                          # синтаксис одного модуля
bash scripts/verify.sh                                 # HTTP 200 для всех примеров
node .opencode/openspec/validate.mjs                   # документы OpenSpec
node .opencode/scripts/check-env.mjs                   # конфиг, агенты, пути SDD

# ассеты (без MCP)
bash .opencode/scripts/fetch-assets.sh https://example.com/sprite.png assets/tex/sprite.png
bash .opencode/scripts/fetch-assets.sh --manifest assets.manifest

# инициализация среды
bash .opencode/scripts/setup.sh
```

## Запрещено всей команде

- MCP-серверы любого вида; сетевые вызовы, кроме `fetch-assets.sh` по явному URL.
- Новые npm-зависимости, бандлеры, TypeScript/JSX в `engine/`.
- Плавающие версии CDN; менять `importmap`-пины без spec.
- Правка `src/**`, `node_modules/**`, `.env*`, `.git/**`.
- `git push`, `git reset --hard`, `git clean -fd` без явной просьбы пользователя.
- Изменение проверок ради «зелёного» результата.
- Самодельные ключи в `opencode.json` (`hooks`, `sdd`, …): схема v1 их не знает.
