# Code review of 4 November 2026

Range reviewed: `634b1fe..c9bd66a` of main, 419 commits and 298 files changed.
The review read the migrations, the client module, the sign-in and Auth changes, the `deliver` function and the Conditions code.
It did not read the many tests, docs, workflows and skills in the range, and ran no lint or tests itself.

## Findings

| # | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | High | `src/app/(app)/(tabs)/(adventure)/plan.tsx:255` | Start on a new Plan saves and starts in one call, but an `unconfirmed` result does not give the screen the new Adventure's id, so Try again can create a second Planned Adventure and be refused with `another_adventure_in_progress` while the first is Active. | Left open: the result must carry the id back, or the client must generate it. |
| 2 | High | `supabase/functions/deliver/index.ts:18` | `deliver` throws at module load when `SUPABASE_SECRET_KEYS` is unset or has no `default` key, so no message goes out and the heartbeat goes silent. | Left open: decide on a fallback to `SUPABASE_SERVICE_ROLE_KEY`. |
| 3 | Medium | `src/lib/barry/trail-task.ts:10` | Every background location batch and geofence event also runs `noticeDeliveryFailures`, a Supabase round trip that costs battery and delays `onLocations`. | Left open: throttle it or use the Realtime failure event. |
| 4 | Medium | `src/lib/barry/conditions.ts:360` | A conditions fetch in flight can store the destination point after `forget()` ran on logout or account deletion. | Left open: cancel the fetch on `forget()`. |
| 5 | Low | `src/app/(app)/sign-in.tsx:143` | Each return to the foreground on the check-inbox screen spends a Turnstile token on a password sign-in that fails with `email_not_confirmed`, counting against the per-IP limit. | Left open: product choice on what to throttle. |
| 6 | Low | `src/lib/barry/limits.ts:20` | The latest Deadline is "now plus 12 months" by `setMonth`, which on 29 February is one day past the server's `interval '1 year'`, and its date changes identity on every render. | Left open. |
| 7 | Low | `src/lib/barry/phone-contact.ts:62` | `createPhoneContactLinks.load()` threw on unreadable storage after the contact was already saved or removed on the server. | Fixed in 32efdbb, with a test. |

Checks before the commit: `npx expo lint`, `npx tsc --noEmit` and `npm test` (38 suites, 267 tests) pass.
The fix is outside `supabase/`, so the Deno and pgTAP suites were not needed for it.
The local stack started and `deliver` answered 401 unauthorized.
