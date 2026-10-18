---
name: verify
description: Drive the Barry iOS app (Expo SDK 58 development build in the iOS Simulator) against the local Supabase stack, the way a user does, and capture proof. Use to verify any change to the app screens, the client module in src/lib/barry, the Adventure commands, the clock, or message and notification delivery before calling it done.
---

# Verify Barry

Barry is a solo-adventure safety app. The user touches the iOS app. Everything it does goes through the local Supabase stack, which runs the clock (pg_cron) and sends email to Mailpit, and sends text messages to a local relay that prints them. The app schedules the Reminder and the Overdue Notice as local notifications. Supabase sends no pushes, because its push channel is off. Read [features/README.md](features/README.md) before driving, then use the matching feature file as the recipe.

Helpers live in `.claude/skills/verify/scripts/`, run from the repo root. Shell commands that touch Docker, the simulator or the clipboard need the sandbox disabled.

## Launch

From the repo root, in this order:

1. `npx supabase start`. Ready when `.claude/skills/verify/scripts/doctor.sh` shows the database, Kong and the Edge runtime up. A fresh database needs `npx supabase db reset --local`, which applies every migration and `supabase/seed.sql` (the Vault secrets `deliver` needs). A reset deletes the test account too: create it again through the app's **Create account** with the values in `.env.local`.
2. `node scripts/sms-relay.mjs` as a background process. Ready when it prints `sms relay listening on http://localhost:8788`.
3. The app:
   - If `ios/` is missing or a native dependency changed: `APP_VARIANT=development LANG=en_US.UTF-8 npx expo run:ios --device "iPhone 18 Pro"` as a background process. If `ios/` was generated for another variant, run `APP_VARIANT=development LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios` first. It builds for 5 to 10 minutes and starts Metro. Ready when it prints `iOS Bundled`.
   - Otherwise: `npm start` as a background process, then `xcrun simctl launch booted support.barry.dev`. Ready when Metro prints `iOS Bundled`.
   - If iOS shows `Open in "Barry"?`, choose **Open**.
4. Run the doctor. Every line must say `ok`.

Only one instance exists: one database, one Metro port, one booted simulator. Never start a second run while another agent drives the app. If the doctor shows a stack you did not start, drive it only if the user said so.

## Doctor

`.claude/skills/verify/scripts/doctor.sh` is read-only. It checks Docker, the three Supabase containers, the API, a pg_cron tick in the last two minutes, the text message relay on :8788, Metro on :8081, a booted simulator, the `support.barry` build, and the test account in `.env.local`. Run it first, and again whenever anything looks off.

## End-to-end suite

`npm run e2e` checks the most important use cases against the running stack in about two minutes: a missed Deadline with its Alert and All-clear, a Check-in in time, a moved Deadline, a Plan Update, the Trail on the Trail Map, deleting an account, and the heartbeat to the monitor. It needs Supabase and `node scripts/sms-relay.mjs` running, and reads emails from Mailpit and texts and heartbeats from the relay. Each file in `e2e/` creates its own account with unique contacts and deletes it afterwards, also when a test fails, so the files run in parallel and never touch the test account. The suite drives the database, the clock and `deliver` directly. It does not tap through the app; that is what the Drive section below is for.

## Drive

The harness is the iOS Simulator control tool: `screenshot`, `tap` (with `duration` for a long-press), `swipe`, `button HOME`, `open_url`. Coordinates are device points on the iPhone 18 Pro, 402 × 874. A screenshot is shown scaled, so convert with the factor the tool reports.

