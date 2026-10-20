# Profile

The Profile tab holds what an Alert tells the Emergency Contacts about the Adventurer: the name and the phone number, which the first Start needs, and optionally the car and medical notes, which only an Alert carries. The checkmark in the header saves it. Signing out, deleting the account and the language of the messages are in [Sign in](./sign-in.md).

## Sub-features

- `profile-required` saves the name and the phone number, which Start needs.
- `profile-optional` saves the car's make, colour and number plate, and the medical notes.
- `profile-save-guard` keeps the checkmark disabled until the name and a valid phone number are filled in and something changed.
- `profile-reload` reloads the stored Profile on pull-down and keeps an unsaved edit.
- `profile-save-failure` shows `Could Not Save` when the save does not reach Barry.
- `profile-legal` opens the Privacy Policy and the Terms of Use.
- `profile-account` opens the `Account` sheet from `Change Email Address and Password`, where the Adventurer changes the password after the current one is checked, and asks for a new email address that both addresses confirm.

## How to get to it (user POV)

- Tap `Profile` in the tab bar (329, 820). The screen titled `Profile` opens with its large title expanded and `Your emergency contacts get this in an alert, so rescuers know who and what to look for.`

## Driving it with the iOS Simulator

Preconditions:

- The doctor passes. The app is signed in as the test account, whose Profile has a name and a phone number. Note both before editing, and restore them at the end.

- **Fields.** `About You` holds `Name` and `Phone Number`, with no footer. The email address is not shown; it is on the `Account` sheet. An empty `Name` shows `Required`, and an empty `Phone Number` shows nothing. `Car (optional)` holds `Make`, `Colour` and `Number Plate`, and `Medical Notes (optional)` a `Medical Notes` area, with no footer. While empty the car fields show nothing, and the notes show `For example allergies or medication`.
- **Save guard (`profile-save-guard`).** The checkmark in the header, which VoiceOver reads as `Save`, is disabled while nothing changed. Clear `Name`: it stays disabled. Paste the name back and replace `Phone Number` with `+4179`: still disabled, because a number needs `+`, a country code and at least six more digits. Paste `+41791234567`: the checkmark turns on.
- **Required (`profile-required`).** Tap the checkmark. It greys out again. Pull the screen down: `Phone Number` now reads `+41 79 123 45 67`, the spacing the app gives a number with a country code and nine more digits. In the database, `adventurer_profiles.phone` is `+41791234567`. Paste the previous number back and save.
- **Optional (`profile-optional`).** Paste `Subaru` into `Make` and tap the checkmark. Pull down: `Subaru` stays, and `adventurer_profiles.car_make` is `Subaru`. Clear `Make` and save: the column is null again.
- **Reload (`profile-reload`).** Add an `x` to `Name` without saving and pull down: the spinner shows and the `x` stays, because a reload replaces the form only while nothing is edited. Remove the `x`. Run `fixture.mjs offline` and pull down: after about 10 seconds `Could not reach Barry. …` shows above the fields, which keep their values. Run `fixture.mjs online`.
- **Save failure (`profile-save-failure`).** Run `fixture.mjs offline`, paste `red` into `Colour` and tap the checkmark. After about 10 seconds the alert `Could Not Save` reads `Check that the phone number starts with + and the country code.`, and `red` stays on screen. Run `fixture.mjs online` and tap the checkmark: it saves. Clear `Colour` and save again.
- **Legal (`profile-legal`).** At the bottom, below `Delete Account`, `Privacy Policy` and `Terms of Use` rows with a chevron sit above the footer `Barry is not an emergency service and never calls rescue services. In an emergency, call 112, or 1414 for Rega in Switzerland.` Tapping a row opens `https://barry.support/privacy` or `https://barry.support/terms` in Safari. The `Log Out` and `Delete Account` rows above them are covered by [Sign in](./sign-in.md).
- **Account (`profile-account`).** Never on the test account's address: create a throwaway account first, as `account-delete` in [Sign in](./sign-in.md) does, and delete it at the end. Scroll down and tap `Change Email Address and Password`, the first row of the `Account` group, above `Log Out`. The sheet titled `Account` slides up from the bottom, with a close button at its top left, and holds two groups. `Password` holds `Current Password` and `New Password`, both showing `Required` while empty, and a greyed-out `Change Password` row with the footer `Barry checks your current password before it changes anything.`; the row turns on once both fields are filled. Paste a wrong password into `Current Password` and a new one into `New Password`, tap `Change Password`: the red notice reads `That is not your current password. Nothing was changed.` and both fields keep their text. Paste the real password into `Current Password` and tap again: the green notice reads `Your password is changed.` and both fields are empty. Close the sheet, tap `Log Out` on the Profile and sign in with the new password. `Email Address` holds `Current` with the address, `New Address` and a `Change Email Address` row that stays greyed out while the field is empty or holds the current address, with the footer `Barry sends a link to your current address and one to the new address. Your address changes once you have opened both.` Paste a new address and tap the row: the green notice reads `Barry sent a link to <old> and one to <new>. Open both. Until then you sign in with <old>.`, `Current` still shows the old address, and Mailpit has `Confirm Email Change` for both addresses. Pull the screen down: the notice now reads `<new> is waiting for its confirmation links. …`. Open the link from one of the two emails in Safari: it lands on `http://127.0.0.1:3000`, where nothing listens, and the change is done, because locally one link is enough (see Gotchas). Pull the screen down: `Current` shows the new address and the notice is gone, and signing in afterwards takes it. Sign in with the new address afterwards.
- **Proof.** Screenshot the Profile after each save and the `Could Not Save` alert to `.verify-artifacts/<run-id>/`, and save the `adventurer_profiles` row after each change. For `profile-account`, screenshot both notices and the `Account` screen after the second link, and save the `auth.users` row's `email` and `new_email` before and after.

## Gotchas

- `Could Not Save` always names the phone number, also when the save failed for lack of signal.
- The Profile has no Cancel. An unsaved edit stays until you type the stored value back, or terminate and launch the app.
- Every save also writes the phone's language to the Profile, which `profile-language` in [Sign in](./sign-in.md) covers.
- Without signal each request waits up to 10 seconds before it fails.
- A wrong current password shows Barry's own notice; anything else Supabase refuses, such as a new password under six characters or an address another account uses, shows Supabase's English message.
- Locally `enable_confirmations = false` in `supabase/config.toml` makes Auth confirm an address change with the first link that is opened; the other link then fails with `otp_expired`. The hosted project confirms new accounts by email, so there both links are needed: the first lands on `https://barry.support/confirmed` saying `One more link to open`, the second saying `Your email address is changed`. The screen's texts describe the hosted behaviour.
- The confirmation links redirect to the Site URL in `supabase/config.toml`, `http://127.0.0.1:3000`, where nothing listens locally. The change is complete once Safari lands there without `error` in the address.
