#!/usr/bin/env bash
# Text entry for the iOS Simulator. The simulator ignores its own pasteboard writes but syncs the
# Mac clipboard, so text goes through pbcopy. Usage:
#   clip.sh set "text"     put text on the clipboard (waits for the sync)
#   clip.sh password       put the test account password from .env.local on the clipboard
#   clip.sh email          put the test account email from .env.local on the clipboard
#   clip.sh clear          empty the clipboard (always run after pasting the password)
set -eu
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
value() { grep "^$1=" .env.local | cut -d= -f2- | tr -d '\n'; }
case "${1:-}" in
  set) printf '%s' "$2" | pbcopy ;;
  password) value BARRY_TEST_PASSWORD | pbcopy ;;
  email) value BARRY_TEST_EMAIL | pbcopy ;;
  clear) printf '' | pbcopy ;;
  *) echo "usage: clip.sh set <text> | password | email | clear" >&2; exit 2 ;;
esac
sleep 1
