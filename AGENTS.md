This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npm start                   # start Metro for the development build (APP_VARIANT=development)
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done. The tests are listed under **Check it** in `README.md`.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

`eas.json` has the profiles `development`, `development-simulator`, `preview` and `production`, and `app.config.js` turns `APP_VARIANT` into the bundle identifier, the name under the icon and the URL scheme. [Builds](docs/builds.md) describes the variants and the cloud builds, and [How to run Barry on your iPhone](docs/iphone.md) the local ones.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a new development build: `npm run ios` locally, or `npm run build:dev` in the cloud.
- Local builds for the iPhone with a free Apple team run prebuild with `BARRY_WITHOUT_PUSH=1`. Then `plugins/without-push.js` leaves out the Push Notifications entitlement, which a free Apple team cannot sign.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Read first

- [CONTEXT.md](CONTEXT.md) is the glossary. Code, texts, tests and commit messages use its capitalised terms (Adventurer, Adventure, Deadline, Grace Period, Check-in, Heads-up, Alert, All-clear, Trail, Trail Map) and avoid the words it lists under _Avoid_.
- [docs/spec.md](docs/spec.md) is the behaviour contract. Its section **Limits that live in the code** names every tunable constant and the file that owns it.
- [docs/adr/0001-server-owns-the-deadline.md](docs/adr/0001-server-owns-the-deadline.md) is the one decision everything else follows from.
- [docs/design/backend/design.md](docs/design/backend/design.md) explains the backend shape as first designed (clock, outbox, commands, delivery, heartbeat) and the tradeoffs accepted. Read it before touching a migration or `deliver`, but where it disagrees with the migrations, the migrations win: push, text messages, the Reminder and the All-clear have changed since. Its code files are the original sketch, not the implementation.

## More commands

The four test suites, each with its single-file form. The README's **Check it** lists the full runs and their prerequisites.

| Suite | One file | Needs |
| --- | --- | --- |
| Jest, `src/**/*.test.ts` | `npx jest src/lib/barry/alarms.test.ts` | nothing |
| Deno, the `deliver` Edge Function | `deno test supabase/functions/deliver/messages.en.test.ts` | Deno |
| pgTAP, `supabase/tests/database/*.test.sql` | `npx supabase test db supabase/tests/database/tick.test.sql` | `npx supabase start` |
| End-to-end, `e2e/*.e2e.mjs` | `node --test --test-timeout=300000 e2e/missed-deadline.e2e.mjs` | the stack and `node scripts/sms-relay.mjs` |

- Each e2e file creates its own account and contacts and deletes them afterwards, so files run in parallel. The clock ticks once a minute, so cases poll up to 150 seconds and the whole suite takes about four minutes.
- `npx supabase db reset --local` applies every migration and `supabase/seed.sql`, which holds the Vault secrets `deliver` needs locally. It also deletes the test account from `.env.local`.
- The local Edge Runtime does not always reload `supabase/functions`. After a change there, run `docker restart supabase_edge_runtime_barry-local`.
- `src/lib/database.types.ts` is generated: `npx supabase gen types typescript --local > src/lib/database.types.ts` with the stack running, after a migration changes a table, view, function or enum.
- Hosted changes go out with `npx supabase db push` and `npx supabase functions deploy deliver`. Hosted secrets are set with `node scripts/hosted-secrets.mjs` from `supabase/.env.hosted`, never with `npx supabase secrets set`, which would also upload the local values from `supabase/config.toml`. Hosted Auth settings live in `[remotes.hosted]` of `supabase/config.toml` and go out with `node scripts/hosted-auth.mjs`, never through the dashboard. [docs/hosted-supabase.md](docs/hosted-supabase.md) has the details.
- A change to a screen, to `src/lib/barry`, to a command or to delivery is done once `/barry-verify` has driven it in the iOS Simulator and captured proof. The other skills are listed in the README.

Where to watch what Barry sends locally: [docs/local-messages.md](docs/local-messages.md).

## Architecture

### Supabase owns the Deadline

The phone may be dead when the Deadline passes, so the clock and every message to an Emergency Contact live in Postgres.

