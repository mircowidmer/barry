# Consistency audit (`/barry-audit-consistency --fix`)

Branch `claude/busy-planck-1swytm`.

## Summary

| Severity | Findings |
|---|---|
| Blocking | 0 |
| High | 1 |
| Medium | 13 |
| Low | 23 |

**The three findings that matter most:**

1. **H1.** The hosting guide sends the operator to set the Site URL in the Supabase dashboard. The project forbids that, and the next `hosted-auth.mjs` run would undo it.
2. **M1.** Delivery Failure reasons from Twilio and HTTP reach the Adventurer raw and in English, also in the German app.
3. **M2.** The local messages guide says a text message is retried until the relay runs again. In fact delivery gives up after 6 attempts, about 18 minutes.

**Checks run:**

| Check | Result |
|---|---|
| `npx expo lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm test` | 129 of 129 passing |
| Web export | produces exactly the files the workflow copies |
| `npx supabase test db`, `deno test` | not run: no Docker and no Deno in this environment |

## Findings

### High

**H1. trail-map-hosting.md tells the operator to set the Site URL in the dashboard. hosted-supabase.md and AGENTS.md forbid that.** Confidence: high.
- `docs/trail-map-hosting.md:17`: "In the Supabase dashboard, open **Authentication > URL Configuration** and set **Site URL** to `https://barry.support/confirmed`."
- `docs/hosted-supabase.md:95`: "Change a hosted Auth setting there, not in the dashboard, or the next push undoes the dashboard change."
- What is true: `supabase/config.toml:434` holds `site_url = "https://barry.support/confirmed"` under `[remotes.hosted.auth]`.
- Fix: step 5 points to `config.toml` and `node scripts/hosted-auth.mjs`.
- Outcome: **fixed** f9fc5a5

### Medium

**M1. Delivery Failure reasons from providers reach the Adventurer untranslated.** Confidence: high.
- `src/lib/texts.ts:110` and `:355` map only `channel_not_enabled` and `retries_exhausted`, then fall back to `f.reason`.
- `supabase/functions/deliver/delivery-report.ts:43` writes `` `Twilio ${code ?? 'error'}: …` ``, and `senders.ts:20` writes `` `HTTP ${status}: ${detail}` ``.
- Fix: map the provider reasons to a generic EN and DE phrase.
- Outcome: **skipped**, rule 2. The change decides what the Adventurer is shown, which is a behaviour change.

**M2. local-messages.md says a text message is retried until the relay runs again.** Confidence: high.
- `docs/local-messages.md:25`: "While it is not running, each text message is retried until it runs again."
- `20261015084008_deliver.sql`: `max_attempts` is 6, with a backoff of 30 s, 1, 2, 5 and 10 minutes, then `'retries_exhausted'`.
- Fix: say six attempts over about 18 minutes, then a Delivery Failure.
- Outcome: **fixed** c90ddfe

**M3. AGENTS.md gives the outbox's unique key with 6 columns. The key has 8.** Confidence: high.
- `AGENTS.md:81`: "The unique key `(adventure_id, kind, round, for_deadline, channel, to_address)`"
- `20261016210100_deadline_update.sql:7-8`: `(adventure_id, kind, round, for_deadline, plan_revision, previous_deadline, channel, to_address)`
- Fix: add `plan_revision, previous_deadline` to the key in AGENTS.md.
- Outcome: **fixed** 9b30279

**M4. AGENTS.md sends readers to the backend design as current. Its summary contradicts the migrations.** Confidence: high.
- `AGENTS.md:51`: "explains the backend shape … Read it before touching a migration or `deliver`."
- `docs/design/backend/design.md:13` and `:92` say the Reminder is a server message, push is on, text messages are off, and the All-clear follows only an Alert.
- Those claims are reversed by `20261015180000`, `20261016083000` and `20261016170000`.
- Fix: AGENTS.md calls it the original design and says the migrations win where they disagree.
- Outcome: **fixed** 3cc3922

**M5. CONTEXT.md's Deadline Update leaves out the destination that its body now carries.** Confidence: high.
- `CONTEXT.md:91`: "carrying the Deadline the contact knew, the new one and the contact's Trail Map link."
- `docs/spec.md:124` lists "destination", and `messages.en.ts` writes `Destination: …` (commit e153098).
- Outcome: **fixed** fc71773

**M6. The privacy page says the All-clear only says when the Adventurer checked in. Since 18 Oct it also carries the contact's link.** Confidence: high.
- `web/privacy.html:49`: "The all-clear says when you checked in."
- `web/privacy.html:115`: "Die Entwarnung sagt, wann du dich zurückgemeldet hast."
- The all_clear template in `messages.en.ts` adds the Trail Map link (`20261018150000_all_clear_trail_link.sql`).
- Outcome: **fixed** a879c9d

