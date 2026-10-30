# Test pruning (`/barry-prune-tests --fix`)

Branch `claude/barry-maintenance-27f3d4`, the third step of the maintenance pass of 30 October 2026. The pass of 28 October pruned the four suites; this one read in full every test file added or changed since (26 files) and checked the new tests against the ones already there.

## 1. Summary

| Suite | Before | After | Duplicates | Unhelpful | Suspected |
|---|---|---|---|---|---|
| Unit (Jest) | 241 in 32 suites | 240 | 1 | 0 | 0 |
| Database (pgTAP) | 301 in 17 files (285 declared plans and decide's 16) | 301 | 0 | 0 | 0 |
| Edge Function (Deno) | 36 | 36 | 0 | 0 | 0 |
| End to end | 83 files | 83 | 0 | 0 | 0 |

The Jest and Deno suites ran. The pgTAP and e2e suites did not: the local stack is not running in this session, so their verdicts rest on reading, and no cut was marked there.

Files read: `conditions.test.ts` (28 tests, new), `daylight.test.ts` (8, new), `scripts/changed-inputs.test.ts` (3, new), `constant-time.test.ts` (1, new), `pace.test.sql` (10, new), and the changes to `client.test.ts`, `limits.test.ts`, `phone-contact.test.ts`, `warnings.test.ts`, `keychain-session.test.ts`, `signed-fetch.test.ts`, `texts.test.ts`, `delivery-report.test.ts`, `messages.en.test.ts`, `messages.de.test.ts`, `limits.test.sql`, `access.test.sql`, and the nine e2e files `alerts-stop-at-nine`, `contact-keeps-its-address`, `eleventh-contact-is-refused`, `long-deadline`, `plan-update-waits`, `sixth-contact-on-an-adventure-is-refused`, `sixth-start-in-a-day-is-refused`, `ten-contacts-per-adventure`, `text-fields-have-length-limits`.

What the new tests pin: the Conditions tests pin the rounding the spec names (`POINT_DECIMALS`), the refresh boundary (`CONDITIONS_REFRESH_MS`, one millisecond before and at), the kept places (`KEPT`), the choice of bulletin region and validity period, the fallbacks for a failed, a malformed and a stale load (the kept-valid-bulletin test is the regression test of cafc8b9), and the Adventure Day boundaries; the daylight tests pin the solar formula against suncalc in two seasons, the civil twilight boundary on both sides and the midnight sun; the pgTAP and e2e additions each pin a promise of the spec added since 28 October (the pace, the nine Alerts, the year-ahead Deadline, the pruned Starts, the length limits, the ten contacts over an Adventure, the address a contact in use keeps).

## 2. Cuts

### Unit

| Where | Name | Verdict | Evidence | Outcome |
|---|---|---|---|---|
| src/lib/barry/conditions.test.ts:226 | asks again at once for another place | duplicate of "keeps the Conditions of the newest places only" (line 177) | With `samePlace` broken to always return true, both tests fail and no other does; the keeper also pins `KEPT`. Reverted with `git checkout`. | **cut** 36cf576 |

### Database, Edge Function, end to end

None.

## 3. Kept with doubt

- `conditions.test.ts` "says Conditions need signal when none are kept": its state and assertion are nearly those of the end of "forgets the kept Conditions on this phone", but it is the direct test of the spec's "with none kept it says Conditions need signal", so it stays.
- `conditions.test.ts` "keeps the forecast and marks the bulletin unavailable when it is malformed" reaches the same `catch` as "marks the bulletin unavailable when it fails to load"; it stays because it pins that the parse runs inside that catch, which the fetch-failure test cannot tell.
- `texts.test.ts` "say in both languages when the Deadline is after Dark ...": its `afterDark` and `forecastFrom` assertions compare a text with a copy of itself, which would be a cut on their own, but the same test pins the `dry(null)` and `dry(day)` branches and the `hour(...)` branches for a missing precipitation value and a thunderstorm, so it stays whole.
- `limits.test.ts` "matches what the migration enforces" and the first seven assertions of `limits.test.sql`, and `pace.test.sql:6`, assert constants equal literals; the spec names these files under **Limits that live in the code**, so they stay.
- `pace.test.sql:59` "a first Deadline Update waits only its usual 3 minutes" restates the delay `deadline_update.test.sql:50` already pins, but here it pins that `pace_updates` with no earlier update leaves that delay alone (the `greatest` over a null pace), which the other file cannot tell.
- `daylight.test.ts` "is Dark only once civil twilight has ended" asserts `DARK_ALTITUDE` is -6 beside its boundary; the spec names the 6 degrees, so the assertion is a promise, not a restated constant.

## 4. Suspected

None.

## 5. Gaps noticed on the way

- No test pins what the Adventurer sees when a Deadline more than a year ahead is refused (`barry:deadline_too_far` has no text in `texts.ts`; the consistency audit's C-3).
- No pgTAP or e2e case covers `guard_account_delete`'s `barry:adventure_in_progress` on a direct `auth.users` delete; the command `delete_account` refuses before it, and `delete-account-refused-while-*` cover that.

## Commits

1. 36cf576 The Conditions tests pin the cache per place once, through the test that keeps the newest places, instead of twice

After it: `npm test` 240 of 240, `npx expo lint` clean, `npx tsc --noEmit` 0 errors.

**Skipped:** none.
