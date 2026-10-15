#!/usr/bin/env bash
# Read-only: is the local Barry stack worth driving? Exit 0 only when every check passes.
set -u
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "ok    $1"; else echo "FAIL  $1"; fail=1; fi; }

check "Docker answers"                         "docker info"
check "Supabase database container is up"      "docker ps --format '{{.Names}}' | grep -qx supabase_db_barry-local"
check "Supabase API gateway (Kong) is up"      "docker ps --format '{{.Names}}' | grep -qx supabase_kong_barry-local"
check "Edge runtime container is up"           "docker ps --format '{{.Names}}' | grep -qx supabase_edge_runtime_barry-local"
check "API answers on :54321"                  "node -e \"fetch('http://127.0.0.1:54321/rest/v1/').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))\""
check "pg_cron ticked in the last 2 minutes"   "[ \"\$(docker exec supabase_db_barry-local psql -U postgres -tAc \"select last_tick_at > now() - interval '2 minutes' from private.clock_status\")\" = t ]"
check "Push relay listens on :8787"            "lsof -nP -iTCP:8787 -sTCP:LISTEN"
check "Metro listens on :8081"                 "lsof -nP -iTCP:8081 -sTCP:LISTEN"
check "A simulator is booted"                  "xcrun simctl list devices booted | grep -q Booted"
check "Development build support.barry is installed" "xcrun simctl listapps booted | grep -q support.barry"
check "Test account in .env.local"             "grep -q '^BARRY_TEST_EMAIL=' .env.local && grep -q '^BARRY_TEST_PASSWORD=' .env.local"

exit $fail
