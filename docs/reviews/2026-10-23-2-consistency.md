# Consistency audit (`/barry-audit-consistency --fix`)

Branch `maintenance-2026-10-23`, the second step of the maintenance pass of 23 October 2026, after the code quality fixes.

## Summary

| Severity | Findings |
|---|---|
| Blocking | 0 |
| High | 0 |
| Medium | 6 |
| Low | 12 |

**The three findings that matter most:**

1. **M3.** The backend verify skill's table of which tests cover what leaves out three e2e cases that exist, so a change to `enqueue_to_contacts` or `report_delivery` would skip them.
2. **M4 and M5.** The spec's stage table says an Ended Adventure leaves to nothing, while the paragraph under it says it can be deleted; and the spec does not mention that the History can select and delete several Ended Adventures at once.
3. **M1.** The spec's section that says where each limit lives names a superseded migration for `claim_messages`.

**Checks run:**

| Check | Result |
|---|---|
| `npx expo lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm test` | 163 of 163 passing |
| `deno test supabase/functions/deliver` | 32 of 32 passing |
| `npx supabase test db`, `npm run e2e` | not run: the local stack is not running; the pass's last step runs both |

**Since the audit of 21 October 2026:** of its 37 findings, 24 were fixed then and stay fixed. The ones still open are repeated below where today's checks confirmed them (M6, L3, L11, L12), and the e2e citation drift (L3) has grown.

## Findings

### Medium

**M1. The spec names a superseded migration as the last definition of `claim_messages`.** Confidence: high.
- `docs/spec.md:219`: "the lease in `claim_messages` (last defined in `supabase/migrations/20261016210100_deadline_update.sql`)"
- `supabase/migrations/20261022120000_move_after_alert.sql:112`: `create or replace function public.claim_messages(p_limit int, p_lease interval default interval '2 minutes')`
- What is true: the migrations win; the lease is still 2 minutes, but the body lives in `20261022120000_move_after_alert.sql`. The other two references in that section are still current.
- Fix: point the spec at `20261022120000_move_after_alert.sql`.
- Outcome: **fixed** 4410eec

**M2. The backend design's "Implementation reconciliation" describes the current repository with a one-minute Grace Period and a push module.** Confidence: high.
- `docs/design/backend/design.md:250`: "The Grace Period is 1 minute, in `supabase/migrations/20261015170000_one_minute_grace.sql`"
- `docs/design/backend/design.md:248`: "Push is implemented. `src/lib/push.ts` asks for notification permission and registers the Expo push token each time the app opens"
- `supabase/migrations/20261022080000_five_minute_grace.sql:1`: `select interval '5 minutes'`; `supabase/migrations/20261015180000_local_adventurer_notifications.sql:3`: `update private.channel_config set enabled = false where channel = 'push';`; `src/lib/push.ts` does not exist.
- What is true: 5 minutes, push off, the Reminder and the Overdue Notice scheduled by the phone (`src/lib/barry/alarms.ts`). The rest of the document is a sketch, as AGENTS.md:51 says, but this section claims the current state.
- Fix: close the reconciliation with one line that names what changed since.
- Outcome: **fixed** 75c7512

**M3. The backend verify skill's table of which tests cover what leaves out three e2e cases.** Confidence: high.
- `.claude/skills/barry-backend-verify/SKILL.md:40-53`: the table names no `alert-reaches-every-channel`, `all-clear-reaches-every-channel` or `undelivered-all-clear`.
- `e2e/alert-reaches-every-channel.e2e.mjs:8`: `test('the Alert reaches a contact on both of their addresses'`; `e2e/all-clear-reaches-every-channel.e2e.mjs:9`; `e2e/undelivered-all-clear.e2e.mjs:11`: `test('an All-clear text message that Twilio reports as undelivered shows as a Delivery Failure`
- What is true: the three files exist and `SKILL.md:69` names them in prose; the table is the stale side. Every other name in the table exists, and all 15 pgTAP files are listed.
- Fix: add the first two to the "Emergency Contacts and their addresses" row and the third to "Twilio's delivery reports".
- Outcome: **fixed** 88fd9bb

**M4. The spec's stage table says an Ended Adventure leaves to nothing, and the paragraph under it says it can be deleted.** Confidence: high.
- `docs/spec.md:67`: `| Planned | The Adventurer saves a new Adventure. | Active, or Deleted |`
- `docs/spec.md:71`: `| Ended | The Adventurer checks in. | Nothing |`
- `docs/spec.md:73`: "The Adventurer can delete a Planned or an Ended Adventure after confirming"
- What is true: `delete_adventure` (`supabase/migrations/20261015160000_delete_ended.sql`) deletes an Ended Adventure; the Planned row already says so in the table's own words.
- Fix: the Ended row leaves to Deleted.
- Outcome: **fixed** da1108b

