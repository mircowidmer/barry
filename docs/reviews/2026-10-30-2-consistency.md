# Consistency audit (`/barry-audit-consistency --fix`)

Branch `claude/barry-maintenance-27f3d4`, the second step of the maintenance pass of 30 October 2026. The audit concentrated on what changed since the pass of 28 October (the eight migrations since: length limits as triggers, the 15-minute pace of Plan and Deadline Updates, the pruned Starts, the cap of nine Alerts, the revoked private privileges, the Deadline at most a year ahead; the Conditions with the forecast, the avalanche bulletin and the daylight; the password rules of the hosted project; the ten new e2e cases) and re-ran the repository-wide checks of every group.

## 1. Summary

- **Findings:** 0 Blocking, 0 High, 3 Medium, 2 Low. 3 fixed, 2 left to the author.
- **The findings that matter:**
  1. **C-3 (Medium):** a Deadline more than a year ahead is refused by the trigger `guard_deadline_bound`, but the app has no text for `barry:deadline_too_far` and the Deadline picker has no maximum, so the Adventurer reads only "Could Not Save".
  2. **C-1 (Medium):** the spec's **Limits that live in the code** left out `max_alerts`, `max_alerts_per_adventure` and `starts_window`, which `limits.test.sql` pins.
  3. **C-2 (Medium):** barry-backend-verify's table **Which tests cover what** did not name `pace.test.sql`.
- **Checks run:** `npx expo lint` clean; `npx tsc --noEmit` clean; `npm test` 241 of 241 in 32 suites; `deno test supabase/functions/deliver` 36 passed. `npx supabase test db` and the regeneration of `src/lib/database.types.ts` were skipped: the local stack is not running in this session (section 4).

## 2. Findings

### Medium

**C-1. The spec's limits section omits three constants the tests pin.**

- `docs/spec.md:244` (before the fix): "`max_contacts`, `max_adventure_contacts` and `max_starts_per_day` (`supabase/migrations/20261028120100_message_limits.sql`) hold the limits above ..." and no bullet names `max_alerts`, `max_alerts_per_adventure` or `starts_window`.
- `supabase/tests/database/limits.test.sql:9-11`: `select is(private.starts_window(), interval '24 hours', ...)`, `select is(private.max_alerts(), 3::smallint, ...)`, `select is(private.max_alerts_per_adventure(), 9::smallint, ...)`; `src/lib/barry/limits.ts:3-4`: "`max_alerts` in `20261015081453_clock_decide.sql` and `max_alerts_per_adventure` in `20261030100100_alert_cap.sql`".
- **True:** the code and its tests; AGENTS.md says the section "names every tunable constant and the file that owns it".
- **Fix:** one bullet naming the three with their migrations and tests.
- **Confidence:** high.
- **Outcome:** **fixed** 466f83b.

**C-2. barry-backend-verify's coverage table does not name `pace.test.sql`.**

- `.claude/skills/barry-backend-verify/SKILL.md:44, 46` (before the fix): the pgTAP column reads "`commands`, `deadline_update`" for the Deadline Update and "`plan_update`" for the Plan Update.
- `supabase/tests/database/pace.test.sql` exists (added 29 October) and `docs/spec.md:246`: "`update_pace` ... `pace.test.sql` pins it."
- **True:** the file exists and tests both update kinds.
- **Fix:** name `pace` in both rows.
- **Confidence:** high.
- **Outcome:** **fixed** 14a813c.

**C-3. The app has no text, and the picker no maximum, for a Deadline more than a year ahead.**

