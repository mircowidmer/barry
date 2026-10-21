# Code quality report (`/barry-assure-code-quality --fix`)

Branch `claude/busy-planck-1swytm` (created from `main`).

## 1. Summary

- **Scope:** 76 app files: `src/**/*.{ts,tsx}` without tests and `database.types.ts`, plus `index.ts` and `app.config.js`. Every file was read in full.
- **The project's own checks** (`npx expo lint`, `npx tsc --noEmit`, `npm test`) were clean before and after: 0 lint problems, 0 type errors, 129 of 129 Jest tests passing.
- **Findings:** 44 in total, 13 certain and 31 likely.
  - Runtime: 27 (floating or misused promises, unchecked indexing, non-null assertions, unparsed route params, an effect with no ignore flag, an index key)
  - Accessibility: 2
  - Performance: 1
  - Maintainability: 14
- **Fixes:** 9 commits fixed 11 certain findings. The other 2 certain findings were skipped (rule 2).
- **The three findings that matter most:**
  1. Route params are cast, not parsed: `plan.tsx:81`, `contacts/edit.tsx:35`, `history/[id].tsx:10`, `reset-password.tsx:15`.
  2. Unhandled rejections in tap handlers: logging out (`profile/index.tsx:153`), opening the legal links (`profile/index.tsx:161-162`, `legal-links.tsx:13,16`), opening Settings (`plan.tsx:173`) and the Account changes (`account.tsx:57,108`).
  3. The rows of `Group` are keyed by index (`grouped-list.tsx:36`). A row that appears or disappears remounts the rows after it, and a focused `InputRow` among them loses its text field.

## 2. Findings

Ranked: runtime, then accessibility, performance and maintainability.

