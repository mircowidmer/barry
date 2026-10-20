# Emergency Contacts

The Contacts tab lists the Adventurer's Emergency Contacts in one inset group, as in the Phone app. Each row shows the contact's initials, the name, how Barry reaches them (`Email and text message`, `Email only` or `Text message only`) and an info symbol. `+` in the header opens the sheet `New Contact`, and tapping a row opens the sheet `Edit <name>`; both have `Cancel` and `Add` or `Save` in the header. The sheet is grouped like Settings: `Name`, then an `EMAIL` group with `Address` and `Use for Messages`, and a `TEXT MESSAGE` group with `Number` and `Use for Messages`. A row swiped left offers `Delete`, and so does `Delete Contact` at the bottom of the edit sheet. While text messages are switched off, a contact Barry would text says so in the warning colour. A contact on a live Adventure cannot be removed.

## Sub-features

- `contacts-add` adds a contact with a name and an email, a phone number, or both.
- `contacts-edit` changes a contact through its row and `Save`.
- `contacts-remove` removes a contact that no live Adventure uses, by swiping its row left or with `Delete Contact` in its sheet.
- `contacts-in-use` refuses to remove a contact of the live Adventure.
- `contacts-sms-marker` marks contacts Barry would text with `Text messages not set up yet`.
- `contacts-switches` switches a contact's email address or phone number off and on. Barry uses only the addresses that are on, and a contact needs at least one.

## How to get to it (user POV)

- Tap `Contacts` in the tab bar (243, 820).

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index.

- **Add (`contacts-add`).** Tap `+` in the header. In the sheet `New Contact`, paste `Mia` into `Name` and `mia@example.com` into `Email Address`, then tap `Add` in the header. The sheet closes and a `Mia` row reads `Email only`.
- **Marker (`contacts-sms-marker`).** Text messages are on, so Sara's row reads `Text message only`. It reads `Text messages not set up yet` in the warning colour only while `sms` is switched off in `private.channel_config`; a contact with an email address as well reads `Email only · Text messages not set up yet`.
- **Switches (`contacts-switches`).** Tap Luca's row. In the sheet `Edit Luca`, the `EMAIL` and `TEXT MESSAGE` groups each have a `Use for Messages` switch below the address; VoiceOver names them `Use Email Address` and `Use Phone Number`. The email switch is on. The phone switch is off and disabled, because the field is empty: a switch works only for a valid address. Paste `+41791111111` into `Number`: its switch turns on by itself. Turn it off and tap `Save` in the header. Luca's row still reads `Email only`. Tap Luca's row again and turn the email switch off as well: `Save` is disabled. Turn it back on and tap `Cancel`: the alert `Discard Changes?` offers `Cancel` and `Discard`; tap `Discard`.
- **In use (`contacts-in-use`).** Run `fixture.mjs live 120`, switch tabs, swipe Luca's row left (`swipe` from (330, y) to (140, y)), tap `Delete`, and tap `Delete` in the `Delete Luca?` alert. The notice reads `Luca is a contact of your current adventure, so they stay until you check in.` Luca is still listed. Run `fixture.mjs end`.
- **Remove (`contacts-remove`).** Swipe Mia's row left and tap `Delete`. The alert `Delete Mia?` offers `Cancel` and `Delete`. `Cancel` keeps the row. Tap `Delete`: the notice reads `Mia deleted.` and the row is gone. Alternatively, tap the row and `Delete Contact` at the bottom of the sheet; the sheet closes.

## Gotchas

- A phone number without `+` and a country code fails the database check, and the sheet shows `Could not save. A contact needs an email address or a phone number with country code that is switched on.`
- Removing is a soft delete. A removed contact no longer appears, but past messages still name them.
