#!/usr/bin/env bash
# Drives the booted simulator with Maestro, which types text and finds controls by accessibility label. Usage:
#   maestro.sh run <run-id> <flow> [KEY=VALUE ...]   run flows/<flow>.yaml (or a path); screenshots land in .verify-artifacts/<run-id>/,
#                                                    and a failed flow's debug output stays outside the repo, in $TMPDIR/maestro-debug/<run-id>/
#   maestro.sh field <label>                         print "x,y" of the right end of the field VoiceOver names <label>
#   maestro.sh labels                                list the accessibility labels on screen with their bounds
set -euo pipefail
skill=$(cd "$(dirname "$0")/.." && pwd)
cd "$(git -C "$skill" rev-parse --show-toplevel)"
# Homebrew's openjdk is keg-only, so Maestro finds no Java without this.
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home} MAESTRO_CLI_NO_ANALYTICS=1
udid=$(xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' | head -1)

tree() {
  maestro --udid "$udid" hierarchy 2>/dev/null > "$TMPDIR/maestro-hierarchy.json"
  python3 -I - "$TMPDIR/maestro-hierarchy.json" "$@" <<'PY'
import json, re, sys
path, label = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
nodes = []
def walk(n):
    a = n.get('attributes', {})
    if a.get('accessibilityText') and a.get('bounds'):
        nodes.append((a['accessibilityText'], tuple(map(int, re.findall(r'-?\d+', a['bounds'])))))
    for c in n.get('children', []):
        walk(c)
walk(json.load(open(path)))
if label is None:
    for text, b in nodes:
        print(f"{text} | {b[0]},{b[1]} {b[2]},{b[3]}")
else:
    # The widest element with the label is the whole row; its right end is the input, not the label.
    rows = [b for text, b in nodes if text.split(',')[0] == label]
    if not rows:
        sys.exit(f"no element named {label}")
    x1, y1, x2, y2 = max(rows, key=lambda b: b[2] - b[0])
    print(f"{x2 - 4},{(y1 + y2) // 2}")
PY
}

case "${1:-}" in
  run)
    out=.verify-artifacts/$2; flow=$3; shift 3
    [ -f "$flow" ] || flow=$skill/flows/$flow.yaml
    envs=(); for kv in "$@"; do envs+=(-e "$kv"); done
    raw=$(mktemp -d)
    status=0
    maestro --udid "$udid" test --test-output-dir "$raw" ${envs[@]+"${envs[@]}"} "$flow" 2>&1 \
      | grep -vE 'WARNING|^[[:space:]]*$|[Mm]aestro [Cc]loud|test recordings|^[│╭╰]' || status=$?
    mkdir -p "$out"
    find "$raw" -path '*/takeScreenshot/*.png' -exec cp {} "$out/" \;
    # Outside the repo: a new folder under .verify-artifacts makes Metro reload the app in the middle of the next flow.
    if [ "$status" -ne 0 ]; then
      debug=${TMPDIR:-/tmp}/maestro-debug/$2/$(date +%Y%m%d-%H%M%S); mkdir -p "$debug" && cp -R "$raw/." "$debug/"
      echo "debug output in $debug" >&2
    fi
    rm -rf "$raw"
    exit "$status"
    ;;
  field) tree "$2" ;;
  labels) tree ;;
  *) echo "usage: maestro.sh run <run-id> <flow> [KEY=VALUE ...] | field <label> | labels" >&2; exit 2 ;;
esac
