#!/usr/bin/env bash
# verify.sh — verify all examples and prototypes load correctly.
# Usage: ./scripts/verify.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# Find a free port
PORT=8765
while true; do
  if ! lsof -i :$PORT > /dev/null 2>&1; then
    break
  fi
  PORT=$((PORT + 1))
done

echo "Starting static server on port $PORT..."
python3 -m http.server $PORT &
SERVER_PID=$!
sleep 1

cleanup() {
  echo "Stopping server..."
  kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

PASS=0
FAIL=0
ERRORS=""

check_url() {
  local url="$1"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  if [ "$status" = "200" ]; then
    echo "  ✓ $url ($status)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $url ($status)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $url returned $status"
  fi
}

echo ""
echo "=== Checking examples ==="
for f in examples/*.html; do
  if [ -f "$f" ]; then
    check_url "http://localhost:$PORT/$f"
  fi
done

echo ""
echo "=== Checking prototypes ==="
found_protos=0
for f in prototypes/*/index.html; do
  if [ -f "$f" ]; then
    found_protos=1
    check_url "http://localhost:$PORT/$f"
  fi
done
if [ "$found_protos" = "0" ]; then
  echo "  (no prototypes found)"
fi

echo ""
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failures:$ERRORS"
fi

# Check if playwright is available for deeper testing
echo ""
if command -v npx &> /dev/null; then
  if npx playwright --version > /dev/null 2>&1; then
    echo "Playwright detected — would run browser tests (not implemented in this script)."
  else
    echo "Playwright not installed. For deeper testing:"
    echo "  npx -y playwright install chromium"
    echo "  Then re-run this script."
  fi
else
  echo "npx not found. Open examples/_smoke.html manually in a browser."
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "✓ All checks passed!"
  exit 0
else
  echo "✗ Some checks failed."
  exit 1
fi
