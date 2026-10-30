# CI speed analysis, 30 October 2026 (second pass)

Run with `/barry-continuous-integration-speed --fix` on `claude/barry-ci-speed-b65db9`, from `1132d3a`, a few hours after [the first pass of the day](2026-10-30-continuous-integration-speed.md).

## Summary

- **Runs measured:** the last 20 successful runs of `.github/workflows/ci.yml` (6 pushes to `main`, 14 pull requests, 29–30 October 2026), plus the 5 most recent failed runs for the time to red. They are the same 20 runs as the first pass: no run of `ci.yml` has started since run 41018648831 at 07:12 UTC, and this branch, with `8cac8cc`, has not been pushed.
- **Median wall-clock:** a push to `main` 8m00s; a pull request 3m39s over all 14. A pull request that builds iOS waits a median of 6m01s for barry-mac and then builds for 7m45s.
- **Critical path:** the iOS Release build, on `main` (7m47s, 97 % of the wall-clock) and on pull requests that build it. Without it, the pgTAP and end-to-end job (5m15s on pull requests, 4m47s on `main`).
- **Billed minutes:** none. `mircowidmer/barry` is public and the iOS build runs on the self-hosted barry-mac. A run uses about 22 job-minutes, 8 of them on barry-mac.
- **Findings:** none new. The one finding above the threshold is still CI-1 of the first pass, the 5.7 GiB npm cache that setup-node moved through GitHub's cache service on barry-mac (median 5m16s per iOS job). `8cac8cc` changed it, and no run has confirmed the saving yet. Everything else is a note.
- **Since the first pass:** the two macOS npm cache entries are gone. `gh cache list` and `GET /actions/caches` list only `node-cache-Linux-x64-npm-…` (320.59 MiB, `refs/heads/main`). The usage endpoint still reports 2 entries and 6.44 GB, which lags the list.

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

- **iOS Release build:** `actions/setup-node` 5m16s or its post step 5m16s (one of the two per run, the cost `8cac8cc` removes), Build 1m19s, Generate the iOS project 0m38s, checkout 0m12s, `npm ci` 0m10s.
- **pgTAP and end-to-end:** `npm run e2e` 2m35s, Start Supabase 1m20s, Wait for the doctor 0m32s (`main` 0m17s), `npm ci` 0m25s, `npx supabase test db` 0m17s (`main` 0m06s), the rest 1 s or less each.
- **Trail Map web build:** `scripts/trail-map-site.sh` 0m57s, `npm ci` 0m23s, setup-node 0m06s.
- **Lint, types, Jest and Deno:** `npm ci` 0m25s, `expo lint` 0m13s, `npm test` 0m09s, `tsc` 0m05s, `expo-doctor` 0m05s, setup-node 0m05s, the Deno steps 1–2 s each.
- **iOS JavaScript bundle:** `expo export --platform ios` 0m30s, `npm ci` 0m21s, setup-node 0m04s.
- **No commit by Claude:** `scripts/claude-commits.sh HEAD` 0m05s, checkout 0m02s.
- **Changed inputs:** checkout 0m02s.

## What each job proves

- **No commit by Claude:** no commit reachable from `HEAD` names Claude as author, committer or co-author.
- **Changed inputs:** whether a pull request touches the native inputs or the backend inputs. Every other event counts as both.
- **Lint, types, Jest and Deno:** ESLint, TypeScript, the Jest suites, the Expo SDK version check, and Deno's lint, type check and tests of `deliver`.
- **Trail Map web build:** `scripts/trail-map-site.sh` builds the site the Pages workflow publishes.
- **pgTAP and end-to-end:** every migration and the seed apply, the doctor passes (the clock ticks), `database.types.ts` matches the migrations, pgTAP passes and the e2e suite passes against the stack and the text message relay.
- **iOS JavaScript bundle:** the production iOS bundle exports with the production env.
- **iOS Release build:** prebuild with the production variant and `xcodebuild` Release for the Simulator succeed, on `main`, on `workflow_dispatch` and on pull requests that change native inputs.

## Findings

None new. CI-1 of the first pass stands as applied in `8cac8cc`. `.github/workflows/ci.yml:193-196` now reads:

```yaml
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 24
          cache: ${{ runner.environment == 'github-hosted' && 'npm' || '' }}
```