| # | Where | Rule (source) | Code | Better | Certainty | Outcome |
|---|---|---|---|---|---|---|
| 1 | src/lib/barry/client.ts:229 | No non-null assertions (typescript-eslint no-non-null-assertion) | `return parseContact(data!);` | `if (error) return fail(...)` narrows the response union | certain | **fixed** b17147b |
| 2 | src/lib/barry/client.ts:285 | same | `const [result] = data!;` | same | certain | **fixed** b17147b |
| 3 | src/lib/barry/trail-buffer.ts:50 | same | `[adventureId]: batchKeys.at(-1)! }` | take `at(-1)` once; stop when it is undefined | certain | **fixed** 8d64d57 |
| 4 | src/components/ended-adventure-screen.tsx:46 | same | `last={readings.data.at(-1)!}` | `?? null` | certain | **fixed** f30ab4d |
| 5 | src/app/(app)/(tabs)/(adventure)/index.tsx:246 | same | `last={trail.at(-1)!}` | `?? null` | certain | **fixed** 12851b7 |
| 6 | src/app/(app)/(tabs)/(adventure)/index.tsx:276 | same | `newest = fresh.at(-1)!.takenAt;` | check `fresh.at(-1)` | certain | **fixed** 12851b7 |
| 7 | src/app/(app)/(tabs)/contacts/index.tsx:25 | Indexed access is possibly undefined (tsconfig noUncheckedIndexedAccess) | `part[0].toUpperCase()` | `part.charAt(0)` | certain | **fixed** 82bc854 |
| 8 | src/app/(app)/(tabs)/(adventure)/plan.tsx:70 | same | `t.plan.unreachableOne(w.contacts[0].name)` | `names(w.contacts)`, which is the one name | certain | **fixed** 43b2d6f |
| 9 | src/app/(app)/(tabs)/history/index.tsx:142 | same | `const id = current[row];` | test the looked-up id | certain | **fixed** 66e6090 |
| 10 | src/app/(app)/_layout.tsx:27 | Every promise is handled (typescript-eslint no-floating-promises) | `askForNotifications();` | `.catch(() => undefined)`, like lines 23–26 | certain | **fixed** f6165b1 |
| 11 | src/lib/barry/client.ts:404 | same | `supabase.removeChannel(channel);` | `.catch(() => undefined)` | certain | **fixed** 72e6a3f |
| 12 | src/app/(app)/(tabs)/(adventure)/index.tsx:152 | Async work in an effect ignores a late result (react.dev, You Might Not Need an Effect, fetching data) | `barry.deliveryFailures(initial.id).then(setFailures, () => undefined);` | an `ignore` flag set in the cleanup | certain | skipped: rule 2, it changes which answer the screen shows in a race |
| 13 | src/lib/session.tsx:16 | no-floating-promises | `supabase.auth.getSession().then(({ data }) => {` | handle the rejection; today the splash screen would stay up | certain | skipped: rule 2, what to show is a decision |
| 14 | src/app/(app)/(tabs)/profile/index.tsx:153 | No promise where void is expected (no-misused-promises) | `onPress={askToLogOut}` | catch a failed `signOut` and say so | likely | skipped: rule 1 |
| 15 | src/app/(app)/(tabs)/profile/index.tsx:161, 162 | same | `onPress={() => Linking.openURL(`${SITE}/privacy`)}` | catch, or reuse `LegalLinks` | likely | skipped: rule 1 |
| 16 | src/components/legal-links.tsx:13, 16 | no-floating-promises | `onPress={() => Linking.openURL(`${SITE}/privacy`)}` | catch | likely | skipped: rule 1 |
| 17 | src/app/(app)/(tabs)/(adventure)/plan.tsx:173 | same | `if (!granted) await Linking.openSettings();` | catch, so `reload()` still runs | likely | skipped: rule 1 |
| 18 | src/app/(app)/(tabs)/profile/account.tsx:57, 108 | same | `const outcome = await account.changePassword(email, current, next);` | try/finally around `busy`; a thrown error leaves the row busy | likely | skipped: rule 1 |
| 19 | src/app/(app)/_layout.tsx:12, 35 | same | `SplashScreen.preventAutoHideAsync();` | `.catch`; the Expo docs show it unhandled | likely | skipped: rule 1 |
| 20 | src/lib/supabase.ts:38, 40 | same | `supabase.auth.startAutoRefresh();` | `.catch`; the Supabase docs show it unhandled | likely | skipped: rule 1 |
| 21 | src/components/trail-map-view.web.tsx:30 | same | `import('leaflet').then((L) => {` | catch a failed chunk load | likely | skipped: rule 1 |
| 22 | src/lib/trail-map/use-trail-map.ts:36–37 | same | `poll();` | `void`; `load` already catches everything | likely | skipped: rule 1 |
| 23 | src/app/(app)/(tabs)/(adventure)/plan.tsx:81 | Route params are parsed, not cast (Expo Router) | `params.id as AdventureId \| undefined` | accept only a string | likely | skipped: rule 1 |
| 24 | src/app/(app)/(tabs)/contacts/edit.tsx:35 | same | `useLocalSearchParams<{ id?: EmergencyContactId }>()` | same | likely | skipped: rule 1 |
| 25 | src/app/(app)/(tabs)/history/[id].tsx:10 | same | `useLocalSearchParams<{ id: AdventureId }>()` | same | likely | skipped: rule 1 |
| 26 | src/app/(app)/reset-password.tsx:15 | same | `useLocalSearchParams<{ email?: string }>()` | same | likely | skipped: rule 1 |
| 27 | src/components/grouped-list.tsx:36 | Stable key from the data (react.dev, Rendering Lists) | `<View key={i}>` | the key `Children.toArray` gives each row | likely | skipped: rule 2, it changes remounting |
| 28 | src/app/(app)/(tabs)/history/index.tsx:92 | noUncheckedIndexedAccess | `select: !before.has(current[anchor])` | handle an empty list | likely | skipped: rule 2 |
| 29 | src/lib/barry/client.ts:380–381 | no-non-null-assertion | `channel: row.channel!,` | the view's columns are nullable in the types; parse them | likely | skipped: rule 1 |
| 30 | src/lib/wording.ts:34 | same | `parts.find((p) => p.type === type)!.value` | throw a named error | likely | skipped: rule 2, the error message changes |
| 31 | src/lib/supabase.ts:23–24 | same | `process.env.EXPO_PUBLIC_SUPABASE_URL!,` | fail with a message that names the missing variable | likely | skipped: rule 2 |
| 32 | src/lib/barry/client.ts:121, 252, 270 | No unchecked casts (typescript-eslint) | `data as unknown as AdventureWithRelations \| null` | let `ADVENTURE_SELECT` infer the row type | likely | skipped: rule 3 |
| 33 | src/lib/barry/client.ts:331, 346 | No unchecked casts / No dead conditions | `if (data) return { kind: 'refused', refusal: data as Refusal };` | the generated types claim a non-null refusal | likely | skipped: rule 1 |
| 34 | src/lib/barry/check-in-queue.ts:25, adventure-cache.ts:14, trail-buffer.ts:29, 32 | No casts on data from outside (storage) | `JSON.parse(raw) as ...` | parse the stored shape | likely | skipped: rule 1 |
| 35 | src/components/button.tsx:20 | State is announced (reactnative.dev, Accessibility) | `<Pressable accessibilityRole="button" ...>` without `busy` | `accessibilityState={{ busy }}` | likely | skipped: rule 2 |
| 36 | src/components/form.tsx:193 | same | `accessibilityState={{ disabled, busy: disabled }}` | `busy` only while a Check-in runs | likely | skipped: rule 1 |
| 37 | src/components/form.tsx:171 | Animations on the native thread (reactnative.dev, Performance) | `useNativeDriver: false` | animate `scaleX` with the native driver | likely | skipped: rule 2 |
| 38 | src/lib/delete-account.ts:13, delete-adventure.ts:10, 30, log-out.ts:6, remove-contact.ts:8 | One responsibility per module / no duplication | five copies of the destructive-confirmation `Alert` | one shared `confirmDestructive` | likely | skipped: rule 1 |
| 39 | src/app/(app)/(tabs)/profile/index.tsx:161–162 | same | the privacy and terms URLs built twice | a shared link helper next to `SITE` | likely | skipped: rule 1 |
| 40 | src/app/(app)/_layout.web.tsx:7 | Texts live in the texts modules (AGENTS.md) | `<ThemedText>Barry runs on iPhone.</ThemedText>` | `siteText` | likely | skipped: rule 2 |
| 41 | src/app/(app)/(tabs)/contacts/index.tsx:84 | Names say what a thing is | the prop `reach` shadows the module's `reach()` | rename the prop | likely | skipped: rule 1 |
| 42 | src/lib/texts.ts:110, 355 | No unchecked casts | `({ ... } as Record<string, string>)[f.reason]` | a typed map of reasons | likely | skipped: rule 1 |
| 43 | src/lib/site-language.ts:33 | No dead code | `type Position = LastKnown;` | use `LastKnown` | likely | skipped: rule 1 |
| 44 | src/lib/barry/index.web.ts:8 | Platform files stay in step | `export const barry = {} as Barry;` | the cast hides that every method is missing on the web | likely | skipped: rule 1, it is a deliberate stand-in (AGENTS.md) |

