# CI speed analysis, 30 October 2026

Run with `/barry-continuous-integration-speed --fix` on `claude/barry-ci-speed-b65db9`, from `c3df849`.

## Summary

- **Runs measured:** the last 20 successful runs of `.github/workflows/ci.yml` (6 pushes to `main`, 14 pull requests, 29–30 October 2026), plus the 5 most recent failed runs for the time to red.
- **Median wall-clock:** a push to `main` 8m00s; a pull request 3m39s over all 14. The 9 that skip the iOS build and the 7 that skip the stack pull that median down. A pull request that changes native inputs waits a median of 6m01s for barry-mac and then builds for 7m45s.
- **Critical path:** the iOS Release build on both `main` (7m47s, 97 % of the wall-clock) and pull requests that build it. Without it, the pgTAP and end-to-end job is the critical path (5m15s on pull requests, 4m47s on `main`).
- **Billed minutes:** none. `mircowidmer/barry` is public, so the standard hosted runners are free, and the iOS build runs on barry-mac, the self-hosted Mac. A run uses about 22 job-minutes, 8 of them on barry-mac.
- **The finding that matters:** CI-1. On barry-mac, `actions/setup-node`'s `cache: npm` restores or saves the Mac's whole npm cache, 5.69 GiB, through GitHub's cache service on every run. That takes a median of 5m16s in a job whose compile takes 1m16s, and it puts that 5m16s back into the next pull request's queue for barry-mac. Removing it takes about 5 minutes off `main`'s critical path and off every pull request that builds iOS, plus up to the 6m01s of queueing it causes. No other finding passes the threshold. The rest are notes.

## Timeline

Medians over the measured runs, from `timings.mjs --runs 20`. Share is of the median wall-clock of that event.

### Push to `main` (6 runs, wall-clock 8m00s)

| job | median | longest | queued | share |
| --- | --- | --- | --- | --- |
| iOS Release build for the Simulator | 7m47s | 10m56s | 0m11s | 97 % |
| pgTAP and end-to-end against the local stack | 4m47s | 5m20s | 0m12s | 60 % |
| Trail Map web build | 1m30s | 1m37s | 0m04s | 19 % |
| iOS JavaScript bundle | 1m04s | 1m07s | 0m03s | 13 % |
| Lint, types, Jest and Deno | 1m01s | 1m19s | 0m04s | 13 % |
| No commit by Claude | 0m10s | 0m11s | 0m04s | 2 % |
| Changed inputs | 0m04s | 0m06s | 0m04s | 1 % |

### Pull request (14 runs, wall-clock 3m39s)

| job | runs | median | longest | queued | share |
| --- | --- | --- | --- | --- | --- |
| iOS Release build for the Simulator | 5 | 7m45s | 9m41s | 6m01s | 212 % |
| pgTAP and end-to-end against the local stack | 7 | 5m15s | 5m27s | 0m12s | 144 % |
| Trail Map web build | 14 | 1m28s | 1m47s | 0m03s | 40 % |
| Lint, types, Jest and Deno | 14 | 1m11s | 1m19s | 0m04s | 32 % |
| iOS JavaScript bundle | 14 | 1m03s | 1m13s | 0m03s | 29 % |
| No commit by Claude | 14 | 0m09s | 0m11s | 0m03s | 4 % |
| Changed inputs | 14 | 0m05s | 0m07s | 0m04s | 2 % |

### Steps (pull request medians; `main` within a few seconds unless noted)

- **iOS Release build:** `actions/setup-node` 5m16s, post `actions/setup-node` 5m16s (in any one run only one of the two is long, see CI-1), Build 1m19s, Generate the iOS project 0m38s, checkout 0m12s, `npm ci` 0m10s.
- **pgTAP and end-to-end:** `npm run e2e` 2m35s, Start Supabase 1m20s, Wait for the doctor 0m32s (`main` 0m17s), `npm ci` 0m25s, `npx supabase test db` 0m17s (`main` 0m06s), the rest 1s or less each.
- **Trail Map web build:** `scripts/trail-map-site.sh` 0m57s, `npm ci` 0m23s, setup-node 0m06s.
- **Lint, types, Jest and Deno:** `npm ci` 0m25s, `expo lint` 0m13s, `npm test` 0m09s, `tsc` 0m05s, `expo-doctor` 0m05s, setup-node 0m05s, the Deno steps 1–2s each.
- **iOS JavaScript bundle:** `expo export --platform ios` 0m30s, `npm ci` 0m21s, setup-node 0m04s.
- **No commit by Claude:** `scripts/claude-commits.sh HEAD` 0m05s, checkout 0m02s.
- **Changed inputs:** checkout 0m02s.

