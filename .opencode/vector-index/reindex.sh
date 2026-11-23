#!/usr/bin/env bash
# reindex.sh — rebuild the local code index for web-game-forge.
#
# Covers engine/, config/, examples/, scripts/ (plus any --roots override).
# No dependencies beyond Node.js — no embeddings service, no MCP, no network.
#
# Usage:
#   .opencode/vector-index/reindex.sh
#   .opencode/vector-index/reindex.sh --roots engine,examples
#   .opencode/vector-index/reindex.sh --quiet
#
# Runs automatically on file edits when the agent runner supports the
# `file.edited` hook declared in .opencode/config.json.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

cd "$ROOT"

if ! command -v node > /dev/null 2>&1; then
  echo "error: node is required for the vector index" >&2
  exit 1
fi

exec node ".opencode/vector-index/index.mjs" build "$@"
