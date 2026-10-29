# CI speed analysis, 29 October 2026

Run as `/barry-continuous-integration-speed --fix` on the branch `feature/weather`, with `gh` signed in.

## Summary

Measured: the last 20 successful runs of `ci.yml` (10 pushes to branches, 8 pull requests, 2 pushes to `main`, all on the workflow before today's five commits), the first run of the current workflow (run 40880005289, the pull request of `feature/weather` with native changes), the 4 most recent failed runs for the time to red, the Actions cache store, and a local trial of the end-to-end suite.

| | Before today's commits (median) | Current workflow (run 40880005289) |
| --- | --- | --- |
| Pull request wall-clock | 22m22s | 20m22s with native changes, 5m37s without; after the fixes below 6m22s and 1m34s |
| Critical path, pull request | `ios` 21m58s | `ios` 20m01s with native changes, `backend` 5m37s without; after the fixes `ios` 5m41s and `web` 1m31s |
| Push to `main` wall-clock | 20m13s | not run yet on the current workflow |
| Critical path, `main` | `ios` 19m58s | `ios`, to be measured |

The repository is public, so GitHub bills no minutes for its standard runners ("The use of standard GitHub-hosted runners is free: in public repositories", docs.github.com, GitHub Actions billing). Runner minutes still bound what runs at once: a run with native changes takes about 20 macOS minutes and 10 Linux minutes, one without about 10 Linux minutes.

The findings:

1. **CI-1:** the iOS build compiles without ccache although the job installs it, so the 16-minute Build step is cold on every run. Fixed by exporting `CCACHE_BINARY`; the saving shows in the second run after the fix.
2. **CI-2:** the backend job runs on pull requests that touch none of its inputs; 7 of the last 20 merged pull requests were such. Fixed by gating it like the iOS build; those pull requests finish in about 1m32s instead of 5m37s.

The end-to-end suite, now the longest step of the pull request critical path, was tried locally at twice its concurrency and gained 8s: it waits on the clock, not on processes, so it stays as it is.

## Timeline

Current workflow, run 40880005289 (pull request with native changes). The 20 earlier runs had the same jobs minus `native` and `ios-bundle`, with `e2e` at the Node default concurrency.

| Job | Current run | Median before | Share of the critical path |
| --- | --- | --- | --- |
| iOS Release build for the Simulator | 20m01s | 21m58s | 100% with native changes |
| pgTAP and end-to-end against the local stack | 5m37s | 12m00s | 100% without native changes |
| Trail Map web build | 1m32s | 1m31s | 27% without native changes |
| Lint, types, Jest and Deno | 1m15s | 1m06s | |
| iOS JavaScript bundle | 1m11s | (new) | |
| No commit by Claude | 0m10s | 0m10s | |
| Native changes | 0m07s | (new) | |

Steps of the current run, the longest first:

- `ios`: Build 965s, Generate the iOS project 135s, npm ci 38s, Post Run actions/cache 23s, brew install ccache 16s, setup-node 11s, checkout 3s. The cache restore found no entry for `ios-build-`, and the saved entry holds an empty ccache.
- `backend`: npm run e2e 145s, Start Supabase 90s, Wait for the doctor 42s, npm ci 21s, npx supabase test db 21s, setup-node 8s, checkout 2s. Inside Start Supabase: 17s of `Data limit exceeded` retries against public.ecr.aws before the first pull begins, pulls until 50s (bounded by the postgres image), the database start until 71s, the migrations and the seed until 90s. The doctor waited only for pg_cron's first tick, five tries 10s apart.
- `web`: scripts/trail-map-site.sh 58s, npm ci 22s. `ios-bundle`: expo export 34s, npm ci 26s. `checks`: npm ci 24s, expo lint 13s, npm test 9s, expo-doctor 5s, tsc 5s, the three Deno steps 3s.

Before today's commits, the medians of a pull request were: `ios` Build 18m35s and prebuild 2m07s; `backend` e2e 9m30s, Start Supabase 1m22s, doctor 22s, pgTAP 19s.

Time to red, over the 4 most recent failed runs: the first red step came at 86s and 91s when `supabase start` failed (both after 26 and 27 `Data limit exceeded` retries, then "failed to set up container network"), and at 728s and 783s when the end-to-end suite failed at the old concurrency. The runs themselves ended after 24 to 27 minutes, because the iOS build kept going after the red step.

## Findings

### CI-1: the iOS build never reaches ccache, so every Build is cold

- **Lever:** 6, cache misses. **Certain.**
- **Where:** `.github/workflows/ci.yml:162-166` sets `USE_CCACHE: '1'`, `CCACHE_DIR` and `CCACHE_MAXSIZE` for the `ios` job, `:172` runs `brew install ccache`, `:198-201` runs `xcodebuild`, `:205` prints `ccache --show-stats`.
- **Measured cost:** Build 965s in the current run, 18m35s median before. After the build, `ccache --show-stats` printed `Cache size (GB): 0.0 / 2.0 ( 0.00%)` and no call counts, and the 23s post step saved that empty cache under `ios-build-273f914…`.
- **Why:** `pod install` did its part, the log says `[Ccache]: Setting CC, LD, CXX & LDPLUSPLUS build settings`, and the build log names `ccache-clang.sh` 711 times. But `node_modules/react-native/scripts/xcode/ccache-clang.sh` ends in `exec $CCACHE_BINARY clang "$@"`, and `CCACHE_BINARY` is a build setting of the Pods project, which Xcode exports to script phases, not to compiler invocations. In the compiler's environment it is empty, so the wrapper runs plain `clang`. Proven locally: with `CCACHE_BINARY` unset the wrapper prints `Apple clang version 21.0.0`; with it set, the named binary is called with `clang --version`.
- **Change:** after `brew install ccache`, write `CCACHE_BINARY=$(brew --prefix)/bin/ccache` to `$GITHUB_ENV`, so xcodebuild's compilers inherit it.
- **Expected saving:** the whole Build step is the candidate (965s on the `main` and native-change critical path). The first run after the change fills the cache, the second one measures the hits; `ccache --show-stats` will then print them. Nothing is claimed until then.
- **Still proves:** the same Release build of the same project; ccache only reuses object files whose inputs are unchanged.
- **Source:** reactnative.dev, Speeding up your Build phase (Xcode setup); the wrapper script quoted above.
- **Outcome:** **applied** and **confirmed.** The run after the fix saved a filled cache, and the one after that (run 40896709238 on c2b3205) restored it in 8s and built in 211s instead of 965s, with 1004 of 1506 cacheable compiler calls hitting (66.7%) and the cache at 0.4 GB of its 2 GB cap, so the store pressure in the Notes is smaller than feared; the CocoaPods cache took "Generate the iOS project" from 135s to 57s. The iOS job took 5m41s and the run 6m22s, against 20m22s before.

### CI-2: the backend job runs on pull requests that touch none of its inputs

- **Lever:** 5, jobs that run when nothing they test changed. **Certain.**
- **Where:** `.github/workflows/ci.yml:72-74` (`backend:` … `runs-on: ubuntu-latest`), and the gate the `native` job already computes at `:115-135`.
- **Measured cost:** 5m37s, the whole critical path of a pull request without native changes. Of the last 20 merged pull requests, 7 touched none of `supabase/`, `e2e/`, `scripts/sms-relay.mjs`, `src/lib/database.types.ts`, `package.json`, `package-lock.json`, `patches/`, the doctor script or `ci.yml` (pull requests 1, 3, 7, 9, 10, 15 and 20).
- **Inputs:** the migrations, seed, config, tests and Edge Function under `supabase/`; the cases and `stack.mjs` under `e2e/`, which read `supabase/config.toml` and call `npx supabase`; the relay; the generated types the job checks; the lockfile and the patches; the doctor script the job polls; and the workflow file.
- **Change:** the `native` job becomes `changes` with two outputs, `native` and `backend`; the `backend` job needs it and runs when `backend` is `true`. The gate is `true` on every event but `pull_request`, so `main` and `workflow_dispatch` keep every check.
- **Expected saving:** 4m05s on the critical path of such a pull request (5m37s to the web job's 1m32s). On every other pull request the backend job starts about 7s later, after the `changes` job.
- **Still proves:** the ruleset "main requires CI" lists the job; a skipped job satisfies it ("Successful check statuses are success, skipped, and neutral", docs.github.com, Troubleshooting required status checks), as the gated iOS build already relies on.
- **Source:** the page above; commit bbb62b9, which gated the iOS build the same way.
- **Outcome:** **applied** and **confirmed** by a scratch pull request against this branch (pull request 22, closed unmerged). Its documents-only commit skipped `backend` and `ios` and the run took 94s, the web job's 91s being the longest (run 40896727809). The gate itself moved into `scripts/changed-inputs.sh` with a Jest test, after the review found that a failed diff or a failed gate job skipped the checks; a second scratch commit with a gate job that fails on purpose still ran and passed `backend` and `ios` (run 40897248499).

## Notes

- `backend`: pgTAP (21s) and the types check (1s) run after "Wait for the doctor" (42s), but need no pg_cron tick (`tick.test.sql` reads `cron.job`, which the migrations fill). Moving them before the wait saves up to 22s of the critical path.
- `backend`: the doctor polls every 10s (`ci.yml:93`), so the tick is noticed up to 10s late; 5s halves that.
- `backend`: 17s of `Data limit exceeded` retries at public.ecr.aws on every run, and 26 to 27 of them before the two `supabase start` failures. The anonymous pull quota of ECR Public is per source address, shared by every runner behind it. A registry mirror or `docker save` cache (about 2.5 GB, restored in roughly the time the pulls take) was not measured.
- `ios`: `brew install ccache` takes 16s per run.
- On `main`, `scripts/trail-map-site.sh` runs in `ci.yml` (58s) and again in `trail-map.yml`; `expo export --platform ios` runs in `ios-bundle` (34s) and inside the Xcode build. Both off the critical path, both free.
- A failed run keeps the iOS build going for about 20 minutes after the first red step. A step with `if: failure()` that cancels the run would need `actions: write`, which a fork's token lacks; free on a public repository, so a note.
- The cache store holds 33 npm download caches, 10.36 GB, over the 10 GB default; GitHub evicts by last access ("Once a repository has reached its maximum cache storage, the cache eviction policy will create space by deleting the caches in order of last access date"). Each iOS build will add an `ios-build-<sha>` entry of up to 2 GB plus CocoaPods; the stale per-branch npm caches go first, which is harmless, but a hit rate below what CI-1 promises would point here.

## Checked and already fast

1. **Critical path:** named for both kinds of pull request and for `main`; CI-1 and CI-2 act on them.
2. **Setup repeated per job:** `npm ci` runs 7 times, 21s to 38s each, 2m30s of runner time in all; only 21s of it sits on the pull request critical path. A `node_modules` cache or artifact would restore about as long as the install takes.
3. **Waiting:** the doctor's 42s is pg_cron's first tick, not a sleep; the relay is up in 1s; the remaining waits are in the Notes.
4. **The same work twice:** only the two `main`-only duplicates in the Notes, off the critical path.
5. **Jobs that run when nothing changed:** CI-2; the iOS build was gated today.
6. **Cache misses:** the npm download cache hits in every job (`Cache restored from key: node-cache-…`); ccache is CI-1; Deno's setup takes 2s; the CocoaPods cache had no entry yet.
7. **The runner:** standard runners are free here; larger runners are billed for public repositories ("Larger runners are billed for public repositories", docs.github.com). With CI-1 in place, a larger macOS runner has nothing to prove.
8. **Parallelism inside a job:** the end-to-end suite (`package.json:63`, `--test-concurrency=12`, 82 files, 145s on the runner) was run twice against the local stack on this Mac: 166s at 12 files at a time, 158s at 24, both green. The cases wait for pg_cron's minute tick, so more processes gain nothing; commit 88c847e, which raised the concurrency from Node's default of 3 to 12 today, already took the step from 9m30s to 145s. Jest 9s, pgTAP 21s and the Deno tests 2s have nothing left.
9. **Time to red:** lint, types and Jest finish in 75s; a superseded run is cancelled by the `concurrency` group (6 of the last 25 runs were).
10. **Checkout depth and action versions:** `fetch-depth: 0` only in `authors` (walks the history) and `native` (diffs against the base); checkouts take 1s to 3s; every action is on a current major.

## Could not measure

- The wall-clock of a push to `main` on the current workflow: none has run yet. The first push after the merge builds the iOS app cold once more, because a pull request's cache is scoped to its merge ref and `main` cannot restore it.
- The cost of a Docker image cache for `supabase start`: not tried.

## Commits

1. 0aadb68 CI's iOS Release build compiles through ccache, which the wrapper in CC only runs when CCACHE_BINARY is in the compiler's environment (CI-1).
2. a25c3a6 CI runs pgTAP and the end-to-end suite only on main and when a pull request changes what the stack, the e2e cases or the relay read, the way it already gates the iOS build (CI-2).

Skipped: none. Both savings were confirmed by the runs named in the findings on the same afternoon.
