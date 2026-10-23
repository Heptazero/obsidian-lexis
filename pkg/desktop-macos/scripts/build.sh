#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLIENT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
DIST_DIR="$CLIENT_DIR/dist"
VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$CLIENT_DIR/Info.plist")
ARCH=$(uname -m)
export CLANG_MODULE_CACHE_PATH="$CLIENT_DIR/.build/clang-cache"

cd "$CLIENT_DIR"
# Bound compiler parallelism for smaller Macs. No package dependencies or Xcode project.
swift build --product LexisDesktop -c release -j 2 --disable-sandbox \
  --cache-path "$CLIENT_DIR/.build/cache" \
  --config-path "$CLIENT_DIR/.build/config" \
  --security-path "$CLIENT_DIR/.build/security"
BIN_DIR=$(swift build -c release --show-bin-path)
APP="$DIST_DIR/Lexis Desktop.app"
mkdir -p "$APP/Contents/MacOS"
cp "$BIN_DIR/LexisDesktop" "$APP/Contents/MacOS/LexisDesktop"
cp "$CLIENT_DIR/Info.plist" "$APP/Contents/Info.plist"
codesign --force --sign - --identifier com.heptazero.lexis-desktop "$APP"
codesign --verify --strict "$APP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$DIST_DIR/lexis-desktop-macos-$ARCH-$VERSION.zip"
printf '%s\n' "$APP" "$DIST_DIR/lexis-desktop-macos-$ARCH-$VERSION.zip"
