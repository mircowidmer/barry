# Barry verification map

This directory is the maintained source for verifying what a Barry user can do. Read this index before driving the app, then use the matching feature file as the recipe. Terms such as Adventure, Deadline, Check-in, Heads-up, Alert and All-clear follow `CONTEXT.md`.

## Baseline preconditions

- The doctor (`.claude/skills/barry-verify/scripts/doctor.sh`) shows every line `ok`.
- The `support.barry.dev` development build, Barry Dev, runs in the booted iPhone 18 Pro simulator and is signed in as the test account from `.env.local`.
- The test account has a Profile with a name and phone number, and two contacts: `Luca` with the email `luca@example.com`, and `Sara` with only the phone number `+41792222222`.
- `.claude/skills/barry-verify/scripts/fixture.mjs state` prints `no live Adventure`.
- Notifications are allowed for `Barry Dev`, the name the development build shows.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise.
- Locate every control by its visible text in a fresh screenshot. Coordinates are hints for an unscrolled iPhone 18 Pro screen.
- Enter text only through `clip.sh` and the long-press Paste menu.
- Use `fixture.mjs` only for preconditions and to skip waiting. Never use it for the step being verified.
- End every recipe with `fixture.mjs end` if an Adventure is still live.

## Proof and skip reporting

- Save a screenshot after the user action and after the resulting state in `.verify-artifacts/<run-id>/`.
- Save `fixture.mjs state` output for every change to stored data.
- Notification proof is a screenshot of the banner or the Notification Center entry.
- Report a step you could not reach with the attempted action and the unmet precondition. Never report it as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behaviour. It then uses exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with the iOS Simulator`, and `Gotchas`.

## Features

- [Sign in](./sign-in.md) covers sign-in, account creation, the notification prompt and staying signed in.
- [Profile](./profile.md) covers the Adventurer Profile: the required name and phone number, the optional car and medical notes, the save guard, pull to reload and the legal links.
- [Emergency Contacts](./contacts.md) covers adding, editing and removing contacts, and the text-message marker.
- [Plan and start](./plan-and-start.md) covers planning, Start warnings, Start and the Heads-up.
- [Live Adventure](./live-adventure.md) covers the countdown, Deadline moves, Overdue, editing, Check-in, the short-tap guard and offline Check-in.
- [Notifications](./notifications.md) covers the Reminder and the Overdue Notice, which the app schedules as local notifications.
- [History](./history.md) covers the History tab with the live Adventure and the Ended Adventures.
- [Trail and Trail Map](./trail.md) covers background recording, offline readings, the live map, the contact's Trail Map page, the Trail after the Check-in, and deleting an Ended Adventure.
