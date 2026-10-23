# Code quality report (`/barry-assure-code-quality --fix`)

Branch `maintenance-2026-10-23` (created from `main`), the first step of the maintenance pass of 23 October 2026.

## 1. Summary

- **Scope:** 89 app files: `src/**/*.{ts,tsx}` without tests and `database.types.ts`, plus `index.ts` and `app.config.js`. Every file was read in full.
- **The project's own checks** (`npx expo lint`, `npx tsc --noEmit`, `npm test`) were clean before and after every commit: 0 lint problems, 0 type errors, 163 of 163 Jest tests passing.
- **Stricter compiler probe** (`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`; `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are already on): 0 errors in the app code.
- **Type-aware lint probe** (`react-hooks` `recommended-latest`, typescript-eslint rules marked *Tool*): 21 messages in the app code, 7 of them real findings, the rest cleared by reading (see the end of section 2).
- **Findings:** 35 in total, 7 certain and 28 likely.
  - Runtime: 25 (casts and assertions on data from outside, dead or hidden conditions, two effects without an ignore flag, an index key, a clock read in render)
  - Accessibility: 2
  - Performance: 3
  - Maintainability: 5
- **Fixes:** 5 commits fixed 5 certain findings. The other 2 certain findings were skipped (rule 2), as on 21 October.
- **Since the review of 21 October 2026:** its route params, the shared destructive confirmation, the shared legal links, the floating promises in `_layout.tsx`, `client.ts`, `plan.tsx`, `account.tsx`, `legal-links.tsx` and `supabase.ts`, and the non-null assertions in `client.ts`, `trail-buffer.ts` and the two screens are all fixed. The findings it left open that still stand are repeated below with today's line numbers.
- **The three findings that matter most:**
  1. The delivery failures and the Trail status are loaded by effects with no ignore flag (`(adventure)/index.tsx:153`, `use-trail-status.ts:11`): a slow older answer can overwrite a newer one.
  2. The generated types mark the refusal every command returns and the columns of `delivery_failures` as non-null, so `client.ts` either asserts (`row.channel!`) or tests what the types call impossible (`data === null`). Regenerating with nullable function returns and view columns would make both honest.
  3. The History renders a growing list with `map` inside a `ScrollView` (`history/index.tsx:607`); the drag selection measures each row, so a `FlatList` is a design change, not a swap.

## 2. Findings

Ranked: runtime, then accessibility, performance and maintainability. Lines are those before the fixes.

| # | Where | Rule (source) | Code | Better | Certainty | Outcome |
|---|---|---|---|---|---|---|
| 1 | src/app/(app)/(tabs)/(adventure)/index.tsx:153 | Async work in an effect ignores a late result (react.dev, You Might Not Need an Effect, fetching data) | `barry.deliveryFailures(initial.id).then(setFailures, () => undefined);` | an `ignore` flag set in the cleanup | certain | skipped: rule 2, it changes which answer the screen shows in a race (as on 21 Oct) |
| 2 | src/hooks/use-trail-status.ts:11 | same | `barry.trail.status().then(setStatus, () => undefined);` | a request counter as in `useLoad`, so only the newest status lands | certain | skipped: rule 2, same reason |
| 3 | src/lib/barry/client.ts:387, 402, 420 | No unchecked casts (typescript-eslint no-explicit-any, no-unnecessary-type-assertion) | `refusal: data as Refusal`, `adventure: adventure as EndedAdventure` | the RPC's type is already `Refusal`; `adventure?.stage === 'ended'` already narrows | certain | **fixed** 31eef75 |
| 4 | src/lib/barry/phone-contact.ts:41 | No non-null assertions (typescript-eslint no-non-null-assertion) | `fullPhoneNumber(p.number!, p.region ?? region)` | filter with a type guard that keeps `number: string` | certain | **fixed** 3570967 |
| 5 | src/lib/language.ts:8, 11 | No dead conditions (typescript-eslint no-unnecessary-condition) | `getLocales()[0]?.languageCode`, `useLocales()[0]?.languageCode` | `expo-localization` types both as a non-empty tuple, so `[0]` is a `Locale` even with `noUncheckedIndexedAccess` | certain | **fixed** 132e8c2 |
| 6 | src/lib/barry/index.ts:163 | same | `getLocales()[0]?.regionCode ?? null` | same | certain | **fixed** 36bbfec |
| 7 | src/components/trail-map-view.tsx:17 | Indexed access is possibly undefined (tsconfig noUncheckedIndexedAccess) | `` const [r, g, b] = [1, 3, 5].map(...); return `rgba(${r},${g},${b},...)` `` | `r`, `g`, `b` are `number \| undefined` and reach the string unchecked; read each channel by its slice | certain | **fixed** 1504c74 |
| 8 | src/lib/wording.ts:38 | No non-null assertions | `parts.find((p) => p.type === type)!.value` | throw a named error | likely | skipped: rule 2, the error message changes (as on 21 Oct) |
| 9 | src/lib/supabase.ts:24, 25, 27 | same | `process.env.EXPO_PUBLIC_SUPABASE_URL!` | fail with a message that names the missing variable | likely | skipped: rule 2 (as on 21 Oct) |
| 10 | src/lib/barry/client.ts:436, 437 | same | `channel: row.channel!, address: row.to_address!` | the view's columns are nullable in the generated types; parse them, or generate the view as not null | likely | skipped: rule 1 |
| 11 | src/lib/barry/client.ts:164, 338 | No dead conditions | `data === null ? 'accepted' : 'refused'`, `if (result.refusal)` | the generated types call every command's refusal non-null, but the RPCs return null on success; generate them nullable | likely | skipped: rule 3, the fix is in the generated file |
| 12 | src/lib/barry/client.ts:145, 307, 320 | No unchecked casts on data from outside | `data as unknown as AdventureWithRelations \| null` | let `ADVENTURE_SELECT` infer the embedded row type | likely | skipped: rule 1 |
| 13 | src/lib/barry/client.ts:77 | same | `const orNull = <T,>(value: T \| null \| undefined): T => (value ?? null) as T;` | nullable argument types in the generated functions | likely | skipped: rule 3 |
| 14 | src/lib/barry/client.ts:434 | same | `message: row.kind as DeliveryFailure['message']` | narrow `kind` against the five kinds | likely | skipped: rule 1 |
| 15 | src/lib/barry/check-in-queue.ts:25, adventure-cache.ts:14, trail-buffer.ts:34, 37 | No casts on data from outside (storage) | `JSON.parse(raw) as ...` | parse the stored shape | likely | skipped: rule 1 |
| 16 | src/lib/wording.ts:9, 18, 50 | Indexed access is possibly undefined | `` `${ENGLISH_WEEKDAYS[at.getDay()]} ...` `` | `getDay()` is 0 to 6, but the types do not know; a `?? ''` would hide it, a lookup table keyed by a literal union would not | likely | skipped: rule 1 |
| 17 | src/lib/trail-map/fetch.ts:45 | No unchecked casts | `trail: trail as TrailPoint[]` after `trail.some((t) => t === null)` | build the array in a loop that returns null on the first bad point | likely | skipped: rule 1 |
| 18 | src/app/(app)/(tabs)/history/index.tsx:74 | No dead conditions | `rows.current.findIndex((r, i) => r && ...)` | `rows.current` is sparse, so `r` is needed; type it `({ top; bottom } \| undefined)[]` so the check is not dead | likely | skipped: rule 1 |
| 19 | src/lib/barry/index.ts:67 | same | `contact.name?.trim() \|\| parts.join(' ')` | `expo-contacts` types `name: string`; the comment says the picker does not always fill it, so either the type or the chain is wrong | likely | skipped: rule 1 |
| 20 | src/lib/site-language.ts:12 | same | `navigator.languages?.length` | the DOM types make it non-null; drop the chain or say which browser lacks it | likely | skipped: rule 1 |
| 21 | src/app/(app)/(tabs)/(adventure)/plan.tsx:240, 305 | Components are pure during render (react.dev, Rules of React) | `minimumDate={new Date()}` | read the clock once with `useState(() => new Date())` or from `useNow()` | likely | skipped: rule 2, it changes when the picker's floor moves |
| 22 | src/app/(app)/(tabs)/(adventure)/index.tsx:246 | Stable key from the data (react.dev, Rendering Lists) | `failures.map((f, i) => <ThemedText key={i}>` | the view has no id to select; the list only grows, so the index is safe today | likely | skipped: rule 1 |
| 23 | src/components/form.tsx:78 | No unchecked casts | `useImperativeHandle(ref, () => scroll.current as ScrollViewInstance, [])` | a callback ref that serves both the inner ref and the prop | likely | skipped: rule 1 |
| 24 | src/lib/storage.web.ts:1 | Platform files stay in step (reactnative.dev, Platform-specific code) | `storage: Storage \| undefined` against `storage.ts`'s `Storage` | the web build needs `undefined` for the Node export; a shared `Pick<Storage, ...> \| undefined` type would make `supabase.ts` honest on both | likely | skipped: rule 1 |
| 25 | src/lib/barry/index.web.ts:8 | same | `export const barry = {} as Barry;` | the cast hides that every method is missing on the web | likely | skipped: rule 1, it is the deliberate stand-in AGENTS.md names |
| 26 | src/components/button.tsx:20 | State is announced (reactnative.dev, Accessibility) | `<Pressable accessibilityRole="button" ...>` without `busy` | `accessibilityState={{ busy, disabled }}` | likely | skipped: rule 2 |
| 27 | src/components/form.tsx:220 | same | `accessibilityState={{ disabled, busy: disabled }}` | `busy` only while a Check-in runs | likely | skipped: rule 1 |
| 28 | src/app/(app)/(tabs)/history/index.tsx:607 | Long or growing lists are virtualized (reactnative.dev, FlatList) | `ended.map((a, i) => ...)` inside `Screen`'s `ScrollView` | a `FlatList` with `keyExtractor`; the drag selection measures rows by `onLayout`, so it needs a redesign | likely | skipped: rule 1 |
| 29 | src/components/form.tsx:198 | Animations on the native thread (reactnative.dev, Performance) | `useNativeDriver: false` | animate `scaleX` with the native driver | likely | skipped: rule 2 |
| 30 | src/components/button.tsx:32, form.tsx:231, swipe-to-delete.tsx:63, done-seal.tsx:28 | Styles are static where they can be | `style={{ color, fontWeight: 600 }}` | the weight and size in `StyleSheet.create`, only the colour inline | likely | skipped: rule 1, the compiler memoizes the object |
| 31 | src/lib/barry/client.ts:79, src/app/(app)/(tabs)/history/index.tsx:18 | One responsibility per module | two copies of `isInProgress` | export the module's one from `@/lib/barry` | likely | skipped: rule 1 |
| 32 | src/lib/texts.ts:110, 361 | No unchecked casts | `({ ... } as Record<string, string>)[f.reason]` | a typed map of reasons | likely | skipped: rule 1 |
| 33 | src/lib/site-language.ts:33 | No dead code | `type Position = LastKnown;` | use `LastKnown` | likely | skipped: rule 1 |
| 34 | src/app/(app)/_layout.web.tsx:7 | Texts live in the texts modules (AGENTS.md) | `<ThemedText>Barry runs on iPhone.</ThemedText>` | `siteText` | likely | skipped: rule 2 |
| 35 | src/app/(app)/(tabs)/contacts/index.tsx:141 | Names say what a thing is | the prop `reach` shadows the module's `reach()` | rename the prop | likely | skipped: rule 1 |

**Tool messages that reading cleared.** These are not counted above:

- `prefer-nullish-coalescing` at `button.tsx:23` and `button.ios.tsx:22`: `disabled || busy` combines two booleans, and `??` would be wrong. At `phone-contact.ts:43` the `||` chain skips an empty name on purpose.
- `no-unnecessary-condition` at `client.ts:387, 402`: `if (data)` is right; the types are wrong (finding 11).

The 21 October report cleared `language.ts:8, 11` as a probe artefact. It is not: `getLocales()` and `useLocales()` return a non-empty tuple, so the chains were dead with `noUncheckedIndexedAccess` on too (findings 5 and 6).

## 3. Configuration proposals (not applied)

| Proposal | Errors today in the app code | Covered by the findings above |
|---|---|---|
| `@typescript-eslint/no-non-null-assertion` | 6 after the fixes (`client.ts` 2, `supabase.ts` 3, `wording.ts` 1) | findings 8, 9, 10 |
| `@typescript-eslint/no-unnecessary-condition` | 7 after the fixes: 4 in `client.ts` from the generated types, 3 defensive chains | findings 11, 18, 19, 20 |
| `@typescript-eslint/prefer-nullish-coalescing` | 4, all false positives | needs `ignoreBooleanCoercion: true` and `ignorePrimitives: { string: true }` to be useful here |
| `@typescript-eslint/no-explicit-any`, `switch-exhaustiveness-check`, `consistent-type-imports`, `only-throw-error` | 0 | |
| `react-hooks` `recommended-latest` (v7.1.1 is installed) | 0 | the project's `eslint-config-expo` already carries the compiler rules |
| `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters` | 0 | |
| Regenerate `database.types.ts` with nullable function returns and view columns | | would retire findings 10, 11, 13 |

## 4. Project rules that override a best practice

| Project rule | Where | Overrides |
|---|---|---|
| "Constants that are implementation choices stay in the code next to what they protect, with a test that pins them" | AGENTS.md, Conventions | No dead code: exports used only by their test (`MOBILE_LABELS`, `SLOT_MS`, `slotKey`) are not dead |
| "`index.web.ts` is an empty stand-in because the web build has no app" | AGENTS.md, The client module | Platform files stay in step, for that one file (finding 25 stays listed) |
| Existing `useMemo`, `useCallback` and `React.memo` stay under the React Compiler | this skill, With the React Compiler on | the `useCallback` in `(adventure)/index.tsx:140`, `use-discard-guard.ts`, `use-load.ts` and `use-trail-status.ts` are not findings |
| Zero new comments by default; a comment only for a non-obvious why | the user's CLAUDE.md | Comments say why, not what: the codebase's comments are all whys, none was touched |

## 5. Rules with no finding

No `any`; unions handled exhaustively; type-only imports marked; defaults use `??`; every promise awaited, returned or caught; no promise where void is expected; only `Error` thrown and `catch` narrows `unknown`; every empty `catch` has its why beside it; props, state and hook arguments never mutated; hooks unconditional at the top level; components at module level; dependency arrays complete; derived values live in render; state reset by `key` or adjusted during render (`LiveAdventure`, `ProfileForm`); every subscription, timer and listener removed in cleanup; no `console.*`; images at their size; every pressable has a role and a name; hints on non-obvious results; touch targets at 44 points; text scales; colour never the only carrier; only routes in `src/app`; typed hrefs, no `as Href`; route params parsed through `useStringParam`; platform differences by `Platform.OS` or platform files with the same exports; imports through `@/`; no commented-out or unreachable code; magic numbers named next to what they protect; formatting consistent within each file.

## Commits

1. 31eef75 Start, moveDeadline and checkIn return the refusal and the ended Adventure as the types already name them, without a cast
2. 3570967 copyPhoneContact keeps the numbers that are filled in through a type guard, so passing one on needs no assertion
3. 132e8c2 The app language reads the phone's first locale without an optional chain, since expo-localization promises at least one
4. 36bbfec The phone's region for numbers without a country code reads the first locale without an optional chain, since expo-localization promises at least one
5. 1504c74 The translucent accuracy circle reads each colour channel by its own slice, so no possibly undefined value reaches the rgba string

**Skipped findings:** 1 and 2 (rule 2); 8, 9, 21, 26, 29, 34 (rule 2); 11 and 13 (rule 3); every other likely finding (rule 1).

**Commits the project wants proven in the app:** all five touch `src/lib/barry` or a component, so `/barry-frontend-verify` covers them; none changes what the screens show. The maintenance pass runs it as its last step.
