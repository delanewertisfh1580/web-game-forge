#!/usr/bin/env node
/**
 * index.mjs — lightweight local code index for web-game-forge.
 *
 * No dependencies, no external services, no MCP. Pure Node.js built-ins.
 *
 * Model: each file is split into overlapping line chunks. Each chunk becomes a
 * sparse TF-IDF term vector. An inverted index (term -> [chunk, weight]) is
 * stored in index.db as JSON and queried with cosine similarity.
 *
 * Usage:
 *   node index.mjs build [--roots engine,config,examples,scripts]
 *   node index.mjs query "fixed timestep accumulator" [--limit 8] [--json]
 *   node index.mjs stats
 *
 * Norm scripts live next to this file: reindex.sh (build) and search.sh (query).
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DB_PATH = join(HERE, 'index.db');

const DEFAULT_ROOTS = ['engine', 'config', 'examples', 'scripts'];
const EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.json5', '.json', '.sh', '.py']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.opencode', 'prototypes-assets']);
const CHUNK_LINES = 40;
const CHUNK_OVERLAP = 8;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'does', 'for', 'from', 'has', 'have',
  'if', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'then', 'this', 'to', 'was',
  'were', 'will', 'with', 'const', 'let', 'var', 'function', 'return', 'import', 'export', 'new',
  'class', 'extends', 'default', 'true', 'false', 'null', 'undefined', '=>', 'else', 'while', 'try',
  'catch', 'throw', 'typeof', 'instanceof', 'async', 'await', 'this', 'super', 'void', 'yield',
  'document', 'window', 'console', 'log', 'warn', 'error', 'div', 'span', 'html', 'head', 'body',
  'script', 'style', 'meta', 'http', 'https', 'www', 'com', 'org', 'net',
]);

/** Split an identifier into lowercase searchable parts (camelCase, snake_case, digits). */
function splitIdentifier(raw) {
  const parts = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((p) => p.toLowerCase())
    .filter(Boolean);
  return parts;
}

/** Tokenize source text: identifiers, camelCase/snake_case parts, numbers. */
function tokenize(text) {
  const matches = text.match(/[A-Za-z_$][A-Za-z0-9_$]*|\d+(?:\.\d+)?/g) ?? [];
  const tokens = [];
  for (const match of matches) {
    for (const part of splitIdentifier(match)) {
      if (part.length < 2 || STOPWORDS.has(part)) continue;
      // crude stemming: folds plural/gerund endings onto one term
      let term = part;
      if (term.length > 4 && term.endsWith('ies')) term = term.slice(0, -3) + 'y';
      else if (term.length > 4 && term.endsWith('ing')) term = term.slice(0, -3);
      else if (term.length > 3 && term.endsWith('ed')) term = term.slice(0, -2);
      else if (term.length > 4 && term.endsWith('es')) term = term.slice(0, -2);
      else if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) term = term.slice(0, -1);
      tokens.push(term);
    }
  }
  return tokens;
}

/** Walk a directory and return matching files, relative to ROOT. */
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (EXTENSIONS.has(extname(entry.name))) out.push(relative(ROOT, abs));
  }
  return out;
}

