# Test pruning (`/barry-prune-tests --fix`)

Branch `maintenance-2026-10-28`, the third step of the maintenance pass of 28 October 2026. The passes of 21 and 23 October pruned the four suites; this one read in full every test file added or changed since 23 October and checked the new tests against the ones already there.

## 1. Summary

| Suite | Before | After | Duplicates | Unhelpful | Suspected |
|---|---|---|---|---|---|
| Unit (Jest) | 193 | 193 | 0 | 0 | 0 |
| Database (pgTAP) | 278 in 16 files | 278 | 0 | 0 | 0 |
| Edge Function (Deno) | 33 | 33 | 0 | 0 | 0 |
| End to end | 75 files | 75 | 0 | 0 | 0 |

Every suite ran: the stack, Deno and the relay are up in this session.

Files read: `sign-in.test.ts`, `turnstile.test.ts`, `keychain-session.test.ts`, `confirmation.test.ts`, `content-security.test.ts`, `limits.test.ts`, `texts.test.ts`, the changes to `account.test.ts`, `password-reset.test.ts`, `client.test.ts`, `phone-contact.test.ts`, `theme.test.ts`, `signed-fetch.test.ts`, `rows.test.ts`; `limits.test.sql` and the changes to the other 11 pgTAP files; `kick.test.ts`; `trail-keeps-every-reading.e2e.mjs`, `clock-pings-the-monitor.e2e.mjs`, `password-reset.e2e.mjs`.

## 2. Cuts

None.

## 3. Kept with doubt

- `limits.test.ts` "matches what the migration enforces" and the first three rows of `limits.test.sql` assert constants equal literals. The spec names them under **Limits that live in the code** as pinned by these files, so they stay.
- `sign-in.test.ts` "matches the hosted Auth limit on confirmation emails" asserts `RESEND_AFTER_SECONDS` is 60 and that `config.toml` says `1m0s`. The spec names the pair as pinned by this test.
- `turnstile.test.ts` "names the token only when there is one" looks covered by the `options: {}` in the `signUp` and `requestCode` tests, but `toEqual` ignores a `captchaToken: undefined` key; only its `'captchaToken' in` line fails if `captchaOptions` returns one, which `exactOptionalPropertyTypes` forbids at the call sites.
- The captcha token tests in `sign-in.test.ts`, `account.test.ts` and `password-reset.test.ts` each pin that one Auth call carries the token. They test three call sites, not one helper.
- `kick.test.ts` and `e2e/deliver-refuses-without-secret.e2e.mjs` pin the same rule at two layers; both stay.
- `client.test.ts` "reports a full list when the server refuses another contact" and the eleventh contact in `limits.test.sql`: the client's mapping and the server's trigger, two layers.

## 4. Suspected

None.

## 5. Gaps noticed on the way

- No e2e case proves the limits end to end (an eleventh contact, a sixth Start in 24 hours); `limits.test.sql` is the only proof, as barry-backend-verify's table says.
- No test pins `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` in `auth-storage.ts`, which `docs/spec.md:17` promises ("for this phone only").

## Commits

None. No cut was skipped.
