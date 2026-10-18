# Emergency Contacts

The Contacts tab lists the Adventurer's Emergency Contacts. `+` in the header opens the sheet `New Contact`, and tapping a card opens the sheet `Edit <name>`; both have `Cancel` and `Add` or `Save` in the header. A card swiped left offers `Delete`, and so does the bottom of the edit sheet. A phone number is marked while text messages are switched off. A contact on a live Adventure cannot be removed.

## Sub-features

- `contacts-add` adds a contact with a name and an email, a phone number, or both.
- `contacts-edit` changes a contact through its card and `Save`.
- `contacts-remove` removes a contact that no live Adventure uses, by swiping its card left or with `Delete` in its sheet.
- `contacts-in-use` refuses to remove a contact of the live Adventure.
- `contacts-sms-marker` marks phone numbers with `Text messages not set up yet`.
- `contacts-switches` switches a contact's email address or phone number off and on. Barry uses only the addresses that are on, and a contact needs at least one.

## How to get to it (user POV)

- Tap `Contacts` in the tab bar (243, 820).

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index.

- **Add (`contacts-add`).** Tap `+` in the header. In the sheet `New Contact`, paste `Mia` into `Name` and `mia@example.com` into `Email Address`, then tap `Add` in the header. The sheet closes and a `Mia` card lists the email.
- **Marker (`contacts-sms-marker`).** Text messages are on, so Sara's card reads `+41792222222` with no marker. The marker `+41792222222  ·  Text messages not set up yet` shows only while `sms` is switched off in `private.channel_config`.
- **Switches (`contacts-switches`).** Tap Luca's card. In the sheet `Edit Luca`, `Email Address` and `Phone Number` each have a switch beside the label. The email switch is on. The phone switch is off and disabled, because the field is empty: a switch works only for a valid address. Paste `+41791111111` into `Phone Number`: its switch turns on by itself. Turn it off and tap `Save` in the header. Luca's card reads `+41791111111  ·  Off` in grey. Tap Luca's card again and turn the `Email Address` switch off as well: the field greys out and `Save` is disabled. Turn it back on and tap `Cancel`: the alert `Discard Changes?` offers `Cancel` and `Discard`; tap `Discard`.
- **In use (`contacts-in-use`).** Run `fixture.mjs live 120`, switch tabs, swipe Luca's card left (`swipe` from (330, y) to (140, y)), tap `Delete`, and tap `Delete` in the `Delete Luca?` alert. The notice reads `Luca is a contact of your current Adventure, so they stay until you check in.` Luca is still listed. Run `fixture.mjs end`.
- **Remove (`contacts-remove`).** Swipe Mia's card left and tap `Delete`. The alert `Delete Mia?` offers `Cancel` and `Delete`. `Cancel` keeps the card. Tap `Delete`: the notice reads `Mia deleted.` and the card is gone. Alternatively, tap the card and `Delete` at the bottom of the sheet; the sheet closes.

## Gotchas

- A phone number without `+` and a country code fails the database check, and the sheet shows `Could not save. A contact needs an email address or a phone number with country code that is switched on.`
- Removing is a soft delete. A removed contact no longer appears, but past messages still name them.