**M5. The spec does not mention that the History selects and deletes several Ended Adventures at once.** Confidence: high.
- `docs/spec.md:73`: "The Adventurer can delete a Planned or an Ended Adventure after confirming, from its screen or by swiping its card left."
- `src/app/(app)/(tabs)/history/index.tsx:196-204`: `removeSelected` calls `askToDeleteAdventures([...selected])`; `src/lib/texts.ts:129-135`: `select: 'Select'`, `selectAll`, `deleteSelected`, `deleteTitle: (n) => ... \`Delete ${n} Adventures?\``, `deleteMany`.
- What is true: the code has it, and `.claude/skills/barry-frontend-verify/features/history.md` drives it.
- Fix: add the selection to the sentence.
- Outcome: **fixed** cc0cadf

**M6. The server still carries the Reminder and the Overdue Notice as message kinds and renders them, though nothing sends them.** Confidence: medium.
- `src/lib/database.types.ts` enum `message_kind`: `"heads_up"|"reminder"|"overdue_notice"|...`; `supabase/functions/deliver/messages.en.ts:77-87` and `messages.de.ts:80-90` render both; `supabase/migrations/20261022120000_move_after_alert.sql:124` still cancels them.
- `docs/spec.md:125`: "The Reminder, the Overdue Notice and the Arrival Notice go to the Adventurer only, so the phone shows them itself as local notifications."; push is off since `20261015180000_local_adventurer_notifications.sql:3`.
- What is true: the phone schedules both (`src/lib/barry/alarms.ts`); the server paths are dead but harmless. Removing them is a migration and code change for the author.
- Fix: a migration that drops the two kinds and the templates, when the author wants it.
- Outcome: **skipped**, rule 1

### Low

