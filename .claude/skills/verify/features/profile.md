# Profile

The Profile tab holds what an Alert tells the Emergency Contacts about the Adventurer: the name and the phone number, which the first Start needs, and optionally the car and medical notes, which only an Alert carries. The checkmark in the header saves it. Signing out, deleting the account and the language of the messages are in [Sign in](./sign-in.md).

## Sub-features

- `profile-required` saves the name and the phone number, which Start needs.
- `profile-optional` saves the car's make, colour and number plate, and the medical notes.
- `profile-save-guard` keeps the checkmark disabled until the name and a valid phone number are filled in and something changed.
- `profile-reload` reloads the stored Profile on pull-down and keeps an unsaved edit.
- `profile-save-failure` shows `Could Not Save` when the save does not reach Barry.
- `profile-legal` opens the Privacy Policy and the Terms of Use.

## How to get to it (user POV)

- Tap `Profile` in the tab bar (329, 820). The screen titled `Profile` opens with `An alert gives your emergency contacts this information, so rescuers know who and what to look for.`

## Driving it with the iOS Simulator

Preconditions:

- The doctor passes. The app is signed in as the test account, whose Profile has a name and a phone number. Note both before editing, and restore them at the end.

- **Fields.** `About You` holds `Name`, `Email Address` with the account's address, which cannot be edited, and `Phone Number`, with the footer `With country code, for example +41 77 123 45 67.` An empty required field shows `Required`. `Car (optional)` holds `Make`, `Colour` and `Number Plate`, and `Medical Notes (optional)` a `Medical Notes` area with the footer `Only sent in an alert, never in a heads-up.` While empty they show `Optional`, or `For example allergies or medication` for the notes.
- **Save guard (`profile-save-guard`).** The checkmark in the header, which VoiceOver reads as `Save`, is disabled while nothing changed. Clear `Name`: it stays disabled. Paste the name back and replace `Phone Number` with `+4179`: still disabled, because a number needs `+`, a country code and at least six more digits. Paste `+41791234567`: the checkmark turns on.
- **Required (`profile-required`).** Tap the checkmark. It greys out again. Pull the screen down: `Phone Number` now reads `+41 79 123 45 67`, the spacing the app gives a number with a country code and nine more digits. In the database, `adventurer_profiles.phone` is `+41791234567`. Paste the previous number back and save.
- **Optional (`profile-optional`).** Paste `Subaru` into `Make` and tap the checkmark. Pull down: `Subaru` stays, and `adventurer_profiles.car_make` is `Subaru`. Clear `Make` and save: the column is null again.
- **Reload (`profile-reload`).** Add an `x` to `Name` without saving and pull down: the spinner shows and the `x` stays, because a reload replaces the form only while nothing is edited. Remove the `x`. Run `fixture.mjs offline` and pull down: after about 10 seconds `Could not reach Barry. …` shows above the fields, which keep their values. Run `fixture.mjs online`.
- **Save failure (`profile-save-failure`).** Run `fixture.mjs offline`, paste `red` into `Colour` and tap the checkmark. After about 10 seconds the alert `Could Not Save` reads `Check that the phone number starts with + and the country code.`, and `red` stays on screen. Run `fixture.mjs online` and tap the checkmark: it saves. Clear `Colour` and save again.
- **Legal (`profile-legal`).** Below the notes, `Privacy Policy` and `Terms of Use` rows with a chevron sit above the footer `Barry is not an emergency service and never calls rescue services. In an emergency, call 112, or 1414 for Rega in Switzerland.` Tapping a row opens `https://barry.support/privacy` or `https://barry.support/terms` in Safari. The `Log Out` and `Delete Account` rows below are covered by [Sign in](./sign-in.md).
- **Proof.** Screenshot the Profile after each save and the `Could Not Save` alert to `.verify-artifacts/<run-id>/`, and save the `adventurer_profiles` row after each change.

## Gotchas

- `Could Not Save` always names the phone number, also when the save failed for lack of signal.
- The Profile has no Cancel. An unsaved edit stays until you type the stored value back, or terminate and launch the app.
- Every save also writes the phone's language to the Profile, which `profile-language` in [Sign in](./sign-in.md) covers.
- Without signal each request waits up to 10 seconds before it fails.
