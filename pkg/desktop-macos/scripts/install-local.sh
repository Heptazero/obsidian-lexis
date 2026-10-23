#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLIENT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
TARGET="${1:-/Applications/Lexis Desktop.app}"

case "$TARGET" in
  /*/Lexis\ Desktop.app) ;;
  *) printf '%s\n' '目标必须是绝对路径，且应用名为 Lexis Desktop.app。' >&2; exit 2 ;;
esac
if [ -L "$TARGET" ]; then
  printf '%s\n' '拒绝覆盖应用符号链接。' >&2; exit 2
fi
PROCESS_STATUS=0
pgrep -x LexisDesktop >/dev/null || PROCESS_STATUS=$?
case "$PROCESS_STATUS" in
  0) printf '%s\n' '请先在菜单栏退出 Lexis Desktop，再运行本地更新。不会强制关闭或覆盖运行中的程序。' >&2; exit 2 ;;
  1) ;;
  *) printf '%s\n' '无法确认 Lexis 是否退出，已停止安装，未覆盖应用。' >&2; exit 2 ;;
esac
if [ -e "$TARGET" ]; then
  ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$TARGET/Contents/Info.plist")
  if [ "$ID" != 'com.heptazero.lexis-desktop' ]; then
    printf '%s\n' '目标不是 Lexis Desktop，未覆盖。' >&2; exit 2
  fi
fi
sh "$SCRIPT_DIR/build.sh"
ditto "$CLIENT_DIR/dist/Lexis Desktop.app" "$TARGET"
codesign --verify --strict "$TARGET"
printf '已更新：%s\n设置与钥匙串没有删除。临时签名变更后，系统可能要求重新授权辅助功能。\n' "$TARGET"
