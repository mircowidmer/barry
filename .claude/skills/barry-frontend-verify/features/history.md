# History

The History tab, second in the tab bar, shows the Adventure in progress under `Current Adventure` and the Ended Adventures grouped by the day of their Check-in, under `TODAY`, `YESTERDAY` or a date such as `WED 21 OCT`, newest first. A search field under the title filters them by destination. Planned Adventures stay on the Adventure tab. The Adventure tab no longer lists past Adventures.

## Sub-features

- `history-tab` shows four tabs in the order `Adventure`, `History`, `Contacts`, `Profile`, with a list icon on `History`.
- `history-past` lists Ended Adventures as rows reading `<destination>` over `Checked in`, with the Check-in time `<hh:mm>` in Nordwand Mono on the right, newest first. VoiceOver reads a row as `<destination>, Checked in <hh:mm>`. Each row has a green checkmark, or an orange warning triangle and `<n> alerts sent` in place of `Checked in` when contacts were alerted, and a chevron on the right.
- `history-now` shows the live Adventure under `Current Adventure` with `Back by <time>`, `Overdue since <time>` or `Emergency contacts alerted`. Tapping it opens the Adventure tab's live screen.
- `history-search` filters the rows by destination as you type, and reads `No adventure matches your search.` when none matches.
- `history-empty` reads `Your adventures show up here once you start one.` when there is no live or Ended Adventure.
- `history-select` deletes several Ended Adventures at once. `Select` in the header turns into `Done`, each row's status symbol turns into a round checkmark, a tap selects the row instead of opening it, and the tab bar gives way to a bottom toolbar with `Select All` and a red `Delete (<n>)`. `Delete (2)` asks `Delete 2 Adventures?` with `Their plans, trails and messages are removed. The links your emergency contacts got no longer work.`; afterwards the rows are gone, `Select` is back and so is the tab bar.
- Opening an Ended Adventure and deleting it are `trail-history` and `history-delete` in [Trail and Trail Map](./trail.md).

## How to get to it (user POV)

- Tap `History` in the tab bar (158, 820).

## Driving it with the iOS Simulator

Preconditions:

- Baseline from the index.

- **Tabs (`history-tab`).** The tab bar shows `Adventure` (73, 820), `History` (158, 820), `Contacts` (243, 820) and `Profile` (329, 820).
- **Past (`history-past`).** Tap `History`. The screen titled `History` shows a day header such as `TODAY` and a row per Ended Adventure under it. The Adventure tab shows `Plan an Adventure` and no past Adventures.
- **Now (`history-now`).** Run `fixture.mjs live 120`, tap `Profile`, then `History`. A `CURRENT ADVENTURE` group sits above the days with a `Pilatus` row reading `Back by <time>`. Tap it. The Adventure tab opens on the live screen with `Hold to Check In`. Run `fixture.mjs end`, tap `History`: the `CURRENT ADVENTURE` group is gone and the Adventure is the first row under `TODAY`.
- **Search (`history-search`).** Tap the search field under the title and type `pil`. Only `Pilatus` rows stay. Type `zzz`: `No adventure matches your search.` Tap `Cancel`: every row is back.

## Gotchas

- History loads when the tab comes into focus, and again when you pull the list down. After a `fixture.mjs` change, pull down, or switch to another tab and back.
- A new tab needs a full reload of the app (`xcrun simctl terminate` and `launch`). Fast Refresh keeps the old tab bar.
- `history-empty` needs an account without Adventures. The test account has many, so the empty state is unverified unless a fresh account is used.
