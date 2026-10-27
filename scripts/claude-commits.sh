#!/usr/bin/env bash
# Lists the commits in the given rev-list arguments that Claude authored or committed, or whose message
# names Claude as co-author or session. Exits 1 if there is one, so the pre-push hook and CI can refuse it.
#   scripts/claude-commits.sh main              every commit reachable from main
#   scripts/claude-commits.sh origin/main..HEAD the commits a push would add
set -euo pipefail

found=0
while IFS= read -r sha; do
  ident=$(git log -1 --format='%an <%ae>%n%cn <%ce>' "$sha")
  message=$(git log -1 --format='%B' "$sha")
  if grep -qiE '^claude <|@anthropic\.com>' <<<"$ident" \
    || grep -qiE '^co-authored-by:.*(claude|anthropic)|^claude-session:|claude\.ai/code/session|generated (with|by) \[?claude code' <<<"$message"; then
    echo "$(git log -1 --format='%h %an <%ae>: %s' "$sha")"
    found=1
  fi
done < <(git rev-list "$@")
exit "$found"
