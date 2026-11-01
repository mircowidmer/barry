---
name: barry-verify
description: Verify all of Barry by running barry-backend-verify (the migrations, the commands, the clock and deliver against the local stack) and then barry-frontend-verify (the app in the iOS Simulator), and report both. Read-only unless invoked with --fix, which then fixes every failure the two found, on the side that is wrong, commits each fix on its own and proves it again. Use when asked to verify everything, to check that Barry still works end to end, or to find and fix what is broken.
---

# Verify Barry

You are verifying the repository at the current working directory, Barry, in two halves.
Each half is a skill of its own under `.claude/skills/`.
Invoke it with the Skill tool and follow its instructions to its end before you start the next one.
This skill adds no checks of its own.
It fixes the order, collects what failed, and with `--fix` repairs it.

## Arguments

- No argument: run both halves and report.
  Nothing in the repository changes; the proof goes to `.verify-artifacts/`, which git ignores.
- `--fix`: run both halves, then fix every failure as **Fixing** describes, and commit each fix.

Any other argument is an error.
Say so and stop.

## The order

1. **`/barry-backend-verify`.** Run its full suites: `deno test supabase/functions/deliver`, `npx supabase test db` and `npm run e2e`.
   It comes first because the app stands on the stack: an Alert the clock does not send fails on the screen too, and a backend failure found here saves a slower one found in the simulator.
2. **`/barry-frontend-verify`.** Drive the baseline of its feature files against the same stack.
   Without a Mac and the iOS Simulator, as in a cloud session, it reports every step as unverified, and you go on to the report.

Both halves share one stack: Supabase and the text message relay that barry-backend-verify's **Launch** starts.
Start them once, before step 1, and stop at the end only what this run started.

Keep the user's local data.
Bring a stack that is missing migrations up to date with `npx supabase migration up --local --include-all`, which applies only the missing files.
Never `npx supabase db reset --local` unless the user said so: it deletes the test account and every Adventure on it.

## Fixing

Only with `--fix`, after both halves have reported.
Take the failures one at a time, backend before frontend.

1. **Rule out the environment.** A stack that is down, a relay that is not listening, a simulator that is not booted or a build that is stale fails a check without any code being wrong.
   Run the doctor of the half, restore what it names, and run the failing check once more.
   If it passes now, it was no defect: list it in the report, and change nothing.
2. **Find which side is wrong.** A failing check is the code and its test disagreeing.
   Decide which one moved:
   - `docs/spec.md`, `CONTEXT.md` and `docs/adr/` are the contract.
     Code that breaks them is wrong.
   - A test, an e2e case or a feature file that still expects a behaviour a commit changed on purpose is stale.
     `git log -S '<value>'` over the code it tests shows the change, such as a constant that moved from 1 to 5 minutes, and the test must follow it.
   - If the contract itself is silent or contradicts the code and its commit, the fix needs a decision.
     Skip it and report both sides quoted.
3. **Fix the wrong side, and only it.** Change the code to match the contract, or the stale test to match the deliberate change.
   Never weaken an assertion, widen a timeout or delete a case to get it green: a test may only change to state the new behaviour exactly.
4. **Prove the fix.** Rerun the check that failed, then the checks the map of the half names for the files you touched.
   For a fix in `src/` or `src/lib/barry`, terminate and relaunch the app first: the development build does not pick up an edit through Fast Refresh.
   If the fix breaks any check, revert it and report it as skipped.
5. **Commit it on its own.** Stage only the files of this fix (`git commit -- <paths>`), never `git commit -a`, which also takes whatever else is in the working tree.
   The title is one prose sentence naming the behaviour, in the glossary's terms, as AGENTS.md asks.

Skip, and report instead of fixing, anything that needs the hosted project (`db push`, `functions deploy`, hosted secrets), a new dependency or a native rebuild, a change to the spec or the ADR, or more than two attempts.

After the last fix, run the full suites of every half that a fix touched once more, so the run ends with one green pass, not with a set of single green checks.

## How to work

- Start step 2 only once step 1 has written its report.
  Never drive the simulator while the e2e suite runs: both use the one stack and the clock.
- If a half stops on an error of its own launch, report it and go on to the next half or the report.
  Do not fix the harness under `.claude/` with `--fix`; a broken skill is a finding for the author.
- Do not repeat a half's report in full.
  Each stands on its own.

## Report

One table with a row per half: the skill, the checks run, passed, failed and unverified, and with `--fix` the commits and the skipped fixes.
Below it:

- Every failure, with the check, the side that was wrong and, with `--fix`, the commit that fixed it or the reason it was skipped, both sides quoted where it needs a decision.
- Every unverified check or step, with its unmet precondition.
- The path of each half's proof under `.verify-artifacts/`.