**L1. The project overview gives one-minute cadences and stale counts.** Confidence: high.
- `docs/overview/barry-overview.html:81`: "Barry records a position about once a minute"; `:82`: "It updates every minute"; `:97`: "One minute after the deadline, then every hour, up to three alerts."; `:112`: "37 migrations"; `:115`: "45 end-to-end scripts"; `:189`: "Run every test in CI … on each push, not only the Pages deploy."
- `docs/spec.md:140`: "The Grace Period is 5 minutes."; `:183`: "about one reading every 5 minutes"; `:197`: "every 5 minutes"; `ls supabase/migrations`: 41; `ls e2e/*.e2e.mjs`: 49; `README.md:30`: "`.github/workflows/ci.yml` runs all six … on every push".
- What is true: the spec and the code. README.md:44 calls the page a snapshot; the 21 October pass still corrected its counts, so this does the same. The prompt count (311 against `barry-prompts.html`'s own figure) could not be settled.
- Fix: five minutes in the three sentences, 41 and 49, and the CI step marked done.
- Outcome: **fixed** bbe5cd2

**L2. A migration comment still says the phone keeps one Trail reading a minute.** Confidence: high.
- `supabase/migrations/20261015200000_ten_second_trail.sql:2-3`: "The phone still uploads only the first reading of each minute (src/lib/barry/trail-buffer.ts), so the Trail keeps about one reading a minute, as the spec and the permission texts say."
- `src/lib/barry/trail-buffer.ts:19`: `export const SLOT_MS = 5 * 60_000;`; `app.json:82`: "about every 5 minutes".
- What is true: five minutes. The comment was true when written.
- Fix: none; migrations are history (rule 3).
- Outcome: **skipped**, rule 3

**L3. The e2e files cite spec line numbers and wordings that have moved.** Confidence: high.
- `e2e/alert-rounds.e2e.mjs:6`: `docs/spec.md:125 "The Grace Period ends, then every hour, up to three Alerts in total"` against `docs/spec.md:135`: "The Grace Period ends, then every hour, up to three Alerts for each Deadline"
- `e2e/move-sends-no-plan-update.e2e.mjs:6` and `e2e/removed-contact.e2e.mjs:7`: `docs/spec.md:109 "Changing only the contacts, or moving the Deadline, sends no Plan Update."` against `docs/spec.md:118`: "Changing only the contacts, moving the Deadline, or moving the destination on the map sends no Plan Update."
- What is true: all 39 citations checked are 6 to 17 lines off, two also in wording. The spec is right.
- Fix: cite headings instead of line numbers, when the author next touches the files.
- Outcome: **skipped**, rule 5

**L4. The spec's list of limits leaves out the 10-second window the server collapses Trail readings to.** Confidence: high.
- `docs/spec.md:217` names `MAX_SLOTS`, `SLOT_MS`, `BATCH` and the `limit` in `record_trail`.
- `supabase/migrations/20261015200000_ten_second_trail.sql:8-12`: the `slot` column on `date_bin('10 seconds', ...)` and the unique index; `supabase/tests/database/trail.test.sql:93`: "Two readings in one 10-second window are accepted".
- What is true: the window is a limit that lives in the code with a test, exactly what the section is for.
- Fix: name the `slot` column in that line.
- Outcome: **fixed** 98b7a2c

**L5. The frontend verify skill's feature index forbids the text entry its skill prescribes.** Confidence: high.
- `.claude/skills/barry-frontend-verify/features/README.md:17`: "Enter text only through `clip.sh` and the long-press Paste menu."
- `.claude/skills/barry-frontend-verify/SKILL.md:38`: "Type with Maestro: `maestro.sh field "Destination"` prints the point of the field's input box … Without Maestro, use the clipboard"
- What is true: the skill and `flows/type.yaml` are newer.
- Fix: the index says Maestro first, the clipboard as fallback.
- Outcome: **fixed** 12d61ac

**L6. The Trail recipe names the map marker `Last Position`; the app titles it `Last position: <time>`.** Confidence: medium.
- `.claude/skills/barry-frontend-verify/features/trail.md:13`: "a red `Last Position` marker"
- `src/components/trail-map-view.tsx:67`: `title: t.adventure.lastKnown(t.when(last.takenAt))`; `src/lib/texts.ts:104`: `` lastKnown: (when: string) => `Last position: ${when}` ``
- What is true: the recipe may mean the glossary term, not the label.
- Fix: quote the title, if it is meant as a label.
- Outcome: **skipped**, rule 1

**L7. `storage` is `Storage` on native and `Storage | undefined` on web, and the web combination is never type-checked.** Confidence: medium.
- `src/lib/storage.ts:3`: `export const storage = localStorage;`; `src/lib/storage.web.ts:1`: `export const storage = typeof localStorage === 'undefined' ? undefined : localStorage;`; `src/lib/supabase.ts:29`: `storage,`
- What is true: `tsc --listFilesOnly` lists every `.web` and `.ios` file, but each resolves `@/…` to the base file, so `supabase.ts` is never checked with `undefined`. At runtime the web side is right and supabase-js tolerates a missing storage.
- Fix: one shared type for both files; a code decision.
- Outcome: **skipped**, rule 1

**L8. Three component pairs export their prop types from the base file only.** Confidence: high.
- `src/components/destination-map.tsx:9,11` exports `MapCamera` and `DestinationMapProps`; `src/components/destination-map.web.tsx` exports only `DestinationMap`, while `src/app/(app)/(tabs)/(adventure)/plan.tsx:6` imports `{ DestinationMap, type MapCamera } from '@/components/destination-map'`. Same for `ButtonProps` (`button.tsx:7`) and `TrailMapViewProps` (`trail-map-view.tsx:12`).
- What is true: Metro erases type-only imports, so nothing breaks; the runtime exports match on both sides.
- Fix: re-export the types from the variant files; a code change (rule 2).
- Outcome: **skipped**, rule 2

**L9. "check-in time" names the Deadline in the Deadline Update and on the landing page.** Confidence: high.
- `supabase/functions/deliver/messages.en.ts:67`: "moved the check-in time from ${time(facts.previousDeadline)} to ${time(facts.deadline)}"; `web/index.html:43`: "or move your check-in time"
- `supabase/functions/deliver/messages.en.ts:102`: "The deadline was ${time(facts.deadline)}"; `messages.de.ts:70`: "hat die Rückkehrzeit von … verschoben" (the German word for the Deadline everywhere); `web/index.html:66`: "check-in time" for the time of the Check-in; `CONTEXT.md:35`: Deadline.
- What is true: the English names one concept two ways, and "check-in time" also means the Check-in's time three lines later; the German is consistent. The 21 October pass skipped this because the Deno tests could not run there; they run here.
- Fix: "deadline" in both places, and in the Deno fixture that pins the text.
- Outcome: **fixed** 48c8075

**L10. The reviews under `docs/reviews/` are reachable from no document.** Confidence: high.
- `README.md:32-44` lists every guide under `docs/` except `docs/reviews/`; `ls docs/reviews`: six reports.
- What is true: every other file under `docs/` is linked; the design sketch's companion files are named by `docs/design/backend/design.md:5-7` without links.
- Fix: one line in the README's guides.
- Outcome: **fixed** 50e41a3

**L11. The ADR names three server messages and four app reports.** Confidence: medium.
- `docs/adr/0001-server-owns-the-deadline.md:3`: "sends every Heads-up, Alert and All-clear. The app only reports Start, Check-in, Deadline moves and Plan edits."
- `CONTEXT.md:90-96`: Plan Update and Deadline Update; `docs/spec.md:129-136`.
- What is true: the decision stands; the list was complete when written.
- Fix: the author's call whether a decision record lists every kind.
- Outcome: **skipped**, rule 1

**L12. `health.e2e.mjs` calls `deliver` itself, so the tick-to-monitor path is untested.** Confidence: high.
- `docs/adr/0001-server-owns-the-deadline.md:10`: "It reports to an outside monitor that alerts the operator when the reports stop."; `docs/hosted-supabase.md:89`.
- `e2e/health.e2e.mjs`: `runDeliver()` from `e2e/stack.mjs`, not a pg_cron tick.
- What is true: the pgTAP `tick` test proves the kick, the e2e the ping; nothing proves them end to end.
- Fix: a missing test is the author's to add (rule 5).
- Outcome: **skipped**, rule 5

## Checked and consistent

1. **Terminology.** Every "Avoid" word of CONTEXT.md searched across `texts.ts`, `site-language.ts`, `messages.en.ts`, `messages.de.ts`, `locales/de.json`, the `app.json` and `app.config.js` permission strings, `web/*.html` and the screens; the hits are the iOS permission "Location", the sign-in "account" (a concept apart from the Adventurer Profile, as the spec's Accounts section uses it) and the German "Alarm" for Alert, used the same way everywhere. English names agree across app, messages and web except L9; German agrees (Rückkehrzeit, Spur, Letzter Standort, Notfallkontakt, Alarm, Entwarnung). No `ß` in user-facing text (`site-language.ts:74` tests a name ending in ß, which is input); « » in `texts.ts`, `site-language.ts`, `locales/de.json` and `web/*.html`.
2. **Numbers and timing.** Grace Period 5 min (`five_minute_grace.sql` = spec = texts = decide/reconcile/access tests = e2e stack = web), Reminder 30 min (`clock_decide.sql` = `alarms.ts` = spec = tests), Overdue Notice at the Deadline, 3 Alerts an hour apart (`max_alerts`, `alert_interval` = spec = texts "n of 3" = both message files = tests = web), Deadline Update 3 min and coalescing (`deadline_update.sql`, `move_after_alert.sql` = spec = CONTEXT "a few minutes" = tests), Trail 5-minute phone slot and 10-second server window (L2, L4), 200 m fence and 150 m arrival radius, live map and Trail Map 5-minute refresh, Trail Map after Check-in and after deletion, tick every minute, `clock_ok` 2 min, `outbox_ok` 5 min, `delivery_ok` 15 min / 3 failures (= hosted guide = both doctor scripts), retries 6 over about 18 min (= local-messages guide), e2e poll 150 s, every limit in spec "Limits that live in the code" at the named file except M1.
3. **Messages to contacts.** All five contact kinds in the enum, `facts.ts`, both templates and `DeliveryFailure['message']`; every field the spec table lists is in both templates, and both templates print the same fields; only the Alert carries the Profile and drops the phone line when there is none; sender name "🐶 Barry" (`senders.ts:99` = spec:168), `help@barry.support` for Auth mail (spec:14 = `config.toml` hosted smtp), `TWILIO_FROM=Barry` (`config.toml` = text-messages guide), text messages on and push off in the final `channel_config` (= text-messages guide, spec:155); `wording.ts` and `messages.de.ts`/`messages.en.ts` build the same "Sa, 17. Okt. um 18:00" and "Sat 17 Oct, 18:00", pinned by `wording.test.ts` and both Deno test files.
4. **Refusals and failures.** 13 refusal codes raised = 13 in the enum = 13 in `texts.ts` English and German; failure reasons `channel_not_enabled` and `retries_exhausted` in the final `claim_messages` and `enqueue_to_contacts` and mapped in `texts.ts`; `no_alert_delivered` is gone from the final `claim_messages`. "Refuses while" rules: `messages_pending` (account, Ended Adventure) with `delete-account-waits-for-all-clear`, `delete-ended-adventure`, `account.test.sql`, `commands.test.sql`; `adventure_in_progress` with the two refused e2e cases; `barry:contact_in_use` trigger with `contact-in-use`, `contact-in-use-while-overdue`, `access.test.sql`; `no_contacts` with `last-contact-stays`, `commands.test.sql`.
5. **Platform variants.** All eleven pairs export the same runtime names with the same signatures (L7, L8 are the exceptions); `tsc --listFilesOnly` lists every variant; `index.ts` imports `trail-task` before `expo-router/entry`.
6. **Routes, links, hosting.** `/confirmed` and `/adventure` agree across spec, `config.toml`, `links.ts` (`${base}#${token}`), `TRAIL_MAP_URL` locally and hosted, the workflow's copies, `web/404.html`, `e2e/stack.mjs`; `/trail` survives only in the trail design sketch and the prompt log; `environment.url: ${{ steps.deployment.outputs.page_url }}` matches `actions/deploy-pages@v4`; `eas.json` hosted URL and key = `hosted-supabase.md` = `builds.md`; `.env.example` = README; schemes `barry`, `barry-dev`, `barry-preview` = `builds.md`.
7. **Build and run configuration.** `app.config.js` overrides scheme, bundle identifier, package, display name and the development-only local-network string; nothing in `app.json` is variant-specific; `eas.json` profiles = `build:*` scripts = `builds.md` = `iphone.md`; `support.barry.dev`, iPhone 18 Pro, Metro 8081, relay 8788 agree across both skills, both doctors, `ci.yml`, `config.toml` and every flow; `without-push.js` = AGENTS.md = `iphone.md` = `ci.yml`; no `bun.lock`, nothing assumes bun; every README "Check it" command exists; tsconfig, eslint and Jest agree on what is app code; every test file has a runner; Expo SDK 58 everywhere.
8. **Tests versus promises.** 15 pgTAP and 47 e2e names in the backend skill's table exist (M3 for the three unlisted); every iOS screen has a recipe and no recipe names a missing screen; 120 quoted labels resolve to `texts.ts`, the message subjects or iOS (L6); every stage transition and every message kind has a test (map in the auditor's notes: Reminder, Overdue Notice and Arrival Notice by Jest and pgTAP only, as local notifications); no pgTAP assertion contradicts a later migration.
9. **Generated and derived files.** `database.types.ts` matches the final migrations table by table, view, function, overload and enum; `locales/de.json` keys match the expo-location, expo-contacts and `app.config.js` keys and say the same as the English; `barry-prompts.html` claims nothing about current behaviour.
10. **Documents.** Every relative link in every Markdown file resolves; every guide the README lists exists (L10 for the reviews); spec and CONTEXT agree on terms, stages and message names; the ADR's Start, Check-in queue and monitor claims hold in `client.ts`, `check-in-queue.ts`, `tick.sql` and `deliver/index.ts` (L11, L12); the only references to the dropped starting point and notes are the old pass-through, its test, the spec's table header and the prompt log; the last thirty commits (test prunes, three e2e cases, the CI workflow, Maestro, the Account sheet's pull-down notice, the time format) are reflected in README, `builds.md`, the features and the skills (M3 for the e2e table).

## Could not check

- pgTAP and the e2e suite: the local stack is down; the pass's last step runs them.
- The hosted Healthchecks.io grace, DNS and GitHub Pages settings, and whether `npx expo export` still yields exactly the files the workflow copies: outside the repository or not run here.
- Which prompt count, 311 or 312, is right.

## Commits

1. 4410eec The spec sends readers to the migration that last defined claim_messages, move_after_alert, for the lease
2. 75c7512 The backend design's reconciliation ends with what changed since it: a five-minute Grace Period, push switched off and the Reminder and the Overdue Notice on the phone
3. da1108b The spec's stage table says an Ended Adventure leaves to Deleted, as its paragraph on deleting already says
4. cc0cadf The spec says that the History deletes several Ended Adventures at once through Select
5. bbe5cd2 The project overview says five minutes for the Trail, the Adventure page and the Grace Period, counts 41 migrations and 49 end-to-end scripts, and no longer lists CI as a next step
6. 98b7a2c The spec's limits name the slot window the server collapses Trail readings to
7. 48c8075 The Deadline Update and the landing page call the Deadline a deadline, not a check-in time
8. 50e41a3 README lists the reviews under docs/reviews among the guides
9. 88fd9bb barry-backend-verify: the table of which tests cover what names alert-reaches-every-channel, all-clear-reaches-every-channel and undelivered-all-clear
10. 12d61ac barry-frontend-verify: the feature index enters text with Maestro first and the clipboard only when Maestro is unavailable, as the skill says

**Skipped findings:** M6, L6, L7, L11 (rule 1: confidence medium); L8 (rule 2: a code change); L2 (rule 3: a migration); L3, L12 (rule 5: tests).
