# Test pruning (`/barry-prune-tests --fix`)

Branch `claude/busy-planck-1swytm`.

## Summary

| Suite | Before | After | Proven cuts | Suspected cuts | Ran here |
|---|---|---|---|---|---|
| Unit (Jest) | 129 | 128 | 1 duplicate | 0 | yes |
| Database (pgTAP) | 288 assertions | 288 | 0 | 13 | no: no Docker for `npx supabase start` |
| Edge Function (Deno) | 30 | 30 | 0 | 0 | no: Deno is not installed |
| End to end | 45 files | 45 | 0 | 1 | no: no stack |

I read every test file in all four suites in full.

- **Unit suite:** apart from the one duplicate, every test pins a branch, a boundary, an ordering, a race, a fallback or a spec limit.
  - The eight `trailMode` rows were checked against reorderings of its conditions. Each row catches a reordering that the others miss.
  - `camera.test` "follows a region the Adventurer zoomed out to" is the only test that fails if `shows` ignores the region's span.
- **The other suites:** no test is a textual duplicate, so nothing there is cut.

## Cuts

### Unit

| path:line | Name | Verdict | Evidence | Outcome |
|---|---|---|---|---|
| src/lib/barry/trail-buffer.test.ts:54 | survives an app restart, because it lives in storage | Duplicate of `trail-buffer.test.ts:41`, "sends nothing for a reading in a minute it already sent". Its other assertion, the Adventure id, is covered by `trail.test.ts`, "uploads the background readings, one per minute". | Break 1: a per-instance storage key (`KEY + Math.random()`). Both the keeper and the candidate fail. Break 2: `send('x', batch)` instead of the Adventure id. The candidate and four `trail.test.ts` cases fail. Both breaks were reverted. | **cut** c47d72c |

### Database, Edge Function, end to end

None proven. See **Suspected**.

## Kept with doubt

**Unit**

- `rows.test.ts` "keeps a switched-off address with its switch": it is close to a copy test, but it pins the promise "An address that is switched off is kept" (CONTEXT.md, spec).
- `wording.test.ts` notificationText tests: they compare the whole text, but they check that the Deadline, the Alert time, the time zone and the language land in it.
- `theme.test.ts`: it compares `web/site.css` with the app theme, which is a promise the website and the app share.

**Edge Function**

- The whole-message template tests in `messages.en.test.ts` and `messages.de.test.ts`: they check that the facts land in the text (the time zone, the Plan, the link, the Profile).
- `messages.en.test.ts:109`: it renders an Overdue Notice the server no longer sends.

**Database**

- `commands.test.sql:117`: it pins the old 7-argument `save_adventure` pass-through. It goes when that pass-through goes.
- `commands.test.sql:256` and `:263`.
- `deliver.test.sql:77`.
- `contact_switches.test.sql:49` and `:54`.
- `access.test.sql:127`.
- `decide.test.sql:253`: `decide()` is immutable.
- `tick.test.sql:153`: the cron schedule string.
- `delivery_report.test.sql:218`.

**End to end**

- `delete-account-refused-while-overdue`, `delete-account-refused-while-alerted` and `contact-in-use-while-overdue`: they are the only coverage of the Overdue and Alerted values in the stage guards.

## Suspected (never applied)

| path:line | Suspected verdict | Command that settles it |
|---|---|---|
| supabase/tests/database/trail_after.test.sql:194 | Cannot fail: `p_after` defaults to null | Change the default in a scratch migration, then `npx supabase test db supabase/tests/database/trail_after.test.sql` |
| supabase/tests/database/deliver.test.sql:71 | Duplicate of :60, whose exact claimed set already leaves out the blocked row | Drop the blocking clause in `claim_messages`, then `npx supabase test db supabase/tests/database/deliver.test.sql` |
| supabase/tests/database/deliver.test.sql:78 | Duplicate of :60, for the live lease | Same as the row above |
| supabase/tests/database/health.test.sql:285 | Duplicate of :290 and :267, which need the `settled_at` trigger | Disable the trigger, then `npx supabase test db supabase/tests/database/health.test.sql` |
| supabase/tests/database/reconcile.test.sql:183 | Duplicate of the decide row at decide.test.sql:206 | `npx supabase test db` with `decide` broken for Active before the Reminder |
| supabase/tests/database/trail.test.sql:218 | Duplicate of :151 | Break the `order by` in `message_facts`, then `npx supabase test db supabase/tests/database/trail.test.sql` |
| contact_switches:62, deadline_update:116, trail:110, :159, :167, :197, plan_update:43 | Setup steps written as assertions, duplicating commands.test.sql (keep the calls as bare selects) | `npx supabase test db` with Start, the move or the save broken |
| supabase/tests/database/trail.test.sql:198 | Duplicate of commands.test.sql:347 | Same as the row above |
| e2e/move-deadline.e2e.mjs | Subset of e2e/overdue-move.e2e.mjs, and it depends on cron timing | Make `move_deadline` keep an Overdue Adventure Overdue, then `node --test --test-timeout=300000 e2e/overdue-move.e2e.mjs e2e/move-deadline.e2e.mjs` |

## Gaps noticed on the way

- `retry_backoff`: only the first step, 30 seconds, is tested. The 1, 2, 5 and 10 minute steps are not.
- The `limit 500` in `record_trail` has no test.
- No test shows a failed Deadline Update or All-clear as a Delivery Failure.
- No test checks that the German texts use `ss` and never `ß`.
- The German Plan Update has no fact test.
- No end-to-end case waits for the real 3-minute Deadline Update delay.

## Commits

1. c47d72c

## Skipped

None of the proven cuts were skipped. The suspected cuts are never applied, by rule 1.
