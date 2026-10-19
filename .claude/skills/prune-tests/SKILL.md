---
name: prune-tests
description: Go through Barry's four test suites (the Jest unit tests, the pgTAP database tests, the Deno tests of deliver and the e2e cases), keep only the tests whose failure would tell the author something, delete the duplicates and the tests that cannot catch a mistake, such as setter and getter tests, and commit each file's cuts with the proof. Use when asked to prune, dedupe, slim down or clean up the tests, or to say which tests are not worth keeping.
---

# Prune Barry's tests

You are pruning the tests of the repository at the current working directory, Barry: an Expo SDK 58 iPhone app with a Supabase backend that alerts an Adventurer's Emergency Contacts when a Deadline passes without a Check-in. Your job is to keep every test whose failure would tell the author something they would act on, and to delete the rest. The deliverable is a slimmer suite that still fails for every mistake the old one caught, and a report that says what went and why.

## The four suites

| Suite | Files | Runner | Needs |
| --- | --- | --- | --- |
| Unit | `src/**/*.test.ts`, one `it(...)` per test | `npm test` | nothing |
| Database | `supabase/tests/database/*.test.sql`, pgTAP | `npx supabase test db` | the local stack |
| Edge Function | `supabase/functions/deliver/*.test.ts`, one `Deno.test(...)` per test | `deno test supabase/functions/deliver` | deno |
| End to end | `e2e/*.e2e.mjs`, one `test(...)` per file | `npm run e2e` | the local stack and `node scripts/sms-relay.mjs` |

Each pgTAP file declares `select plan(N)` near the top, or computes N from a `cases` table as `decide.test.sql` does. Every assertion you remove lowers N by one, or removes one row from `cases`. `e2e/stack.mjs` is the helper the cases share, not a test. The sentence in `.claude/skills/verify/SKILL.md` that begins with `npm run e2e` names every e2e case.

## Arguments

- No argument: inventory, decide, delete, commit each file's cuts.
- `--dry-run`: inventory and verdicts only. Change nothing.
- A path, such as `src/lib/barry` or `e2e/trail.e2e.mjs`: limit the inventory to the tests under it. Can be combined with `--dry-run`.

Any other argument is an error. Say so and stop.

## What earns a test its place

A test stays when its failure would tell the author something they would act on. That is the case when it pins one of these:

1. **A promise.** A row of the stage table or the message table in `docs/spec.md`, a rule in the spec's prose or in CONTEXT.md, a refusal, a claim in `docs/adr/0001-server-owns-the-deadline.md`, or a limit the spec names under "Limits that live in the code". The spec says there that `trail-buffer.test.ts` pins `MAX_SLOTS` and `BATCH` and that `deliver.test.sql` pins `max_attempts`, `retry_backoff` and the lease, so those tests stay although they assert constants.
2. **A decision in the code.** A branch, a boundary (one second before, exactly at, one second after), an ordering, a lock, a race, a fallback, a rounding rule, a format.
3. **A bug that was fixed.** `git log -S '<test name>' --oneline` or `git log --follow -- <file>` finds the commit that added the test. A message that describes the wrong behaviour the test now rules out makes it a regression test.
4. **The wiring between layers.** An e2e case proves that a command reaches Supabase, that the clock and `deliver` do their part, and that Mailpit and the relay receive what the contacts would. Each e2e file is one such case.

## What does not

- **Setter and getter tests.** A value is set and read back; a constructor keeps its arguments; a parser copies a column into a field of the same name with no transformation; a type guard accepts the fixture it was handed.
- **Tautologies.** The expected value is computed by the code under test or by the same formula; a mock is asserted to have been called with the arguments the test itself passed; `toBeDefined` on something the type already guarantees; an assertion on the fixture instead of on the result.
- **Tests of a dependency.** That `Intl` formats a date, that supabase-js builds a query, that Postgres enforces a `not null`, where no Barry code stands between the test and the library. A check constraint, a trigger or a policy from a migration is Barry code, and one test of it stays.
- **Restated constants.** A test that asserts a constant equals a literal, except the ones the spec names above. A test that asserts a string from `src/lib/texts.ts` equals the same string copied into the test, since both sides would be changed together. A template test that compares the whole rendered message with a copy of the template is the same thing; one that checks the facts land in the message (the Deadline, the link, the Profile fields, the language) is not.
- **Tests that cannot fail.** No assertion, an assertion that always holds, or inputs that never reach the branch the name claims.
- **Duplicates within one suite.** Two tests that pin the same decision on the same side of the same boundary. Parametrised rows that reach the same branch with no new boundary are duplicates of each other: keep the boundary rows and one in the middle. A test whose inputs and assertions are a subset of another's is a duplicate of that other.

