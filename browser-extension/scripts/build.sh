#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
EXT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
DIST_DIR="$EXT_DIR/dist"
VERSION=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$EXT_DIR/manifest.json" | head -n 1)
OUTPUT="$DIST_DIR/lexis-web-$VERSION.zip"

mkdir -p "$DIST_DIR"
rm -f "$OUTPUT"
cd "$EXT_DIR"
zip -qr "$OUTPUT" \
  manifest.json background.js content.js content.css \
  popover.css popup.html popup.js
echo "$OUTPUT"
