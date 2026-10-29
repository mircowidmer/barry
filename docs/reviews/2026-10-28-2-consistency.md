# Consistency audit (`/barry-audit-consistency --fix`)

Branch `maintenance-2026-10-28`, the second step of the maintenance pass of 28 October 2026. The audit concentrated on what changed since the pass of 23 October (the message limits, Cloudflare Turnstile, the Keychain session, Check Your Inbox, the confirmation page, the place search and the pin picker, the five-minute Grace Period, the dropped Reminder and Overdue Notice kinds) and re-ran the repository-wide checks of every group.

## 1. Summary

- **Findings:** 0 Blocking, 1 High, 2 Medium, 0 Low. All 3 fixed, C-1 at the author's request after the pass.
- **The findings that matter:**
  1. **C-1 (High):** the privacy page names no Cloudflare and says Apple only distributes the app, but the preview and production builds load Cloudflare Turnstile, and the Plan sheet sends what the Adventurer types to Apple Maps.
  2. **C-2 (Medium):** the spec names an older migration as the last definition of `claim_messages`.
  3. **C-3 (Medium):** barry-security's storage check still describes the session in the plain storage file.
- **Checks run:** `npx expo lint` clean; `npx tsc --noEmit` clean; `npm test` 193 of 193; `npx supabase test db` 16 files, 278 tests, PASS; `deno test supabase/functions/deliver` 33 passed; `src/lib/database.types.ts` is identical to what `npx supabase gen types typescript --local` generates.

## 2. Findings

### High

**C-1. The privacy page leaves out two services the app now sends data to.**

- `web/privacy.html:61`: "<strong>Apple</strong> distributes the app through the App Store." The list at lines 57 to 61 (and 123 to 127 in German) names Supabase, Resend, Twilio, GitHub, OpenFreeMap and Apple, and no other.
- `eas.json:25, 34`: `"EXPO_PUBLIC_TURNSTILE_SITE_KEY": "0x4AAAAAAFpyqESvuO8c-3T3"` in `preview` and `production`; `src/lib/turnstile.ts:9` loads `https://challenges.cloudflare.com/turnstile/v0/api.js` on sign-in, sign-up, the password check and the recovery email (`docs/spec.md:18`).
- `src/lib/barry/index.ts:53-58`: `findPlaces` sends the typed destination, and the last known position, to Apple Maps through `modules/place-search` (`MKLocalSearch`) while the Adventurer types (`docs/spec.md:61`).
- **True:** the code is right; the page is behind it. Cloudflare sees the phone's address and browser signals during each check; Apple sees the destination text and an approximate position for each search.
- **Fix:** name Cloudflare Turnstile and Apple Maps' place search in both languages of `web/privacy.html`.
- **Confidence:** high that the page is incomplete.
- **Outcome:** **fixed** ab59841, at the author's request after the pass.

### Medium

**C-2. The spec names an older migration as the last definition of `claim_messages`.**

- `docs/spec.md:228`: "the lease in `claim_messages` (last defined in `supabase/migrations/20261022120000_move_after_alert.sql`)"
- `supabase/migrations/20261028120100_message_limits.sql:199`: `create or replace function public.claim_messages(p_limit int, p_lease interval default interval '2 minutes')`, after a redefinition in `20261027120000_drop_reminder_and_overdue_notice_kinds.sql:162`.
- **True:** the lease is still two minutes; the latest definition is in `message_limits`, which also claims Alerts first.
- **Fix:** name `20261028120100_message_limits.sql`. **Confidence:** high. **Outcome:** **fixed** 700913e.

**C-3. barry-security's storage check describes where the session was kept before the Keychain.**

