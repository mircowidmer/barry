# CI speed analysis, 29 October 2026, second pass

Run as `/barry-continuous-integration-speed --fix` on the branch `worktree-ethereal-moseying-harp`, cut from `main` at 72a4783, with `gh` signed in. The first pass of the day is [2026-10-29-continuous-integration-speed.md](2026-10-29-continuous-integration-speed.md); its two changes (ccache reaches the compiler, the backend job is gated) are in the runs measured here.

## Summary

Measured: the last 20 successful runs of `ci.yml` (10 pull requests, 3 pushes to `main`, 7 pushes to branches from before the workflow stopped running on those), the 5 most recent failed runs for the time to red, the Actions cache store, and the logs of the three most recent iOS builds and the two most recent backend jobs. The medians below mix runs from before and after today's five workflow commits, so the current state is given by the latest runs of each kind.

| | Median of the 20 runs | Latest runs on the current workflow |
| --- | --- | --- |
| Pull request wall-clock | 18m01s | 6m22s and 9m33s with native changes (runs 40896709238, 40912772619), 94s for a documents-only change (run 40896727809) |
| Critical path, pull request | `ios` 19m07s | `ios` 341s and 540s with native changes; `backend` 283s to 330s when only the stack's inputs change; `web` 97s to 100s otherwise |
| Push to `main` wall-clock | 19m21s | 19m08s (run 40915112531, the first push after the ccache fix, whose iOS build was cold once more because a pull request's cache does not reach `main`) |
| Critical path, `main` | `ios` 19m08s | `ios` 1148s cold; the `backend` job took 258s |

The repository is public, so GitHub bills no minutes for its standard runners (docs.github.com, "About billing for GitHub Actions": standard runners are free in public repositories). A pull request with native changes uses about 9 macOS minutes and 10 Linux minutes; one without, about 10 Linux minutes.

The first pass took the big wins. What remains on the critical path is bounded by work that no cache touches: Swift compilation and the JavaScript bundle in the iOS build, and the clock's minute tick in the end-to-end suite. The findings of this pass:

1. **CI-1:** the compiler cache's statistics are the sum since the first cold build, not the run's, so the hit rate the first pass recorded (two thirds) was wrong: every warm build since the fix hit on all 502 compiler calls. Applied: the counters are zeroed after the restore. No saving on the clock; it corrects the measurement lever 6 depends on.
2. **CI-2:** the iOS build bundles the JavaScript inside Xcode for 43s, serially at the end of the build, while the `ios-bundle` job exports the same bundle on the same commit. 43s of the native pull request's critical path. Likely, left to the author.
3. **CI-3:** the backend job spends up to 13s in retries against the anonymous pull quota of ECR Public, and 2 of the 5 failed runs since 27 October were this quota, not Barry. Likely, left to the author.

## Timeline

From `timings.mjs --runs 20`. Pull requests, 10 runs, median wall-clock 18m01s, critical path `ios`:

| Job | Runs | Median | Longest | Queued | Share of wall-clock |
| --- | --- | --- | --- | --- | --- |
| iOS Release build for the Simulator | 9 | 19m07s | 25m23s | 0m26s | 106% |
| pgTAP and end-to-end against the local stack | 9 | 5m37s | 12m47s | 0m24s | 31% |
| Trail Map web build | 10 | 1m33s | 1m40s | 0m15s | 9% |
| iOS JavaScript bundle | 6 | 1m09s | 1m13s | 0m15s | 6% |
| Lint, types, Jest and Deno | 10 | 1m09s | 1m27s | 0m15s | 6% |
| No commit by Claude | 10 | 0m10s | 0m11s | 0m15s | 1% |
| Native changes / Changed inputs | 6 | 0m06s | 0m07s | 0m05s | 1% |

- `ios`: Build 16m00s, Generate the iOS project 1m33s, npm ci 0m31s, Post Run actions/cache 0m22s, brew install ccache 0m13s, actions/cache 0m11s, setup-node 0m06s.
- `backend`: npm run e2e 2m30s, Start Supabase 1m22s, npm ci 0m24s, Wait for the doctor 0m21s, npx supabase test db 0m19s, setup-node 0m05s.
- `web`: scripts/trail-map-site.sh 1m00s, npm ci 0m24s. `ios-bundle`: expo export 0m35s, npm ci 0m24s. `checks`: npm ci 0m23s, expo lint 0m13s, npm test 0m09s, tsc 0m05s, expo-doctor 0m05s, the Deno steps 0m05s.

Pushes to `main`, 3 runs, median wall-clock 19m21s, critical path `ios`: `ios` 19m08s (Build 15m01s, Generate the iOS project 2m20s), `backend` 12m34s (e2e 9m34s in the two runs before the concurrency change, 143s in the latest), `checks` 1m10s, `web` 1m04s, `ios-bundle` 1m04s, `authors` 0m11s. The 7 pushes to branches before dc8d2fb had `ios` at 25m48s and `backend` at 12m11s.

The latest runs, step by step:

- `ios`, run 40912772619 (warm, 540s): brew install ccache 11s, actions/cache 13s (249 MB restored), setup-node 9s, npm ci 28s, Generate the iOS project 93s (prebuild done at 10s, `pod install` from 11s: codegen to 29s, dependency analysis to 38s, downloads from the CocoaPods cache to 61s, Pods project generation to 86s, integration to 93s), Build 352s, Post Run actions/cache 22s. Inside Build: no compiler runs before 69s (xcodebuild's planning and the script phases that unpack the prebuilt Hermes, React Native Dependencies and React Native Core); 502 `CompileC` and 125 Swift tasks across 28 Expo module targets and the app from 69s to 306s; then, serially, "Bundle React Native code and images" from 306s to 349s and the link, `BUILD SUCCEEDED` at 352s.
- `ios`, run 40915112531 on `main` (cold, 1148s): the cache had no entry for `ios-build-`, Generate the iOS project 156s (the prebuilt tarballs downloaded from 71s to 126s), Build 901s, 502 misses.
- `backend`, run 40912772619 (283s): npm ci 20s, Start Supabase 94s (27 `Data limit exceeded` retries from 2s to 15s, pulls to 57s bounded by the postgres image, database start to 75s, 48 migrations and the seed by 80s, containers to 83s, health checks to 94s), doctor 1s (passed on the first try), types check 1s, pgTAP 17s (the `pg_prove` image pulled at 14s to 15s, 289 tests in 1s), e2e 140s.
- `backend`, run 40915112531 on `main` (258s): Start Supabase 72s with no quota retries (pulls to 36s, database start to 53s, seed by 58s, health checks to 71s), pgTAP 4s, e2e 143s.
- `backend`, run 40896709238 (330s): the doctor waited 42s for pg_cron's first tick, pgTAP 19s, e2e 150s.

Time to red, over the 5 most recent failed runs: 9s when the scratch gate job failed on purpose (run 40897248499), 86s and 91s when `supabase start` failed after 26 and 27 quota retries ("failed to set up container network", runs 40524919124 and 40778697938), and 728s and 783s when the end-to-end suite failed at Node's default concurrency (runs 40520252831 and 40524922510). The runs ended 14 to 27 minutes after their start, because the iOS build kept going.

## What each job proves

- `authors`: no commit reachable from HEAD names Claude as author, committer, co-author or session.
- `checks`: expo lint, `tsc --noEmit`, Jest (`src/**/*.test.ts`, `scripts/*.test.ts`), expo-doctor, and Deno's lint, type check and tests of `deliver`.
- `web`: `scripts/trail-map-site.sh` exports the web build and assembles `site/`, the way `trail-map.yml` publishes it.
- `changes`: computes `native` and `backend` from the pull request's diff; anything but a pull request is `true`; a failed diff or a failed job counts as changed.
- `backend`: the migrations and the seed apply on a fresh stack, pg_cron ticks, `src/lib/database.types.ts` matches the schema, the 17 pgTAP files pass, the 82 end-to-end cases pass against the stack with the text message relay.
- `ios-bundle`: `expo export --platform ios` with the production env succeeds on every pull request.
- `ios`: `expo prebuild --clean` and a Release build of `Barry.xcworkspace` for the arm64 Simulator succeed, on `main` and when a pull request changes a native input.

## Findings

### CI-1: the compiler cache's statistics are cumulative, so the recorded hit rate was wrong

- **Lever:** 6, cache misses (the lever's test is the hit rate). **Certain.**
- **Where:** `.github/workflows/ci.yml:175-181` restores `/Users/runner/Library/Caches/ccache` under `key: ios-build-${{ github.sha }}` with `restore-keys: ios-build-`; `.github/workflows/ci.yml:204-205` is `- name: Show the compiler cache hits` / `run: ccache --show-stats`.
- **Measured cost:** the cold build on `main` printed `Cacheable calls: 502 / 503`, `Misses: 502 / 502 (100.0%)`. The warm build of run 40912772619 printed `Cacheable calls: 2008 / 2012`, `Hits: 1506 / 2008 (75.00%)`, `Misses: 502 / 2008`: 2008 is four builds of 502 calls, and the 502 misses are the first cold build's. ccache keeps its counters in `CCACHE_DIR`, so they travel inside the saved cache and add up. The build log of the same run has 502 `CompileC` tasks, all hits. The first pass read `1004 / 1506 (66.7%)` from the second warm run and recorded a hit rate of two thirds, in its report and in commit 72a4783; the true rate of every warm build since the fix is 100%, and the statistic as printed would have hidden a future regression behind a growing numerator.
- **Change:** a step `ccache --zero-stats` right after the cache restore, so the counters shown after the build are this run's.
- **Expected saving:** none on the clock. The step takes under a second. This finding is below the thirty-second threshold and is kept as a finding because lever 6 cannot be tested without it.
- **Still proves:** the same build; `--zero-stats` resets counters, not cached objects.
- **Source:** ccache manual, "Statistics counters" and the `-z, --zero-stats` option.
- **Outcome:** **applied** in 767008f; the next iOS build's "Show the compiler cache hits" will print this run's counts.

### CI-2: the iOS build bundles the JavaScript that the ios-bundle job exports on the same commit

- **Lever:** 4, the same work twice. **Likely.**
- **Where:** `.github/workflows/ci.yml:197-203`, the `Build` step (`xcodebuild -workspace ios/Barry.xcworkspace -scheme Barry -configuration Release …`), whose script phase "Bundle React Native code and images" runs `expo export:embed`; and `.github/workflows/ci.yml:151` (`- run: npx expo export --platform ios --output-dir "$RUNNER_TEMP/ios-bundle"`), which runs on every pull request.
- **Measured cost:** in run 40912772619 the bundle phase started at 306s, after the last compile, and ended at 349s, 3s before `BUILD SUCCEEDED`: 43s of the Build step, serial, on the critical path of every pull request with native changes and of every push to `main`. The `ios-bundle` job exported the same commit's bundle in 35s on a Linux runner at the same time.
- **Change:** when the `ios` job runs, pass `SKIP_BUNDLING=1` to `xcodebuild`, which Expo's script phase honours, so the native build stops after the link; or, the other way round, skip `ios-bundle` when `ios` runs, which saves a Linux minute but nothing on the critical path.
- **Expected saving:** 43s on the critical path of a native pull request (540s to about 497s) and of `main`.
- **Still proves:** the Release build of the native project and, through `ios-bundle`, that the production bundle exports. It no longer proves that `expo export:embed` runs inside Xcode's environment with Hermes bytecode compilation and asset embedding, which is a different code path from `expo export`. That is why this stays likely: the author decides whether the embed step is part of what CI must prove.
- **Source:** docs.expo.dev, "expo export" and the `SKIP_BUNDLING` check in `expo/scripts/react-native-xcode.sh`; the build log quoted above.
- **Outcome:** **skipped**, rule 1: likely, not certain.

### CI-3: the backend job pays the anonymous pull quota of ECR Public, in seconds and in failed runs

- **Lever:** 3, waiting, and 6, images pulled on every run. **Likely.**
- **Where:** `.github/workflows/ci.yml:86-87`, `- name: Start Supabase` / `run: npx supabase start -x studio,imgproxy,vector,logflare`; and `:102`, `npx supabase test db`, which pulls `supabase/pg_prove` at test time.
- **Measured cost:** run 40912772619 logged `Data limit exceeded` 27 times between 2s and 15s of the step before the first pull began, and the `pg_prove` pull began only at 14s of the 17s pgTAP step. Run 40915112531 on `main`, 25 minutes later, had no retries and started the stack in 72s instead of 94s, and pgTAP took 4s instead of 17s. Over the 5 most recent failed runs, 2 (runs 40524919124 and 40778697938) ended in `supabase start` failing after 26 and 27 retries with "failed to set up container network", at 86s and 91s; each such red costs a rerun of the whole workflow. The quota is per source address, and GitHub-hosted runners share theirs.
- **Change:** the Supabase CLI reads `SUPABASE_INTERNAL_IMAGE_REGISTRY` (`apps/cli/src/command-internal/docker-registry.ts` in supabase/cli, where `docker.io` is the alternative to `public.ecr.aws`), so the job could pull from Docker Hub, whose own anonymous quota and its treatment of GitHub-hosted runners were not measured; or authenticate to ECR Public with an AWS key, which raises the quota and needs a repository secret.
- **Expected saving:** 13s to 22s of the backend job's critical path on a run that hits the quota, and the reruns: 2 of 5 reds.
- **Still proves:** the same stack from the same image tags; only the registry changes.
- **Source:** the Supabase CLI source named above; AWS, "Amazon ECR Public service quotas" (unauthenticated pull rate per source address); docs.docker.com, "Docker Hub usage and limits".
- **Outcome:** **skipped**, rule 1: it depends on a quota the registry decides and on a secret or an environment variable the author chooses.

## Notes

- `backend`: pgTAP (17s to 19s) and the types check (1s) run after "Wait for the doctor", but need no pg_cron tick (`tick.test.sql` calls `private.tick()` itself and reads `cron.job`). Moving them before the wait saves up to 20s on the runs where the tick is not there yet (42s wait in run 40896709238, 1s in the two latest). Under the threshold.
- `backend`: the doctor polls every 10s (`ci.yml:96`), so a tick is noticed up to 10s late; 5s would halve that.
- `backend`: a Docker image cache does not pay. The compressed images are 1.24 GiB without kong, postgrest and mailpit (postgres 351 MiB, edge-runtime 374 MiB, storage-api 239 MiB, realtime 119 MiB, postgres-meta 109 MiB, gotrue 29 MiB, pg_prove 17 MiB), about 1.4 GiB in all; the cache restores at 45 to 50 MB/s in this repository (295 MB in 6s to 7s), so 1.4 GiB takes about 30s plus `docker load`, against pulls that take 35s on `main` and 42s on the quota-hit run.
- `backend`: `-x` cannot drop more services. Realtime is used (`src/lib/barry/client.ts:464`, `watchAdventure`), Storage is 239 MiB but `storage-api` is the image the CLI starts for the local stack as configured, and `postgres-meta` is pulled by `supabase gen types` anyway.
- `ios`: `brew install ccache` takes 11s to 14s per run; the formula's bottle could be cached.
- `ios`: every build uploads a new 249 MB entry under `ios-build-<sha>` (Post Run actions/cache, 21s to 22s), as commit e69c0fd chose. A key on the native inputs plus the Xcode version, saved only on a miss, would skip the upload on a hit, but a header change outside the keyed inputs would then never refresh the cache. Under the threshold either way.
- `ios`: Swift compilation of 28 Expo module targets and the app runs between 69s and 306s of the Build alongside the 502 cached C compiles; ccache does not cache Swift. Xcode 26's compilation cache is the lever and was not measured.
- `web`: the critical path of a documents-only pull request (97s to 100s). A gate like `changes` would need every input of the web build, which is most of `src/`; the next job, `checks`, takes 61s to 71s, so the saving is about 25s.
- `ios-bundle` runs on every pull request, also when `ios` runs; skipping it then saves one Linux minute off the critical path.
- A failed run keeps the iOS build going for up to 20 minutes after the first red step. Cancelling the run from a step needs `actions: write`.
- The cache store holds 34 entries, 9.81 GiB of the 10 GiB limit: 27 npm download caches (8.2 GiB) and 7 `ios-build-` entries from today (1.63 GiB). All the npm caches but `main`'s belong to merged pull requests or deleted branches (`main` is the only head; no pull request is open). Eviction goes by last access (docs.github.com, "Caching dependencies to speed up workflows", usage limits and eviction policy), so the stale npm caches go first, then the oldest `ios-build-` entries, which `restore-keys` never picks again once a newer one exists. `main`'s entry is restored only by pushes to `main` and by the first run of a new pull request; after about 40 pull request builds without a push to `main` it would be the oldest. The documented cleanup workflow on `pull_request: closed` would remove the stale entries sooner.

## Checked and already fast

1. **Critical path:** named for pull requests with native changes (`ios`, 341s to 540s), with backend changes only (`backend`, 283s to 330s), for documents-only ones (`web`, 97s to 100s) and for `main` (`ios`, cold once after the fix). CI-2 acts on the first and the last.
2. **Setup repeated per job:** `npm ci` runs 6 or 7 times, 18s to 31s each, 2m30s of runner time, once on each critical path. A `node_modules` cache would restore about as long as the install takes (295 MB in 6s to 7s, then the postinstall).
3. **Waiting:** the doctor passed on the first try in both latest runs; the relay is up in 1s; the quota retries are CI-3; the first 69s of the Xcode build run the prebuilt-tarball script phases, not a sleep.
4. **The same work twice:** CI-2; the web build on `main` runs in `ci.yml` and `trail-map.yml`, off the critical path.
5. **Jobs that run when nothing changed:** `backend` and `ios` are gated by `scripts/changed-inputs.sh` since the first pass; `web` is in the Notes.
6. **Cache misses:** the npm download cache hit in every job (`Cache restored from key: node-cache-…`); ccache hit on 502 of 502 calls in every warm build (CI-1 corrects the number); the CocoaPods cache took the downloads of `pod install` from 55s to 0s; Deno's setup takes 2s.
7. **The runner:** standard runners are free; larger runners are billed in public repositories (docs.github.com, "About larger runners"). With the Build at 211s to 352s warm, a larger macOS runner has a 237s compile window to shorten and a price the author would pay for it.
8. **Parallelism inside a job:** the end-to-end suite runs 82 files at `--test-concurrency=12` in 140s to 150s and waits on the minute tick (the first pass measured 24 at a time at 158s); Jest 9s, pgTAP 1s of tests inside 4s to 19s of container start, the Deno tests 2s.
9. **Time to red:** lint, types and Jest finish within 61s to 71s; a superseded run is cancelled by the `concurrency` group (11 of the last 40 runs were); a red from the end-to-end suite would now come at about 280s into the backend job (estimate from the step layout; no failed run on the current concurrency yet).
10. **Checkout depth and action versions:** `fetch-depth: 0` only in `authors` and `changes`, which walk and diff the history; checkouts take 1s to 3s; every action is on a current major.

## Could not measure

- The wall-clock of a push to `main` with a warm compiler cache: the only push on the current workflow was the first after the fix, cold by design of the cache scope. The next push will show it, and with CI-1 in place its `ccache --show-stats` will be that run's.
- Docker Hub's anonymous quota as seen from GitHub-hosted runners, which decides whether the registry switch in CI-3 helps or hurts.
- What the first 42s of the Xcode build do before the first script phase; the log has no task before "[Hermes] Replace Hermes for the rig" at 42s.
- The saving of Xcode 26's compilation cache for Swift.

## Commits

1. 767008f CI's iOS Release build zeroes ccache's counters after the cache restore, so the compiler cache hits it shows are this run's and not the sum since the first cold build (CI-1).

Skipped: CI-2 (rule 1, likely: it drops the embed step from what the native build proves), CI-3 (rule 1, likely: it depends on a registry's quota and on a secret or an environment variable the author chooses).
