# Code review of 2026-10-29

Range reviewed: `git diff 8aff52c origin/main`, the 297 commits that landed on main in the past 7 days (310 files). Reviewed with `code-review --fix`. `npx expo lint`, `npx tsc --noEmit` and `npm test` pass. The pgTAP, Deno and end-to-end suites were not run by the review itself; the SQL findings come from reading the migrations.

| # | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | Medium | `src/lib/barry/conditions.ts:245` | A failed avalanche bulletin fetch is swallowed with `.catch(() => null)`, so the Conditions count as fresh with no bulletin and a missing bulletin looks like no danger. | Left open: needs a new unavailable state and English and German texts. |
| 2 | Medium | `supabase/migrations/20261029090000_pace_updates.sql:61` | Plan and Deadline Updates are paced, but Alerts per address stay unbounded: `move_deadline` accepts any later time and resets `alerts_sent`, so each move buys three fresh Alerts. | Left open: pacing Alerts changes the rule in `docs/spec.md`. |
| 3 | Low | `src/app/(app)/(tabs)/(adventure)/index.tsx:311` | The Alerted card hardcodes `/3` instead of taking the Alert limit from one constant. | Left open: needs a shared constant pinned by `limits.test.ts` and `limits.test.sql`. |
| 4 | Low | `src/lib/signed-fetch.ts:11` | `signedOnly` reads Authorization only from `init.headers`, so a `Request` object bypasses the guard. | Left open: needs a design decision. |
| 5 | Low | `src/lib/keychain-session.ts:21` | A Keychain read error is not handled, and a failed legacy-migration write loses the session. | Left open: needs a design decision. |
| 6 | Low | `supabase/migrations/20261028120100_message_limits.sql:1` | `private.starts` is never pruned. | Left open. |
| 7 | Low | `src/app/(app)/(tabs)/(adventure)/plan.tsx:175` | `openPicker` clears `busy` only on success, so a throw leaves the form locked. | Left open. |
| 8 | Low | `src/lib/barry/alarms.ts:28` | The comment called the Reminder skip the server's rule, but the phone schedules the Reminder. | Fixed in the commit "The comment on the Reminder no longer calls its skip the server's rule, since the phone schedules the Reminder itself". |

Found 8, fixed 1, left open 7.