/** Split source into line chunks, preferring blank-line boundaries. */
function chunkFile(text, size = CHUNK_LINES, overlap = CHUNK_OVERLAP) {
  const lines = text.split(/\r?\n/);
  const chunks = [];
  let start = 0;

  while (start < lines.length) {
    let end = Math.min(lines.length, start + size);

    if (end < lines.length) {
      // prefer ending just above a blank line, not too short a chunk
      for (let i = end; i > start + 10; i--) {
        if (lines[i - 1].trim() === '') {
          end = i;
          break;
        }
      }
    }

    while (end > start + 1 && lines[end - 1].trim() === '') end--;

    const body = lines.slice(start, end).join('\n');
    if (body.trim()) chunks.push({ start: start + 1, end, text: body });
    if (end >= lines.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function build({ roots = DEFAULT_ROOTS, quiet = false } = {}) {
  const startedAt = Date.now();
  const files = [];
  for (const root of roots) {
    const abs = join(ROOT, root);
    let info;
    try {
      info = statSync(abs);
    } catch {
      if (!quiet) console.warn(`  ! skipping missing root: ${root}`);
      continue;
    }
    if (info.isFile()) files.push(relative(ROOT, abs));
    else files.push(...walk(abs));
  }

  const uniqueFiles = [...new Set(files)].sort();
  const chunks = [];
  const postings = new Map();

  for (const file of uniqueFiles) {
    let text;
    try {
      text = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      continue;
    }
    for (const chunk of chunkFile(text)) {
      const tokens = tokenize(chunk.text);
      const counts = new Map();
      for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

      chunks.push({
        path: file,
        start: chunk.start,
        end: chunk.end,
        norm: 0,
        _counts: [...counts.entries()],
      });
    }
  }

  // document frequency and IDF over chunks
  const df = new Map();
  for (const chunk of chunks) {
    for (const [term] of chunk._counts) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const total = chunks.length;
  const idf = (term) => Math.log((total + 1) / ((df.get(term) ?? 0) + 1)) + 1;

  // build weighted postings
  let termCount = 0;
  const storedChunks = [];

  for (let id = 0; id < chunks.length; id++) {
    const chunk = chunks[id];
    let sumSquares = 0;
    const weighted = [];
    for (const [term, count] of chunk._counts) {
      const weight = (1 + Math.log(count)) * idf(term);
      const rounded = round(weight);
      if (!(rounded > 0)) continue;
      weighted.push([term, rounded]);
      sumSquares += rounded * rounded;
      if (!postings.has(term)) postings.set(term, []);
      postings.get(term).push([id, rounded]);
    }
    chunk.norm = round(Math.sqrt(sumSquares)) || 1;
    storedChunks.push({ path: chunk.path, start: chunk.start, end: chunk.end, norm: chunk.norm });
    delete chunk._counts;
    delete chunk.text;
  }

  termCount = postings.size;

  const db = {
    format: 'webgame-forge-index/1',
    createdAt: new Date().toISOString(),
    root: ROOT,
    roots,
    params: { chunkLines: CHUNK_LINES, overlap: CHUNK_OVERLAP },
    files: uniqueFiles,
    chunkCount: storedChunks.length,
    termCount,
    chunks: storedChunks,
    postings: Object.fromEntries([...postings.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };

  mkdirSync(HERE, { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, DB_PATH);

  const sizeKb = Math.round((statSync(DB_PATH).size / 1024) * 10) / 10;
  const elapsed = Date.now() - startedAt;
  if (!quiet) {
    console.log('web-game-forge index rebuilt');
    console.log(`  roots:   ${roots.join(', ')}`);
    console.log(`  files:   ${db.files.length}`);
    console.log(`  chunks:  ${db.chunkCount}`);
    console.log(`  terms:   ${db.termCount}`);
    console.log(`  size:    ${sizeKb} KB`);
    console.log(`  time:    ${elapsed} ms`);
    console.log(`  db:      ${relative(ROOT, DB_PATH)}`);
  }
  return db;
}

function loadDb() {
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf8'));
  } catch {
    console.error(`No index at ${relative(ROOT, DB_PATH)}. Run: .opencode/vector-index/reindex.sh`);
    process.exit(1);
  }
}

/** Cosine-similarity search over the sparse index. */
function query(text, { limit = 8, json = false } = {}) {
  const db = loadDb();
  const tokens = [...new Set(tokenize(text))];
  if (tokens.length === 0) {
    console.error('Empty query after tokenization.');
    process.exit(1);
  }

  const scores = new Map();
  const idf = (term) => Math.log((db.chunkCount + 1) / ((db.postings[term]?.length ?? 0) + 1)) + 1;
  const matchedTerms = [];

  for (const term of tokens) {
    const entries = db.postings[term];
    if (!entries) continue;
    matchedTerms.push(term);
    const queryWeight = idf(term);
    for (const [chunkId, weight] of entries) {
      scores.set(chunkId, (scores.get(chunkId) ?? 0) + queryWeight * weight);
    }
  }

  const fileNameHits = db.files.filter((file) => tokens.some((t) => basename(file).toLowerCase().includes(t)));
  for (const [chunkId, chunk] of db.chunks.entries()) {
    if (fileNameHits.includes(chunk.path)) scores.set(chunkId, (scores.get(chunkId) ?? 0) * 1.15);
  }

  const ranked = [...scores.entries()]
    .map(([chunkId, score]) => {
      const chunk = db.chunks[chunkId];
      return { ...chunk, score: round(score / (chunk.norm || 1), 4) };
    })
    .sort((a, b) => b.score - a.score);

  // suppress near-duplicate hits caused by overlapping chunk windows
  const results = [];
  for (const candidate of ranked) {
    if (results.length >= limit) break;
    const overlaps = results.some((picked) => {
      if (picked.path !== candidate.path) return false;
      const shared = Math.min(picked.end, candidate.end) - Math.max(picked.start, candidate.start) + 1;
      const smaller = Math.min(picked.end - picked.start + 1, candidate.end - candidate.start + 1);
      return shared > 0 && shared / smaller > 0.6;
    });
    if (!overlaps) results.push(candidate);
  }

  if (json) {
    console.log(JSON.stringify({ query: text, terms: matchedTerms, results }, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(`No matches for "${text}".`);
    return;
  }

  console.log(`Matches for "${text}" (terms: ${matchedTerms.join(', ')}):\n`);
  for (const [i, result] of results.entries()) {
    console.log(`${i + 1}. ${result.path}:${result.start}-${result.end}  score=${result.score}`);
    const snippet = readSnippet(result.path, result.start, result.end, matchedTerms);
    if (snippet) console.log(`   ${snippet}`);
  }
}

function readSnippet(file, start, end, terms) {
  let lines;
  try {
    lines = readFileSync(join(ROOT, file), 'utf8').split(/\r?\n/);
  } catch {
    return '';
  }
  const slice = lines.slice(start - 1, Math.min(end, start + 35));
  const best =
    slice.find((line) => terms.some((term) => line.toLowerCase().includes(term))) ??
    slice.find((line) => line.trim()) ??
    '';
  return best.trim().slice(0, 160);
}

function stats() {
  const db = loadDb();
  const byRoot = {};
  for (const file of db.files) {
    const root = file.split('/')[0];
    byRoot[root] = (byRoot[root] ?? 0) + 1;
  }
  console.log(`index: ${relative(ROOT, DB_PATH)}`);
  console.log(`created: ${db.createdAt}`);
  console.log(`files: ${db.files.length}  chunks: ${db.chunkCount}  terms: ${db.termCount}`);
  console.log(`roots: ${db.roots.join(', ')}`);
  for (const [root, count] of Object.entries(byRoot)) console.log(`  ${root}: ${count} files`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--roots') args.roots = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--limit') args.limit = Number(argv[++i] ?? 8);
    else if (arg === '--json') args.json = true;
    else if (arg === '--quiet' || arg === '-q') args.quiet = true;
    else args._.push(arg);
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const command = args._.shift() ?? 'stats';

  if (command === 'build') {
    build({ roots: args.roots ?? DEFAULT_ROOTS, quiet: args.quiet });
  } else if (command === 'query' || command === 'search') {
    const text = args._.join(' ');
    if (!text.trim()) {
      console.error('Usage: node index.mjs query "terms" [--limit 8] [--json]');
      process.exit(1);
    }
    query(text, { limit: args.limit ?? 8, json: args.json });
  } else if (command === 'stats') {
    stats();
  } else {
    console.error('Usage: node index.mjs <build|query|stats> [options]');
    process.exit(1);
  }
}
