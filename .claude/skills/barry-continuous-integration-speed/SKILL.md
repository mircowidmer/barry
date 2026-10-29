---
name: barry-continuous-integration-speed
description: Find where the time goes in Barry's continuous integration workflow (.github/workflows/ci.yml, the jobs that lint, type-check, test, build the Trail Map and the iOS app) from the measured durations of recent runs, and report each speed improvement with its measured cost, its expected saving and what the workflow still proves afterwards. Read-only unless invoked with --fix, which then applies the certain changes that keep every check and commits each one. Use when asked why CI is slow, to speed up or shorten the pipeline, to cut Actions minutes, or after a job's duration grew.
---

# Speed up Barry's CI

You are looking for speed improvements in the continuous integration of the repository at the current working directory, Barry: an Expo SDK 58 iPhone app with a Supabase backend that alerts an Adventurer's Emergency Contacts when a Deadline passes without a Check-in. `.github/workflows/ci.yml` is the verification: on every pull request and every push to `main` it lints, type-checks, runs Jest and Deno, builds the Trail Map site, brings up the local Supabase stack for pgTAP and the end-to-end cases, exports the iOS JavaScript bundle, and, when native inputs changed, builds the iOS app on a macOS runner. The deliverable is a report that says where the minutes go and which changes win them back, and, with `--fix`, the certain changes applied, one commit each.

Faster means three things, in this order: the **wall-clock** of a pull request's checks, which is the **critical path** (the longest job, queue and setup included); the **billed minutes** of a run, where a macOS minute costs ten Linux minutes; and the **time to red**, how long a mistake takes to turn the run red. Faster never means proving less. A change that drops a check, skips a job on `main`, or trusts a cache across the inputs it was keyed on is not a speed improvement, whatever it saves.

## Arguments

- No argument: measure, analyse, report. Change nothing.
- `--runs N`: measure the last N successful runs instead of the default of twenty.
- `--fix`: measure, analyse, write the report, then apply the changes the section **Applying changes with --fix** allows, and commit each one. The report comes first either way, so a change is never applied to a finding the report does not name.

Any other argument is an error. Say so and stop.

## Measure first

A finding without a measured cost is a guess, so the numbers come before the reading.

1. Run `node .claude/skills/barry-continuous-integration-speed/scripts/timings.mjs --runs 20` from the repository root. It reads the recent successful runs of `ci.yml` through `gh` and prints, for pull requests and for `main` separately: the median wall-clock of a run, the median and the longest duration of every job, the median of every step within a job, and the critical path. Pass `--json` for the raw table when you want to compute more.
2. Run `gh cache list --limit 50` and `gh api repos/{owner}/{repo}/actions/cache/usage`, and read the `ccache --show-stats` output of the latest `ios` job (`gh run view <id> --log --job <job-id>`) for the hit rate. A cache that is restored but rarely hit costs its restore time for nothing.
3. Read the workflow itself, `.github/workflows/ci.yml`, with `git log --oneline -- .github/workflows/ci.yml`: the history names what was sped up already, and a finding that reverses one of those commits needs a reason the commit did not have.

When `gh` is missing or not signed in, say so in the report, estimate from the step names and mark every number as an estimate. An estimate never becomes a `--fix`.

## The levers

Each lever names the test that turns it into a finding. A lever whose test fails is a line under **Checked and already fast**, not a finding.

1. **The critical path.** The longest job bounds the wall-clock, so a saving elsewhere is a saving of billed minutes only. Test: does the job sit on the critical path of a pull request, of `main`, or of both? A job that only runs on `main` or on native changes (`ios`) has its own critical path, measured separately.
2. **Setup repeated per job.** Every job checks out and installs, so `npm ci` runs as many times as there are jobs. Test: the setup steps' median summed over the jobs, against one install shared through an artifact or a `node_modules` cache keyed on the lockfile and the Node version. `actions/setup-node`'s `cache: npm` keeps the download cache, not `node_modules`, so the install still runs.
3. **Waiting.** Fixed sleeps, polls with long intervals, a health check that waits for pg_cron's first tick, images pulled on every run. Test: the time between a step's start and the first useful work it does, from the step's log. A poll that sleeps ten seconds between tries loses up to ten seconds per try.
4. **The same work twice.** Two jobs that export the same bundle, prebuild the same project or build the same site; a workflow that rebuilds on `main` what the pull request already built. Test: two steps whose inputs and commands are the same, in one run or across `ci.yml` and `trail-map.yml`.
5. **Jobs that run when nothing they test changed.** The `native` job already gates the iOS build on the files that reach the native project. Test: a job whose inputs are a subset of the repository that a class of pull requests never touches, provided the job still runs on `main` and the gate lists every input, the workflow file itself included.
6. **Cache misses.** `ccache`, CocoaPods, the npm download cache, Deno's `DENO_DIR`, Docker images for the Supabase stack, Xcode's derived data. Test: the restore time plus the hit rate against the time the cached work takes cold. A key that never matches, or a cache above the repository's limit so that the newest entry evicts the one the next run wants, is a miss every run.
7. **The runner.** A larger runner, an arm64 Linux runner for the Docker-heavy `backend` job, or a different macOS image with the Xcode version preinstalled. Test: the expected saving against the price per minute, which the report states, so the author decides.
8. **Parallelism inside a job.** Jest's workers, the end-to-end suite's `--test-concurrency`, which the local Auth's sign-in rate limit bounds (the commit that set twelve says what it takes), pgTAP files that run one after another, serial steps with no dependency between them that could be two jobs. Test: the runner's cores against what the suite uses, and the job's duration against the sum of its steps.
9. **Time to red.** The cheap checks that catch most mistakes (lint, types, Jest) ahead of the expensive ones, `fail-fast` where a matrix exists, the `concurrency` group that cancels a superseded run. Test: the median time from a run's start to its first failed step, over the recent failed runs (`--status failure`).
10. **Checkout depth and action versions.** `fetch-depth: 0` only where a job diffs or walks history; actions pinned to a major that still receives updates. Test: the checkout step's duration where the history is not used.

