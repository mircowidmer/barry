#!/bin/bash
# Refuses `gh pr create` until /simplify has run on the current HEAD, which Claude records in
# .git/simplified. A commit after that makes the marker stale, so /simplify runs again.
set -euo pipefail

[[ $(jq -r '.tool_input.command // ""') == *"gh pr create"* ]] || exit 0

repo="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
marker="$(git -C "$repo" rev-parse --absolute-git-dir)/simplified"
[ "$(cat "$marker" 2>/dev/null)" = "$(git -C "$repo" rev-parse HEAD)" ] && exit 0

echo "Run /simplify on the branch and commit its fixes, then \`git rev-parse HEAD > $marker\` and create the pull request again." >&2
exit 2
