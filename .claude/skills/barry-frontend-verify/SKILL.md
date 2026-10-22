---
name: barry-frontend-verify
description: Drive the Barry iOS app (Expo SDK 58 development build in the iOS Simulator) against the local Supabase stack, the way a user does, and capture proof. Needs a Mac with Xcode. Use to verify any change to the app screens, the client module in src/lib/barry, the local notifications, the Trail recording or the Trail Map page before calling it done; a change under supabase/ goes to barry-backend-verify.
---

# Verify Barry's frontend

Barry is a solo-adventure safety app. The user touches the iOS app: its screens, and the client module in `src/lib/barry` behind them, which hides the location fix, the offline Check-in queue, the cached Adventure, the Trail buffer and the local alarms. The app schedules the Reminder and the Overdue Notice as local notifications, and records the Trail in the background. Everything it sends goes through the local Supabase stack. This skill proves what the app does; what the stack does with it (the clock, the commands, the messages) is [barry-backend-verify](../barry-backend-verify/SKILL.md)'s, and runs without the app. Read [features/README.md](features/README.md) before driving, then use the matching feature file as the recipe.

Helpers live in `.claude/skills/barry-frontend-verify/scripts/`, run from the repo root. Shell commands that touch Docker, the simulator or the clipboard need the sandbox disabled.

The iOS Simulator runs only on a Mac. In a Linux cloud session, report every step as unverified with the precondition "no iOS Simulator", and prove the backend half of the change with barry-backend-verify instead.

## Launch

From the repo root, in this order:

1. The stack: steps 1 to 4 of the **Launch** in barry-backend-verify, which start Supabase and the text message relay. A `npx supabase db reset --local` deletes the test account: create it again through the app's **Create Account** with the values in `.env.local`.
2. The app:
   - If `ios/` is missing or a native dependency changed: `APP_VARIANT=development LANG=en_US.UTF-8 npx expo run:ios --device "iPhone 18 Pro"` as a background process. If `ios/` was generated for another variant, run `APP_VARIANT=development LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios` first. It builds for 5 to 10 minutes and starts Metro. Ready when it prints `iOS Bundled`.
   - Otherwise: `npm start` as a background process, then `xcrun simctl launch booted support.barry.dev`. Ready when Metro prints `iOS Bundled`.
   - If iOS shows `Open in "Barry Dev"?`, choose **Open**.
3. Run the doctor. Every line must say `ok`.

Only one instance exists: one database, one Metro port, one booted simulator. Never start a second run while another agent drives the app. If the doctor shows a stack you did not start, drive it only if the user said so.

## Doctor

`.claude/skills/barry-frontend-verify/scripts/doctor.sh` is read-only. It runs barry-backend-verify's doctor (Docker, the three Supabase containers, the API, a pg_cron tick in the last two minutes, the text message relay on :8788), then checks Metro on :8081, a booted simulator, the `support.barry.dev` build, and the test account in `.env.local`. Run it first, and again whenever anything looks off.

## Drive

The harness is the iOS Simulator control tool: `screenshot`, `tap` (with `duration` for a long-press), `swipe`, `button HOME`, `open_url`. Coordinates are device points on the iPhone 18 Pro, 402 × 874. A screenshot is shown scaled, so convert with the factor the tool reports.