- `docs/spec.md:62`: "Deadline | Yes | An absolute moment in time. Must be in the future at Start. At most a year ahead when saved or moved."
- `supabase/migrations/20261030120100_deadline_bound.sql:16`: `raise exception 'barry:deadline_too_far';`
- `src/lib/texts.ts`: no `deadline_too_far`; `src/lib/barry/client.ts:283, 295` map `barry:too_many_contacts` and `barry:contact_in_use` to outcomes, nothing maps `barry:deadline_too_far`; `src/app/(app)/(tabs)/(adventure)/plan.tsx:376`: `minimumDate={new Date()}` with no `maximumDate`, and `onSave`'s catch (`plan.tsx:229`) shows `t.plan.couldNotSave`, "Could Not Save ... check your signal".
- **True:** the server refuses as the spec says; the phone explains it as a lost signal. `e2e/long-deadline.e2e.mjs` proves the server side only.
- **Fix:** a `maximumDate` a year ahead on the picker, or a text for the code, as for `too_many_contacts`.
- **Confidence:** high that the two sides disagree.
- **Outcome:** **skipped**, rule 2: app code.

### Low

**C-4. The spec did not describe Log Out.**

- `docs/spec.md:21-22` (before the fix): the Profile tab's account rules name **Delete Account** and the Account screen; nothing names Log Out.
- `src/lib/texts.ts:317, 350-351`: `logOut: 'Log Out'`, `logOutTitle: 'Log Out?'`; `src/lib/barry/client.ts:374-378`: `logOut` calls `remember(null)`, `conditions.forget()` and `signOut()`, so the alarms are cancelled and the Trail stops on this phone while the Adventure goes on on the server.
- **True:** the code; the spec simply left the screen out.
- **Fix:** one bullet after Delete Account.
- **Confidence:** high.
- **Outcome:** **fixed** 95e1853.

**C-5. A migration's comment describes a Trail cadence the phone no longer has.**

- `supabase/migrations/20261015200000_ten_second_trail.sql:2-3`: "The phone still uploads only the first reading of each minute (src/lib/barry/trail-buffer.ts), so the Trail keeps about one reading a minute, as the spec and the permission texts say."
- `src/lib/barry/trail-buffer.ts:19`: `export const SLOT_MS = 5 * 60_000;`; `docs/spec.md:193`: "The phone keeps the first one of every 5 minutes and uploads only those."; `CONTEXT.md:52`: "about one every 5 minutes".
- **True:** the code, the spec and the texts agree on 5 minutes; the comment is from the day the migration was written. The server's `slot` is still 10 seconds, as the spec says ("seconds long, not minutes").
- **Fix:** none possible here; migrations are history.
- **Confidence:** high.
- **Outcome:** **skipped**, rule 3.

## 3. Checked and consistent

