# Notifications

The Adventurer gets a Reminder 30 minutes before the Deadline and an Overdue Notice when the Deadline passes. Both are local notifications that the app schedules on the phone with `expo-notifications` (`src/lib/barry/alarms.ts`). They need no signal and no push, so the relay plays no part. Supabase has the push channel turned off and queues no push rows for them.

## Sub-features

- `local-reminder` shows `Check in or move your Deadline` 30 minutes before the Deadline. A Deadline less than 30 minutes ahead gets none.
- `local-overdue` shows `You are overdue` with the Alert time at the Deadline.
- `local-cancel` shows neither after a Check-in, including one that waits for signal.

## How to get to it (user POV)

- They arrive by themselves while an Adventure is live. The app needs notification permission. It schedules both when Supabase confirms the Start or a Deadline move, and whenever it loads the live Adventure, such as when the Adventure tab opens.

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index. The relay may be stopped. Stopping it shows that the notification is local.

- **Overdue Notice (`local-overdue`).** Run `fixture.mjs live 2`, then `xcrun simctl terminate booted support.barry` and `xcrun simctl launch booted support.barry`, so the app loads the Adventure and schedules the notification. Wait until the live screen shows the countdown, then press `button HOME`. At the Deadline, a banner from `Barry` reads `You are overdue. Your Deadline for Pilatus was <weekday> <day> <month>, <HH:MM>. Barry alerts your Emergency Contacts at …`. Take `xcrun simctl io booted screenshot` about once a second from one second before the Deadline, because the banner stays for about 5 seconds. `fixture.mjs state` lists no `reminder` or `overdue_notice` message rows.
- **Reminder (`local-reminder`).** Run `fixture.mjs live 31`, then relaunch the app as above and press `button HOME`. About a minute later the banner reads `Check in or move your Deadline. Your Deadline for Pilatus is …`.
- **Check-in cancels (`local-cancel`).** Run `fixture.mjs live 2`, relaunch the app, and hold `Hold to check in` with `duration: 2.2`. Press `button HOME`. Screenshots from one second before the Deadline to ten seconds after show no banner.
- **Proof.** Save the banner screenshot and `fixture.mjs state`, then run `fixture.mjs end`.

## Gotchas

- `fixture.mjs` writes to the database only. The app schedules nothing until it loads the Adventure, so relaunch it after `fixture.mjs live`.
- With the app in the foreground, the banner shows for a few seconds only. Background the app first for a screenshot.
- The simulator's clock decides when the notification shows. The Alert still follows the database clock.
- Metro prints no `console.log` output from this build. To see why a schedule failed, send the error to a local HTTP listener with `fetch`, and remove it afterwards.
- Older Notification Center entries that end in `Zurich time` came from the relay before push was turned off. They are not local notifications.
