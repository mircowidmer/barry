# Code review of 2026-10-29

Range reviewed: `git diff 8aff52c origin/main`, the 297 commits that landed on main in the past 7 days (310 files). Reviewed with `code-review --fix`. `npx expo lint`, `npx tsc --noEmit` and `npm test` pass. The pgTAP, Deno and end-to-end suites were not run by the review itself; the SQL findings come from reading the migrations.

| # | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | Medium | `src/lib/barry/conditions.ts:245` | A failed avalanche bulletin fetch is swallowed with `.catch(() => null)`, so the Conditions count as fresh with no bulletin and a missing bulletin looks like no danger. | Fixed in "An avalanche bulletin that could not be loaded shows as missing in the Conditions instead of as no danger, and the next look asks again". |
| 2 | Medium | `supabase/migrations/20261029090000_pace_updates.sql:61` | Plan and Deadline Updates are paced, but Alerts per address stay unbounded: `move_deadline` accepts any later time and resets `alerts_sent`, so each move buys three fresh Alerts. | Fixed in "An Adventure brings at most nine Alerts: a Deadline move whose three Alerts would pass nine is refused with too_many_alerts", with the rule changed in `docs/spec.md`. |
| 3 | Low | `src/app/(app)/(tabs)/(adventure)/index.tsx:311` | The Alerted card hardcodes `/3` instead of taking the Alert limit from one constant. | Fixed in "The Alerted card and its text take the number of Alerts per Deadline from LIMITS, which the tests pin to max_alerts"; the texts hardcoded 3 too. |
| 4 | Low | `src/lib/signed-fetch.ts:11` | `signedOnly` reads Authorization only from `init.headers`, so a `Request` object bypasses the guard. | Fixed in "A database request passed as a Request object, signed only with the publishable key, fails like a lost signal too". |
| 5 | Low | `src/lib/keychain-session.ts:21` | A Keychain read error is not handled, and a failed legacy-migration write loses the session. | Fixed in "A Keychain that cannot be read answers no session until the next request, and a session whose move into the Keychain fails stays in the storage file". |
| 6 | Low | `supabase/migrations/20261028120100_message_limits.sql:1` | `private.starts` is never pruned. | Fixed in "A Start drops the Adventurer's Starts older than 24 hours, so the times they went out no longer outlive the Ended Adventures they deleted". |
| 7 | Low | `src/app/(app)/(tabs)/(adventure)/plan.tsx:175` | `openPicker` clears `busy` only on success, so a throw leaves the form locked. | Fixed in "The place picker opens on Switzerland when Apple Maps or the position fails, instead of leaving the Plan sheet locked". |
| 8 | Low | `src/lib/barry/alarms.ts:28` | The comment called the Reminder skip the server's rule, but the phone schedules the Reminder. | Fixed in the commit "The comment on the Reminder no longer calls its skip the server's rule, since the phone schedules the Reminder itself". |

Found 8, fixed 8.
