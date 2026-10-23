# Live Adventure

While an Adventure is Active, Overdue or Alerted, the Adventure tab shows its stage with a countdown, lets the Adventurer move the Deadline or edit the Plan and contacts, and ends it only with a deliberate press-and-hold Check-in. A Check-in made without signal waits on the phone and is sent when the signal returns.

## Sub-features

- `live-countdown` shows a green card with `CHECK IN BY`, the Deadline's time large and the time left beside it while Active; VoiceOver reads it as `Barry is watching. Check in by …, in …`.
- `live-overdue` turns the card orange with `OVERDUE · ALERT AT` and the Alert time once the Deadline passes, without a reload; VoiceOver reads `You are overdue. Barry alerts your emergency contacts at …, in …, unless you check in.`
- `live-move` moves the Deadline from the clock at the top right (`Need More Time?`), a menu of `+30 min`, `+1 h` and `+2 h`, each with its new Deadline under it, and 3 minutes later sends a Deadline Update to each contact whose Heads-up went out.
- `live-watching` opens `Who Is Watching` from the contacts button at the top right (tinted orange while a message did not arrive): each contact with the addresses Barry uses, `Messages That Did Not Arrive` when any, `NEXT` with the Alert time and the All-clear, and `Edit Contacts`, which opens the Plan sheet.
- `live-edit` edits the Plan and contacts in the sheet behind the `Plan` card, which has a chevron, with a close button (`Cancel`) and a checkmark (`Save`) in its header.
- `live-plan-update` sends a Plan Update to each contact whose Heads-up went out when the Plan changes.
- `live-checkin` ends the Adventure after holding `Hold to Check In`.
- `live-short-tap` leaves the Adventure live after a short press on `Hold to Check In`.
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

