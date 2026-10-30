# Plan and start

From the Adventure tab, an Adventurer plans an Adventure in a sheet with a destination, a Deadline and Emergency Contacts. A close button (`Cancel`) and `Start` sit in the sheet's header; `Save for Later` and `Delete` at its bottom. The Start warnings say who will not be reached. Start records the position, sends each contact a Heads-up and closes the sheet.

## Sub-features

- `plan-save` saves a Planned Adventure with `Save for Later`, which closes the sheet. The card appears under `Planned Adventures`.
- `plan-warnings` shows the no-notifications, no-Trail, email-only and unreachable warnings for the selected contacts.
- `plan-start` starts the Adventure, records the position and opens the live screen.
- `plan-headsup` sends the Heads-up to each contact on every channel it has. Contacts who share an email address or phone number get one message per address. Locally, text messages land in the text message relay.
- `plan-refusals` shows a refusal such as `Add a destination.` instead of starting.
- `plan-pin` pins the destination: places Apple Maps suggests while you type, the `Tell Me When I Arrive` switch, the map with the arrival circle and `Adjust`, and the full-screen `Pin on Map`.
- `plan-conditions` shows the Conditions at the pinned destination for the Adventure Day between `Deadline` and `Emergency Contacts`, on a new unsaved Plan too, following the pin and the Deadline as they are edited.
- `plan-delete` deletes a Planned Adventure, from its sheet with `Delete` or from `Planned Adventures` by swiping the card left (`swipe` from (330, y) to (140, y)) and tapping `Delete`. Both ask `Delete this Adventure?` with `Its plan is removed. Nobody was told about it yet.`; `Cancel` keeps it.

## How to get to it (user POV)

- Tap `+` in the header of the Adventure tab (364, 84), which VoiceOver reads as `Plan an Adventure`. The sheet `Plan an Adventure` slides up.
- Tap a card under `Planned Adventures` to reopen a saved Adventure in the sheet `Planned Adventure`.
- The close button (`Cancel`) in the header, or swiping the sheet down, closes it. With unsaved changes the alert `Discard Changes?` offers `Cancel` and `Discard`.

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index. The simulator location is set: `xcrun simctl location booted set 47.0286,8.6885`.

- **Refusal (`plan-refusals`).** Tick `Luca` and tap `Start` in the header without a destination. The alert `Could Not Start` reads `Add a destination.`; tap `OK`.
- **Warnings (`plan-warnings`).** Tick `Sara` as well. With text messages on, no warning names Sara. While `sms` is switched off in `private.channel_config`, the warning reads `Text messages are not set up yet, and Sara only has a phone number, so they will get no message at all.`
- **Start (`plan-start`).** Paste `Grosser Mythen` into `Destination` and tap `Start` in the header. With Maestro: the `plan-start` flow up to the scrolled-in field, then `maestro.sh field "Destination"`, the `type` flow with that point and `VALUE="Grosser Mythen"`, then the `plan-start-go` flow. On first use iOS asks for location: choose `Allow While Using App`. The sheet closes and the live screen shows `Barry is watching.` `fixture.mjs state` prints `adventure | active | Grosser Mythen`.
- **Pin (`plan-pin`).** In a new sheet, tap the `Destination` box and type `Rigi Kul` with `press_key` or the on-screen keyboard (`set_keyboard show`); Maestro's typing leaves the field half focused. Within a second the rows `Rigi Kulm` (`SZ, Switzerland`) and `Keep “Rigi Kul” without a pin` appear under the field. Tap `Rigi Kulm` once and wait a second before the screenshot: the field reads `Rigi Kulm`, the suggestions are gone, `Tell Me When I Arrive` is on, and a map shows the pin with a circle around it, `Adjust` at its top right and `Barry shows a notice when you are inside the circle. Your contacts never see the pin.` below. Tap `Adjust`: `Pin on Map` covers the screen with a pin fixed in the middle, a close button, a checkmark (`Use This Place`) and `Move the map to put the pin where you are headed.` Swipe the map and tap the checkmark: the small map recentres on the new point. Drag the switch off with `touch_path` from (352, 288) to (318, 288); a plain `tap` does not move a switch. The map goes and the hint reads `Pin your destination on a map and Barry shows a notice when you get there.` Drag it on again: `Pin on Map` opens on Rigi Kulm. Tap the checkmark and `Save for Later`; the stored row has `destination = 'Rigi Kulm'` and a point near 47.055, 8.483. Without a known position, the suggestions are ranked worldwide, so set the simulator location first.
- **Conditions (`plan-conditions`).** In a new sheet without a pin, `CONDITIONS` reads `Put your destination on the map to see the weather, the avalanche danger and the daylight there.` Type `Davos` into `Destination` with Maestro and tap the `Davos` suggestion: `CONDITIONS` shows `Sunset` and `Dark`, then `Forecast` with the hours from the current hour to `23` and `No rain or snow expected today.` or the precipitation row. Tap the date chip under `DEADLINE`, pick a later day in the calendar and tap outside it: without saving, the section reads `On <weekday> <day> <month>`, the heading `Forecast for <weekday> <day> <month>`, the hours `00` to `23` and the dry sentence names the day. Drag the hour wheel of the time chip to `02`: with the Deadline before dawn the section falls back to today and the table runs past midnight with `Fri 00` (the weekday) on the midnight column, ending at `02`. The hours table only scrolls with a `touch_path` of small steps every 30 ms; a `swipe` or large steps pan nothing. Tapping a picker wheel row does nothing either; drag it slowly and hold at the end, or it overshoots. Close with `Cancel` and `Discard`.
- **Heads-up (`plan-headsup`).** Within a few seconds Mailpit at http://127.0.0.1:54324 has `Anna is heading out to Grosser Mythen` from `🐶 Barry` for `luca@example.com`. For each contact with a phone number, the text message relay prints `texted <number> from Barry: Anna is going on an adventure alone and chose you as an emergency contact on Barry.` and the rest of the text. `fixture.mjs state` lists `heads_up | email | luca@example.com | sent` and `heads_up | sms | <number> | sent`.

## Gotchas

- The default Deadline is four hours ahead, rounded up to the quarter hour.
- A Start or Save that cannot reach Barry shows the alert `Could Not Start` with `Could not start the adventure. Try again.` or the alert `Could Not Save` with `Could not save the adventure. Try again.`; tap `OK`.
- The tap after a swipe often lands while the list is still scrolling. Take a screenshot and tap again.
- Run `fixture.mjs end` afterwards, or Luca gets an Alert when the Deadline passes.
