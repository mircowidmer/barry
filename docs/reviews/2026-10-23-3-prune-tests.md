# Test pruning (`/barry-prune-tests --fix`)

Branch `maintenance-2026-10-23`, the third step of the maintenance pass of 23 October 2026, after the code quality and consistency fixes.

## Summary

| Suite | Before | After | Proven cuts | Suspected cuts | Ran here |
|---|---|---|---|---|---|
| Unit (Jest) | 163 | 161 | 1 duplicate, 1 unhelpful | 0 | yes |
| Database (pgTAP) | 288 assertions in 15 files | 279 | 9 duplicates | 0 | yes, against the local stack |
| Edge Function (Deno) | 32 | 32 | 0 | 0 | yes |
| End to end | 49 files | 48 | 1 duplicate | 0 | the two files in question, against the local stack |

Every test file in all four suites was read in full, and every proposed cut was proven with a scratch break of the code under test, reverted before anything was committed. The database breaks ran inside a transaction that the test file's own `rollback` undid; the end-to-end break was a committed `create or replace` of `commands.move_deadline`, restored right after the run.

- **Unit suite:** apart from the two cuts, every test pins a promise, a branch, a boundary, an ordering, a race, a fallback, a format or a fixed bug. Two pairs that looked alike were kept after a second break showed that the candidate catches something the keeper misses: `trail.test.ts:324` against `:292` (an entered event outside the fence-setting loop), and `senders.test.ts:103` against `:44` (Twilio's wiring to the shared status classification).
- **Database suite:** the nine cuts are assertions whose every failure is already a failure of a neighbour: the exact claimed set in `deliver`, the decide row for the same inputs in `reconcile`, the unique key, a refusal's second parameter, setup steps that `commands.test.sql` already proves (the pattern the 22 October commits applied to four other files), and a second kind through the same `distinct on`.
- **Edge Function suite:** nothing to cut. The whole-message tests stay because each checks that the facts land in the text, as on 21 October.
- **End to end:** `move-deadline` moves the Deadline of an Adventure whose Deadline has passed but which the clock has not yet marked Overdue, so which stage it exercises depends on timing; `overdue-move` ticks first and asserts the same outcome. With `commands.move_deadline` broken to leave an Overdue Adventure Overdue, `overdue-move` failed and `move-deadline` passed.
- **Of the 21 October report's 13 suspected database cuts:** nine are proven and cut here; two were cut by the 22 October commits; `trail_after.test.sql:194` (cannot fail: `p_after` defaults to null) and `health.test.sql:285` were not confirmed by reading and stay.

## Cuts

### Unit

| path:line | Name | Verdict | Evidence | Outcome |
|---|---|---|---|---|
| src/lib/barry/alarms.test.ts:76 | moves both alarms with the Deadline and gives the same result when run again | Duplicate of `alarms.test.ts:63` ("schedules what is due and cancels the alarms of an Adventure that is no longer live", whose fixture already holds `barry.reminder.a1` and so pins that scheduling again replaces) and of `:92` ("applies syncs in order") for the repeated sync | Break 1, `alarms.ts` `apply` schedules only identifiers not yet scheduled: `:63` and `:76` fail. Break 2, `apply` runs once: `:76` and `:92` fail. No break fails `:76` alone. The spec sentence "a moved Deadline moves both" (docs/spec.md:152) stays pinned through `:63`. |**cut** d1d479b |
| src/lib/barry/rows.test.ts:139 | keeps a Profile without a phone number | Unhelpful: a parser copying a column into a same-named field with no transformation (`rows.ts:49` `phone: row.phone`) | The only edit that fails it, `phone: row.phone ?? ''`, invents a transformation the code does not have; it fails this test alone (162 of 163 pass). The optional phone is pinned where it matters: `messages.en.test.ts:193` and `messages.de.test.ts:147` (the Alert leaves the phone line out) and `access.test.sql`. |**cut** 8696acd |

### Database

| path:line | Name | Verdict | Evidence | Outcome |
|---|---|---|---|---|
| supabase/tests/database/deliver.test.sql:71 | A row in retry backoff is not claimed yet | Duplicate of `:60`, "claim takes exactly the due rows that nothing ahead of them blocks", whose exact set leaves `b@` out | `claim_messages` without `m.next_attempt_at <= now()`: `:60` and `:71` fail together |**cut** a222ab2 |
| supabase/tests/database/deliver.test.sql:72 | An All-clear waits until the Alert to its address is settled | Duplicate of `:60` | `claim_messages` with the All-clear-waits clause replaced by `false`: `:60`, `:72` and `:140` fail together |**cut** a222ab2 |
| supabase/tests/database/deliver.test.sql:75 | A row with a live lease is left alone | Duplicate of `:60` | `claim_messages` claiming every `sending` row regardless of its lease: only `:60` fails; `:75` still sees `sending` and cannot catch the break, and no other edit of `claim_messages` changes `g@`'s status (22 October already cut its twin in the claimed set, a919067) |**cut** a222ab2 |
| supabase/tests/database/reconcile.test.sql:62 | Before the Reminder time the Adventure stays Active | Duplicate of `decide.test.sql:21`, "Active long before the Deadline owes nothing", with the same inputs (Active, Deadline 18:00, set 08:00, now 16:00); `reconcile.sql:55` runs no update on an all-null decision, so no single edit of `reconcile` fails it alone | `decide` marking every Active Adventure Overdue: `decide.test.sql:21` and `reconcile.test.sql:62` fail together (with 10 others) |**cut** 7bba3fe |
| supabase/tests/database/reconcile.test.sql:169 | The Alert rounds are 1, 2 and 3 | Duplicate of `:176`, "Each round reached the same four contact rows" (12 rows): under the unique key with one `for_deadline`, 12 Alert rows for four addresses are rounds 1, 2 and 3 | `decide` giving every later Alert round 2: `:169` and `:176` fail together |**cut** 7bba3fe |
| supabase/tests/database/commands.test.sql:277 | The Adventure with an All-clear being sent still exists | Parametrised duplicate of `:270`, "The Adventure with a pending All-clear still exists"; the two statuses of `status in ('pending', 'sending')` are pinned by the refusals at `:268` and `:275`, which stay | `commands.delete_adventure` deleting before the messages check: `:270` and `:277` fail together |**cut** cfc4bee |
| supabase/tests/database/plan_update.test.sql:43 | Saving an unchanged Plan is accepted | Setup written as an assertion: `commands.test.sql:194` pins that an Active Adventure accepts a save; `:47` is the decision. The call stays as a bare `select`, as the 22 October commits did in four other files | `commands.save_adventure` refusing `wrong_stage` for Active: `commands.test.sql:194` and `plan_update.test.sql:43` fail together (with 12 others) |**cut** 527a354 |
| supabase/tests/database/plan_update.test.sql:50 | The destination can be put on the map while the Adventure is Active | Same pattern; `commands.test.sql:124` pins the point itself and `:55` is the decision | Same break: fails together with `commands.test.sql:194` |**cut** 527a354 |
| supabase/tests/database/shared_address.test.sql:43 | A shared address gets one Alert per channel | Parametrised duplicate of `:35`, "A shared address gets one Heads-up per channel": both pin `distinct on (r.channel, r.address)` in `enqueue_to_contacts`, and the kind reaches no other branch of it. Its setup call at `:41` goes with it | `enqueue_to_contacts` without `distinct on`: the duplicate rows hit the unique key on the Start, so `:27`, `:35` and `:43` fail together |**cut** d29d4a8 |

### Edge Function

None.

### End to end

| path | Name | Verdict | Evidence | Outcome |
|---|---|---|---|---|
| e2e/move-deadline.e2e.mjs | moving the Deadline of an overdue Adventure keeps the Alert from going out | Subset of `e2e/overdue-move.e2e.mjs`, "moving the Deadline of an Adventure the clock marked Overdue makes it Active again, and no Alert goes out": same Start, same `missDeadline(id, 4.5)`, same move, same `sleep(90)`, same two Alert assertions; it only leaves out the tick, so the Adventure is usually still Active at the move. The position arguments it passes are pinned by `move-records-position` | `commands.move_deadline` keeping the stage: `overdue-move` failed ("the move makes it Active again", actual `overdue`) and `move-deadline` passed |**cut** cc7b6ac |

## Kept with doubt

**Unit**

- `rows.test.ts:85` "parses an Ended Adventure with its Check-in time and Alert count": proposed as a duplicate of `:91`, but reading `checked_in_at` from `started_at` fails it alone, so it pins which column the Check-in time comes from.
- `rows.test.ts:104` "keeps a switched-off address with its switch" and `:70`: close to column copies, but the first pins "A switched-off address is kept" and the second is the only test of `latestPosition`.
- `adventure-cache.test.ts:18`: set and read back, but the only test that the cache survives a restart, which the offline fallback depends on.
- `phone-contact.test.ts:19`: mostly libphonenumber; the Barry code in between is the null region.
- `wording.test.ts` and `theme.test.ts`: as on 21 October.

**Database**

- `commands.test.sql:117`: pins the old seven-argument `save_adventure` pass-through, which its migration says to remove in the next release; the test goes with it.
- `decide.test.sql:68`: `decide()` is immutable, a declared property.
- `tick.test.sql:103`: the cron schedule string, the spec's "every minute".
- `access.test.sql:127`: the grant and the current `channel_config` state; the state half flips when text messages are switched off.
- `deliver.test.sql:144`: the facts of a Reminder, a kind the server no longer sends (push is off).
- `trail.test.sql:214` "A late Alert retry after the Check-in carries the newest reading": looks implied by `:195` and `:150`, but it is the only assertion on `message_facts` after the Check-in.
- `reconcile.test.sql:189`: the same decision as `commands.test.sql:335` with a different count, kept as the baseline for `:222`.
- `account.test.sql:81`: proposed as implied by `:79`, but a `delete_account` that deleted every Adventure would fail it alone.

**Edge Function**

- `messages.en.test.ts:108` (the Overdue Notice template) and `deliver.test.sql:144`: the server never enqueues the kind; the template, the enum value and the test should go together (consistency audit M6).
- `delivery-report.test.ts:9`: its last assertion is a tautology; the path, `message` and 32-hex assertions carry the test.

**End to end**

- `delete-account`, `delete-account-refused-while-overdue`, `delete-account-refused-while-alerted`, `contact-in-use-while-overdue`: the only coverage of those stage values at this layer, as on 21 October.

## Suspected

None. The stack and Deno ran here, so every candidate was settled.

## Gaps noticed on the way

- `retry_backoff`: only the 30-second step is pinned (`deliver.test.sql:95`); the 1, 2, 5 and 10 minute steps are not, though the spec names the schedule as pinned there.
- The `limit 500` in `record_trail` (spec, Limits that live in the code) has no test.
- The cross-Deadline Alert ordering in `claim_messages` (`(e.for_deadline, e.round) < (m.for_deadline, m.round)`) has no test: `deliver.test.sql` has one `for_deadline`, and `move-after-alert` sends every Alert before the next Deadline is missed.
- A failed Deadline Update is nowhere shown as a Delivery Failure; the other four kinds are.
- Refusals with no test at any layer: `move_deadline` → `wrong_stage` on Planned and Ended and `not_found`; `check_in` → `not_found`; `save_adventure` → `not_found`, `destination_missing` on an Active edit, `wrong_stage` on Ended.
- `report_delivery` overtaking `settle_message` (`provider_ref` null, status `sending`), and `health().outbox_ok` for a `sending` row with a lease older than five minutes, are untested.
- `start` → `unconfirmed` without signal and after a failed refetch, `checkIn` → `ended`, `removeContact` → `in_use`, `getInProgressAdventure`'s offline fallback with `offlineSince`, and `deliveryFailures` have no unit test in `client.test.ts`.
- The `FENCE_MOVE_M` boundary itself (50 m) is not pinned; `trail.test.ts:238` uses 11 m and 155 m.
- German texts with `ss` and never `ß` (spec, Channels): no test pins it; ß is in GSM-7, so the GSM-7 tests do not.
- No end-to-end case waits the real three-minute Deadline Update delay, confirms a sign-up email, or lands on `/confirmed`.
- `formatDuration` (English) has no test; `formatDurationGerman` has.

## Commits

1. d1d479b The alarms tests leave the moved Deadline to the sync that already replaces a scheduled alarm and to the ordered syncs
2. 8696acd The rows tests no longer check that a Profile without a phone number is copied as it is, which the Alert tests pin where it matters
3. a222ab2 The deliver tests leave the row in retry backoff, the All-clear behind its Alert and the row under a live lease to the exact set of claimed rows
4. 7bba3fe The reconcile tests leave the Active stage before the Reminder to the decide row with the same inputs, and the Alert rounds to the twelve rows the unique key allows
5. cfc4bee The commands tests prove once that a refused deletion keeps the Adventure, for the pending All-clear, since the one being sent takes the same branch
6. 527a354 The Plan Update tests save the unchanged Plan and the destination point as steps, since the commands tests already prove that an Active Adventure accepts a save
7. d29d4a8 The shared address test proves one message per channel through the Heads-up alone, since an Alert takes the same distinct on
8. cc7b6ac The end-to-end suite proves a Deadline move on an Overdue Adventure once, through the case that lets the clock mark it Overdue first

The first full end-to-end run after the cut failed in `deadline-update.e2e.mjs`, which still expected the Deadline Update to say "check-in time" after the consistency audit changed it to "deadline". That fixture followed in ab41071, a commit of the consistency step, not a cut; the suite then passed 48 of 48, and the pruning commit followed.

## Skipped

None of the proven cuts were skipped. One proposed cut was rejected on proof: `rows.test.ts:85`, see **Kept with doubt**.