1. **Terminology:** the 21 Avoid lists of CONTEXT.md against `texts.ts`, `wording.ts`, `messages.en.ts`, `messages.de.ts`, `locales/de.json`, the permission strings in `app.json` and `app.config.js`, `site-language.ts` and `web/*.html`: 103 raw hits, all read; every one is the defined term itself ("emergency contact", "Account" for the Account screen), a part the glossary allows ("Sunset" beside Dark, "forecast" for the hourly table, "weather" as one of the three Conditions), the German term for Alert ("Alarm"), or the iOS word "location" in permission strings. No `ß` in any user-facing file. German quotes are « » in `de.json`, `texts.ts` and the web pages; `messages.de.ts` uses none; the „ “ in `texts.ts` are English typographic quotes in `keepWithoutPin`.
2. **Numbers and timing:** Grace Period 5 minutes (`20261022080000_five_minute_grace.sql`, spec:148); Reminder 30 minutes (`alarms.ts` `REMINDER_LEAD_MS`, spec:140); Alerts 3 an hour apart, 9 per Adventure (`clock_decide.sql`, `alert_cap.sql`, `LIMITS`, spec:106-107, texts `too_many_alerts`); Deadline Update delay 3 minutes and pace 15 minutes (`deadline_update.sql`, `pace_updates.sql`, spec:110, 139); Plan Update pace 15 minutes (spec:125, 138); Starts 5 in 24 hours (`message_limits.sql`, `prune_starts.sql`, spec:91); Deadline at most a year ahead (`deadline_bound.sql`, spec:62); contacts 10 and 5, lengths 200/100/50/50/20/500/254 (`length_limits_on_change.sql`, `LIMITS`, spec:34, 46, 60); Trail 5 minutes on the phone and a 10-second `slot` on the server (spec:192-194, CONTEXT.md:48, 52, `app.json`, `de.json`); Conditions refresh 30 minutes, at least 6 hours shown (`conditions.ts`, spec:233, 250).
3. **Messages to contacts:** the five kinds in the enum, `messages.ts`, both language files and `types.ts` `DeliveryFailure['message']`; the English and German Alert both carry round "of 3"; the failure reasons `channel_not_enabled` and `retries_exhausted` in the migrations and `texts.ts` (both languages); the privacy page names Open-Meteo and the SLF beside Cloudflare and Apple.
4. **Refusals and failures:** the 16 values of `public.refusal` in the migrations, `database.types.ts` and both `refusals` objects of `texts.ts` (`satisfies Record<Refusal, string>` makes the compiler check it); every value is returned by a command. The `barry:` exceptions: `too_many_contacts` and `contact_in_use` are mapped in `client.ts`, `adventure_in_progress` is a backstop trigger on `auth.users` behind the `delete_account` refusal, `deadline_too_far` is C-3.
5. **Platform variants:** the 13 pairs export the same values; the base files additionally export prop types (`ButtonProps`, `TrailMapViewProps`, `MapCamera`, `Captcha`) that callers resolve from the base, and the web pages export `generateMetadata`, which only the static export reads. `tsconfig.json` includes `**/*.ts` and `**/*.tsx` and excludes only `supabase/functions`, `docs`, `ios`, `android`, so both variants are type-checked.
6. **Routes, links and hosting:** every relative link in the 30 Markdown files resolves; every file under `docs/` is linked from the README or another document.
7. **Build and run configuration:** `npm run` targets in the README, AGENTS.md, the docs and the skills exist in `package.json`; the scripts the skills name exist under their `scripts/` folders; `locales/de.json` has one key per permission string `app.json` and `app.config.js` produce (`motionUsagePermission` is `false`, so no motion string); no `bun.lock`; every SDK mention says 58; `.npmrc` is gone and only barry-security mentions it, as a thing to report.
8. **Tests versus promises:** all 83 e2e files and 16 of the 17 pgTAP files are named in barry-backend-verify (C-2 the 17th); the 9 feature files name screens that exist and labels that `texts.ts`, `site-language.ts` or the server messages render.
9. **Generated and derived files:** the migrations since 28 October add private functions, triggers and one enum value, `too_many_alerts`, which `database.types.ts` has (the compiler checks `texts.ts` against it); no public table, view or function changed, so the types the 28 October audit found identical to the CLI's output still are.
10. **Documents against each other:** the 30 commits since 28 October are reflected: the Conditions in the spec, CONTEXT.md, `plan-conditions` and `web/index.html`; the year-ahead Deadline, the pace, the nine Alerts and the length limits in the spec; the password rules in `docs/hosted-supabase.md`; the CI trigger in the README; the Supabase CLI version only in `package.json`.

## 4. Could not check

- `npx supabase test db` and `npx supabase gen types typescript --local`: the local stack is not running (the API on 54321 does not answer, and the Supabase CLI cannot write its telemetry file inside this session's sandbox). Step 8 of the maintenance pass runs the pgTAP suite against the stack.
- `npm run e2e`: needs the stack and the text message relay.

## Commits

1. 14a813c barry-backend-verify: the table of what covers what names pace.test.sql beside the Plan Update and the Deadline Update it paces
2. 466f83b The spec names max_alerts, max_alerts_per_adventure and starts_window among the limits that live in the code, with the migrations that own them
3. 95e1853 The spec says what Log Out does: the phone forgets the live Adventure and the kept Conditions while the Adventure itself goes on

After each: `npx expo lint` clean, `npx tsc --noEmit` 0 errors, 241 of 241 Jest tests.

**Skipped:** C-3 (rule 2, app code), C-5 (rule 3, a migration).
