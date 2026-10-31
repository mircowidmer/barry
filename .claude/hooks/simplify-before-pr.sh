#!/bin/bash
# Refuses `gh pr create` until /simplify has run on the branch as it stands. After /simplify and its
# commits, Claude writes the HEAD it reviewed to .git/simplified; a commit after that makes the
# marker stale, so the next attempt asks for /simplify again.
set -euo pipefail

command=$(jq -r '.tool_input.command // ""')
case "$command" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

repo="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
marker="$(git -C "$repo" rev-parse --absolute-git-dir)/simplified"
if [ "$(cat "$marker" 2>/dev/null)" = "$(git -C "$repo" rev-parse HEAD)" ]; then
  exit 0
fi

jq -n --arg marker "$marker" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: ("Run /simplify on the branch first and commit its fixes, as AGENTS.md asks. Then run `git rev-parse HEAD > " + $marker + "` and create the pull request again.")
  }
}'
