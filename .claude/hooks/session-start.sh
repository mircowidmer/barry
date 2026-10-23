#!/bin/bash
# Claude Code cloud sessions start with the environment's git identity, Claude <noreply@anthropic.com>,
# so every commit made there is authored by Claude. This hook gives the repository the owner's
# identity instead, for this checkout only. On a Mac the identity is already the owner's, so the
# hook does nothing there.
set -euo pipefail

repo="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# The commit-msg and pre-push hooks in .githooks refuse any commit that names Claude as author,
# committer or co-author, in every session, local and cloud.
git -C "$repo" config core.hooksPath .githooks

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

git -C "$repo" config user.name "Mirco Widmer"
git -C "$repo" config user.email "mirco.widmer@gmail.com"

# Outbound HTTPS in a cloud session goes through an agent proxy that re-signs every certificate
# with its own CA. The local Edge Runtime trusts only its bundled roots, so `deliver` fails to
# boot with "invalid peer certificate: UnknownIssuer" while loading @supabase/supabase-js.
# `supabase start` passes supabase/functions/.env into the container, and supabase/functions is
# mounted at the same path there, so a copy of the bundle in that folder is readable inside.
ca="/root/.ccr/ca-bundle.crt"
if [ -f "$ca" ]; then
  cp "$ca" "$repo/supabase/functions/proxy-ca.pem"
  printf 'DENO_TLS_CA_STORE=mozilla,system\nSSL_CERT_FILE=%s\n' \
    "$repo/supabase/functions/proxy-ca.pem" > "$repo/supabase/functions/.env"
fi

# The tests and linters need node_modules, which a fresh checkout lacks. npm install rather than
# npm ci, so the cached container keeps what an earlier session installed, and --no-save, because
# the container's older npm would rewrite package-lock.json.
(cd "$repo" && npm install --no-save --no-audit --no-fund)

# `npx tsc --noEmit` needs expo-env.d.ts, which `npm start` writes on its first run and git ignores.
if [ ! -f "$repo/expo-env.d.ts" ]; then
  printf '/// <reference types="expo/types" />\n\n// NOTE: This file should not be edited and should be in your git ignore' \
    > "$repo/expo-env.d.ts"
fi

# The container has Docker but does not start its daemon, and `npx supabase start` needs it.
# The Supabase stack itself stays a manual step: it takes minutes, and only the pgTAP and e2e
# suites need it.
if ! docker info > /dev/null 2>&1; then
  # A resumed container keeps the pid files of the daemons that ran before it was saved. dockerd
  # then takes a stranger with containerd's old pid for containerd and gives up after 15 seconds.
  rm -f /var/run/docker.pid /var/run/docker/containerd/containerd.pid
  setsid nohup dockerd > /tmp/dockerd.log 2>&1 < /dev/null &
  for _ in $(seq 1 30); do
    docker info > /dev/null 2>&1 && break
    sleep 1
  done
  docker info > /dev/null 2>&1 || echo "dockerd did not start, see /tmp/dockerd.log" >&2
fi