- **Wait after every tap.** The debug build reacts one to three seconds late. Wait 2 to 3 seconds after a tap before the next screenshot, or the screenshot shows the old screen and the next tap lands on the new one.
- **Find controls by their visible text.** Take a fresh screenshot before every tap and locate the button or field by its label: `Sign in`, `Plan an Adventure`, `Start`, `Hold to Check In`, `+1 hour`, `Edit Plan or Contacts`, `Save`. Coordinates in the feature files are hints for an unscrolled screen only.
- **Language.** The app follows the simulator's language, and every recipe quotes the English texts, so keep the simulator in English. To check the German texts, run `xcrun simctl spawn booted defaults write -g AppleLanguages -array de-CH en`, then `xcrun simctl shutdown booted` and boot it again. Set it back with `-array en-CH` the same way.
- **Text entry.** The `text` action does not reach the field. Use the clipboard:
  1. `.claude/skills/verify/scripts/clip.sh set "Grosser Mythen"` (or `clip.sh email`, `clip.sh password`).
  2. Long-press the field: `tap` at its centre with `duration: 0.9`.
  3. Wait one second, then take a screenshot. A menu with `Paste` and `AutoFill` appears 46 points below the field, or above it near the bottom of the screen.
  4. Tap `Paste`. Never tap `AutoFill`.
  5. After pasting the password, run `clip.sh clear`.
- **Sign in.** Paste the email and the password, then tap `Sign in`. The first sign-in shows `"Barry" Would Like to Send You Notifications`. Choose **Allow**, so the app can show the Reminder and the Overdue Notice.
- **Scrolling.** `swipe` from (380, 600) to (380, 120) with `duration: 0.4`. Wait for scrolling to stop before tapping, or the tap lands on moving content.
- **Hold to Check In.** A Check-in needs `tap` with `duration: 2.2` on `Hold to Check In`. A shorter press must not end the Adventure.
- **Preconditions and time.** `.claude/skills/verify/scripts/fixture.mjs` creates a live Adventure (`live [minutes]`), moves its Deadline into the past (`overdue`), shows the stored state (`state`) and the Trail (`trail`), takes the API offline and back (`offline`, `online`), and checks in for cleanup (`end`). Use it only to set up state or skip waiting. The app performs every step being verified.
- **Refreshing banner.** A blue `Refreshing…` bar at the top means Metro reloaded after a file in the repo changed, including files in this skill. It does not affect the run.
- **Changed `deliver` code.** The local edge runtime does not always reload `supabase/functions`. After changing them, run `docker restart supabase_edge_runtime_barry-local`, or messages still go out with the old text.
- **Messages.** Email lands in Mailpit at http://127.0.0.1:54324. Notifications appear as banners, and in Notification Center after a swipe from (201, 2) to (201, 600). The text message relay prints `texted <to> from Barry: <first line>` for each text message, then the other lines indented, and `curl -s http://localhost:8788/messages` lists them in full.

## Evidence

Write proof to `.verify-artifacts/<run-id>/`, which git ignores, with `<run-id>` as `YYYYMMDD-HHMM-<feature>`.

- Screenshots: `xcrun simctl io booted screenshot .verify-artifacts/<run-id>/<step>.png` after the user action and after the resulting state.
- Stored state: `.claude/skills/verify/scripts/fixture.mjs state > .verify-artifacts/<run-id>/<step>.state.txt`. Every mutation needs this second, read-only view.
- Messages: banner screenshots for notifications, the text message relay's output lines, and Mailpit subjects for email.

Proof standards: drive the real screens, not the database. Capture the action and the result, not only the final screen. Check side effects (rows, messages, notifications) alongside what is visible. A step you could not reach is reported as unverified with the unmet precondition. It is never passed through a different path.

## Cleanup

- `.claude/skills/verify/scripts/fixture.mjs end` checks in from any live Adventure the run left, so no Alert goes to the contacts later.
- `.claude/skills/verify/scripts/fixture.mjs online` if the run took the API offline.
- `.claude/skills/verify/scripts/clip.sh clear`.
- Stop only the processes this run started: the text message relay and Metro background tasks by their task ID, and `npx supabase stop` if the run started Supabase.
- Keep `.verify-artifacts/`. Cleanup never deletes proof.

## Upgrade path

Every tap here goes by coordinates read from screenshots, because no selector-based driver is installed. [Maestro](https://maestro.mobile.dev) would drive the same flows by accessibility label (every field and button in `src/components/form.tsx` sets one) and type text directly. Install it only with the user's approval.
