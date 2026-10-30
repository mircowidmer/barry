#!/usr/bin/env bash
# Prints, for $GITHUB_OUTPUT, whether a pull request changes what goes into the native project (native) and
# what the stack, the e2e cases or the relay read (backend). Every event but a pull request changes both.
# A diff that cannot be taken counts as changed, so a broken gate runs the checks instead of skipping them.
#   EVENT=pull_request BASE=<sha of the base branch> scripts/changed-inputs.sh
set -u

native='^(package(-lock)?\.json|\.nvmrc|app\.json|app\.config\.js|eas\.json|plugins/|modules/|patches/|locales/|assets/|\.github/workflows/ci\.yml|scripts/changed-inputs\.sh)'
backend='^(package(-lock)?\.json|\.nvmrc|deno\.json|patches/|supabase/|e2e/|scripts/sms-relay\.mjs|src/lib/database\.types\.ts|\.claude/skills/barry-backend-verify/scripts/doctor\.sh|\.github/workflows/ci\.yml|scripts/changed-inputs\.sh)'

changed() {
  [ "${EVENT:-}" != pull_request ] && return 0
  [ -n "${BASE:-}" ] || return 0
  files=$(git diff --name-only "$BASE...HEAD" 2>/dev/null) || return 0
  grep -qE "$1" <<<"$files"
}

echo "native=$(changed "$native" && echo true || echo false)"
echo "backend=$(changed "$backend" && echo true || echo false)"
