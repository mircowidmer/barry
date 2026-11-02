# Trail and Trail Map

With the iOS "Always" location permission, Barry records the Trail in the background during a live Adventure, at most one reading per five minutes, keeps readings on the phone without signal, and keeps the Trail for the Adventurer after the Check-in.
Each Emergency Contact gets their own Trail Map link in the Heads-up, every Plan Update, every Deadline Update, every Alert and the All-clear.
The page shows the Plan, the Trail and the Last Position, never the Deadline or the Overdue stage, and adds the Check-in time once the Adventurer is back.
The app shows the Adventurer the map of the Trail on the Check-in screen and on each Past Adventure.

## Sub-features

- `trail-off` shows a grey `Start position only` badge on the live screen's map without "Always", read as `Barry can share only where you started.`; without a map yet, the same text shows as a note.
- `trail-recording` shows an accent `Recording` badge on the map with "Always", read as `Barry is recording your trail. Closing Barry stops the trail.`; without a map yet, the same text shows as a note.
- `trail-background` keeps uploading readings while Barry is in the background, at most one per five minutes.
- `trail-offline` keeps readings on the phone without signal and sends them when the signal returns and Barry comes to the foreground.
- `trail-map` shows `<name>'s Adventure`, the line, `Last position on …` and the Plan, without the Deadline, also while Overdue.
- `trail-map-checked-in` shows `<name> checked in on …` above the map of the Trail after the Check-in.
- `trail-live-map` shows the Trail on an Apple map on the live screen, below the Deadline card, with a dot per reading and a marker titled `Last position: <time>` for the newest reading.
  It adds new readings every five minutes.
- `trail-after-checkin` keeps every reading at Check-in and shows the Trail on an Apple map on the screen after the Check-in.
- `trail-history` opens an Ended Adventure from its day on the History tab (accessibility hint `Open <destination>`) with its destination as the title and the same map, and no Plan section and no check-in note.
- `history-delete` deletes an Ended Adventure, from its screen with `Delete` or from its day on the History tab by swiping the row left (`swipe` from (330, y) to (140, y)) and tapping `Delete`.
  Both ask `Delete this Adventure?`; `Delete` removes it, and a message still being sent refuses with `Barry is still sending messages for this adventure. Try again in a few minutes.`

## How to get to it (user POV)

- The Adventurer allows location "Always" (iOS Settings, or the `Allow Always` button under the Start warning), starts an Adventure, and walks.
- An Emergency Contact opens the link from the Heads-up or Alert email in a browser.
  Locally the link is `http://Mirook.local:8081/adventure#<token>`, so it opens on a phone on the same Wi-Fi.
  On the Mac `http://localhost:8081/adventure#<token>` shows the same page.

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index.
- `xcrun simctl location booted set 47.0286,8.6885` so the phone has a position.
- For `trail-off`: `xcrun simctl privacy booted revoke location-always support.barry.dev`, then `xcrun simctl privacy booted grant location support.barry.dev`.
- For the other journeys: `xcrun simctl privacy booted grant location-always support.barry.dev`.
- After any `privacy` change, `xcrun simctl terminate booted support.barry.dev` and `xcrun simctl launch booted support.barry.dev`, because the app reads the permission on load and on foreground only.
- `fixture.mjs live 120`, then tap `Contacts` (243, 820) and `Adventure` (73, 820) so the app loads and saves the live Adventure.

- **Off (`trail-off`).** The live screen's map carries the badge `Start position only` at its top left, or, before the first reading, the note `Barry can share only where you started.` under the Deadline card.
- **Recording (`trail-recording`).** The live screen's map carries the badge `Recording` at its top left (VoiceOver: `Barry is recording your trail. Closing Barry stops the trail.`) and the status bar shows the location arrow.
- **Walk.** `xcrun simctl location booted start --speed=2 --distance=15 47.0286,8.6885 47.0320,8.6960 47.0370,8.7040 47.0420,8.7120 47.0480,8.7200`.
  Within five minutes `fixture.mjs trail` prints a `readings | trail | n | n | …` line, where the two counts are equal.
  Expect one reading per five minutes, the first one iOS reports in those five minutes.
- **Background (`trail-background`).** Press HOME, wait eleven minutes, run `fixture.mjs trail`.
  The count grows by roughly 2 (one per five minutes while moving) and the last time is within the last five minutes.
- **Offline (`trail-offline`).** While walking, `fixture.mjs offline`, wait eleven minutes, `fixture.mjs trail` shows no new readings.
  `fixture.mjs online`, then `xcrun simctl launch booted support.barry.dev`.
  Within 30 seconds the missing readings arrive, still at most one per five minutes.
- **Page (`trail-map`).** Take Luca's token from `fixture.mjs trail` (`link | Luca | <token>`) and open `http://localhost:8081/adventure#<token>` in the built-in browser.
  The page reads `Anna's Adventure` (or the Profile name), shows a line on the map, `Last position on <time>` (no time zone), and a `Plan` card with `Destination` and `Pilatus`.
  `get_page_text` contains no `Deadline` and no `overdue`.
  Repeat after `fixture.mjs overdue` and the next tick: the page looks the same.
- **Check-in (`trail-after-checkin`, `trail-map-checked-in`).** Hold `Check In` with `duration: 2.2`.
  The app shows the destination as its title with a checkmark button (`Done`) at the top right and an Apple map below it: a blue line, a blue dot per reading and a red marker on the newest one.
  `fixture.mjs trail` prints `adventure | ended` and the same `trail` count as before.
  Reload the page with `location.reload()`: it reads `Anna checked in on <time>.` above the same map and Last Position as before.
- **History (`trail-history`).** Tap `Done`, tap `History` (158, 820), then the Adventure's row under its day.
  The pushed screen has a `Back` button and shows the same map, without a Plan section or a check-in note.
  An Ended Adventure without readings shows `No positions were recorded.`
- **Proof.** Screenshot the live screen's map badge and the page, and save `fixture.mjs trail` after each step to `.verify-artifacts/<run-id>/`.

## Gotchas

- The simulated route ends.
  At 2 m/s the route above takes about 25 minutes.
  Once it ends, Barry gets no readings, because iOS sends updates only on movement.
  A stalled count after a route ended is not a bug: start a new route.
- The iOS 27 simulator refuses geofencing (`startGeofencingAsync` throws).
  The relaunch after a force-quit cannot be verified here; it needs a real iPhone.
  Report it as unverified.
- `navigate` to the same `/adventure#<token>` URL does not reload the page.
  Use `location.reload()`, or wait for the page's five-minute refresh, which fetches only readings newer than the newest one shown.
- `fixture.mjs live` inserts the Adventure without `start_adventure`, so there is no `start` reading.
  A Check-in then leaves no readings at all.
- Count uploads with `docker logs --since 300s supabase_kong_barry-local | grep -c rpc/record_trail`.
  A walk makes at most one call per new five minutes, and never more calls than new readings.
  More calls than readings means Barry sends slots it already sent again.
- A launch on a live Adventure the app has not saved yet, as after `fixture.mjs live`, must start recording without HOME and a relaunch.
  If the status bar shows no location arrow and the count stays at 0, the Trail missed the Adventure.
- Background uploads were verified within the session token's first hour only.
  An expired token during a background wake is unverified.
- The Trail Map URL in messages comes from `TRAIL_MAP_URL` in `supabase/config.toml`.
  The edge runtime reads it at start, so a change needs `npx supabase stop` and `npx supabase start`.
