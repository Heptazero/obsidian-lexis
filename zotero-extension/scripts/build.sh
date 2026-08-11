#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
EXT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REPO_DIR=$(CDPATH= cd -- "$EXT_DIR/.." && pwd)
DIST_DIR="$EXT_DIR/dist"
OUTPUT="$DIST_DIR/lexis-zotero-0.1.23.xpi"

if ! cmp -s "$REPO_DIR/browser-extension/popover.css" "$EXT_DIR/styles/card.css"; then
  echo "styles/card.css 与浏览器卡片样式不同步" >&2
  exit 1
fi

mkdir -p "$DIST_DIR"
rm -f "$OUTPUT"
cd "$EXT_DIR"
zip -qr "$OUTPUT" \
  manifest.json bootstrap.js prefs.js \
  preferences.xhtml preferences.js preferences.css \
  icons src styles
echo "$OUTPUT"
