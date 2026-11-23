#!/usr/bin/env bash
# fetch-assets.sh — download game assets over HTTP(S). No MCP, no services.
#
# Assets are plain files on disk; the engine loads them at runtime through
# engine/assets.js (PIXI.Assets / THREE.TextureLoader / GLTFLoader).
#
# Usage:
#   .opencode/scripts/fetch-assets.sh <url> [dest]
#   .opencode/scripts/fetch-assets.sh --manifest assets.manifest [--out assets]
#
# Options:
#   --manifest FILE   read "url [dest]" lines (blank lines and # comments ok)
#   --out DIR         destination root for relative paths (default: assets)
#   --force           overwrite existing files (default: skip)
#   --sha256 HASH     verify the downloaded file (single-URL mode)
#   --dry-run         print the plan, download nothing
#   -h, --help        this help
#
# Examples:
#   .opencode/scripts/fetch-assets.sh https://example.com/tiles.png assets/tex/tiles.png
#   .opencode/scripts/fetch-assets.sh --manifest assets.manifest --out assets
#
# Manifest example (assets.manifest):
#   # textures
#   https://example.com/hero.png          tex/hero.png
#   https://example.com/jump.ogg          audio/jump.ogg
#   https://example.com/coin.glb          models/coin.glb
#
# Runtime usage after download:
#   const game = await createGame({ assets: { manifest: { tex: ['assets/tex/hero.png'] } } });

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

ALLOWED_EXTS=" png jpg jpeg webp gif avif svg mp3 ogg oga wav m4a flac opus json json5 glb gltf fbx obj bin ttf otf woff woff2 css txt "

OUT_DIR="assets"
FORCE=0
DRY_RUN=0
MANIFEST=""
EXPECTED_SHA=""

usage() {
  sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
}

log() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --manifest) MANIFEST="${2:?--manifest needs a file}"; shift 2 ;;
    --out) OUT_DIR="${2:?--out needs a directory}"; shift 2 ;;
    --sha256) EXPECTED_SHA="${2:?--sha256 needs a hash}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; break ;;
    -*) die "unknown option: $1 (see --help)" ;;
    *) break ;;
  esac
done

command -v curl > /dev/null 2>&1 || die "curl is required"

URL=""
DEST=""
if [ -n "$MANIFEST" ]; then
  [ -f "$MANIFEST" ] || die "manifest not found: $MANIFEST"
  [ $# -eq 0 ] || die "pass either --manifest or URL arguments, not both"
elif [ $# -ge 1 ]; then
  URL="$1"
  DEST="${2:-}"
  [ $# -le 2 ] || die "too many arguments (see --help)"
else
  usage
  exit 1
fi

mkdir -p "$OUT_DIR"
OUT_ABS="$(cd "$OUT_DIR" && pwd)"

check_url() {
  local url="$1"
  case "$url" in
    http://*|https://*) ;;
    *) die "refusing non-HTTP URL: $url" ;;
  esac
}

check_extension() {
  local url="$1"
  local path="${url%%[?#]*}"
  local name="${path##*/}"
  local ext="${name##*.}"
  ext="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
  [ "$ext" != "$name" ] || die "cannot determine file extension for: $url"
  case "$ALLOWED_EXTS" in
    *" $ext "*) ;;
    *) die "extension .$ext is not allowed (allowed:${ALLOWED_EXTS% })" ;;
  esac
}

normalize_path() {
  if command -v realpath > /dev/null 2>&1; then
    realpath -m "$1"
  elif command -v python3 > /dev/null 2>&1; then
    python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$1"
  else
    printf '%s' "$1"
  fi
}

resolve_dest() {
  local url="$1"
  local dest="$2"
  local path="${url%%[?#]*}"
  if [ -z "$dest" ]; then
    dest="${path##*/}"
  fi
  case "$dest" in
    /*) printf '%s' "$dest" ;;
    *) printf '%s/%s' "$OUT_ABS" "$dest" ;;
  esac
}

fetch_one() {
  local url="$1"
  local dest="$2"

  check_url "$url"
  check_extension "$url"

  local abs
  abs="$(normalize_path "$(resolve_dest "$url" "$dest")")"
  local abs_dir
  abs_dir="$(dirname "$abs")"

  case "$abs" in
    "$OUT_ABS"/*) ;;
    *) die "destination escapes --out ($OUT_DIR): $dest" ;;
  esac

  if [ -f "$abs" ] && [ "$FORCE" -ne 1 ]; then
    log "skip (exists): ${abs#"$ROOT_DIR"/}  — use --force to overwrite"
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    log "would download: $url -> ${abs#"$ROOT_DIR"/}"
    return 0
  fi

  mkdir -p "$abs_dir"
  local tmp
  tmp="$(mktemp "$abs_dir/.fetch.XXXXXX")"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp'" RETURN

  if ! curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 15 --max-time 300 -o "$tmp" "$url"; then
    rm -f "$tmp"
    die "download failed: $url"
  fi

  [ -s "$tmp" ] || { rm -f "$tmp"; die "downloaded file is empty: $url"; }

  if [ -n "$EXPECTED_SHA" ]; then
    local actual
    if command -v sha256sum > /dev/null 2>&1; then
      actual="$(sha256sum "$tmp" | awk '{print $1}')"
    elif command -v shasum > /dev/null 2>&1; then
      actual="$(shasum -a 256 "$tmp" | awk '{print $1}')"
    else
      rm -f "$tmp"
      die "no sha256sum/shasum available for --sha256"
    fi
    if [ "$actual" != "$EXPECTED_SHA" ]; then
      rm -f "$tmp"
      die "sha256 mismatch for $url: expected $EXPECTED_SHA, got $actual"
    fi
  fi

  mv -f "$tmp" "$abs"
  trap - RETURN

  local size
  size="$(wc -c < "$abs" | tr -d ' ')"
  log "saved: ${abs#"$ROOT_DIR"/} (${size} bytes)"
}

if [ -n "$MANIFEST" ]; then
  count=0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    # trim leading/trailing whitespace
    line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    [ -n "$line" ] || continue
    read -r manifest_url manifest_dest <<< "$line"
    [ -n "${manifest_dest:-}" ] || manifest_dest=""
    fetch_one "$manifest_url" "$manifest_dest"
    count=$((count + 1))
  done < "$MANIFEST"
  log "manifest entries processed: $count"
else
  fetch_one "$URL" "$DEST"
fi

if [ "$DRY_RUN" -eq 0 ]; then
  cat << 'EOF'

Runtime loading (no bundler, no MCP):
  const game = await createGame({
    assets: {
      manifest: {
        tex:    ['assets/tex/hero.png'],
        audio:  ['assets/audio/jump.ogg'],
        glb:    ['assets/models/coin.glb'],
      },
    },
  });

PixiJS/Three loaders are used by engine/assets.js; audio is registered through
game.audio. Keep asset paths relative to the HTML file so import maps stay valid.
EOF
fi
