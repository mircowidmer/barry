# Code review, 28 October 2026

`/code-review --fix` on the 226 commits that landed on `main` in the seven days before today: `7b711b2..f915339` (`git diff 7b711b2 f915339`, 292 files). The fixes are on branch `review-2026-10-28`.

## 1. Summary

Findings: 1 High, 3 Medium, 2 Low, 2 Nit. Fixed: 5. Left open: 3.

Checks run before every commit, each green: `npx expo lint`, `npx tsc --noEmit`, `npm test` (193 tests). For the migration also `deno test supabase/functions/deliver` (33 passed) and `npx supabase test db` (279 tests, 16 files) against the local stack, with the Edge Runtime restarted and the new migration applied with `npx supabase migration up --local`. The same suites were green on `main` before the first fix.

The High finding was reproduced in the local database before it was fixed: a row that breaks a `NOT VALID` check constraint fails `violates check constraint` on an update of any other column.

## 2. Findings

| # | Severity | Where | Finding | Outcome |
| --- | --- | --- | --- | --- |
| 1 | High | `supabase/migrations/20261028120100_message_limits.sql:13` | The length limits are `NOT VALID` check constraints, which Postgres checks on every update of a row. An Active Adventure saved before the limits with a destination over 200 characters can then not go Overdue (the clock's update fails and lands in `tick_error`), so no Alert goes out, and `check_in` and `move_deadline` fail too. A profile with longer medical notes can no longer be saved. | Fixed in `ed02f62` |
| 2 | Medium | `supabase/migrations/20261028120100_message_limits.sql:34` | `guard_contact_count` counts without a lock, so two inserts at once can both pass the limit of 10 Emergency Contacts. | Fixed in `ed02f62` |
| 3 | Medium | `src/app/(app)/(tabs)/(adventure)/plan.tsx:161` | A place chosen from the suggestions is copied into the destination without the 200-character limit the typed field has, so the save is refused with the generic error. | Fixed in `f18b052` |
| 4 | Medium | `supabase/functions/deliver/messages.en.ts:92`, `messages.de.ts` | Since `cd3be6d` the Alert carries no map link to the Last Position. When `TRAIL_MAP_URL` is missing or invalid, or the contact has no Trail token, the Emergency Contact gets bare coordinates only. | Left open: the commit made it deliberately and changed the tests with it. The author should confirm an Alert without any map link is acceptable when the Trail Map link is missing. |
| 5 | Low | `src/lib/barry/phone-contact.ts:49` | `copyPhoneContact` shortens the name to its limit but not the email, which the server refuses over 254 characters, and the screen then says only that the contact could not be added. | Left open: it needs an email limit in `LIMITS` and its pin in `limits.test.ts`, for addresses that are very rare. |
| 6 | Low | `src/app/(app)/sign-in.tsx:143` | Check Your Inbox signs in on every return to the foreground and shows the "not confirmed" note each time the link has not been opened yet, renewing the captcha each time. | Left open: a choice about the intended behaviour, for the author. |
| 7 | Nit | `src/lib/barry/phone-contact.ts:35` | `hasNumber` sat between `copyPhoneContact` and its doc comment, followed by three blank lines. | Fixed in `31bd790` |
| 8 | Nit | `watching.tsx`, `contacts/index.tsx`, `profile/index.tsx` | The same `initials` helper was copied into three screens. | Fixed in `4223744` |

## 3. Fixes

- `ed02f62` adds `supabase/migrations/20261028130000_length_limits_on_change.sql`. It drops the `NOT VALID` length constraints and checks each text in a trigger only when it is new or changed, raising `check_violation` as the constraints did. `guard_contact_count` takes a transaction lock per Adventurer before it counts. `limits.test.sql` gains a case: an Adventure with an older, longer destination still updates. `docs/spec.md` and `src/lib/barry/limits.ts` name the new migration. Needs `/barry-backend-verify`, and `npx supabase db push` once merged.
- `f18b052` cuts a chosen place name to `LIMITS.destinationLength`. Needs `/barry-frontend-verify`.
- `31bd790` puts the doc comment back on `copyPhoneContact`. No behaviour changes.
- `4223744` moves `initials` to `src/lib/initials.ts`. No behaviour changes; `/barry-frontend-verify` of the three screens is cheap insurance.