- **Countdown (`live-countdown`).** Open the Adventure tab. The card at the top reads `CHECK IN BY`, the Deadline as `<HH:MM>` in large Nordwand Mono with `1 h 59 min` or similar beside it, and `Barry is watching. If you don’t check in by then, Barry alerts your emergency contacts.`; a Deadline on another day adds `<weekday> <day> <month>` above the time. VoiceOver, and so Maestro, reads the card as `Barry is watching. Check in by <weekday> <day> <month>, <HH:MM>, in 1 h 59 min`, and the screen shows `Hold to Check In`, the clock (`Need More Time?`) and the contacts button (`Who Is Watching`) at the top right, and the `Plan` card with a chevron.
- **Short tap (`live-short-tap`).** Tap `Hold to Check In`, the capsule floating above the tab bar, with `duration: 0.3`. The button may read `Keep holding…` while pressed. After release the screen still shows the countdown. `fixture.mjs state` still prints `adventure | active`.
- **Overdue (`live-overdue`).** Run `fixture.mjs overdue` and wait for the next pg_cron tick, up to 60 seconds, without touching the app. The card turns orange and reads `OVERDUE · ALERT AT`, the Alert time large with `5 min` or a few minutes less beside it, and `You are overdue. Barry alerts your emergency contacts then, unless you check in.`; VoiceOver reads `You are overdue. Barry alerts your emergency contacts at <weekday> <day> <month>, <HH:MM>, in 5 min, unless you check in.` The alert time is the Deadline plus 5 minutes. `fixture.mjs state` prints `adventure | overdue`. About 5 minutes later a tick sends Alert 1 and the screen turns to `Your emergency contacts were alerted`.
- **Move the Deadline (`live-move`).** Tap the clock at the top right (295, 84) and `+1 h` in its menu. A notice reads `New deadline: …`, the countdown returns, and `fixture.mjs state` shows the new Deadline and `active`. Once the Heads-ups were sent, a move also lists a `deadline_update` row per contact address, `pending` for 3 minutes. Choose `+1 h` again within those minutes: it stays one row. After the wait Mailpit has `Anna needs more time for <destination>`, with `moved the deadline from <first Deadline> to <latest Deadline>`.
- **Edit (`live-edit`).** Tap the `Plan` card. The sheet titled `Edit Adventure` has no Deadline section and a checkmark (`Save`) in its header. Paste `West ridge` into `Route (optional)`, tick `Sara`, and tap the checkmark. The sheet closes to the live screen, whose Plan shows `Route: West ridge` and `Contacts: Luca, Sara`. `fixture.mjs state` lists both contacts and a `heads_up | sms | +41792222222 | sent` message for Sara, which the text message relay prints.
- **Plan Update (`live-plan-update`).** After `live-edit`, wait until `fixture.mjs state` lists every `heads_up` as `sent` or `failed`. Tap the `Plan` card again, replace the route with `North ridge` in `Route (optional)`, and tap the checkmark (`Save`). Within 15 seconds `fixture.mjs state` lists a `plan_update` row per contact address, `plan_update | email | luca@example.com | sent` and `plan_update | sms | +41792222222 | sent`, and no new `heads_up`. Mailpit has `Anna changed the plan for Pilatus` from `🐶 Barry` for `luca@example.com`, with `Route: North ridge` in the body. `fixture.mjs live` adds contacts without a Heads-up, so the first save after it sends Heads-ups instead of Plan Updates. That is why this step starts after `live-edit`.
- **Offline view (`live-offline-view`).** Open the app online once, so it saves the live Adventure. Run `fixture.mjs offline`, then `xcrun simctl terminate booted support.barry.dev` and `xcrun simctl launch booted support.barry.dev`. Within about 15 seconds the live screen shows the latest Deadline and the notice `No signal. This is your adventure as of <time>. Check-in still works and is sent when you have signal.` A screen reading `Could not reach Barry` is a failure.
- **Offline Check-in (`live-offline-checkin`).** While offline, hold `Hold to Check In` with `duration: 2.2`. The live screen stays and adds `Check-in from <time> is waiting for signal.` (with `Barry keeps trying in the background.` when "Always" is granted), and no second notice about the same Check-in. `fixture.mjs state` still prints the Adventure as live. Run `fixture.mjs online`, then terminate and launch the app again. Within a few seconds `fixture.mjs state` prints `no live Adventure`. In the database, `checked_in_at` is the time of the hold and `ended_at` is the time the signal returned.
- **Check-in (`live-checkin`).** Hold `Hold to Check In` with `duration: 2.2`. The screen reads `You checked in … Welcome back.` with a `Done` button. `fixture.mjs state` prints `no live Adventure`. Within a minute Mailpit has `Anna is back safe` for each contact's email, and the text message relay prints `texted <number> from Barry: Anna checked in safely at …` for each phone number, also when no Alert went out.
- **Proof.** Screenshot each resulting screen to `.verify-artifacts/<run-id>/` and save `fixture.mjs state` after each mutation.

## Gotchas

- The overview reloads when its tab comes into focus, when the app returns to the foreground, and when you pull the list down. After `fixture.mjs live`, pull down, or switch tabs, waiting 3 seconds after each tab tap.
- `fixture.mjs live` sends Luca a real Heads-up at the next tick. It lands in Mailpit.
- A short tap passes trivially if it misses the button. Confirm the same coordinates end the Adventure with a 2.2-second hold in the same run.
- Without signal each request waits up to 10 seconds before the app falls back to the saved Adventure.
- `fixture.mjs offline` stops the whole API gateway, so Realtime and every screen lose the server too. Always run `fixture.mjs online` before the next journey.
- With "Always", a queued Check-in is sent on the next background location wake (the screen shows `Barry keeps trying in the background.`). Without "Always", it is sent only when the app comes to the foreground or another Check-in starts.
- **Background Check-in (`live-background-checkin`).** Start a simulated walk with `xcrun simctl location booted start --speed=2 --distance=15 <waypoints>` so iOS delivers wakes. `fixture.mjs offline`, hold `Hold to Check In`, press `button HOME`, `fixture.mjs online`, and do not open Barry. Within about a minute the latest Adventure is `ended`, with `checked_in_at` at the hold and `ended_at` at a location wake after `online`. Verified on 15 October: hold 14:35:54, delivered 14:37:17.
- While Alerted, the `Plan` card loses its chevron and takes no tap, and `Who Is Watching` has no `Edit Contacts`, by design. The clock stays, and a move makes the Adventure Active again.
