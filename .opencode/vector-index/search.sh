#!/usr/bin/env bash
# search.sh — query the local code index.
#
# Usage:
#   .opencode/vector-index/search.sh "fixed timestep accumulator"
#   .opencode/vector-index/search.sh "json5 extend" --limit 5 --json
#
# Output: ranked file:line-range hits with the best matching line as a snippet.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

if [ ! -f "$DIR/index.db" ]; then
  echo "index.db not found — building it first..." >&2
  "$DIR/reindex.sh" --quiet >&2
fi

cd "$ROOT"
exec node ".opencode/vector-index/index.mjs" query "$@"