**Tool messages that reading cleared.** These are not counted above:

- `no-floating-promises` and `no-misused-promises` flag `reload()` from `useLoad`, `syncAlarms()`, `load()` in `useLiveTrail`, `remove()` and the `onPress` handlers that catch everything. Their promises cannot reject.
- `prefer-nullish-coalescing` at `button.tsx:23` and `button.ios.tsx:22`: `disabled || busy` combines two booleans, and `??` would be wrong.
- `no-unnecessary-condition` at `language.ts:8,11`, `site-language.ts:12`, `trail-buffer.ts:51,82` and `history/index.tsx:74`: the checks are real and only look dead without `noUncheckedIndexedAccess`.
- `no-unnecessary-condition` at `client.ts:140,286,331,346`: the generated types call the refusals non-null, but the RPCs return null.

## 3. Configuration proposals (not applied)

| Proposal | Errors today | Covered by the findings above |
|---|---|---|
| `noUncheckedIndexedAccess` | 12 (5 now fixed) | rest in #28 and in `trail-buffer.ts:44, 89`, `client.ts:286–287` |
| `exactOptionalPropertyTypes` | 7 | none; the optional props would need `\| undefined` |
| `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters` | 0 each | could be switched on today |
| `@typescript-eslint/no-misused-promises` | 41 | mostly handlers that cannot reject |
| `@typescript-eslint/no-floating-promises` | 21 (2 fixed) | #10–#22 |
| `@typescript-eslint/no-non-null-assertion` | 11 (6 fixed) | #29–#31 |
| `@typescript-eslint/no-unnecessary-condition` | 10 | false positives without `noUncheckedIndexedAccess` |
| `@typescript-eslint/prefer-nullish-coalescing` | 2 | both wrong for booleans |
| `react-hooks` recommended-latest (v7.1.1) | 0 | none: the React Compiler skips no component |

## 4. Project rules that override a best practice

- The ruleset says *No unchecked casts*, but AGENTS.md:89 makes `index.web.ts` "an empty stand-in because the web build has no app". The cast is the design, so it is not counted as a defect; #44 reports it as likely only.
- None of the project's rules contradicts any other rule here.

## 5. Rules with no finding

Rules of Hooks, purity in render, no mutation of props or state, components defined at module level, complete dependency arrays, derived state kept in render, state reset with a `key`, effect cleanups, the minimum of state, compiler bailouts, virtualized lists, light list items, static styles, `console.*`, image sizes, touch targets, text scaling, colour as the only carrier, routes only in `src/app`, a single navigation library, typed hrefs, screen options, `Platform` usage, the path alias, the glossary terms, exhaustive unions, `import type`, `only-throw-error`, and comments that say why.

## Commits, in order

1. b17147b saveContact and saveAdventure narrow the Supabase answer by its error instead of asserting the data is there
2. 8d64d57 The Trail buffer stops at an empty batch by its last slot, so recording the sent slot needs no assertion
3. f30ab4d The ended Adventure's map takes the last reading without asserting it is there
4. 12851b7 The Live Adventure takes the newest Trail reading without asserting it is there
5. 82bc854 The contact initials take each name part's first character with charAt, which the types know is a string
6. 43b2d6f The Start warning about one unreachable contact names it through names(), like the warning about many
7. 66e6090 A tap on the History's selection circles ignores a tap beside every row by the missing id, not by the index
8. f6165b1 The foreground catch-up drops a failed notification permission request, like the other work it starts
9. 72e6a3f watchAdventure's cleanup drops a failed channel removal instead of leaving its promise floating

**Skipped:** #12–#44, each with the rule named in its row.

**Not yet checked in the iOS Simulator** (`/barry-verify`): the screen and `src/lib/barry` commits 1–9. This environment is Linux, so the Simulator is not available.