**M7. AGENTS.md promises over-the-air updates. The app has no expo-updates.** Confidence: high.
- `AGENTS.md:34`: "and to ship over-the-air updates (`eas update`)".
- `package.json` has no `expo-updates`, and `app.json` has no `updates` or `runtimeVersion`.
- Outcome: **fixed** 494c6c9

**M8. hosted-supabase.md lists the hosted app build as "Not done yet". `eas.json` already carries the hosted values.** Confidence: high.
- `docs/hosted-supabase.md:151`: "The app. Barry on a phone reaches the hosted project only after a build with … set to the hosted values."
- `eas.json` preview and production set the hosted `EXPO_PUBLIC_SUPABASE_URL` and key, and `docs/builds.md:15` says so.
- Outcome: **fixed** 008be76

**M9. The barry-verify recipes tell the agent to tap `Cancel`, `Add` and `Save` by their text. They are icon buttons.** Confidence: high.
- `features/contacts.md:3`, `:24`, `:26`, `features/live-adventure.md:10`, `:35` and `features/plan-and-start.md:3` speak of `Cancel` / `Save` / `Add` in the header.
- `contacts/edit.tsx:97`, `:101-103` and `plan.tsx:222`, `:228` use `icon="xmark"` and `icon="checkmark"`, with those words only as accessibility labels.
- `profile.md:26` already words it right: "The checkmark in the header, which VoiceOver reads as `Save`".
- Outcome: **fixed** 28ac073

**M10. AGENTS.md puts the English permission strings and the Reminder texts in the wrong places.** Confidence: high.
- `AGENTS.md:103` and `:105` name `texts.ts` and app.json's `expo-location` block.
- The Reminder and Overdue Notice texts are `notificationText` in `src/lib/wording.ts:49-69`.
- `NSLocalNetworkUsageDescription` is English in `app.config.js:25`.
- Outcome: **fixed** de295ae

**M11. The server still renders Reminder and Overdue Notice texts that nothing sends.** Confidence: medium.
- `supabase/functions/deliver/messages.en.ts:77,83` and `messages.de.ts:80,86` render them.
- Push is off (`20261015180000_local_adventurer_notifications.sql`).
- Outcome: **skipped**, rules 1 and 2.

**M12. tsc checks the `.web` variants on their own, never against their callers.** Confidence: high.
- `tsconfig.json` includes `**/*.ts` with no `moduleSuffixes`.
- `src/lib/storage.web.ts:1` may export `undefined`, while `storage.ts:3` cannot.
- Outcome: **skipped**, rule 2. The fix is a code or config decision.

**M13. README promises that `npm run ios` builds Barry Dev, but an existing `ios/` keeps its variant.** Confidence: medium.
- `README.md:15` against `docs/builds.md:51`.
- Outcome: **skipped**, rule 1.

### Low

**L1. The spec and the sign-in recipe call the account deletion `Delete`. The Profile row reads `Delete Account`.** Confidence: high.
- `docs/spec.md:18`, `features/sign-in.md:13` against `texts.ts` `deleteAccount: 'Delete Account'`.
- Outcome: **fixed** a8f1d5b

**L2. CONTEXT.md's Heads-up names only Start as its trigger.** Confidence: high.
- `CONTEXT.md:83`: "when it starts". `docs/spec.md:122` also includes "a contact is added to an Active or Overdue Adventure".
- Outcome: **fixed** fa4702f

**L3. The feature index leaves out the Account sheet and the address switches.** Confidence: high.
- `features/README.md` Profile and Contacts lines, against `profile.md:13` and `contacts.md:12`.
- Outcome: **fixed** 49808a2

**L4. The Contacts recipe names the email field `Email Address`. Its visible label is `Address`.** Confidence: high.
- `features/contacts.md:24` against `contacts/edit.tsx:122` `label={t.contacts.address}`.
- Outcome: **fixed** 3e47b98

**L5. AGENTS.md lists `push_devices` among the tables the app writes. The app never writes it.** Confidence: high.
- `AGENTS.md:80`. In `src/`, only `adventurer_profiles` and `emergency_contacts` are written.
- Outcome: **fixed** 2fdcea6

**L6. AGENTS.md applies `BARRY_WITHOUT_PUSH` to every iPhone build. builds.md limits it to local free-team builds.** Confidence: high.
- `AGENTS.md:43` against `docs/builds.md:47`.
- Outcome: **fixed** b6447c5

