#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
EXT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
DIST_DIR="$EXT_DIR/dist"
VERSION=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$EXT_DIR/manifest.json" | head -n 1)

# 两个目标共享同一份源码,只有 manifest 不同
SHARED_FILES="config.js background.js content.js content.css popover.css popup.html popup.js"

mkdir -p "$DIST_DIR"

# Chrome(MV3 service worker)
OUTPUT="$DIST_DIR/lexis-web-$VERSION.zip"
rm -f "$OUTPUT"
cd "$EXT_DIR"
zip -qr "$OUTPUT" manifest.json $SHARED_FILES icons
echo "$OUTPUT"

# Firefox(MV3 事件页):version 从 manifest.json 注入,避免两处漂移
FIREFOX_DIR="$DIST_DIR/firefox"
OUTPUT="$DIST_DIR/lexis-web-firefox-$VERSION.zip"
rm -rf "$FIREFOX_DIR" "$OUTPUT"
mkdir -p "$FIREFOX_DIR"
cp $SHARED_FILES "$FIREFOX_DIR/"
cp -R icons "$FIREFOX_DIR/"
sed "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" \
  "$EXT_DIR/manifest.firefox.json" > "$FIREFOX_DIR/manifest.json"
cd "$FIREFOX_DIR"
zip -qr "$OUTPUT" .
echo "$OUTPUT"