These are not duplicates, and both stay:

- The same behaviour at two layers, such as a unit test of `check-in-queue.ts` and the e2e Check-in. Each catches a mistake the other cannot.
- The English and the German template of one message. Both languages move together and each has its own test.
- A happy path and its refusal; the two sides of a boundary; the same command on a Planned and on an Active Adventure.
- A pgTAP assertion on a row and the Edge Function test that consumes the same row. One tests SQL, the other TypeScript.

## How to work

1. **Inventory.** Find every test: `grep -n "^\s*\(it\|test\|Deno\.test\)("` over the TypeScript and JavaScript suites, and every `is(`, `ok(`, `isnt(`, `throws_ok(`, `lives_ok(`, `results_eq(`, `bag_eq(`, `is_empty(` and every row of a `cases` table in the pgTAP files. Read each test file fully before writing its lines; do not judge from names. For each test write one line: suite, `path:line`, name, what it asserts in one sentence (the decision, not the function name), and what it pins from the list above, or "nothing".
2. **Group** by what is pinned. Within one suite, tests in one group are duplicate candidates. Pick the keeper: the one that covers the boundary, has the clearest name and needs the fewest fixtures.
3. **Prove a duplicate before cutting it.** In the unit and Edge Function suites, break the decision the pair pins with a scratch edit to the code (flip the comparison, return the other branch), run the suite, note which tests fail, and revert the edit with `git checkout -- <file>`. If the keeper fails, the other is redundant and goes. If only the candidate fails, it is not a duplicate: keep both and write down what the keeper misses. In the database and e2e suites do the same when the stack is running. Without it, cut only a textual duplicate, with identical inputs and assertions, and report the rest as suspected.
4. **Verdicts.** Every test gets one: keep, with what it pins; delete as a duplicate of a named keeper; or delete as unhelpful, with the rule above that applies. A test that looks weak but pins a promise is kept, with a note.
5. **Apply, one file at a time.** Remove the whole `it`, `test` or `Deno.test` block, the fixtures and helpers only it used, and the imports that become unused. In pgTAP, remove the assertion or the `cases` row and lower `plan(N)`. When an e2e file goes, remove its case from the sentence in `.claude/skills/verify/SKILL.md` in the same commit. Then run the suite you touched, `npx expo lint` and `npx tsc --noEmit`. If anything fails, `git checkout -- <files>` and mark the cut skipped with the output. If all pass, commit that file's cuts alone, in the style of the repository's history: one sentence that says what the reader now sees, not what the diff does, for example "The rows tests keep one case per branch of parseAdventure instead of one per column", followed by the attribution lines the session requires.

Never: delete a test to turn a failing suite green; weaken an assertion instead of deleting it, or change a test's inputs so that a duplicate looks different; delete the only test of a promise, a refusal or a named limit; add a test, because a gap is a finding for the author; leave a changed implementation behind, since the scratch break in step 3 is reverted before anything is committed; touch tests outside the path given as the argument; push. If the current branch is the default branch, create a branch first and say which.

## Report

Write the report in Markdown with these sections, in this order:

1. **Summary**: per suite, the tests before and after, the duplicates cut, the unhelpful tests cut, the suspected cuts not applied, and the suites you could not run and why.
2. **Cuts**: one table per suite with `path:line`, name, verdict (duplicate of which keeper, or unhelpful by which rule), the evidence (the break that proved it, or the rule), and the commit hash.
3. **Kept with doubt**: tests that look weak but pin something, with what it is.
4. **Suspected**: cuts not applied for lack of the stack or deno, with the command that would settle each.
5. **Gaps noticed on the way**: a promise, refusal or limit with no test, one line each. Not yours to fill.

With `--dry-run`, the cuts carry no commit hash and say "would cut".
