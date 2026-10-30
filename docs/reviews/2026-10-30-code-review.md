# Code review, 30 October 2026

`/code-review --fix` on the 217 commits that landed on `main` in the seven days before today: `c7f9185..d764f0a` (`git diff c7f9185 d764f0a`, 279 files). The fixes are on branch `review-2026-10-30`.

## 1. Summary

Findings: 1 High, 3 Medium, 2 Low, 2 Nit. 7 fixed, 1 left for the author.

Checks run before every commit, each green, on the staged tree alone: `npx expo lint`, `npx tsc --noEmit`, `npm test` (233 tests on `main`, 235 after the fixes). For the migration also `deno test supabase/functions/deliver` (34 passed) and `npx supabase test db` (290 tests, 17 files) against the local stack, with the Edge Runtime restarted and the new migration applied. `/barry-frontend-verify` was not run: it needs a Mac with the iOS Simulator.

## 2. Findings

| # | Severity | Where | Finding | Outcome |
| --- | --- | --- | --- | --- |
| 1 | High | `supabase/migrations/20261029090000_pace_updates.sql:12` | `pace_updates` paces from the previous update's `created_at`, not from when it went out. An update that waited up to 15 minutes is still counted from its creation, so the next change right after its send goes out within a minute of it, against the spec's "15 minutes after the last Plan Update to the same address". | Fixed in `b13cbb2` |
| 2 | Medium | `src/lib/barry/conditions.ts:269` | When only the SLF request fails on a refresh, the bulletin becomes `null` and is kept for 30 minutes, so the Conditions hide an avalanche danger whose bulletin is still valid. | Fixed in `cafc8b9` |
| 3 | Medium | `src/lib/keychain-session.ts:24` | While the session moves from the storage file to the Keychain, a session refreshed at the same moment is overwritten in the Keychain by the file's older one. The next launch reads a rotated refresh token and signs the Adventurer out. | Fixed in `e8b6e33` |
| 4 | Medium | `modules/place-search/index.ts:7` | `requireNativeModule('PlaceSearch')` runs on import and the module exists only on Apple platforms, so importing `@/lib/barry` throws anywhere else (app.json keeps an Android block). | Fixed in `700ead8` |
| 5 | Low | `src/lib/texts.ts:56` | The `too_many_contacts` text names only the 5 contacts at a time, but `save_adventure` also refuses an 11th different contact over the Adventure, so an Adventurer with 3 contacts reads an explanation that does not fit. | Fixed in `9a21b34` |
| 6 | Low | `src/lib/barry/phone-contact.ts:50`, `plan.tsx:167` | `slice(0, n)` cuts in UTF-16 units and can leave half an emoji in a contact name or a chosen place name; Postgres counts whole characters. | Fixed in `2c77ead` |
| 7 | Nit | `plan.tsx:32`, `profile/about.tsx`, `profile/car.tsx`, `profile/medical.tsx` | Four screens import `@/lib/barry/limits`, past the client module that AGENTS.md says screens import. | Fixed in `ac83690` |
| 8 | Nit | `src/app/(app)/(tabs)/(adventure)/index.tsx:174` | The live screen fetches `deliveryFailures` again on every new adventure object, including each realtime push and focus reload, even when nothing about failures changed. | Left open: narrowing the dependency changes when the failure list refreshes, which may be intended. |

## 3. Fixes

- `b13cbb2` adds `supabase/migrations/20261030110000_pace_from_sent.sql`, which paces from the previous update's `sent_at`, or for one still waiting from when it is due. `pace.test.sql` gains a case. Needs `/barry-backend-verify`, and `npx supabase db push` once merged.
- `700ead8` loads the place search with `requireOptionalNativeModule`; without the module it finds no places. Needs `/barry-frontend-verify`.
- `cafc8b9` on `main` keeps the last bulletin while its `validUntil` lies ahead when only the SLF fails, and shows a failed load as unavailable; the commit this review made for it was dropped as a duplicate when the branch was rebased. `conditions.test.ts` covers it.
- `e8b6e33` counts writes per key; a read that sees a write landed while it waited answers with that one and drops the file's copy without moving it. `keychain-session.test.ts` checks the Keychain afterwards and fails on the old code. Needs `/barry-frontend-verify`.
- `9a21b34` names both limits in English and German. Needs `/barry-frontend-verify`.
- `ac83690` exports `LIMITS` from `@/lib/barry` and `index.web.ts`. No behaviour changes.
- `2c77ead` adds `clip` to `limits.ts`, pinned in `limits.test.ts`, and uses it for contact names and chosen place names. Needs `/barry-frontend-verify`.
