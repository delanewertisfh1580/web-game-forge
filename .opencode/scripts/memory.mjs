#!/usr/bin/env node
/**
 * memory.mjs — agent memory for web-game-forge.
 *
 * One local JSON file, no database, no network. Writes are atomic
 * (write temp + rename) so an interrupted session cannot corrupt memory.
 *
 * Structure (.opencode/memory.json):
 *   project       — stable description of the repository
 *   context       — current task, open questions, next steps
 *   longTermFacts — durable facts worth reloading every session
 *   decisions     — architectural decisions with context/consequences
 *   sessions      — append-only history (last 50 kept)
 *
 * Usage:
 *   node memory.mjs init
 *   node memory.mjs start --task "SPEC-001: add camera easing"
 *   node memory.mjs end --summary "implemented easing" --file engine/camera2d.js --follow-up "add smoke test"
 *   node memory.mjs end --auto
 *   node memory.mjs fact "Arrays are replaced, not merged" --source engine/utils/deep-merge.js
 *   node memory.mjs decision --title "..." --decision "..." --context "..." --consequences "..."
 *   node memory.mjs show [--sessions 5]
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const MEMORY_PATH = join(ROOT, '.opencode/memory.json');
const MAX_SESSIONS = 50;

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10).replace(/-/g, '');

function emptyMemory() {
  return {
    version: 1,
    updatedAt: now(),
    project: { name: 'web-game-forge', root: '.' },
    context: { currentTask: null, openQuestions: [], nextSteps: [] },
    longTermFacts: [],
    decisions: [],
    sessions: [],
  };
}

function normalize(memory) {
  const base = emptyMemory();
  const merged = { ...base, ...memory };
  merged.project = { ...base.project, ...(memory.project ?? {}) };
  merged.context = { ...base.context, ...(memory.context ?? {}) };
  for (const key of ['longTermFacts', 'decisions', 'sessions']) {
    if (!Array.isArray(merged[key])) merged[key] = [];
  }
  return merged;
}

function read() {
  if (!existsSync(MEMORY_PATH)) {
    console.warn('memory.json not found — creating a fresh one.');
    return normalize({});
  }
  try {
    return normalize(JSON.parse(readFileSync(MEMORY_PATH, 'utf8')));
  } catch (error) {
    console.error(`Cannot parse ${relative(ROOT, MEMORY_PATH)}:`, error.message);
    process.exit(1);
  }
}

function write(memory) {
  memory.updatedAt = now();
  const tmp = `${MEMORY_PATH}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(memory, null, 2)}\n`);
  renameSync(tmp, MEMORY_PATH);
}

function nextId(items, prefix) {
  const numbers = items
    .map((item) => Number(String(item.id ?? '').replace(`${prefix}-`, '')))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

function nextSessionId(memory) {
  const prefix = `S-${today()}`;
  const count = memory.sessions.filter((s) => String(s.id).startsWith(prefix)).length;
  return `${prefix}-${String(count + 1).padStart(2, '0')}`;
}

function openSession(memory) {
  const open = memory.sessions.find((s) => !s.endedAt);
  if (open) return open;
  const session = {
    id: nextSessionId(memory),
    agent: 'main',
    startedAt: now(),
    endedAt: null,
    summary: '',
    changedFiles: [],
    decisions: [],
    followUps: [],
  };
  memory.sessions.unshift(session);
  return session;
}

function parseArgs(argv) {
  const args = { _: [], file: [], 'follow-up': [], decision: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const nextValue = argv[i + 1];
    if (nextValue === undefined || nextValue.startsWith('--')) {
      args[key] = true;
      continue;
    }
    i++;
    if (['file', 'follow-up', 'decision', 'question'].includes(key)) {
      (args[key] ??= []).push(nextValue);
    } else {
      args[key] = nextValue;
    }
  }
  return args;
}

function collectGitChanges() {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.slice(2).trim())
      .filter((file) => file && !file.startsWith('node_modules') && !file.startsWith('.opencode/vector-index/index.db'));
  } catch {
    return [];
  }
}

function show(memory, sessionsLimit = 5) {
  const facts = memory.longTermFacts.length;
  const decisions = memory.decisions.length;
  console.log(`memory: ${relative(ROOT, MEMORY_PATH)}`);
  console.log(`updated: ${memory.updatedAt}`);
  console.log(`facts: ${facts}  decisions: ${decisions}  sessions: ${memory.sessions.length}`);
  console.log(`current task: ${memory.context.currentTask ?? '(none)'}`);
  if (memory.context.nextSteps?.length) {
    console.log('next steps:');
    for (const step of memory.context.nextSteps) console.log(`  - ${step}`);
  }
  if (memory.sessions.length) {
    console.log(`\nlast ${Math.min(sessionsLimit, memory.sessions.length)} sessions:`);
    for (const session of memory.sessions.slice(0, sessionsLimit)) {
      const state = session.endedAt ? 'closed' : 'OPEN';
      console.log(`  [${state}] ${session.id} ${session.agent} — ${session.summary || '(no summary)'}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._.shift() ?? 'show';
  const memory = read();

  switch (command) {
    case 'init': {
      write(memory);
      console.log(`initialized ${relative(ROOT, MEMORY_PATH)}`);
      break;
    }

    case 'start': {
      const task = args.task ? String(args.task) : undefined;
      const session = openSession(memory);
      if (args.agent) session.agent = String(args.agent);
      if (task) {
        session.task = task;
        memory.context.currentTask = task;
      }
      write(memory);
      console.log(`session ${session.id} started${task ? `: ${task}` : ''}`);
      break;
    }

    case 'end': {
      const session = openSession(memory);
      session.endedAt = now();
      if (args.agent) session.agent = String(args.agent);
      session.summary = args.summary ? String(args.summary) : session.summary || 'session closed without summary';
      if (args.auto) {
        const changed = collectGitChanges();
        session.changedFiles = [...new Set([...(session.changedFiles ?? []), ...changed])];
        if (!args.summary) session.summary = `auto: ${changed.length} changed file(s)`;
      }
      session.changedFiles = [...new Set([...(session.changedFiles ?? []), ...(args.file ?? [])])];
      session.followUps = [...new Set([...(session.followUps ?? []), ...(args['follow-up'] ?? [])])];
      session.decisions = [...new Set([...(session.decisions ?? []), ...(args.decision ?? [])])];
      if (session.followUps.length) memory.context.nextSteps = session.followUps;
      memory.context.currentTask = null;
      memory.sessions = memory.sessions.slice(0, MAX_SESSIONS);
      write(memory);
      console.log(`session ${session.id} closed: ${session.summary}`);
      break;
    }

    case 'fact': {
      const fact = args._.join(' ') || (args.fact ? String(args.fact) : '');
      if (!fact) {
        console.error('Usage: node memory.mjs fact "text" [--source path]');
        process.exit(1);
      }
      const entry = {
        id: nextId(memory.longTermFacts, 'F'),
        fact,
        source: args.source ? String(args.source) : 'agent',
        addedAt: now(),
      };
      memory.longTermFacts.push(entry);
      write(memory);
      console.log(`added ${entry.id}: ${fact}`);
      break;
    }

    case 'decision': {
      if (!args.title || !args.decision) {
        console.error('Usage: node memory.mjs decision --title "..." --decision "..." [--context ...] [--consequences ...]');
        process.exit(1);
      }
      const entry = {
        id: nextId(memory.decisions, 'D'),
        date: now(),
        title: String(args.title),
        context: args.context ? String(args.context) : '',
        decision: String(args.decision),
        consequences: args.consequences ? String(args.consequences) : '',
        spec: args.spec ? String(args.spec) : undefined,
      };
      memory.decisions.push(entry);
      const session = memory.sessions.find((s) => !s.endedAt);
      if (session) session.decisions = [...new Set([...(session.decisions ?? []), entry.id])];
      write(memory);
      console.log(`added ${entry.id}: ${entry.title}`);
      break;
    }

    case 'question': {
      const question = args._.join(' ');
      if (!question) process.exit(1);
      memory.context.openQuestions.push(question);
      write(memory);
      console.log(`open question recorded: ${question}`);
      break;
    }

    case 'show':
    case 'stats': {
      show(memory, Number(args.sessions ?? 5));
      break;
    }

    default:
      console.error('Usage: node memory.mjs <init|start|end|fact|decision|question|show> [options]');
      process.exit(1);
  }
}

main();
