#!/usr/bin/env bash
# Read-only: is the local Barry stack and the app worth driving? Exit 0 only when every check passes.
# The stack's checks are barry-backend-verify's doctor; this one adds the app's.
set -u
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
fail=0
.claude/skills/barry-backend-verify/scripts/doctor.sh || fail=1
check() { if eval "$2" >/dev/null 2>&1; then echo "ok    $1"; else echo "FAIL  $1"; fail=1; fi; }

check "Metro listens on :8081"                "lsof -nP -iTCP:8081 -sTCP:LISTEN"
check "A simulator is booted"                  "xcrun simctl list devices booted | grep -q Booted"
check "Development build support.barry.dev is installed" "xcrun simctl listapps booted | grep -q support.barry.dev"
check "Test account in .env.local"             "grep -q '^BARRY_TEST_EMAIL=' .env.local && grep -q '^BARRY_TEST_PASSWORD=' .env.local"

exit $fail
