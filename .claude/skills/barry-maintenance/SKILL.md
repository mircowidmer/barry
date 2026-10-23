---
name: barry-maintenance
description: Run Barry's maintenance skills one after another in the order where each one's changes feed the next: barry-assure-code-quality, barry-audit-consistency, barry-prune-tests, barry-e2e-gaps twice, barry-update-readme, then barry-verify last to prove the backend against the local stack and drive the app in the iOS Simulator. Read-only unless invoked with --fix, which passes --fix to every step so each commits its own changes. Use when asked for a maintenance pass, a full clean-up of the repository, or to run all the maintenance skills.
---

# Maintenance pass

You are running the maintenance skills of the repository at the current working directory, Barry, one after another. Each step is a skill of its own under `.claude/skills/`. Invoke it with the Skill tool and follow its instructions to its end before you start the next one. This skill adds nothing to what they check. It only fixes the order and carries the argument through.

## Arguments

- No argument: run every step without an argument. Each reports and changes nothing.
- `--fix`: run every step with `--fix`. Each reports first, then applies and commits its own changes.

Any other argument is an error. Say so and stop.

## The order

1. **`/barry-assure-code-quality`.** Its fixes do not change behaviour, so it runs while the full test suite still guards them. Renames and moves it makes are drift for step 2 to catch.
2. **`/barry-audit-consistency`.** It catches the drift step 1 caused and corrects the spec, `CONTEXT.md` and the guides, which step 4 reads its use cases from.
3. **`/barry-prune-tests`.** It runs after the refactors, so the tests it cuts still guarded them, and before step 4, so the new e2e cases are written against the pruned suite and are not cut straight away.
4. **`/barry-e2e-gaps`.** It writes the cases the corrected documents promise.
5. **`/barry-e2e-gaps`** a second time. It picks up the gaps the first run left open, such as cases that failed against the stack or that did not fit in one run. If the first run closed every gap, it reports none and you go on.
6. **`/barry-update-readme`.** It comes after every step that changes the repository, because each of them can change the commands, test suites, files, guides and skills the README describes.
7. **`/barry-verify`.** It comes last. It proves the backend against the local stack with the full pgTAP, Deno and e2e runs, then drives the baseline of the app's feature files in the iOS Simulator against the same stack, so the pass ends with proof that both still do what the documents promise. With `--fix`, it fixes each failure on the side that is wrong and commits it; tell it which files the earlier steps' commits touched, so it looks at those first. In a cloud session there is no simulator: it reports every app step as unverified, and the pass goes on to the report.

The proof of step 7 goes to `.verify-artifacts/`, which git ignores, so the pass stays read-only without `--fix`.

Steps 4, 5 and 7 need the local stack and the SMS relay that the README's **Check it** names. Start them before step 4 if they are not running. Step 7 also needs the development build in the booted simulator, as barry-frontend-verify's **Launch** section describes.

## How to work

- Start each step only once the previous one has written its report and, with `--fix`, made its commits. Never run two steps at the same time: each reads the repository the step before left behind.
- If a step stops with an error, or with `--fix` leaves the working tree dirty, stop the pass there and report which step stopped and why. Do not go on to the next step over a broken tree.
- Do not repeat a step's report in full. Each step's report stands on its own.

## Report

After the last step, write one table with a row per step: the skill, the number of findings, and with `--fix` the number of commits and skipped fixes. For step 7, the findings are its failures and the checks and steps it could not verify. Below it, list the findings any step left for the author, each with the step that raised it, and for step 7 the unmet precondition of each unverified check or step.