## What each job proves

This is the list the change below had to leave intact.

- **No commit by Claude:** no commit reachable from `HEAD` names Claude as author, committer or co-author.
- **Changed inputs:** whether a pull request touches the native inputs or the backend inputs. Every other event counts as both.
- **Lint, types, Jest and Deno:** ESLint, TypeScript, the Jest suites, the Expo SDK version check, and Deno's lint, type check and tests of `deliver`.
- **Trail Map web build:** `scripts/trail-map-site.sh` builds the site the Pages workflow publishes.
- **pgTAP and end-to-end:** every migration and the seed apply, the doctor passes (the clock ticks), `database.types.ts` matches the migrations, pgTAP passes and the e2e suite passes against the stack and the text message relay.
- **iOS JavaScript bundle:** the production iOS bundle exports with the production env.
- **iOS Release build:** prebuild with the production variant and `xcodebuild` Release for the Simulator succeed. It runs on `main`, on `workflow_dispatch` and on pull requests that change native inputs.

## Findings

### CI-1 — On barry-mac, the iOS build moves the Mac's whole npm cache through GitHub's cache service on every run

- **Lever:** 6, cache misses. A cache that costs more to restore than the work it saves, with 2 (setup repeated per job) and 1 (critical path).
- **Job and step:** iOS Release build for the Simulator, `.github/workflows/ci.yml:192-195`:

  ```yaml
        - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
          with:
            node-version: 24
            cache: npm
  ```

- **Measured cost:** in the 11 iOS jobs that ran, setup-node's restore or its post-step save took 311, 312, 313, 315, 316, 317, 321, 327, 345, 489 and 505 seconds: one or the other, never both. The median is 316 s, against a 1m16s compile that ccache serves at 100 % (502 of 502 calls hit in run 41018648831). The log shows why. On barry-mac, `npm config get cache` is `/Users/mirco/.npm`, the Mac's own npm cache, and `gh cache list` holds two entries of it, `node-cache-macOS-arm64-npm-…`, of 5.69 GiB and 5.68 GiB. When the lockfile hash matches, the step downloads 5.7 GiB into the directory the files came from. When it does not match, the post step uploads 5.7 GiB. The two entries also put the repository at 12.55 GB, above GitHub's 10 GB limit, so they evict the 320 MiB Linux npm cache that the five Linux jobs use. On pull requests, the 6m01s median queue for the `ios` runner is mostly the previous run's iOS job still holding barry-mac. For example, run 41016066478's iOS job ended at 06:53:31 and the next one started at 06:53:34.
- **Change:** pass `cache: npm` only on a GitHub-hosted runner, the way the `actions/cache` step at `ci.yml:182-183` already does: `cache: ${{ runner.environment == 'github-hosted' && 'npm' || '' }}`. barry-mac keeps `~/.npm` on its own disk, so `npm ci` still finds every tarball there. A fork's pull request on `macos-26` keeps the npm download cache.
- **Expected saving:** about 5m16s off the iOS job (7m45s to about 2m30s). On `main` that takes the critical path from 7m47s to the pgTAP and end-to-end job's 4m47s, about 3 minutes off the wall-clock. On a pull request that builds iOS, the build finishes about 5 minutes sooner and the next pull request's queue for barry-mac shrinks by the same amount, so a pull request behind another one gains up to about 10 minutes. Billed minutes: none either way (public repository, self-hosted runner).
- **What it still proves:** the same `npm ci`, prebuild and Release build from the same lockfile, on the same events and runners.
- **Certainty:** certain. The cache path is the directory the restore writes into, on the same disk, so the restore can only reproduce what is already there.
- **Source:** docs.github.com, *Caching dependencies to speed up workflows*: the 10 GB per repository limit, eviction of the least recently used entry, and that a pull request can restore caches of its base branch. github.com/actions/setup-node, *Caching global packages data*: `cache` caches the directory from `npm config get cache`, and an empty value turns caching off.
- **Outcome:** applied in `8cac8cc`, saving to be confirmed by the next run.

## Notes

