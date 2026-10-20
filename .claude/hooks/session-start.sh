#!/bin/bash
# Claude Code cloud sessions start with the environment's git identity, Claude <noreply@anthropic.com>,
# so every commit made there is authored by Claude. This hook gives the repository the owner's
# identity instead, for this checkout only. On a Mac the identity is already the owner's, so the
# hook does nothing there.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

repo="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
git -C "$repo" config user.name "Mirco Widmer"
git -C "$repo" config user.email "mirco.widmer@gmail.com"
