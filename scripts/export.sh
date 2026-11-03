#!/usr/bin/env bash
# export.sh — export an example/prototype to a single self-contained HTML file.
# Usage: ./scripts/export.sh <name>
# Where <name> is an example (e.g. animation, platformer) or a prototype name.
#
# Output: dist/<name>.html
#
# Approach:
# 1. Find the source HTML file
# 2. Extract the import map
# 3. Concatenate all engine/*.js files in topological order
# 4. Replace "my-engine" import with a data: URI containing the bundled engine
# 5. Keep CDN imports as-is (pixi.js, three, etc.)

set -e

NAME="${1:?Usage: ./scripts/export.sh <name>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# Find source HTML
if [ -f "examples/$NAME.html" ]; then
  SRC="examples/$NAME.html"
elif [ -f "prototypes/$NAME/index.html" ]; then
  SRC="prototypes/$NAME/index.html"
else
  echo "Error: Cannot find examples/$NAME.html or prototypes/$NAME/index.html"
  exit 1
fi

echo "📦 Exporting $SRC → dist/$NAME.html"

# Create dist directory
mkdir -p dist

# Topological sort of engine files based on imports
# Simple approach: just concatenate in a reasonable order
# engine/index.js imports everything else, so it must be last
# We'll build a dependency order

ORDER=(
  "engine/utils/deep-merge.js"
  "engine/config.js"
  "engine/loop.js"
  "engine/events.js"
  "engine/rng.js"
  "engine/pool.js"
  "engine/spatial-hash.js"
  "engine/save.js"
  "engine/tween.js"
  "engine/input.js"
  "engine/audio.js"
  "engine/assets.js"
  "engine/camera2d.js"
  "engine/camera3d.js"
  "engine/scenes.js"
  "engine/hud.js"
  "engine/debug.js"
  "engine/animation.js"
  "engine/sprites.js"
  "engine/particles.js"
  "engine/shaders.js"
  "engine/json5-loader.js"
  "engine/renderer2d.js"
  "engine/renderer3d.js"
  "engine/dev-client.js"
  "engine/boot.js"
  "engine/index.js"
)

# Build the bundled engine code
BUNDLE=""
for f in "${ORDER[@]}"; do
  if [ ! -f "$f" ]; then
    echo "Warning: $f not found, skipping"
    continue
  fi
  
  # Read file content
  CONTENT=$(cat "$f")
  
  # Remove import statements for local files (they'll be in the same bundle)
  # Keep imports for bare specifiers (pixi.js, three, json5, gsap)
  CONTENT=$(echo "$CONTENT" | sed -E "s|^import .* from '\./.*';$||g")
  CONTENT=$(echo "$CONTENT" | sed -E "s|^import \{.*\} from '\./.*';$||g")
  CONTENT=$(echo "$CONTENT" | sed -E "s|^import '\./.*';$||g")
  
  # Remove export statements but keep the code
  CONTENT=$(echo "$CONTENT" | sed -E "s|^export (function|class|const|let|var) |\\1 |g")
  CONTENT=$(echo "$CONTENT" | sed -E "s|^export \{.*\} from '.*';$||g")
  CONTENT=$(echo "$CONTENT" | sed -E "s|^export default ||g")
  
  BUNDLE="$BUNDLE
// === $f ===
$CONTENT
"
done

# Encode bundle as base64 for data URI
BUNDLE_B64=$(echo "$BUNDLE" | base64 -w 0)

# Create the output HTML
# Strategy: replace the import map's "my-engine" entry with a data: URI
# and inline the boot.js import

# Read source HTML
HTML=$(cat "$SRC")

# Replace import map entry for my-engine
HTML=$(echo "$HTML" | sed "s|\"my-engine\": \"../engine/index.js\"|\"my-engine\": \"data:text/javascript;base64,$BUNDLE_B64\"|g")
HTML=$(echo "$HTML" | sed "s|\"my-engine/boot\": \"../engine/boot.js\"|\"my-engine/boot\": \"data:text/javascript;base64,$BUNDLE_B64\"|g")

# Replace script src for boot.js with inline
HTML=$(echo "$HTML" | sed 's|<script type="module" src="../engine/boot.js"></script>||g')

# Write output
echo "$HTML" > "dist/$NAME.html"

echo "✓ Exported to dist/$NAME.html"
echo ""
echo "Open with: open dist/$NAME.html"
echo "(Works via file:// — no server needed)"
