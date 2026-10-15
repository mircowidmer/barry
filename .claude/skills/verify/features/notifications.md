# Notifications

The Adventurer gets a push Reminder 30 minutes before the Deadline and a push Overdue Notice when the Deadline passes. Locally, `deliver` sends pushes to the relay, which shows them in the simulator.

## Sub-features

- `push-reminder` shows `Check in or move your Deadline` within the 30 minutes before the Deadline.
- `push-overdue` shows `You are overdue` with the Alert time once the Deadline passes.

## How to get to it (user POV)

- They arrive by themselves while an Adventure is live. The app needs notification permission and a registered push token.

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index, with the relay running and notifications allowed.

- **Reminder (`push-reminder`).** Run `fixture.mjs live 20`. Within 60 seconds the relay prints `pushed to simulator: Check in or move your Deadline`, and `fixture.mjs state` lists `reminder | push | ExponentPushToken[…] | sent`.
- **Overdue Notice (`push-overdue`).** Press `button HOME`, then run `fixture.mjs overdue`. Within 60 seconds the relay prints `pushed to simulator: You are overdue`, and a banner from `Barry` reads `You are overdue. Your Deadline for Pilatus was …`. Swipe from (201, 2) to (201, 600) to see both notifications in Notification Center.
- **Proof.** Save the relay lines and a Notification Center screenshot, then run `fixture.mjs end`.

## Gotchas

- With the app in the foreground, the banner shows for a few seconds only. Background the app first for a screenshot.
- Real delivery through Expo's push service is not covered. It needs an Apple push key from `eas credentials` and `EXPO_PUSH_URL` removed from `supabase/config.toml`.
- No row in `push_devices` means no push rows at all. Check the sign-in push step first.
