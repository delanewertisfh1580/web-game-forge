#!/usr/bin/env bash
# new-game.sh — scaffold a new prototype.
# Usage: ./scripts/new-game.sh <name> [--force]

set -e

NAME="${1:?Usage: ./scripts/new-game.sh <name> [--force]}"
FORCE="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="$ROOT_DIR/prototypes/$NAME"
TEMPLATE="$ROOT_DIR/templates/prototype.html"

if [ ! -f "$TEMPLATE" ]; then
  echo "Error: template not found at $TEMPLATE"
  exit 1
fi

if [ -d "$PROTO_DIR" ] && [ "$FORCE" != "--force" ]; then
  echo "Error: prototypes/$NAME already exists. Use --force to overwrite."
  exit 1
fi

mkdir -p "$PROTO_DIR"

# Create index.html from template
sed "s/__GAME_NAME__/$NAME/g" "$TEMPLATE" > "$PROTO_DIR/index.html"

# Create config.json5
cat > "$PROTO_DIR/config.json5" << 'EOF'
// Config for __NAME__ prototype.
{
  $extend: '../../config/base.json5',

  // Override only what you need:
  // width: 1024,
  // height: 768,
  // backgroundColor: 0x222244,
}
EOF
sed -i "s/__NAME__/$NAME/g" "$PROTO_DIR/config.json5"

echo "✓ Created prototypes/$NAME/"
echo "  - index.html"
echo "  - config.json5"
echo ""
echo "Run: python3 -m http.server 8000"
echo "Open: http://localhost:8000/prototypes/$NAME/"