- **Wait after every tap.** The debug build reacts one to three seconds late. Wait 2 to 3 seconds after a tap before the next screenshot, or the screenshot shows the old screen and the next tap lands on the new one.
- **Find controls by their visible text.** Take a fresh screenshot before every tap and locate the button or field by its label: `Sign In`, `Plan an Adventure`, `Start`, `Hold to Check In`, `+1 h`, `Edit Plan or Contacts`. A header's close button and checkmark have no text: VoiceOver reads them as `Cancel` and `Save` or `Add`. Coordinates in the feature files are hints for an unscrolled screen only.
- **Language.** The app follows the simulator's language, and every recipe quotes the English texts, so keep the simulator in English. To check the German texts, run `xcrun simctl spawn booted defaults write -g AppleLanguages -array de-CH en`, then `xcrun simctl shutdown booted` and boot it again. Set it back with `-array en-CH` the same way.
- **Text entry.** The `text` action does not reach the field. Use the clipboard:
  1. `.claude/skills/barry-frontend-verify/scripts/clip.sh set "Grosser Mythen"` (or `clip.sh email`, `clip.sh password`).
  2. Long-press the field: `tap` at its centre with `duration: 0.9`.
  3. Wait one second, then take a screenshot. A menu with `Paste` and `AutoFill` appears 46 points below the field, or above it near the bottom of the screen.
  4. Tap `Paste`. Never tap `AutoFill`.
  5. After pasting the password, run `clip.sh clear`.
- **Sign in.** Paste the email and the password, then tap `Sign In`. The first sign-in shows `"Barry Dev" Would Like to Send You Notifications`. Choose **Allow**, so the app can show the Reminder and the Overdue Notice.
- **Scrolling.** `swipe` from (380, 600) to (380, 120) with `duration: 0.4`. Wait for scrolling to stop before tapping, or the tap lands on moving content.
- **Hold to Check In.** A Check-in needs `tap` with `duration: 2.2` on `Hold to Check In`. A shorter press must not end the Adventure.
- **Preconditions and time.** `.claude/skills/barry-frontend-verify/scripts/fixture.mjs` creates a live Adventure (`live [minutes]`), moves its Deadline into the past (`overdue`), shows the stored state (`state`) and the Trail (`trail`), takes the API offline and back (`offline`, `online`), and checks in for cleanup (`end`). Use it only to set up state or skip waiting. The app performs every step being verified.
- **Refreshing banner.** A blue `Refreshing…` bar at the top means Metro reloaded after a file in the repo changed, including files in this skill. It does not affect the run.
- **Messages.** Email lands in Mailpit at http://127.0.0.1:54324. Notifications appear as banners, and in Notification Center after a swipe from (201, 2) to (201, 600). The text message relay prints `texted <to> from Barry: <first line>` for each text message, then the other lines indented, and `curl -s http://localhost:8788/messages` lists them in full. A message is the side effect that proves the app's tap reached the stack; its wording and timing are barry-backend-verify's to prove.

## Evidence

Write proof to `.verify-artifacts/<run-id>/`, which git ignores, with `<run-id>` as `YYYYMMDD-HHMM-<feature>`.

- Screenshots: `xcrun simctl io booted screenshot .verify-artifacts/<run-id>/<step>.png` after the user action and after the resulting state.
- Stored state: `.claude/skills/barry-frontend-verify/scripts/fixture.mjs state > .verify-artifacts/<run-id>/<step>.state.txt`. Every mutation needs this second, read-only view.
- Messages: banner screenshots for notifications, the text message relay's output lines, and Mailpit subjects for email.

Proof standards: drive the real screens, not the database. Capture the action and the result, not only the final screen. Check side effects (rows, messages, notifications) alongside what is visible. A step you could not reach is reported as unverified with the unmet precondition. It is never passed through a different path.

## Cleanup

- `.claude/skills/barry-frontend-verify/scripts/fixture.mjs end` checks in from any live Adventure the run left, so no Alert goes to the contacts later.
- `.claude/skills/barry-frontend-verify/scripts/fixture.mjs online` if the run took the API offline.
- `.claude/skills/barry-frontend-verify/scripts/clip.sh clear`.
- Stop only the processes this run started: Metro by its task ID, and the stack as barry-backend-verify's **Cleanup** says.
- Keep `.verify-artifacts/`. Cleanup never deletes proof.

## Upgrade path

Every tap here goes by coordinates read from screenshots, because no selector-based driver is installed. [Maestro](https://maestro.mobile.dev) would drive the same flows by accessibility label (every field and button in `src/components/form.tsx` sets one) and type text directly. Install it only with the user's approval.