**L7. The workflow's environment link opens the Adventure page without a token. It always shows "This link does not work."** Confidence: high.
- `.github/workflows/trail-map.yml:22` `url: ${{ steps.deployment.outputs.page_url }}adventure`, against `use-trail-map.ts` and `site-language.ts:41`.
- Outcome: **fixed** d4bfe8f

**L8. A route comment names a second file that renders it.** Confidence: high.
- `src/app/adventure.tsx:3` "adventure.web.tsx and confirmed.web.tsx render it there", against `confirmed.tsx:3`.
- Outcome: **fixed** 4040342

**L9. Avoided words appear in user-facing text.** Confidence: high.
- `texts.ts:37` "already in progress" (CONTEXT.md:62 avoids "in progress").
- `web/index.html:41` "A Live Adventure Page" and `:103` "Live-Abenteuer-Seite" (avoid "Live map", "live").
- `web/index.html:59` "on time or late" and `:121` "pünktlich oder zu spät" (avoid "Late").
- Outcome: **fixed** c7ae453

**L10. "check-in time" names the Deadline in the Deadline Update and on the home page.** Confidence: high.
- `messages.en.ts:67`, `web/index.html:43`.
- Outcome: **skipped**, rule 7. The message text is pinned by the Deno tests, which cannot run here. The web half alone would break rule 6, so it is skipped too.

**L11. The e2e files quote spec line numbers that moved by about two lines (44 references in 25 files).** Confidence: high.
- Outcome: **skipped**, rule 5. These are tests, and no migration changed.

**L12. trail.e2e relies on the server's 10-second slot. The docs promise one reading a minute.** Confidence: high.
- Outcome: **skipped**, rule 5.

**L13. health.e2e calls `deliver` itself, so the tick-to-monitor path that hosted-supabase.md:89 claims it checks is untested.** Confidence: high.
- Outcome: **skipped**, rule 5. A missing test is the author's to add.

**L14. alarms.ts claims the server's Reminder rule but differs at exactly 30 minutes.** Confidence: medium.
- Outcome: **skipped**, rule 1.

**L15. The ADR names only Heads-up, Alert and All-clear as server messages.** Confidence: medium.
- Outcome: **skipped**, rule 1.

**L16. Some decide.test fixtures still use the old 30-minute Grace Period for `last_alert_at`.** Confidence: medium.
- Outcome: **skipped**, rule 1.

**L17. The overview is stale.** Confidence: high.
- "11 end-to-end scripts" (`barry-overview.html:115`); there are 45.
- Its Resend line leaves out deadline updates (`:168`).
- Its statistics disagree with `barry-prompts.html`.
- `barry-overview.pdf` is orphaned.
- Outcome: **fixed** 74f8950 for the e2e count and the Resend line. The statistics, the stale open-branches step and the PDF are skipped under rule 1: they are a dated snapshot, and how to regenerate it is unclear.

**L18. The spec's stage table and the History multi-select.** Confidence: medium.
- `docs/spec.md:62,66` against `:68`, and multi-select missing from spec.md:68.
- Outcome: **skipped**, rule 1.

**L19. The German local-network string ships in every variant. The English one ships only in development.** Confidence: medium.
- Outcome: **skipped**, rule 1.

**L20. The local `site_url` points at port 3000, which nothing serves.** Confidence: medium.
- Outcome: **skipped**, rule 1.

**L21. `hosted-secrets.mjs` also uploads `AUTH_SMTP_PASS` as a function secret.** Confidence: medium.
- Outcome: **skipped**, rule 1.

**L22. ESLint lints `docs/design`, which tsc and Jest exclude.** Confidence: medium.
- Outcome: **skipped**, rule 1.

**L23. Naming drift.** Confidence: medium.
- The Trail Map is called "adventure page" in the guides.
- The German names for the Heads-up and Plan Update vary ("Startnachricht" against "Nachricht beim Start").
- The Auth sender is "Barry", the messages' sender "🐶 Barry".
- English "You checked in Sat 17 Oct" has no preposition.
- Outcome: **skipped**, rule 1.

## Checked and consistent

1. **Terminology:**
   - No avoided word appears outside L9 and L10.
   - The German terms agree across `texts.ts`, `messages.de.ts`, `locales/de.json`, `site-language.ts` and the web pages.
   - No `ß` appears in user-facing text, and German quotations use « » throughout.
2. **Numbers:**
   - The Grace Period of 1 minute, the Reminder 30 minutes ahead, the Overdue Notice at the Deadline, and 3 Alerts an hour apart all agree.
   - So do the Deadline Update delay of 3 minutes with its coalescing, the 6 retries with their backoff, the 2-minute lease, and the 10-second request and 5-second position timeouts.
   - So do `MAX_SLOTS` and `BATCH`, the 200 m fence, the 60-second polls, the health windows of 2, 5 and 15 minutes, and the 6-digit reset code valid for an hour.