Sources for the rules: docs.github.com (caching dependencies, larger runners, concurrency, billing multipliers), docs.expo.dev (`expo export`, `expo prebuild`), supabase.com/docs (`supabase start -x`), reactnative.dev (ccache), and the Node.js test runner's `--test-concurrency`. Name the page for every finding that relies on one.

## How to work

1. **Measure** as above, until every job of the last twenty successful runs has a median per step and the critical path is named for pull requests and for `main`. Keep the printed table; the report quotes it.
2. **Map** what each job proves, one line per job, from the workflow and `AGENTS.md`. This is the list that `--fix` must keep intact, so it is written before any change is thought of.
3. **Apply every lever** to every job, in the order above, and write down the test's result each time, pass or fail. A lever is done when every job has a verdict under it.
4. **Rank** the findings by the minutes they take off the pull request critical path, then off `main`, then off the billed minutes. A finding under thirty seconds on the critical path and under five percent of the billed minutes is a note, not a finding.
5. **Report**, then, with `--fix`, apply.

## Report

Write the report in Markdown, in the language the user writes in (German in Swiss High German, with `ss`, never `ß`), with these sections, in this order:

1. **Summary:** the runs measured, the median wall-clock of a pull request and of a push to `main`, the critical path of each, the billed minutes per run, and the three findings that matter most with their combined saving.
2. **Timeline:** the table from `timings.mjs`, one row per job with its median, its longest run and its share of the critical path, and under each job its steps' medians.
3. **Findings,** ranked. One entry each: an identifier (`CI-1`, `CI-2`, …), a one-sentence title, the lever, the job and step with the line of `ci.yml` quoted, the measured cost, the change in one or two sentences, the expected saving on the critical path and in billed minutes, what the job still proves afterwards, certain or likely, and the source of the rule. With `--fix`, each entry also carries an outcome: **applied** with the commit hash and "saving to be confirmed by the next run", or **skipped** with the rule below that stopped it.
4. **Notes:** savings under the threshold, one line each.
5. **Checked and already fast:** one line per lever saying what was measured and why it holds.
6. **Could not measure:** what needed `gh`, a run log that expired, the macOS runner's stats or a price the repository's plan decides, and what each would have shown.

Quote the workflow verbatim with `path:line`. One finding per root cause, with every job it touches. A finding states its saving as a number from the measurement, never as "faster".

With `--fix`, write the report to `docs/reviews/<YYYY-MM-DD>-continuous-integration-speed.md`, like the other maintenance skills' reports, and commit it after the changes, with a message such as `docs/reviews: the CI speed analysis of 29 October 2026, with two changes applied and one left to the author`. Without `--fix`, give it in the reply unless the user asks for a file.

With `--fix`, append the commits made, in order, one line each, and the skipped findings with their rules.

## Applying changes with --fix

Only after the report is complete. Apply a change only when every rule below holds. Skip it otherwise and say which rule stopped it.

1. **The report names it as certain.** A likely finding, an estimate, and anything that depends on a price or a plan is left to the author.
2. **Every check from the map still runs** on the same events with the same inputs. A job that is gated gains a gate that lists every one of its inputs, the workflow file included, and still runs on `main` and on `workflow_dispatch`. A cache gains a key that names every input the cached work depends on. A check never moves behind a condition it did not have.
3. **The workflow stays valid.** After each change run `actionlint .github/workflows/ci.yml` when it is installed, and otherwise parse the file with `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))"`. A change that touches a script the workflow runs also runs that script locally when it can run without the runner.
4. **One finding, one commit,** with a message in the style of `git log -- .github/workflows/ci.yml`: one sentence that names what CI now does, for example "CI's backend job restores the Supabase Docker images from the cache instead of pulling them on every run", followed by the attribution lines the session requires.
5. **The saving is confirmed by a run, not by the commit.** The report marks each applied change "to be confirmed by the next run", and nothing in the report claims a measured saving for a change that has not run yet.
6. **Never push, never open a pull request.** If the current branch is the default branch, create a branch first and say which. Leave pushing to the user unless they asked for it in the same message.
