# Live Adventure

While an Adventure is Active, Overdue or Alerted, the Adventure tab shows its stage with a countdown, lets the Adventurer move the Deadline or edit the Plan and contacts, and ends it only with a deliberate press-and-hold Check-in. A Check-in made without signal waits on the phone and is sent when the signal returns.

## Sub-features

- `live-countdown` shows `Barry is watching. Check in by …, in …` while Active.
- `live-overdue` shows `You are overdue. Barry alerts your Emergency Contacts at …, in …, unless you check in.` once the Deadline passes, without a reload.
- `live-move` moves the Deadline with `+30 min`, `+1 hour` or `+2 hours`.
- `live-edit` edits the Plan and contacts through `Edit Plan or contacts` and `Save changes`.
- `live-checkin` ends the Adventure after holding `Hold to check in`.
- `live-short-tap` leaves the Adventure live after a short press on `Hold to check in`.
- `live-offline-checkin` keeps a Check-in made without signal and sends it when the signal returns.
- `live-background-checkin` sends a queued Check-in from a background location wake, with "Always" granted, without Barry being opened.
- `live-offline-view` shows the last known live Adventure with a `No signal` notice when the app opens without signal.

## How to get to it (user POV)

- Start an Adventure from the Plan screen. The Adventure tab then shows the live screen.
- Open the app while an Adventure is live. The Adventure tab opens on the live screen.

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index.
- `fixture.mjs live 120` created a live Adventure to `Pilatus` with `Luca`, Deadline in two hours, so a journey can start without the Plan screen.
- The app was brought to the Adventure tab after the fixture, because the overview loads on focus: tap `Contacts` (243, 820), then `Adventure` (73, 820).

- **Countdown (`live-countdown`).** Open the Adventure tab. The top notice reads `Barry is watching. Check in by <weekday> <day> <month> at <HH:MM>, in 1 h 59 min` or similar, and the screen shows `Hold to check in`, `Need more time?` and `Edit Plan or contacts`.
- **Short tap (`live-short-tap`).** Tap `Hold to check in` (201, 243) with `duration: 0.3`. The button may read `Keep holding…` while pressed. After release the screen still shows the countdown. `fixture.mjs state` still prints `adventure | active`.
- **Overdue (`live-overdue`).** Run `fixture.mjs overdue` and wait for the next pg_cron tick, up to 60 seconds, without touching the app. The notice turns orange and reads `You are overdue. Barry alerts your Emergency Contacts at <HH:MM>, in 29 min, unless you check in.` The alert time is the Deadline plus 30 minutes. `fixture.mjs state` prints `adventure | overdue`.
- **Move the Deadline (`live-move`).** Tap `+1 hour`. A notice reads `New Deadline: …`, the countdown returns, and `fixture.mjs state` shows the new Deadline and `active`.
- **Edit (`live-edit`).** Tap `Edit Plan or contacts`. The screen titled `Edit Adventure` has no Deadline section and shows `Save changes`. Paste `West ridge` into `Route`, tick `Sara`, scroll, and tap `Save changes`. The app returns to the live screen, whose Plan shows `Route: West ridge` and `Contacts: Luca, Sara`. `fixture.mjs state` lists both contacts and a `heads_up | sms | +41792222222 | failed | channel_not_enabled` message for Sara.
- **Offline view (`live-offline-view`).** Open the app online once, so it saves the live Adventure. Run `fixture.mjs offline`, then `xcrun simctl terminate booted support.barry` and `xcrun simctl launch booted support.barry`. Within about 15 seconds the live screen shows the latest Deadline and the notice `No signal. This is your Adventure as of <time>. Check-in still works and is sent when you have signal.` A screen reading `Could not reach Barry` is a failure.
- **Offline Check-in (`live-offline-checkin`).** While offline, hold `Hold to check in` with `duration: 2.2`. The live screen stays and adds `Check-in from <time> is waiting for signal.` (with `Barry keeps trying in the background.` when "Always" is granted), and no second notice about the same Check-in. `fixture.mjs state` still prints the Adventure as live. Run `fixture.mjs online`, then terminate and launch the app again. Within a few seconds `fixture.mjs state` prints `no live Adventure`. In the database, `checked_in_at` is the time of the hold and `ended_at` is the time the signal returned.
- **Check-in (`live-checkin`).** Hold `Hold to check in` with `duration: 2.2`. The screen reads `You checked in at … Welcome back.` with a `Done` button. `fixture.mjs state` prints `no live Adventure`.
- **Proof.** Screenshot each resulting screen to `.verify-artifacts/<run-id>/` and save `fixture.mjs state` after each mutation.

## Gotchas

- The overview does not refresh while open. After `fixture.mjs live`, switch tabs to reload it, waiting 3 seconds after each tab tap.
- `fixture.mjs live` sends Luca a real Heads-up at the next tick. It lands in Mailpit.
- A short tap passes trivially if it misses the button. Confirm the same coordinates end the Adventure with a 2.2-second hold in the same run.
- Without signal each request waits up to 10 seconds before the app falls back to the saved Adventure.
- `fixture.mjs offline` stops the whole API gateway, so the relay, Realtime and every screen lose the server too. Always run `fixture.mjs online` before the next journey.
- With "Always", a queued Check-in is sent on the next background location wake (the screen shows `Barry keeps trying in the background.`). Without "Always", it is sent only when the app comes to the foreground or another Check-in starts.
- **Background Check-in (`live-background-checkin`).** Start a simulated walk with `xcrun simctl location booted start --speed=2 --distance=15 <waypoints>` so iOS delivers wakes. `fixture.mjs offline`, hold `Hold to check in`, press `button HOME`, `fixture.mjs online`, and do not open Barry. Within about a minute the latest Adventure is `ended`, with `checked_in_at` at the hold and `ended_at` at a location wake after `online`. Verified on 15 October: hold 14:35:54, delivered 14:37:17.
- While Alerted, `Need more time?` and `Edit Plan or contacts` are hidden by design.
