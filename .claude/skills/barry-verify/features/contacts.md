# Emergency Contacts

The Contacts tab lists the Adventurer's Emergency Contacts in one inset group, as in the Phone app. Each row shows the contact's initials, the name, how Barry reaches them (`Email and text message`, `Email only` or `Text message only`) and an info symbol. `+` in the header opens the phone's own contact picker, and so does `Pick a Contact` while the list is empty; the picked Phone Contact is copied into the list at once, both addresses on. Tapping a row opens the sheet titled with the contact's name, grouped like Settings: `Name`, then an `EMAIL` group with `Address` and `Use for Messages`, and a `TEXT MESSAGE` group with `Number` and `Use for Messages`. The copied name and addresses are read-only; the sheet has `Cancel` and `Save` in the header and `Delete Contact` at the bottom. A row swiped left offers `Delete`. While text messages are switched off, a contact Barry would text says so in the warning colour. A contact on a live Adventure cannot be removed.

## Sub-features

- `contacts-pick` adds a contact by picking it in the phone's contact picker, copying the name, the first mobile number and the first email.
- `contacts-duplicate` refuses a pick whose email or phone number a contact already has.
- `contacts-unreachable` refuses a pick with no email and no usable phone number.
- `contacts-remove` removes a contact that no live Adventure uses, by swiping its row left or with `Delete Contact` in its sheet.
- `contacts-in-use` refuses to remove a contact of the live Adventure.
- `contacts-sms-marker` marks contacts Barry would text with `Text messages not set up yet`.
- `contacts-switches` switches a contact's email address or phone number off and on. Barry uses only the addresses that are on, and a contact needs at least one.

## How to get to it (user POV)

- Tap `Contacts` in the tab bar (243, 820).

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index.
- The Simulator's region is Switzerland (`en_CH`), so a number without a country code is read as Swiss. Its sample contacts carry US numbers without a country code, which Barry cannot use in that region: `Kate Bell` (Creative Consulting, `kate-bell@mac.com`), `John Appleseed`, `Anna Haro`, `Daniel Higgins Jr.`, `David Taylor`, `Hank M. Zakroff`.
- A Swiss contact, made in the Simulator's Contacts app once: `xcrun simctl launch booted com.apple.MobileAddressBook`, tap `+` (349, 821), tap `First name` (201, 417) and type `Sara Keller`, tap `add phone` (116, 590) and type `079 123 45 67` (label `mobile`), tap the checkmark (364, 100). The `text` action works in the Contacts app. It pastes the clipboard, so run `clip.sh set <text>` first or it pastes the previous text. Bring Barry back with `xcrun simctl launch booted support.barry.dev`.

- **Pick (`contacts-pick`).** Tap `+` (364, 84). The system picker `Contacts` lists the phone's contacts under `Private Access to Contacts`, with no permission prompt. Tap `Sara Keller`. The picker closes without a notice, and a `Sara Keller` row reads `Text message only`; her sheet lists `+41 79 123 45 67`. The stored row has `phone = +41791234567` and `phone_enabled = true`. Tap `+` and pick `Kate Bell`: a `Kate Bell` row appears and reads `Email only`, because `(555) 564-8583` is not a Swiss number.
- **Duplicate (`contacts-duplicate`).** Tap `+` and pick `Kate Bell` again. The notice reads `Kate Bell is already a contact.` and the list still has one Kate Bell row.
- **Unreachable (`contacts-unreachable`).** In the Contacts app, add a contact named `Nobody Reachable` with no number and no email, then pick it in Barry. The notice reads `Nobody Reachable has no email address and no phone number Barry can use.`, no row appears and no row is stored.
- **Marker (`contacts-sms-marker`).** Text messages are on, so Sara's row reads `Text message only`. It reads `Text messages not set up yet` in the warning colour only while `sms` is switched off in `private.channel_config`; a contact with an email address as well reads `Email only · Text messages not set up yet`.
- **Switches (`contacts-switches`).** Tap Kate Bell's row. In the sheet `Kate Bell`, `Name`, `Address` and `Number` are plain values that take no typing. The `EMAIL` and `TEXT MESSAGE` groups each have a `Use for Messages` switch below the address; VoiceOver names them `Use Email Address` and `Use Phone Number`. The email switch is on, the phone switch is off and disabled because she has no number. Drag the email switch off with `touch_path` from its right end leftwards by about 46 points in 30 ms steps; a plain `tap` does not move a switch. `Save` in the header greys out. Tap `Cancel` (38, 100): the alert `Discard Changes?` offers `Cancel` and `Discard`; tap `Discard`. On Sara Keller's sheet the phone switch can be turned off and saved; her row then reads `Email only` if she has an email address, and the switch stays off when the sheet is opened again.
- **In use (`contacts-in-use`).** Run `fixture.mjs live 120`, switch tabs, swipe Luca's row left, tap `Delete`, and tap `Delete` in the `Delete Luca?` alert. The notice reads `Luca is a contact of your current adventure, so they stay until you check in.` Luca is still listed. Run `fixture.mjs end`.
- **Remove (`contacts-remove`).** Swipe a row left with `touch_path` from (340, y) to (140, y) in 16 ms steps and tap `Delete`. The alert `Delete <name>?` offers `Cancel` and `Delete`. `Cancel` keeps the row. Tap `Delete`: the notice reads `<name> deleted.` and the row is gone. Alternatively, tap the row and `Delete Contact` at the bottom of the sheet; the sheet closes.
- **Empty list.** With every contact deleted, the screen shows the intro, the row `Pick a Contact` and below it `No contacts yet. Pick them from your phone’s contacts.`, which opens the same picker as `+`. Not yet driven: the test account keeps its contacts.

## Gotchas

- The picker is the legacy `presentContactPickerAsync` of `expo-contacts`, which hands over the picked contact itself. The class API's `Contact.presentPicker()` returns only an id, and reading its name asks `Allow "Barry Dev" to access your contacts?`. If that prompt appears, the wiring in `src/lib/barry/index.ts` has changed. Reset a denied answer with `xcrun simctl privacy booted reset contacts support.barry.dev`, which also quits the app.
- The picker's copy carries the name parts but not always the formatted full name, so the company name shows up as the contact's name when the full name is dropped. A card named `Kate Bell` is the proof that the name parts are joined.
- After `xcrun simctl launch`, the Expo developer menu button floats under `+` and catches the tap. Relaunch with the deep link `exp+barry://?__expo_url=http%3A%2F%2F<mac-ip>%3A8081&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1` through `xcrun simctl openurl`, which hides it.
- A screenshot written into `.verify-artifacts/` while the app is open shows a `Refreshing…` banner and can reset the sheet's unsaved switches. Write proof to a folder outside the repo and copy it in at the end.
- Removing is a soft delete. A removed contact no longer appears, but past messages still name them.
- A contact's name and addresses cannot be edited in Barry. The fixture's `Luca` and `Sara` are inserted by `fixture.mjs`, not picked.
