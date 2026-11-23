#!/usr/bin/env bash
# setup.sh — initialize the web-game-forge agent environment.
#
# Idempotent: safe to run after pulling changes or on a fresh checkout.
# Checks tooling, fixes exec bits, validates OpenSpec documents, initializes
# agent memory and builds the local code index.
#
# Usage:
#   bash .opencode/scripts/setup.sh
#   bash .opencode/scripts/setup.sh --no-index
#
# Requirements: node >= 18, bash, curl. python3 is needed by scripts/verify.sh
# and scripts/dev.sh; git is optional (used for auto session summaries).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

BUILD_INDEX=1
for arg in "$@"; do
  case "$arg" in
    --no-index) BUILD_INDEX=0 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

cd "$ROOT_DIR"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

bold "web-game-forge · SDD environment setup"
echo

bold "1. Toolchain"
if command -v node > /dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" -ge 18 ]; then
    ok "node $(node --version) (index + memory + openspec validator)"
  else
    bad "node $(node --version) — version 18+ required"
    exit 1
  fi
else
  bad "node not found — required for index, memory and validator"
  exit 1
fi

command -v bash > /dev/null 2>&1 && ok "bash $(bash --version | head -1 | awk '{print $4}')" || warn "bash not found (scripts require bash)"
command -v curl > /dev/null 2>&1 && ok "curl (fetch-assets.sh)" || warn "curl not found — asset fetching will not work"
command -v python3 > /dev/null 2>&1 && ok "python3 (scripts/dev.sh, scripts/verify.sh)" || warn "python3 not found — verify.sh and dev.sh will not run"
command -v git > /dev/null 2>&1 && ok "git (session auto-summary)" || warn "git not found — memory.mjs end --auto falls back to empty change list"

echo
bold "2. Directories"
mkdir -p .opencode/vector-index .opencode/openspec/work .opencode/openspec/templates .opencode/agents/sub-agents .opencode/scripts assets
ok "engine/, config/, examples/, scripts/ present"
ok ".opencode/{vector-index,openspec/work,openspec/templates,agents/sub-agents,scripts}"
ok "assets/ (downloaded runtime assets, gitignored)"

echo
bold "3. Executable bits"
chmod +x \
  .opencode/vector-index/reindex.sh \
  .opencode/vector-index/search.sh \
  .opencode/vector-index/index.mjs \
  .opencode/scripts/fetch-assets.sh \
  .opencode/scripts/setup.sh \
  .opencode/scripts/memory.mjs \
  .opencode/openspec/validate.mjs
ok "SDD entry points are executable"
if [ ! -x scripts/verify.sh ]; then
  warn "project scripts are not executable — call them via bash (bash scripts/verify.sh) or chmod +x scripts/*.sh yourself"
fi

echo
bold "4. Agent memory"
if [ -f .opencode/memory.json ]; then
  node .opencode/scripts/memory.mjs init > /dev/null
  ok "memory.json present ($(node -p 'JSON.parse(require("fs").readFileSync(".opencode/memory.json","utf8")).longTermFacts.length') facts)"
else
  node .opencode/scripts/memory.mjs init > /dev/null
  warn "memory.json was missing — created an empty one"
fi

echo
bold "5. OpenSpec documents"
if node .opencode/openspec/validate.mjs; then
  ok "schema and templates are consistent"
else
  bad "OpenSpec validation failed — fix documents in .opencode/openspec/"
  exit 1
fi

echo
if [ "$BUILD_INDEX" -eq 1 ]; then
  bold "6. Code index"
  bash .opencode/vector-index/reindex.sh
  ok "query with: .opencode/vector-index/search.sh \"<terms>\""
else
  bold "6. Code index"
  warn "skipped (--no-index)"
fi

echo
bold "Ready."
cat << 'EOF'

Typical loop:
  node .opencode/scripts/memory.mjs show
  .opencode/vector-index/search.sh "camera shake"
  cp .opencode/openspec/templates/spec.json .opencode/openspec/work/SPEC-001.json
  node .opencode/openspec/validate.mjs
  bash scripts/verify.sh
  node .opencode/scripts/memory.mjs end --auto

Agents: .opencode/agents/AGENTS.md
Rules:  .opencode/agents/rules.md
EOF
