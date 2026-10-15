# Plan and start

From the Adventure tab, an Adventurer plans an Adventure with a destination, an optional route, starting point and notes, a Deadline and Emergency Contacts. The Start warnings say who will not be reached. Start records the position and sends each contact a Heads-up.

## Sub-features

- `plan-save` saves a Planned Adventure with `Save for later`.
- `plan-warnings` shows the no-push, email-only and unreachable warnings for the selected contacts.
- `plan-start` starts the Adventure, records the position and opens the live screen.
- `plan-headsup` sends the Heads-up by email and by text message to each contact on every channel it has.
- `plan-refusals` shows a refusal such as `Add a destination.` instead of starting.
- `plan-delete` deletes a Planned Adventure, from its screen with `Delete` or from `Planned Adventures` by swiping the card left (`swipe` from (330, y) to (140, y)) and tapping `Delete`. Both ask `Delete this Adventure?` with `Its Plan is removed. Nobody was told about it yet.`; `Cancel` keeps it.

## How to get to it (user POV)

- Tap `Plan an Adventure` on the Adventure tab (201, 250).
- Tap a card under `Planned Adventures` to reopen a saved Adventure.

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index. The simulator location is set: `xcrun simctl location booted set 47.0286,8.6885`.

- **Refusal (`plan-refusals`).** Tick `Luca`, scroll, and tap `Start Adventure` without a destination. The notice reads `Add a destination.`
- **Warnings (`plan-warnings`).** Tick `Sara` as well. With text messages on, no warning names Sara. While `sms` is switched off in `private.channel_config`, the warning reads `Text messages are not set up yet, and Sara only has a phone number, so they will get no message at all.`
- **Start (`plan-start`).** Paste `Grosser Mythen` into `Destination` and tap `Start Adventure`. On first use iOS asks for location: choose `Allow While Using App`. The live screen opens with `Barry is watching.` `fixture.mjs state` prints `adventure | active | Grosser Mythen`.
- **Heads-up (`plan-headsup`).** Within a few seconds Mailpit at http://127.0.0.1:54324 has `🐶 Anna is heading out to Grosser Mythen` for `luca@example.com`, and the text message relay prints `texted +41792222222 from Barry: Anna is going on an adventure alone and chose you as an Emergency Contact on Barry. Barry is the watchdog here: he only barks if Anna does not check in in time.`. `fixture.mjs state` lists `heads_up | email | luca@example.com | sent` and `heads_up | sms | +41792222222 | sent`.

## Gotchas

- The default Deadline is four hours ahead, rounded up to the quarter hour.
- The tap after a swipe often lands while the list is still scrolling. Take a screenshot and tap again.
- Run `fixture.mjs end` afterwards, or Luca gets an Alert when the Deadline passes.
