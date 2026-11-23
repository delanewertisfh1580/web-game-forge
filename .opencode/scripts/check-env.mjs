#!/usr/bin/env node
/**
 * check-env.mjs — validate the OpenCode v1 configuration and the SDD layout.
 *
 * Checks (no dependencies):
 *   - opencode.json parses, has $schema/default_agent, valid agent entries
 *   - {file:...} prompts and instructions paths exist
 *   - every .opencode/agents/*.md has YAML frontmatter with description + mode
 *   - .opencode/sdd.json parses and every declared path exists
 *   - agent files and sdd.json agree on the subagent roster
 *   - no service docs (AGENTS.md, rules.md, main-agent.md) pollute the agent dir
 *
 * Usage: node .opencode/scripts/check-env.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CONFIG_PATH = join(ROOT, 'opencode.json');
const SDD_PATH = join(ROOT, '.opencode/sdd.json');
const AGENTS_DIR = join(ROOT, '.opencode/agents');

const errors = [];
const notes = [];
const rel = (path) => relative(ROOT, path) || '.';

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(`${rel(path)}: ${error.message}`);
    return null;
  }
}

function checkPath(path, label, { derived = false } = {}) {
  if (existsSync(path)) return true;
  if (derived) {
    notes.push(`${label}: ${rel(path)} is generated (missing until reindex)`);
    return true;
  }
  errors.push(`${label}: missing ${rel(path)}`);
  return false;
}

function resolveFileRef(value) {
  const match = /^\{file:(.+)\}$/.exec(value);
  if (!match) return null;
  const target = match[1].trim();
  return target.startsWith('~') || target.startsWith('/') ? target : resolve(ROOT, target);
}

// --- opencode.json --------------------------------------------------------
const config = readJson(CONFIG_PATH);
if (config) {
  if (typeof config.$schema !== 'string') errors.push('opencode.json: missing $schema');
  if (typeof config.model !== 'string' && !config.model) {
    notes.push('opencode.json: no top-level model (project inherits the user default)');
  }

  const agents = config.agent && typeof config.agent === 'object' ? config.agent : null;
  if (!agents) errors.push('opencode.json: missing "agent" object');

  if (agents) {
    const entries = Object.entries(agents);
    if (entries.length === 0) errors.push('opencode.json: "agent" is empty');

    for (const [id, agent] of entries) {
      const prefix = `agent.${id}`;
      if (typeof agent !== 'object' || agent === null) {
        errors.push(`${prefix}: must be an object`);
        continue;
      }
      if (typeof agent.description !== 'string' || !agent.description.trim()) {
        errors.push(`${prefix}: "description" is required by OpenCode v1`);
      }
      if (!['primary', 'subagent', 'all'].includes(agent.mode)) {
        errors.push(`${prefix}: mode must be primary|subagent|all`);
      }
      if (agent.prompt) {
        const ref = resolveFileRef(agent.prompt);
        if (ref) {
          checkPath(ref, `${prefix}.prompt`);
        } else if (typeof agent.prompt !== 'string' || agent.prompt.trim().length < 20) {
          notes.push(`${prefix}: inline prompt is short; prefer {file:...}`);
        }
      } else {
        errors.push(`${prefix}: missing prompt (v1 would use a built-in prompt)`);
      }
      if (agent.permission && typeof agent.permission !== 'object') {
        errors.push(`${prefix}: permission must be an object`);
      }
    }

    if (!config.default_agent) {
      errors.push('opencode.json: missing default_agent');
    } else if (!agents[config.default_agent]) {
      errors.push(`opencode.json: default_agent "${config.default_agent}" is not defined in "agent"`);
    } else if (agents[config.default_agent].mode !== 'primary') {
      errors.push(`opencode.json: default_agent "${config.default_agent}" must be mode: primary`);
    }
  }

  if (config.instructions !== undefined) {
    if (!Array.isArray(config.instructions)) errors.push('opencode.json: instructions must be an array');
    else {
      for (const entry of config.instructions) {
        if (typeof entry !== 'string') {
          errors.push('opencode.json: instructions entries must be strings');
          continue;
        }
        if (entry.includes('*')) {
          notes.push(`instructions: glob "${entry}" is not expanded by this checker`);
          continue;
        }
        checkPath(resolve(ROOT, entry), 'instructions');
      }
    }
  }

  if (config.mcp && Object.keys(config.mcp).length > 0) {
    notes.push('opencode.json: mcp is non-empty (SDD environment is meant to be MCP-free)');
  }

  for (const key of Object.keys(config)) {
    if (!['$schema', 'model', 'default_agent', 'instructions', 'agent', 'permission', 'mcp', 'plugin', 'subagent_depth', 'autoupdate', 'watcher', 'share', 'compaction', 'formatter', 'tools', 'lsp', 'disabled_providers', 'experimental', 'server', 'shell', 'provider', 'small_model'].includes(key)) {
      notes.push(`opencode.json: unknown key "${key}" (ignored by OpenCode)`);
    }
  }
}

// --- .opencode/agents/*.md ------------------------------------------------
const agentFiles = existsSync(AGENTS_DIR)
  ? readdirSync(AGENTS_DIR).filter((name) => name.endsWith('.md')).sort()
  : [];
const agentIds = agentFiles.map((name) => basename(name, '.md'));

if (!existsSync(AGENTS_DIR)) errors.push('missing .opencode/agents/');
if (agentFiles.length === 0) errors.push('.opencode/agents/: no markdown agents found');

for (const name of agentFiles) {
  const path = join(AGENTS_DIR, name);
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const label = rel(path);

  if (lines[0].trim() !== '---') {
    errors.push(`${label}: missing YAML frontmatter (first line must be ---)`);
    continue;
  }
  const end = lines.indexOf('---', 1);
  if (end === -1) {
    errors.push(`${label}: unterminated frontmatter`);
    continue;
  }
  const block = lines.slice(1, end);
  const hasKey = (key) => block.some((line) => new RegExp(`^${key}:`).test(line));
  const hasValue = (key) => block.some((line) => new RegExp(`^${key}:\\s*\\S`).test(line));

  if (!hasValue('description')) errors.push(`${label}: frontmatter needs description`);
  const modeLine = block.find((line) => /^mode:/.test(line));
  if (!modeLine) errors.push(`${label}: frontmatter needs mode`);
  else if (!/^mode:\s*(primary|subagent|all)\s*$/.test(modeLine.trim())) {
    errors.push(`${label}: mode must be primary|subagent|all`);
  }
  if (!hasKey('permission')) notes.push(`${label}: no permission block (agent inherits global permissions)`);
}

for (const forbidden of ['AGENTS.md', 'rules.md', 'main-agent.md']) {
  if (existsSync(join(AGENTS_DIR, forbidden))) {
    errors.push(`.opencode/agents/${forbidden}: service doc would be loaded as an agent — move it to .opencode/prompts/ or the repo root`);
  }
}

// --- .opencode/sdd.json ---------------------------------------------------
const sdd = readJson(SDD_PATH);
if (sdd) {
  const pathEntries = [
    ['agents.dir', sdd.agents?.dir, true],
    ['docs.instructions', sdd.docs?.instructions, false],
    ['docs.rules', sdd.docs?.rules, false],
    ['docs.mainPrompt', sdd.docs?.mainPrompt, false],
    ['openspec.schema', sdd.openspec?.schema, false],
    ['openspec.validator', sdd.openspec?.validator, false],
    ['openspec.templates', sdd.openspec?.templates, true],
    ['openspec.workDir', sdd.openspec?.workDir, true],
    ['memory.file', sdd.memory?.file, false],
    ['memory.cli', sdd.memory?.cli, false],
    ['vectorIndex.module', sdd.vectorIndex?.module, false],
    ['vectorIndex.build', sdd.vectorIndex?.build, false],
    ['vectorIndex.search', sdd.vectorIndex?.search, false],
    ['vectorIndex.db', sdd.vectorIndex?.db, false],
    ['assets.fetch', sdd.assets?.fetch, false],
    ['automation.plugin', sdd.automation?.plugin, false],
  ];

  for (const [label, value, isDir] of pathEntries) {
    if (!value) {
      errors.push(`sdd.json: missing ${label}`);
      continue;
    }
    const path = resolve(ROOT, value);
    if (isDir) {
      if (!existsSync(path) || !statSync(path).isDirectory()) errors.push(`sdd.json: ${label} is not a directory: ${value}`);
    } else {
      checkPath(path, `sdd.json ${label}`, { derived: label === 'vectorIndex.db' });
    }
  }

  const declared = Array.isArray(sdd.agents?.subagents) ? [...sdd.agents.subagents].sort() : [];
  if (declared.length === 0) errors.push('sdd.json: agents.subagents is empty');
  const missing = declared.filter((id) => !agentIds.includes(id));
  const extra = agentIds.filter((id) => !declared.includes(id));
  if (missing.length) errors.push(`sdd.json: subagents without markdown file: ${missing.join(', ')}`);
  if (extra.length) errors.push(`.opencode/agents: files not listed in sdd.json: ${extra.join(', ')}`);

  const primary = sdd.agents?.primary;
  if (!primary) errors.push('sdd.json: agents.primary is required');
  else if (config?.agent && !config.agent[primary]) errors.push(`sdd.json: primary "${primary}" is not defined in opencode.json`);

  if (sdd.openspec?.schema && sdd.openspec?.validator) {
    notes.push('openspec: run node .opencode/openspec/validate.mjs to check documents');
  }
}

// --- report ---------------------------------------------------------------
for (const note of notes) console.log(`  · ${note}`);

if (errors.length) {
  console.log('');
  for (const message of errors) console.log(`  ✗ ${message}`);
  console.log(`\n${errors.length} configuration problem(s) found`);
  process.exit(1);
}

console.log(`  ✓ opencode.json (${Object.keys(config?.agent ?? {}).length} agent, v1 schema)`);
console.log(`  ✓ ${agentIds.length} subagent file(s): ${agentIds.join(', ')}`);
console.log(`  ✓ .opencode/sdd.json paths resolve`);
console.log('\nconfiguration OK');
