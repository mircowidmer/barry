# Sign in

The app opens on the sign-in screen until an Adventurer signs in or creates an account. After the first sign-in it asks for notification permission and registers the phone for push. The session survives app restarts.

## Sub-features

- `signin-password` signs in with email and password.
- `signin-create` creates an account with email and password.
- `signin-push` asks for notification permission and registers a push token.
- `signin-persist` keeps the session after the app restarts.
- `signin-signout` signs out from the Profile tab.
- `account-delete` deletes the account from the Profile tab with `Delete Account`.

## How to get to it (user POV)

- Open the app while signed out. The screen titled `Barry` shows `Email`, `Password`, `Sign in` and `Create account`.
- Tap `Sign out` on the Profile tab.

## Driving it with the iOS Simulator

Preconditions:

- The doctor passes. The app is signed out.

- **Enter credentials.** `clip.sh email`, long-press `Email` (201, 247), tap `Paste`. `clip.sh password`, long-press `Password` (201, 329), tap `Paste`, then `clip.sh clear`. `Sign in` turns solid blue.
- **Sign in (`signin-password`).** Tap `Sign in` (201, 390). The Adventure tab opens with `Plan an Adventure`.
- **Push (`signin-push`).** On a fresh install the prompt `"Barry" Would Like to Send You Notifications` appears. Tap `Allow`. Within 10 seconds the database has a row in `push_devices` for the test account starting with `ExponentPushToken[`.
- **Persist (`signin-persist`).** Run `xcrun simctl terminate booted support.barry` and `xcrun simctl launch booted support.barry`. The app opens signed in on the Adventure tab.
- **Sign out (`signin-signout`).** Tap `Profile`, scroll down, tap `Sign out`. The sign-in screen returns.
- **Delete account (`account-delete`).** Never on the test account. Sign out, paste a new address such as `delete-test-<time>@barry.test` and a generated password, and tap `Create account`. Tap `Profile`, scroll down, tap `Delete Account`. The alert `Delete your account?` offers `Cancel` and `Delete`. Tap `Delete`. The sign-in screen returns, and `auth.users` has no row for that address. Sign in to the test account again afterwards.

## Gotchas

- `Create account` with the existing test email fails with a Supabase error. Use it only after `npx supabase db reset --local`.
- The push prompt appears only once per install. Re-test it with `xcrun simctl privacy booted reset notifications support.barry` before launching.
- Never tap `AutoFill` in the Paste menu.