- **Clock.** pg_cron runs `private.tick()` every minute. It calls `private.reconcile(adventure_id)`, which locks the row and calls the pure function `private.decide(...)` until nothing is owed, then enqueues messages. Every command calls `reconcile` for its own Adventure after its change, so one code path decides what goes out whether a tap or the clock triggered it.
- **Commands.** The app changes Adventures only through the RPCs `save_adventure`, `delete_adventure`, `start_adventure`, `move_deadline`, `check_in`, `record_trail` and `delete_account`. The Stage rules live in those functions and nowhere else, and they return a typed `refusal` enum value instead of raising. The app writes directly only to `adventurer_profiles` and `emergency_contacts`; `push_devices` is granted too, but unused while push is off. Privileges fail closed: a table without an explicit grant is invisible to the app.
- **Outbox.** One `messages` row is one message to one address on one channel. The unique key `(adventure_id, kind, round, for_deadline, plan_revision, previous_deadline, channel, to_address)` makes every enqueue idempotent, so retries and double ticks cannot send twice. Kinds that reach contacts: `heads_up`, `plan_update`, `deadline_update`, `alert` (up to three rounds, an hour apart) and `all_clear`. The Reminder and the Overdue Notice are local notifications the phone schedules itself (`src/lib/barry/alarms.ts`), not server messages. So is the Arrival Notice (`src/lib/barry/arrival.ts`), which the phone shows when iOS reports the destination's geofence.
- **Delivery.** The Edge Function `supabase/functions/deliver` is a plain drain: pg_net kicks it after each command and each tick, it claims rows through the service-role-only RPC `claim_messages` with a lease, reads `message_facts` at send time so an Alert carries the latest Plan and Profile, renders with `messages.en.ts` or `messages.de.ts` by the Adventurer's language, sends through `senders.ts` (email, text message, push) and settles. Afterwards it calls `health()` and pings the monitor, so one heartbeat proves the whole chain.
- **Migrations are history.** Later files replace functions earlier files created, and some reverse an earlier rule (the All-clear rule changed on 16 Oct 2026). To learn a function's current body, read the latest migration that defines it. Commands sit in the unexposed `commands` schema with thin pass-throughs in `public`.

### The client module

`src/lib/barry` is the one module screens import, as `@/lib/barry`. `client.ts` builds it with `createBarry(deps)`, where the effects (storage, Supabase, location, notifications) are injected and faked in the unit tests. `index.ts` wires the real effects; `index.web.ts` is an empty stand-in because the web build has no app. The module hides the location fix, the geofences of the Trail and of the destination (one task, because expo-location restarts every region whenever any geofence task changes), the offline Check-in queue (`check-in-queue.ts`), the cached Adventure for offline screens (`adventure-cache.ts`), the Trail buffer and upload (`trail.ts`, `trail-buffer.ts`), the local alarms, the Start warnings and the row-to-domain parsing (`rows.ts`). It returns outcome unions, such as `protected | refused | unconfirmed` for Start and `ended | queued` for Check-in. An Adventure is Active only once Supabase confirmed the Start; `unconfirmed` is the state the screen must show as unprotected.

`index.ts` at the repository root imports `trail-task` before `expo-router/entry`, because iOS delivers background location and geofence events to a relaunched app before any UI exists.

### Screens

`src/app/_layout.tsx` wraps gesture handling. `(app)/_layout.tsx` provides the session, gates `(tabs)` and `sign-in` with `Stack.Protected`, and on every foreground flushes queued Check-ins, syncs the Trail, syncs the message language and asks for notification permission. `(tabs)` holds the four tabs (Adventure, History, Contacts, Profile), each with its own stack and headers. Shared pieces live in `src/components`, `src/hooks` and `src/constants/theme.ts`.

### The web build is the Trail Map

`app.json` sets `web.output: "static"`. The only web pages that ship are `src/app/adventure.web.tsx` (the Trail Map an Emergency Contact opens, with the token in the URL fragment, backed by `src/lib/trail-map`) and `src/app/confirmed.web.tsx` (where Auth lands after email confirmation). `(app)/_layout.web.tsx` tells any other route that Barry runs on iPhone. `.github/workflows/trail-map.yml` exports the web build and publishes those pages plus the static pages in `web/` to GitHub Pages at barry.support ([docs/trail-map-hosting.md](docs/trail-map-hosting.md)). Platform-specific files use Expo's `.web.tsx` and `.ios.tsx` suffixes.

### English and German live in four places

A text change usually touches more than one of them, and the tests of each pin the wording.

- App screens: `src/lib/texts.ts`, with date and duration formats and the texts of the Reminder and the Overdue Notice (`notificationText`) in `src/lib/wording.ts`. The language comes from the phone (`src/lib/language.ts`) and is synced to the server so contacts get the Adventurer's language.
- Messages to contacts: `supabase/functions/deliver/messages.en.ts` and `messages.de.ts`.
- iOS permission strings: the `expo-location` plugin block in `app.json` and the development build's `NSLocalNetworkUsageDescription` in `app.config.js` (English), and `locales/de.json` (German).
- The website and the Trail Map: `src/lib/site-language.ts` and the pages in `web/`.

## Conventions

- Commit titles are one prose sentence naming the behaviour that changed, in the glossary's terms, as in `git log`. A change to a skill or the README is prefixed with its name, such as `barry-verify:` or `README:`.
- Constants that are implementation choices stay in the code next to what they protect, with a test that pins them, and the spec names them instead of their values.