3. **Messages:**
   - All five contact kinds exist in the enum, the view, both templates, the types and the `failure()` maps.
   - Each kind's fields match the spec in English and German alike.
   - The SMS segment counts agree.
   - The German date shape agrees between `wording.ts` and `messages.de.ts`.
4. **Refusals:** all 13 enum values are mapped in both languages. Every "refuses while" rule has a refusal, a text and a test.
5. **Platform variants:** every pair exports the same surface. `trail-task.web.ts` exists.
6. **Routes and hosting:**
   - The Trail Map URL agrees everywhere.
   - No stale `/trail` route remains outside the deliberate notes.
   - The workflow's file list matches the export.
   - The confirmation URL, the hosted URL and key, and `.env.example` all agree.
7. **Build:**
   - The variant table, the EAS profiles and scripts, and the barry-verify launch values (`support.barry.dev`, iPhone 18 Pro, ports 8081 and 8788) all agree.
   - The without-push plugin matches its docs. No bun is assumed.
   - Every command under Check it exists, and SDK 58 is named everywhere.
8. **Tests:**
   - SKILL.md's e2e list matches the 45 files.
   - Every screen has a recipe.
   - Every row of the stage and message tables has a test.
   - No pgTAP test asserts a superseded rule.
9. **Generated files:** `database.types.ts` matches the final schema, checked by hand. The `de.json` location keys match `app.json`.
10. **Documents:**
    - Every relative link and anchor resolves.
    - The spec and CONTEXT.md agree on stages and messages.
    - Every constant in the spec's Limits section exists in the file it names.
    - The ADR holds for Start and Check-in.
    - No current file refers to the dropped starting point or notes.

## Could not check

- The pgTAP suite and the Deno tests of `deliver`: there is no Docker or Deno in this environment.
- Regenerating `database.types.ts`: it was compared by hand instead.
- Anything on a device or in the Simulator.

## Commits, in order

1. f9fc5a5 The Trail Map hosting guide sets the confirmation page as Site URL through config.toml and hosted-auth.mjs, not the dashboard
2. c90ddfe The local messages guide says a text message is retried six times while the relay is down and then becomes a Delivery Failure
3. 9b30279 AGENTS.md gives the outbox's unique key with plan_revision and previous_deadline, as the migrations define it
4. 3cc3922 AGENTS.md calls the backend design the original one and says the migrations win where it disagrees with them
5. fc71773 CONTEXT.md's Deadline Update carries the destination, as the message does
6. a879c9d The privacy page says the All-clear carries each contact's link to the adventure page, in English and German
7. 494c6c9 AGENTS.md no longer promises over-the-air updates, which Barry does not have
8. 008be76 The hosted Supabase guide says the preview and production builds already reach the hosted project, instead of listing the app as not done
9. 28ac073 barry-verify: the recipes find the sheets' Cancel, Save and Add as the close button and the checkmark VoiceOver reads by those names
10. de295ae AGENTS.md places the Reminder and Overdue Notice texts in wording.ts and the Local Network string in app.config.js
11. a8f1d5b The spec and the sign-in recipe name the Profile's Delete Account row by its label
12. fa4702f CONTEXT.md's Heads-up also goes to a contact added to an Active or Overdue Adventure
13. 49808a2 barry-verify: the feature index names the Account sheet and the contacts' address switches
14. 3e47b98 barry-verify: the Add recipe pastes the email into the field by its visible label, Address
15. 2fdcea6 AGENTS.md says the app writes only the Profile and the contacts, and push_devices waits unused while push is off
16. b6447c5 AGENTS.md limits BARRY_WITHOUT_PUSH to local builds with a free Apple team, as the builds guide does
17. d4bfe8f The Trail Map workflow links its run to the landing page instead of an Adventure page without a token
18. 4040342 The native Adventure route's comment names only adventure.web.tsx as the page that renders it
19. c7ae453 The refusal of a second Adventure and the website say started, adventure page and overdue instead of in progress, live and late
20. 74f8950 The overview counts 45 end-to-end scripts and names the Deadline Updates among the emails Resend sends

## Skipped

M1 (rule 2), M11 (rules 1, 2), M12 (rule 2), M13 (rule 1), L10 (rule 7: Deno tests cannot run here; rule 6), L11–L13 (rule 5), L14–L16 and L18–L23 (rule 1), L17 statistics, branches and PDF (rule 1).
