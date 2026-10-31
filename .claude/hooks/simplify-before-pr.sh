#!/bin/bash
# Refuses `gh pr create` until /simplify has run on the current HEAD, which Claude records in the
# git directory of the checkout the session works in, so each worktree has its own marker. A commit
# after that makes the marker stale, so /simplify runs again.
set -euo pipefail

input=$(cat)
[[ $(jq -r '.tool_input.command // ""' <<<"$input") == *"gh pr create"* ]] || exit 0

# CLAUDE_PROJECT_DIR is the main checkout even when the session works in a worktree.
dir=$(jq -r '.cwd // empty' <<<"$input")
dir="${dir:-${CLAUDE_PROJECT_DIR:-$PWD}}"
marker="$(git -C "$dir" rev-parse --absolute-git-dir)/simplified"
[ "$(cat "$marker" 2>/dev/null)" = "$(git -C "$dir" rev-parse HEAD)" ] && exit 0

echo "Run /simplify on the branch and commit its fixes, then \`git rev-parse HEAD > $marker\` and create the pull request again." >&2
exit 2
