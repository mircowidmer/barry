# Code review, 28 October 2026

`/code-review --fix` on the 226 commits that landed on `main` in the seven days before today: `7b711b2..f915339` (`git diff 7b711b2 f915339`, 292 files). The fixes are on branch `review-2026-10-28`.

## 1. Summary

Findings: 1 High, 3 Medium, 2 Low, 2 Nit. All 8 fixed: five in the review, the three first left for the author on 29 October.

Checks run before every commit, each green: `npx expo lint`, `npx tsc --noEmit`, `npm test` (193 tests). For the migration also `deno test supabase/functions/deliver` (33 passed) and `npx supabase test db` (279 tests, 16 files) against the local stack, with the Edge Runtime restarted and the new migration applied with `npx supabase migration up --local`. The same suites were green on `main` before the first fix.

The High finding was reproduced in the local database before it was fixed: a row that breaks a `NOT VALID` check constraint fails `violates check constraint` on an update of any other column.

## 2. Findings

| # | Severity | Where | Finding | Outcome |
| --- | --- | --- | --- | --- |
| 1 | High | `supabase/migrations/20261028120100_message_limits.sql:13` | The length limits are `NOT VALID` check constraints, which Postgres checks on every update of a row. An Active Adventure saved before the limits with a destination over 200 characters can then not go Overdue (the clock's update fails and lands in `tick_error`), so no Alert goes out, and `check_in` and `move_deadline` fail too. A profile with longer medical notes can no longer be saved. | Fixed in `ed02f62` |
| 2 | Medium | `supabase/migrations/20261028120100_message_limits.sql:34` | `guard_contact_count` counts without a lock, so two inserts at once can both pass the limit of 10 Emergency Contacts. | Fixed in `ed02f62` |
| 3 | Medium | `src/app/(app)/(tabs)/(adventure)/plan.tsx:161` | A place chosen from the suggestions is copied into the destination without the 200-character limit the typed field has, so the save is refused with the generic error. | Fixed in `f18b052` |
| 4 | Medium | `supabase/functions/deliver/messages.en.ts:92`, `messages.de.ts` | Since `cd3be6d` the Alert carries no map link to the Last Position. When `TRAIL_MAP_URL` is missing or invalid, or the contact has no Trail token, the Emergency Contact gets bare coordinates only. | Fixed in `3f4460c`: the Trail Map link stays the only map link when there is one, as `cd3be6d` intended; without it the OpenStreetMap link comes back. |
| 5 | Low | `src/lib/barry/phone-contact.ts:49` | `copyPhoneContact` shortens the name to its limit but not the email, which the server refuses over 254 characters, and the screen then says only that the contact could not be added. | Fixed in `4daf18d`: `LIMITS.emailLength` is 254, pinned in `limits.test.ts` and `limits.test.sql`, and a longer address is passed over for the next one, never cut. |
| 6 | Low | `src/app/(app)/sign-in.tsx:143` | Check Your Inbox signs in on every return to the foreground and shows the "not confirmed" note each time the link has not been opened yet, renewing the captcha each time. | Fixed in `b4786fa`: the sign-in on return stays quiet while the link is unopened; a tap on Sign In still says so. |
| 7 | Nit | `src/lib/barry/phone-contact.ts:35` | `hasNumber` sat between `copyPhoneContact` and its doc comment, followed by three blank lines. | Fixed in `31bd790` |
| 8 | Nit | `watching.tsx`, `contacts/index.tsx`, `profile/index.tsx` | The same `initials` helper was copied into three screens. | Fixed in `4223744` |

## 3. Fixes

- `ed02f62` adds `supabase/migrations/20261028130000_length_limits_on_change.sql`. It drops the `NOT VALID` length constraints and checks each text in a trigger only when it is new or changed, raising `check_violation` as the constraints did. `guard_contact_count` takes a transaction lock per Adventurer before it counts. `limits.test.sql` gains a case: an Adventure with an older, longer destination still updates. `docs/spec.md` and `src/lib/barry/limits.ts` name the new migration. Needs `/barry-backend-verify`, and `npx supabase db push` once merged.
- `f18b052` cuts a chosen place name to `LIMITS.destinationLength`. Needs `/barry-frontend-verify`.
- `31bd790` puts the doc comment back on `copyPhoneContact`. No behaviour changes.
- `4223744` moves `initials` to `src/lib/initials.ts`. No behaviour changes; `/barry-frontend-verify` of the three screens is cheap insurance.
- `3f4460c` puts the OpenStreetMap link back into the Alert, in English and German, only when there is no Trail Map link. Deno gains a case for it, and the spec's message table says so. Needs `/barry-backend-verify`, and `npx supabase functions deploy deliver` once merged.
- `4daf18d` adds `LIMITS.emailLength` and skips a Phone Contact's email address over it. Needs `/barry-frontend-verify`.
- `b4786fa` keeps the automatic sign-in of Check Your Inbox quiet when the address is not confirmed yet. The captcha is still renewed on each return, since the sign-in needs a fresh token. Needs `/barry-frontend-verify`.
