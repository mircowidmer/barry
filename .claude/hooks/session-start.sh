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
