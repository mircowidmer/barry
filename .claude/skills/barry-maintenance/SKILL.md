---
name: barry-maintenance
description: Run Barry's five maintenance skills one after another in the order where each one's changes feed the next: barry-assure-code-quality, barry-audit-consistency, barry-prune-tests, barry-e2e-gaps twice, then barry-update-readme. Read-only unless invoked with --fix, which passes --fix to every step so each commits its own changes. Use when asked for a maintenance pass, a full clean-up of the repository, or to run all the maintenance skills.
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
6. **`/barry-update-readme`.** It comes last because every earlier step can change the commands, test suites, files, guides and skills the README describes.

Steps 4 and 5 need the local stack and the SMS relay that the README's **Check it** names. Start them before step 4 if they are not running.

## How to work

- Start each step only once the previous one has written its report and, with `--fix`, made its commits. Never run two steps at the same time: each reads the repository the step before left behind.
- If a step stops with an error, or with `--fix` leaves the working tree dirty, stop the pass there and report which step stopped and why. Do not go on to the next step over a broken tree.
- Do not repeat a step's report in full. Each step's report stands on its own.

## Report

After the last step, write one table with a row per step: the skill, the number of findings, and with `--fix` the number of commits and skipped fixes. Below it, list the findings any step left for the author, each with the step that raised it.
