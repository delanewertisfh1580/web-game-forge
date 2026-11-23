#!/usr/bin/env node
/**
 * validate.mjs — validate OpenSpec documents against schema.json.
 *
 * Dependency-free validator covering the JSON Schema subset used by our
 * schema: $ref (local), oneOf, const, enum, type, required, properties,
 * additionalProperties, items, minItems, minLength, pattern, format(date-time).
 *
 * Usage:
 *   node validate.mjs                     # templates/ + work/
 *   node validate.mjs path/to/spec.json   # explicit files
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SCHEMA_PATH = join(HERE, 'schema.json');
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(expected, value) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => {
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'object') return typeOf(value) === 'object';
    return typeOf(value) === type;
  });
}

function resolveRef(ref) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((node, key) => node?.[key], schema);
}

function validateNode(node, value, path, errors) {
  if (!node || typeof node !== 'object') return;

  if (node.$ref) {
    validateNode(resolveRef(node.$ref), value, path, errors);
    return;
  }

  if (node.const !== undefined && value !== node.const) {
    errors.push(`${path}: expected ${JSON.stringify(node.const)}, got ${JSON.stringify(value)}`);
  }

  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${path}: expected one of ${JSON.stringify(node.enum)}, got ${JSON.stringify(value)}`);
  }

  if (node.type && !matchesType(node.type, value)) {
    errors.push(`${path}: expected type ${JSON.stringify(node.type)}, got ${typeOf(value)}`);
    return;
  }

  if (typeof value === 'string') {
    if (node.minLength !== undefined && value.length < node.minLength) {
      errors.push(`${path}: shorter than ${node.minLength} characters`);
    }
    if (node.pattern && !new RegExp(node.pattern).test(value)) {
      errors.push(`${path}: does not match ${node.pattern}`);
    }
    if (node.format === 'date-time' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
      errors.push(`${path}: expected ISO 8601 date-time ending in Z`);
    }
  }

  if (typeof value === 'number' && node.minimum !== undefined && value < node.minimum) {
    errors.push(`${path}: less than minimum ${node.minimum}`);
  }

  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) {
      errors.push(`${path}: needs at least ${node.minItems} item(s)`);
    }
    if (node.items) value.forEach((item, i) => validateNode(node.items, item, `${path}[${i}]`, errors));
  }

  if (typeOf(value) === 'object') {
    for (const key of node.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required property "${key}"`);
    }
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      if (key in value) validateNode(child, value[key], `${path}.${key}`, errors);
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(node.properties ?? {})[key]) errors.push(`${path}: unexpected property "${key}"`);
      }
    }
  }

  if (node.oneOf) {
    const branchErrors = node.oneOf.map((branch) => {
      const branchPath = [];
      validateNode(branch, value, path, branchPath);
      return branchPath;
    });
    const valid = branchErrors.filter((list) => list.length === 0).length;
    if (valid !== 1) {
      if (valid === 0) {
        const shortest = branchErrors.sort((a, b) => a.length - b.length)[0] ?? [];
        errors.push(`${path}: does not match any OpenSpec document kind`);
        for (const message of shortest.slice(0, 3)) errors.push(`  ${message}`);
      } else {
        errors.push(`${path}: ambiguous document (matches ${valid} kinds)`);
      }
    }
  }
}

function collectJson(target, out = []) {
  if (!existsSync(target)) return out;
  const info = statSync(target);
  if (info.isFile()) {
    if (target.endsWith('.json')) out.push(target);
    return out;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'schema.json') continue;
    collectJson(join(target, entry.name), out);
  }
  return out;
}

const cliTargets = process.argv.slice(2);
const targets = cliTargets.length
  ? cliTargets.map((target) => resolve(process.cwd(), target))
  : [join(HERE, 'templates'), join(HERE, 'work')].flatMap((dir) => collectJson(dir));

if (targets.length === 0) {
  console.log('No OpenSpec documents found.');
  console.log('Create one from a template:');
  console.log('  cp .opencode/openspec/templates/spec.json .opencode/openspec/work/SPEC-001.json');
  process.exit(0);
}

let failed = 0;
for (const file of targets) {
  const display = relative(ROOT, file) || file;
  const errors = [];
  let document;
  try {
    document = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.log(`✗ ${display}: invalid JSON — ${error.message}`);
    failed++;
    continue;
  }
  validateNode(schema, document, '$', errors);
  if (errors.length === 0) {
    console.log(`✓ ${display} (${document.kind}${document.id ? ` ${document.id}` : ''})`);
  } else {
    failed++;
    console.log(`✗ ${display}`);
    for (const message of errors) console.log(`    ${message}`);
  }
}

console.log(`\n${targets.length - failed}/${targets.length} document(s) valid`);
process.exit(failed === 0 ? 0 : 1);
