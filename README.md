# Barry

Barry is an iPhone app for adventures alone. You tell Barry where you are going and when you will be back. If you don't check in by then, Barry tells the people you chose. It is an Expo app with a Supabase backend.

## Run it locally

```bash
npm install
npx supabase start
npm start
```

Copy `.env.example` to `.env.local` first, and set `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the publishable key that `npx supabase start` prints. `EXPO_PUBLIC_SUPABASE_URL` already points at the local stack for the simulator; the iPhone guide says what a phone needs there. `BARRY_TEST_EMAIL` and `BARRY_TEST_PASSWORD` name the test account that the barry-frontend-verify skill drives the app with; the app itself does not read them.

The app needs the development build, Barry Dev. `npm run ios` builds it into the iOS Simulator. [How to run Barry on your iPhone](docs/iphone.md) covers a phone, where `npm run iphone:production` builds and installs the production app, and [Builds](docs/builds.md) the variants and the cloud builds with EAS.

## Check it

```bash
npx expo lint
npx tsc --noEmit
npm test
deno test supabase/functions/deliver
npx supabase test db
npm run e2e
```

`npx tsc --noEmit` needs `expo-env.d.ts`, which `npm start` writes on its first run. `deno test` needs Deno. `npx supabase test db` and `npm run e2e` need the local Supabase stack running, and `npm run e2e` also needs `node scripts/sms-relay.mjs` running.

On GitHub, `.github/workflows/ci.yml` runs all six against its own local stack and builds the iOS app for the Simulator, on every push and every pull request. **Run workflow** in the Actions tab starts it by hand.

## Guides

- [Barry specification](docs/spec.md)
- [Glossary](CONTEXT.md), the domain language the specification and the texts use
- [Supabase owns the Deadline and sends every message](docs/adr/0001-server-owns-the-deadline.md), the decision record behind the backend
- [How to run Barry on your iPhone](docs/iphone.md)
- [Builds](docs/builds.md)
- [How to see what Barry sends locally](docs/local-messages.md)
- [The hosted Supabase project](docs/hosted-supabase.md)
- [How to host the Adventure page on GitHub Pages](docs/trail-map-hosting.md)
- [Text messages](docs/text-messages.md)
- [Backend design](docs/design/backend/design.md) and [Trail design](docs/design/trail/design.md), the sketches the implementation started from
- [Project overview](docs/overview/barry-overview.html), a snapshot of the project, and [Prompt overview](barry-prompts.html), the prompts of its first two days
- [Reviews](docs/reviews/), the dated reports of the maintenance skills

## Skills

Each is a prompt under `.claude/skills/`, run in Claude Code as `/<name>`.

- `barry-backend-verify` proves a change to the migrations, the commands, the clock or `deliver` against the local stack, without the app, and captures proof. It runs in a cloud session too.
- `barry-frontend-verify` drives the app in the iOS Simulator against the local stack, the way a user does, and captures proof.
- `barry-verify` runs the two above, the backend first, and reports both; `--fix` fixes each failure on the side that is wrong, commits it and proves it again.
- `barry-audit-consistency` finds where the repository disagrees with itself and reports it; `--fix` applies the safe fixes.
- `barry-e2e-gaps` lists the use cases the documents promise that no end-to-end case proves; `--fix` writes the missing cases against the running stack.
- `barry-prune-tests` finds the tests whose failure would tell nothing, and the duplicates; `--fix` cuts them.
- `barry-update-readme` keeps this file true to the repository; `--fix` edits it.
- `barry-assure-code-quality` reviews the app code against current best practices in coding style and code quality; `--fix` applies the certain, behaviour-preserving fixes.
- `barry-security` analyses the app, the database, `deliver`, the Trail Map, Auth, secrets, dependencies and CI in depth for security vulnerabilities and reports each with its attack path; `--fix` applies the certain fixes that close a hole without changing what an honest user sees.
- `barry-maintenance` runs the skills above other than `barry-backend-verify` and `barry-frontend-verify` in the order where each one's changes feed the next, with `barry-e2e-gaps` twice, `barry-security` before `barry-update-readme` and `barry-verify` last; `--fix` passes `--fix` to each.
