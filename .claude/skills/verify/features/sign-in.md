# Sign in

The app opens on the sign-in screen until an Adventurer signs in or creates an account. After the first sign-in it asks for notification permission, so the phone can show the Reminder and the Overdue Notice. The session survives app restarts.

## Sub-features

- `signin-password` signs in with email and password.
- `signin-create` creates an account with email and password.
- `signin-reset` sets a new password with the six-digit code from the recovery email, after `Forgot Password?`.
- `signin-push` asks for notification permission, for the Reminder and the Overdue Notice.
- `signin-persist` keeps the session after the app restarts.
- `signin-signout` signs out from the Profile tab.
- `account-delete` deletes the account from the Profile tab with `Delete`.
- `profile-language` writes the messages to the contacts in the phone's language, without a choice on the Profile.

## How to get to it (user POV)

- Open the app while signed out. The screen titled `Barry` shows `Email Address`, `Password`, `Sign In`, `Create Account` and the link `Forgot Password?`.
- Tap `Log Out` on the Profile tab, then `Log Out` in the `Log Out?` alert.

## Driving it with the iOS Simulator

Preconditions:

- The doctor passes. The app is signed out.

- **Enter credentials.** `clip.sh email`, long-press `Email Address` (201, 359), tap `Paste`. `clip.sh password`, long-press `Password` (201, 441), tap `Paste`, then `clip.sh clear`. `Sign In` turns solid.
- **Sign in (`signin-password`).** Tap `Sign In` (201, 502). The Adventure tab opens with `Plan an Adventure`.
- **Push (`signin-push`).** On a fresh install the prompt `"Barry Dev" Would Like to Send You Notifications` appears. Tap `Allow`. Barry needs it only for the Reminder and the Overdue Notice, which the phone schedules itself, so nothing is stored on the server.
- **Persist (`signin-persist`).** Run `xcrun simctl terminate booted support.barry.dev` and `xcrun simctl launch booted support.barry.dev`. The app opens signed in on the Adventure tab.
- **Sign out (`signin-signout`).** Tap `Profile`, scroll down, tap `Log Out`. The alert `Log Out?` offers `Cancel` and `Log Out`. `Cancel` keeps you signed in. Tap `Log Out` and the sign-in screen returns.
- **Language (`profile-language`).** The Profile has no language choice. Switch the simulator to German as the Language note in `SKILL.md` describes, open Barry, and start an Adventure: Mailpit has `Anna ist unterwegs: <destination>` for Luca, and the text message relay prints `texted <number> from Barry: Anna ist allein auf einem Abenteuer …`. Switch the simulator back to English and open Barry again, so the test account writes English messages afterwards.
- **Reset password (`signin-reset`).** Never on the test account: the new password would no longer match `.env.local`. Sign out, paste a new address such as `reset-test-<time>@barry.test` and a generated password, and tap `Create Account`. Sign out again, then tap `Forgot Password?` below `Create Account`. The screen `Reset Password` opens with `Email Address` filled in from the sign-in screen. Tap `Send Code`. The notice `Barry sent a code to <address>. Check your inbox.` appears above `Code`, `New Password`, `Set New Password` and `Send Again`. Mailpit at http://127.0.0.1:54324 has `Reset your password for Barry` for that address with a six-digit code and no link. `clip.sh set <code>`, long-press `Code`, tap `Paste`. `clip.sh set <new password>`, long-press `New Password`, tap `Paste`, then `clip.sh clear`. Tap `Set New Password`. The Adventure tab opens with `Plan an Adventure`. Tap `Profile`, scroll down, tap `Log Out`, confirm, and sign in with the new password: the Adventure tab opens. The old password is refused with a Supabase error. Afterwards delete that account as `account-delete` describes and sign in to the test account again.
- **Delete account (`account-delete`).** Never on the test account. Sign out, paste a new address such as `delete-test-<time>@barry.test` and a generated password, and tap `Create Account`. Tap `Profile`, scroll down, tap `Delete Account`. The alert `Delete Your Account?` offers `Cancel` and `Delete`. Tap `Delete`. The sign-in screen returns, and `auth.users` has no row for that address. Sign in to the test account again afterwards.

## Gotchas

- `Create Account` with the existing test email fails with a Supabase error. Use it only after `npx supabase db reset --local`.
- The push prompt appears only once per install. Re-test it with `xcrun simctl privacy booted reset notifications support.barry.dev` before launching.
- Never tap `AutoFill` in the Paste menu.
- A wrong or expired code fails with a Supabase error under `New Password`. `Send Again` sends a new code, and the old one stops working.