- `.claude/skills/barry-security/SKILL.md:91`: "`src/lib/storage.ts` uses `expo-sqlite/localStorage`, which is a plain file in the app container, included in device backups unless excluded. Compare with `expo-secure-store` (Keychain)"
- `src/lib/supabase.ts:38`: `...(authStorage && { storage: authStorage })`; `src/lib/auth-storage.ts:8`: `keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; `docs/spec.md:17`: "The app keeps the sign-in in the iPhone's Keychain, for this phone only".
- **True:** the session is in the Keychain; the plain file only holds a session from before the update until its first read.
- **Fix:** point the check at `auth-storage.ts` and `keychain-session.ts`. **Confidence:** high. **Outcome:** **fixed** a70fda0.

## 3. Checked and consistent

1. **Terminology:** every text added since 23 October in `texts.ts` (Check Your Inbox, the pin picker, the limit refusals, the Delivery Failure names), `site-language.ts`, `web/*.html` and `app.json` against the _Avoid_ lists of `CONTEXT.md`; no hit, no `ß`, German quotes `«»` throughout.
2. **Numbers:** Grace Period 5 minutes (`20261022080000_five_minute_grace.sql`, `docs/spec.md:145`, `texts.ts:202`, `web/index.html:58, 120`, `docs/overview`); Reminder 30 minutes (`alarms.ts`, spec, web, feature file); Deadline Update 3 minutes; six attempts over about 18 minutes (`retry_backoff`, `docs/local-messages.md:25`); the recovery code's eight digits and 15 minutes (`config.toml:234-236`, spec, `docs/hosted-supabase.md:89`); the limits 10, 5, 5 and the field lengths (`message_limits.sql:5-7`, `limits.ts`, spec lines 46, 91, 227); `RESEND_AFTER_SECONDS` 60 and `max_frequency = "1m0s"`; the Trail's 5 minutes in `SLOT_MS`, `CONTEXT.md`, `app.json` and the web pages.
3. **Messages:** the five kinds in the enum after `drop_reminder_and_overdue_notice_kinds`, `AGENTS.md` and the Delivery Failure texts.
4. **Refusals:** `too_many_contacts` and `too_many_starts` in the enum, the generated types and both languages of `refusals`; the contact list's `full` outcome in `client.ts` and `texts.ts`.
5. **Platform variants:** `captcha.tsx` and `captcha.web.tsx` share the `Captcha` type; `auth-storage.ts` and `auth-storage.web.ts`; the pairs listed in the skill, unchanged since 23 October.
6. **Routes and hosting:** `SITE`, `MAP_ORIGIN` and the Content-Security-Policy against `trail-map-view.web.tsx` and `docs/trail-map-hosting.md`; `site_url = "https://barry.support/confirmed"`.
7. **Build:** `scripts/iphone-production.sh` reads the production profile's env, including the Turnstile key, as `docs/iphone.md` and `docs/builds.md` say; no `bun.lock`.
8. **Tests against promises:** every pgTAP and e2e file is named in barry-backend-verify's table and every name there exists; the sign-in and Plan feature files quote labels that `texts.ts` has (`Check Your Inbox`, `Send Again in <n> s`, `Tell Me When I Arrive`, `Use This Place`, `Adjust`, `Pin on Map`).
9. **Generated files:** `database.types.ts` matches the migrations byte for byte.
10. **Spec's limits section:** each named constant exists where the spec says (`MAX_SLOTS`, `SLOT_MS`, `BATCH`, `FENCE_MOVE_M`, `ARRIVAL_RADIUS_M`, `max_attempts`, `retry_backoff`, `MOBILE_LABELS`, `POSITION_TIMEOUT_MS`, `REQUEST_TIMEOUT_MS`, `RESEND_AFTER_SECONDS`), apart from C-2.

## 4. Could not check

- The screens in the iOS Simulator: this is a Linux cloud session.
- The hosted project's Auth settings against `[remotes.hosted]`: no access to the hosted project.

## Commits

1. 700913e The spec names the latest migration that defines claim_messages and its lease, message_limits
2. a70fda0 barry-security: the storage check names the Keychain where the app keeps the session, and the plain file it moves an older session out of

3. ab59841 The privacy page names Cloudflare, which checks sign-up, sign-in and the password for bots, and Apple Maps, which gets the typed destination for its suggestions

**Skipped:** none.
