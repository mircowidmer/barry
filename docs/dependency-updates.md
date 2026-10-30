# Dependency updates

Renovate keeps the dependencies current. It runs as the Mend Renovate App, which is installed on the GitHub account `mircowidmer` for this repository only and runs on Mend's servers. Nothing in this repository starts it: there is no workflow and no cron entry. `renovate.json` at the root is its whole configuration.

## Where to look

- **The Dependency Dashboard**, an issue Renovate keeps open in this repository. It lists every dependency Renovate found, the updates waiting for approval, and a checkbox that starts a run.
- **The Mend Developer Portal**, at [developer.mend.io](https://developer.mend.io) → mircowidmer → barry, signed in with GitHub. It shows each job with its trigger and its full log, the mode (Interactive opens pull requests, Silent only logs), and an **Actions** menu that starts a run. Each Renovate pull request also links its job log in the footer of its description.
- **The installation**, at [github.com/settings/installations](https://github.com/settings/installations) → Renovate → Configure, which names the repositories the app may touch.

## When it runs

Mend decides when a job runs: on its own timer and after events such as a push to `main` or a ticked checkbox. `schedule:weekly` in `renovate.json` only limits when a job may open or update a pull request, to Monday before 4 a.m. Zurich time, so the iOS Release build on barry-mac runs once a week instead of after every release.

A release is proposed only once it is three days old (`minimumReleaseAge`), so a broken or hijacked release is usually withdrawn before it reaches a pull request. A new commit hash of an Action has no date and is not held back.

A security fix ignores both the Monday window and the three days. Renovate learns of a vulnerability from osv.dev and from GitHub's Dependabot alerts, which need **Dependency graph** and **Dependabot alerts** turned on under Settings → Advanced Security. The Dependency Dashboard lists the vulnerabilities still open.

## What it opens

| Pull request | Holds | Merges on its own |
| --- | --- | --- |
| npm minor and patch updates | Every npm package not named below, and the imports in `supabase/functions/deliver/deno.json` such as `@std/assert` | Yes |
| Supabase CLI | The `supabase` devDependency | Yes |
| supabase-js | `@supabase/supabase-js` in `package.json` and in `deliver`'s `deno.json` | Yes |
| GitHub Actions | Every Action in `.github/workflows`, pinned to a commit hash with its version as a comment | Yes |
| Lock file maintenance | `package-lock.json` rebuilt every Tuesday, after Monday's updates, so the packages other packages pull in move too | Yes |
| One per security fix | The lowest version that fixes the vulnerability, marked `[SECURITY]` | Yes |
| Expo SDK | The Expo, React and React Native packages the Expo SDK rule in `renovate.json` names | No, and it opens only after approval on the Dependency Dashboard |
| One per major update | Any package outside the Expo SDK | No |

Merging on its own means GitHub's auto-merge: the pull request merges once the six checks the ruleset "main requires CI" names have passed. A failing check leaves it open.

The Supabase CLI has its own pull request because a new CLI can change what `npx supabase gen types` writes. CI then rejects the stale `src/lib/database.types.ts`, and that pull request waits until the types are regenerated as AGENTS.md says.

## What still needs a person

- **A new Expo SDK.** Run `npx expo install expo@^<major>` and then `npx expo install --fix`, which moves every SDK package to the versions that SDK supports. An Expo SDK pull request approved on the Dependency Dashboard bumps versions with plain npm resolution, so it suits a patch, and CI's `npx expo-doctor` rejects a version outside the SDK. The Tuesday lock file maintenance also moves the Expo packages to new patches within their `~` ranges without approval, with `npx expo-doctor` as the same guard.
- **The hosted Edge Function.** A merged supabase-js update changes `deliver` on `main` only. It reaches the hosted project with `npx supabase functions deploy deliver`, as [The hosted Supabase project](hosted-supabase.md) describes.
- **A major update.** Read its changelog, which Renovate links in the pull request, and merge it by hand.

## Change the configuration

When Renovate renames an option `renovate.json` uses, it opens a pull request that migrates the file (`configMigration`).

Edit `renovate.json` on a branch named `renovate/reconfigure` and open a pull request from it. Renovate validates the file there and comments with what the new configuration would open. To check a file locally:

```bash
npx --package renovate -- renovate-config-validator --strict renovate.json
```
