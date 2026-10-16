# Emergency Contacts

The Contacts tab lists the Adventurer's Emergency Contacts and lets them add, edit and remove contacts. A phone number is marked while text messages are switched off. A contact on a live Adventure cannot be removed.

## Sub-features

- `contacts-add` adds a contact with a name and an email, a phone number, or both.
- `contacts-edit` changes a contact through `Edit` and `Save Changes`.
- `contacts-remove` removes a contact that no live Adventure uses.
- `contacts-in-use` refuses to remove a contact of the live Adventure.
- `contacts-sms-marker` marks phone numbers with `Text messages not set up yet`.

## How to get to it (user POV)

- Tap `Contacts` in the tab bar (243, 820).

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index.

- **Add (`contacts-add`).** Paste `Mia` into `Name` and `mia@example.com` into `Email Address` in the `Add a New Contact` section, then tap `Add Contact`. The notice reads `Mia saved.` and a `Mia` card lists the email.
- **Marker (`contacts-sms-marker`).** Text messages are on, so Sara's card reads `+41792222222` with no marker. The marker `+41792222222 · Text messages not set up yet` shows only while `sms` is switched off in `private.channel_config`.
- **In use (`contacts-in-use`).** Run `fixture.mjs live 120`, switch tabs, tap `Remove` on Luca's card, and tap `Remove` in the `Remove Luca?` alert. The notice reads `Luca is a contact of your current Adventure, so they stay until you check in.` Luca is still listed. Run `fixture.mjs end`.
- **Remove (`contacts-remove`).** Tap `Remove` on Mia's card. The alert `Remove Mia?` offers `Cancel` and `Remove`. `Cancel` keeps the card. Tap `Remove`: the notice reads `Mia removed.` and the card is gone.

## Gotchas

- A phone number without `+` and a country code fails the database check, and the screen shows `Could not save.`
- Removing is a soft delete. A removed contact no longer appears, but past messages still name them.