- **Not about speed, but found here:** the two macOS npm cache entries are barry-mac's personal `~/.npm`, which may hold tarballs from projects other than Barry. In a public repository, a fork's pull request that runs on `macos-26` with the same lockfile restores the key `node-cache-macOS-arm64-npm-<hash>` from `main`'s scope. CI-1 stops new entries. Deleting the two existing ones is left to the author: `gh cache delete 9743600811 -R mircowidmer/barry` and `gh cache delete 9723536428 -R mircowidmer/barry`.
- **Wait for the doctor polls every 10 s** (`ci.yml:96`, `sleep 10`). Each run loses up to 10 s after pg_cron's first tick, about 5 s on average.
- **pgTAP and the types check could run before the doctor's wait for the first tick** (`ci.yml:94-102`). They don't need the clock, and they would overlap the 17–32 s wait. That saves at most their 6–17 s, and pgTAP would run before the doctor has proven the stack.
- **`npm ci` runs in five jobs,** 21–25 s each on Linux, about 2 job-minutes per run. On the critical path that is only the backend job's 25 s, which a `node_modules` cache would trade for its own restore time. The repository is public, so the job-minutes cost nothing.
- **Start Supabase pulls ten images on every run,** about 35 s of its 1m10–1m20s. A Docker image cache of several GB would cost a similar restore plus `docker load`, and the repository is already at its cache limit. Likely no gain, so it is not a finding.
- **storage-api starts but nothing in `src`, `supabase/functions`, `e2e` or `scripts` uses Supabase Storage.** Adding `storage-api` to `-x` at `ci.yml:87` would save one image pull and one container start, a few seconds. Likely, not certain: nothing here checked whether the doctor or the Auth setup depends on it. Realtime is used (`src/lib/barry/client.ts:466`) and must stay.
- **The Trail Map web build runs on every pull request** for 1m28s, off the critical path. Gating it would save free job-minutes only.

## Checked and already fast

1. **The critical path:** named above for both events. Every job other than iOS and the backend finishes in under 1m31s.
2. **Setup repeated per job:** checkout 1–2 s and setup-node 3–6 s on Linux. Only `npm ci` repeats noticeably (see Notes). On barry-mac, CI-1.
3. **Waiting:** the relay start polls every 1 s and takes 1 s. The doctor's wait is pg_cron's first tick, bounded by the minute schedule (see Notes for the 10 s interval).
4. **The same work twice:** `c52be63` already stopped the iOS build from repeating the `ios-bundle` export. The Trail Map export (`--platform web`) and the iOS export (`--platform ios`) bundle different platforms. `trail-map.yml` builds the site for Pages from `main`, not for the check.
5. **Jobs that run when nothing they test changed:** the iOS build and the backend job are already gated by `scripts/changed-inputs.sh`, which lists the workflow and itself. Both still run on `main` and on `workflow_dispatch`.
6. **Cache misses:** ccache hits 100 % on barry-mac. The ReactNative, Hermes and dependency prebuilds hit the Mac's shared cache in `Generate the iOS project`. The Linux npm cache restores in 3–6 s. Deno has nothing worth caching (setup 1–2 s, tests 2 s). The one miss is CI-1.
7. **The runner:** the iOS build already runs on barry-mac at no cost. A larger Linux runner for the 5m15s backend job would mostly speed the e2e suite, whose cases poll the once-a-minute clock, so more cores would not shorten it. Larger runners are billed even for public repositories (docs.github.com, *About larger runners*), so that is the author's call and not measured here.
8. **Parallelism inside a job:** the e2e suite already runs with `--test-concurrency=12`, which the local Auth's sign-in rate limit bounds. Jest takes 9 s and pgTAP 6–17 s. No serial step without a dependency is long enough to be worth its own job.
9. **Time to red:** of the last 5 failed runs, the gate failed at 0m12s, Start Supabase at 1m30s and 1m35s, and the e2e suite at 12m14s and 13m09s, because a failing case polls the full 150 s clock window and its 300 s timeout. Lint, types and Jest finish at about 1m11s. The `concurrency` group cancels superseded runs. There is no matrix that would need `fail-fast`.
10. **Checkout depth and action versions:** `fetch-depth: 0` appears only in `authors`, which walks the history, and `changes`, which diffs against the base, at 1–2 s each. Every action is pinned to a commit of a current major (`e0af07c`).

## Could not measure

- **Why barry-mac queues when no iOS job holds it:** the runner's own availability (sleep, other work on the Mac) is not in the API. The queue times line up with the previous iOS job's end, which CI-1 addresses. The next runs will show what remains.
- **The hosted `macos-26` path:** no fork pull request ran in the window, so its restore time and ccache hit rate are unmeasured.
- **The price of larger runners:** it depends on the account's plan, so lever 7 gives no number.

## Commits

1. `8cac8cc` — CI's iOS Release build caches npm's downloads only on a GitHub-hosted runner, so barry-mac no longer moves its whole 5.7 GiB npm cache through the cache service on every run.

Skipped: none of the findings. Everything else is a note under the threshold, or likely rather than certain.