Its expected saving, about 5m16s off the iOS job and about 3 minutes off `main`'s wall-clock, is still to be confirmed by the next run that builds iOS.

## Notes

- **Wait for the doctor polls every 10 s** (`ci.yml:96`, `sleep 10`). Each run loses up to 10 s after pg_cron's first tick, about 5 s on average.
- **pgTAP and the types check could run before the doctor's wait for the first tick** (`ci.yml:94-102`). That saves at most their 6–17 s, and pgTAP would run before the doctor has proven the stack.
- **`npm ci` runs in five jobs,** 21–25 s each on Linux, about 2 job-minutes per run. On the critical path only the backend job's 25 s counts, which a `node_modules` cache would trade for its own restore time. The job-minutes cost nothing.
- **Start Supabase pulls ten images on every run,** about 35 s of its 1m16s–1m20s. A Docker image cache of several GB would cost a similar restore plus `docker load`. Likely no gain.
- **storage-api starts but nothing in `src`, `supabase/functions`, `e2e` or `scripts` uses Supabase Storage.** Adding `storage-api` to `-x` at `ci.yml:87` would save one image pull and one container start, a few seconds. Likely, not certain: nothing here checked whether the doctor or the Auth setup depends on it.
- **The Trail Map web build runs on every pull request** for 1m28s, off the critical path. Gating it would save free job-minutes only.
- **The cache usage endpoint lags the cache list.** It still reports 6.44 GB in 2 entries while the list holds one entry of 320.59 MiB. If it does not drop below 1 GB within a day, a hidden entry is still counted against the 10 GB limit.

## Checked and already fast

1. **The critical path:** named for both events above. Every job other than iOS and the backend finishes in under 1m31s.
2. **Setup repeated per job:** checkout 1–2 s and setup-node 3–6 s on Linux. Only `npm ci` repeats noticeably (Notes). On barry-mac, CI-1, applied.
3. **Waiting:** the relay start polls every 1 s and takes 1 s. The doctor's wait is pg_cron's first tick, bounded by the minute schedule (Notes for the 10 s interval).
4. **The same work twice:** `c52be63` stopped the iOS build from repeating the `ios-bundle` export. The Trail Map export (`--platform web`) and the iOS export (`--platform ios`) bundle different platforms. `trail-map.yml` builds the site for Pages from `main`, not for the check.
5. **Jobs that run when nothing they test changed:** the iOS build and the backend job are gated by `scripts/changed-inputs.sh`, which lists the workflow and itself, and both still run on `main` and on `workflow_dispatch`.
6. **Cache misses:** ccache hits 100 % on barry-mac (502 of 502 in run 41018648831). The Linux npm cache restores in 3–6 s and is now the only entry, well under the 10 GB limit. Deno has nothing worth caching (setup 1–2 s, tests 2 s).
7. **The runner:** the iOS build runs on barry-mac at no cost. A larger Linux runner would mostly speed the e2e suite, whose cases poll the once-a-minute clock, and larger runners are billed even for public repositories (docs.github.com, *About larger runners*). The author's call.
8. **Parallelism inside a job:** the e2e suite runs with `--test-concurrency=12`, bounded by the local Auth's sign-in rate limit. Jest takes 9 s and pgTAP 6–17 s. No serial step without a dependency is long enough to be its own job.
9. **Time to red:** the 5 most recent failed runs are the same as in the first pass (newest 40897248499 on 29 October): the gate failed at 0m12s, Start Supabase at 1m30s and 1m35s, the e2e suite at 12m14s and 13m09s. Lint, types and Jest finish at about 1m11s. The `concurrency` group cancels superseded runs, and there is no matrix that would need `fail-fast`.
10. **Checkout depth and action versions:** `fetch-depth: 0` only in `authors` and `changes`, which walk and diff history, at 1–2 s each. Every action is pinned to a commit of a current major (`e0af07c`).

## Could not measure

- **The effect of `8cac8cc`:** no run has carried it. The first push of this branch with a native change, or the next push to `main`, shows the iOS job without the 5-minute setup-node step.
- **Why barry-mac queues when no iOS job holds it:** the runner's availability is not in the API. The queue times line up with the previous iOS job's end, which CI-1 addresses.
- **The hosted `macos-26` path:** no fork pull request ran in the window.
- **The price of larger runners:** it depends on the account's plan.

## Commits

None for findings: there was no new certain finding to apply. This report is the only commit of the pass.
