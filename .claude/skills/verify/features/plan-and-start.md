# Plan and start

From the Adventure tab, an Adventurer plans an Adventure in a sheet with a destination, an optional route, starting point and notes, a Deadline and Emergency Contacts. `Cancel` and `Start` sit in the sheet's header; `Save for Later` and `Delete` at its bottom. The Start warnings say who will not be reached. Start records the position, sends each contact a Heads-up and closes the sheet.

## Sub-features

- `plan-save` saves a Planned Adventure with `Save for Later`, which closes the sheet. The card appears under `Planned Adventures`.
- `plan-warnings` shows the no-notifications, no-Trail, email-only and unreachable warnings for the selected contacts.
- `plan-start` starts the Adventure, records the position and opens the live screen.
- `plan-headsup` sends the Heads-up to each contact on every channel it has. Contacts who share an email address or phone number get one message per address. Locally, text messages land in the text message relay.
- `plan-refusals` shows a refusal such as `Add a destination.` instead of starting.
- `plan-delete` deletes a Planned Adventure, from its sheet with `Delete` or from `Planned Adventures` by swiping the card left (`swipe` from (330, y) to (140, y)) and tapping `Delete`. Both ask `Delete this Adventure?` with `Its Plan is removed. Nobody was told about it yet.`; `Cancel` keeps it.

## How to get to it (user POV)

- Tap `Plan an Adventure` on the Adventure tab (201, 250). The sheet `Plan an Adventure` slides up.
- Tap a card under `Planned Adventures` to reopen a saved Adventure in the sheet `Planned Adventure`.
- `Cancel` in the header, or swiping the sheet down, closes it. With unsaved changes the alert `Discard Changes?` offers `Cancel` and `Discard`.

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index. The simulator location is set: `xcrun simctl location booted set 47.0286,8.6885`.

- **Refusal (`plan-refusals`).** Tick `Luca` and tap `Start` in the header without a destination. Scroll down: the notice just above `Save for Later` reads `Add a destination.`
- **Warnings (`plan-warnings`).** Tick `Sara` as well. With text messages on, no warning names Sara. While `sms` is switched off in `private.channel_config`, the warning reads `Text messages are not set up yet, and Sara only has a phone number, so they will get no message at all.`
- **Start (`plan-start`).** Paste `Grosser Mythen` into `Destination` and tap `Start` in the header. On first use iOS asks for location: choose `Allow While Using App`. The sheet closes and the live screen shows `Barry is watching.` `fixture.mjs state` prints `adventure | active | Grosser Mythen`.
- **Heads-up (`plan-headsup`).** Within a few seconds Mailpit at http://127.0.0.1:54324 has `Anna is heading out to Grosser Mythen` from `🐶 Barry` for `luca@example.com`. For each contact with a phone number, the text message relay prints `texted <number> from Barry: Anna is going on an adventure alone and chose you as an emergency contact on Barry.` and the rest of the text. `fixture.mjs state` lists `heads_up | email | luca@example.com | sent` and `heads_up | sms | <number> | sent`.

## Gotchas

- The default Deadline is four hours ahead, rounded up to the quarter hour.
- A Start or Save that cannot reach Barry shows `Could not start the Adventure. Try again.` or `Could not save the Adventure. Try again.` just above `Save for Later`, not at the top of the sheet.
- The tap after a swipe often lands while the list is still scrolling. Take a screenshot and tap again.
- Run `fixture.mjs end` afterwards, or Luca gets an Alert when the Deadline passes.
