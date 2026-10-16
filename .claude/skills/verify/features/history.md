# History

The History tab, second in the tab bar, shows the Adventure in progress under `Current Adventure` and the Ended Adventures under `Past Adventures`, newest first. Planned Adventures stay on the Adventure tab. The Adventure tab no longer lists past Adventures.

## Sub-features

- `history-tab` shows four tabs in the order `Adventure`, `History`, `Contacts`, `Profile`, with a list icon on `History`.
- `history-past` lists Ended Adventures as cards reading `<destination>` and `Checked in <time>`, newest first.
- `history-now` shows the live Adventure under `Current Adventure` with `Back by <time>`, `Overdue since <time>` or `Emergency Contacts alerted`. Tapping it opens the Adventure tab's live screen.
- `history-empty` reads `Your adventures show up here once you start one.` when there is no live or Ended Adventure.
- Opening an Ended Adventure and deleting it are `trail-history` and `history-delete` in [Trail and Trail Map](./trail.md).

## How to get to it (user POV)

- Tap `History` in the tab bar (158, 820).

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index.

- **Tabs (`history-tab`).** The tab bar shows `Adventure` (73, 820), `History` (158, 820), `Contacts` (243, 820) and `Profile` (329, 820).
- **Past (`history-past`).** Tap `History`. The screen titled `History` shows `Past Adventures` and a card per Ended Adventure. The Adventure tab shows `Plan an Adventure` and no `Past Adventures`.
- **Now (`history-now`).** Run `fixture.mjs live 120`, tap `Profile`, then `History`. A `Current Adventure` heading sits above `Past Adventures` with a `Pilatus` card reading `Back by <time>`. Tap it. The Adventure tab opens on the live screen with `Hold to check in`. Run `fixture.mjs end`, tap `History`: the `Current Adventure` section is gone and the Adventure is the first card under `Past Adventures`.

## Gotchas

- History loads when the tab comes into focus. After a `fixture.mjs` change, switch to another tab and back.
- A new tab needs a full reload of the app (`xcrun simctl terminate` and `launch`). Fast Refresh keeps the old tab bar.
- `history-empty` needs an account without Adventures. The test account has many, so the empty state is unverified unless a fresh account is used.
