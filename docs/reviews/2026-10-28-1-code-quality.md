# Code quality report (`/barry-assure-code-quality --fix`)

Branch `maintenance-2026-10-28` (created from `main`), the first step of the maintenance pass of 28 October 2026.

## 1. Summary

- **Scope:** the app files, `src/**/*.{ts,tsx}` without tests and `database.types.ts`, plus `index.ts` and `app.config.js`. The 41 files changed since the pass of 23 October (the captcha, the pin picker, the place suggestions, the Keychain session, sign-in and Check Your Inbox, the confirmation page, the Plan sheet's destination) were read in full. For the unchanged files, each finding the 23 October report left open was checked against today's code; those that still stand are listed below with today's line numbers.
- **The project's own checks** (`npx expo lint`, `npx tsc --noEmit`, `npm test`): clean. 0 lint problems, 0 type errors, 193 of 193 Jest tests passing.
- **Stricter compiler probe** (`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`; `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on already): 0 errors in the app code.
- **Type-aware lint probe** (`react-hooks` `recommended-latest` 7.1.1, the typescript-eslint rules marked *Tool*): 8 messages, all cleared by reading or already listed (end of section 2).
- **Findings:** 33, 2 certain and 31 likely. Runtime 19, accessibility 3, performance 3, maintainability 8. 7 are new since 23 October.
- **Fixes:** none. The two certain findings change which answer a screen shows in a race (rule 2), as on 21 and 23 October.
- **Since 23 October:** the `wording.ts` and `supabase.ts` assertions, the `channel!` and `address!` assertions and the `as unknown as` casts in `client.ts`, the `row.kind` cast, and the index key on the delivery failures are gone.
- **The three findings that matter most:**
  1. The delivery failures and the Trail status are still loaded with no ignore flag (`(adventure)/index.tsx:164`, `use-trail-status.ts:11`).
  2. Check Your Inbox re-subscribes to `AppState` on every render, because its effect has no dependency array so it can read the latest `busy` (`sign-in.tsx:142`). React 19's `useEffectEvent` would let the subscription live once.
  3. The Adjust button on the destination preview is 34 points high (`destination-map.tsx:85`), below the 44 the rest of the app keeps.

## 2. Findings

Ranked: runtime, then accessibility, performance and maintainability. **New** marks a finding first raised today.

| # | Where | Rule (source) | Code | Better | Certainty | Outcome |
|---|---|---|---|---|---|---|
| 1 | src/app/(app)/(tabs)/(adventure)/index.tsx:164 | Async work in an effect ignores a late result (react.dev, You Might Not Need an Effect) | `barry.deliveryFailures(initial.id).then(setFailures, () => undefined);` | an `ignore` flag set in the cleanup | certain | skipped: rule 2 |
| 2 | src/hooks/use-trail-status.ts:11 | same | `barry.trail.status().then(setStatus, () => undefined);` | a request counter as in `useLoad` | certain | skipped: rule 2 |
| 3 | src/app/(app)/sign-in.tsx:142 | **New.** Every subscription an effect starts is removed, and effects sync with something outside React (react.dev, Separating Events from Effects) | `useEffect(() => { const subscription = AppState.addEventListener(...` with no dependency array | read `busy` and `captcha` through `useEffectEvent`, and subscribe once with `[]` | likely | skipped: rule 1 |
| 4 | src/components/destination-map.tsx:57 | **New.** Components are pure; no `ref.current` reads in render, effects not used to track mount (react.dev, Rules of React) | `const mounted = useRef(false); useEffect(() => { if (!mounted.current) { ...` | the comment names a real native constraint; in Strict Mode the double effect run moves the map on mount anyway, so the guard does not hold in development | likely | skipped: rule 1 |
| 5 | src/app/(app)/(tabs)/(adventure)/plan.tsx:298 | **New.** Stable, unique key from the data (react.dev, Rendering Lists) | `` key={`${place.point.latitude},${place.point.longitude}`} `` | two places Apple Maps returns at one coordinate (a building and a business in it) share a key; add the name | likely | skipped: rule 1 |
| 6 | src/lib/barry/client.ts:162, 353 | No dead conditions (typescript-eslint no-unnecessary-condition) | `data === null ? 'accepted' : 'refused'`, `if (data)` | generate the commands' refusal as nullable | likely | skipped: rule 3, generated file |
| 7 | src/lib/barry/client.ts:75 | No unchecked casts | `const orNull = <T,>(value: T \| null \| undefined): T => (value ?? null) as T;` | nullable argument types in the generated functions | likely | skipped: rule 3 |
| 8 | src/lib/barry/check-in-queue.ts:25, adventure-cache.ts:14, trail-buffer.ts:34 | No casts on data from outside (storage) | `JSON.parse(raw) as ...` | parse the stored shape | likely | skipped: rule 1 |
| 9 | src/lib/wording.ts:9, 18, 25 | Indexed access is possibly undefined | `` `${ENGLISH_WEEKDAYS[at.getDay()]} ...` `` | a lookup keyed by a literal union | likely | skipped: rule 1 |
| 10 | src/lib/trail-map/fetch.ts:45 | No unchecked casts | `trail: trail as TrailPoint[]` | build the array in a loop that returns null on the first bad point | likely | skipped: rule 1 |
| 11 | src/app/(app)/(tabs)/history/index.tsx:91 | No dead conditions | `rows.current.findIndex((r, i) => r && ...)` | type the sparse array with `\| undefined` | likely | skipped: rule 1 |
| 12 | src/lib/barry/index.ts:72 | same (probe) | `contact.name?.trim() \|\| parts.join(' ')` | `expo-contacts` types `name: string`; the comment says the picker does not always fill it, so the type or the chain is wrong | likely | skipped: rule 1 |
| 13 | src/lib/site-language.ts:12 | same (probe) | `navigator.languages?.length` | drop the chain or name the browser that lacks it | likely | skipped: rule 1 |
| 14 | src/app/(app)/(tabs)/(adventure)/plan.tsx:363 | Components are pure during render | `minimumDate={new Date()}` | read the clock once or from `useNow()` | likely | skipped: rule 2 |
| 15 | src/components/form.tsx:105 | No unchecked casts | `useImperativeHandle(ref, () => scroll.current as ScrollViewInstance, [])` | a callback ref | likely | skipped: rule 1 |
| 16 | src/lib/storage.web.ts:2 | Platform files stay in step | `storage: Storage \| undefined` against `storage.ts`'s `Storage`; the same shape now makes `supabase.ts:38` `authStorage &&` look always true to the probe | a shared `... \| undefined` type | likely | skipped: rule 1 |
| 17 | src/lib/barry/index.web.ts:9 | same | `export const barry = {} as Barry;` | the deliberate stand-in AGENTS.md names | likely | skipped: rule 1 |
| 18 | src/lib/texts.ts:140, 441 | No unchecked casts | `({ ... } as Record<string, string>)[f.reason]` | a typed map of reasons | likely | skipped: rule 1 |
| 19 | src/components/pin-picker.tsx:37 | **New.** An effect or handler's async work keeps its state honest (react.dev) | `setLocating(true); const here = await barry.currentPosition(); setLocating(false);` | `readPosition` never rejects today, so this holds; a `try/finally` would keep it so if it ever did | likely | skipped: rule 1 |
| 20 | src/components/captcha.tsx:9 | **New.** Defaults use `??` (probe) | `process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY \|\| null` | the `\|\|` is right (an empty key means none) but, unlike `phone-contact.ts:48`, says nothing about it | likely | skipped: rule 1 |
| 21 | src/app/(app)/_layout.web.tsx:7 | Texts live in the texts modules (AGENTS.md) | `<ThemedText>Barry runs on iPhone.</ThemedText>` | `siteText` | likely | skipped: rule 2 |
| 22 | src/components/destination-map.tsx:85 | **New.** Touch targets are at least 44 points (reactnative.dev, Accessibility) | `adjustTarget: { height: 34, ... }` | `hitSlop` of 5 points | likely | skipped: rule 2, it changes where a tap lands |
| 23 | src/components/button.tsx:20 | State is announced | `<Pressable accessibilityRole="button" ...>` without `busy` | `accessibilityState={{ busy, disabled }}` | likely | skipped: rule 2 |
| 24 | src/components/form.tsx:255 | same | `accessibilityState={{ disabled, busy: disabled }}` | `busy` only while a Check-in runs | likely | skipped: rule 1 |
| 26 | src/app/(app)/(tabs)/history/index.tsx:383 | Long or growing lists are virtualized | `days.map(...)` inside `Screen`'s `ScrollView` | a `SectionList`; the drag selection measures rows, so it needs a redesign | likely | skipped: rule 1 |
| 27 | src/components/form.tsx:238 | Animations on the native thread | `useNativeDriver: false` | animate `scaleX` with the native driver | likely | skipped: rule 2 |
| 28 | src/components/button.tsx, form.tsx, swipe-to-delete.tsx, done-seal.tsx | Styles are static where they can be | `style={{ color, fontWeight: 600 }}` | the weight in `StyleSheet.create` | likely | skipped: rule 1 |
| 29 | src/lib/barry/client.ts:77, src/app/(app)/(tabs)/history/index.tsx:23 | One responsibility per module | two copies of `isInProgress` | export the module's one | likely | skipped: rule 1 |
| 30 | src/app/(app)/(tabs)/(adventure)/plan.tsx:64, src/components/profile-edit.tsx:17 | same | two copies of `orNull` for trimmed text | one helper | likely | skipped: rule 1 |
| 31 | src/lib/site-language.ts:33 | No dead code | `type Position = LastKnown;` | use `LastKnown` | likely | skipped: rule 1 |
| 32 | src/app/(app)/(tabs)/contacts/index.tsx:142 | Names say what a thing is | the prop `reach` shadows the module's `reach()` | rename the prop | likely | skipped: rule 1 |
| 33 | src/app/(app)/sign-in.tsx:152, 168, 172 | **New.** Derived values computed once | `const counting = secondsLeft > 0;` then `secondsLeft > 0` twice more | use `counting` | likely | skipped: rule 1 |
| 34 | src/lib/barry/index.ts:16 | Imports use the project's path alias | `import { searchPlaces } from '../../../modules/place-search';` | `@/*` maps only `src/`; an alias for `modules/` would need a config change | likely | skipped: rule 3 |

**Probe messages that reading cleared:** `prefer-nullish-coalescing` at `button.tsx:23` and `button.ios.tsx:33` (`disabled || busy` combines two booleans) and the two at `phone-contact.ts:48` (the `||` chain skips empty names on purpose, and says so). `no-unnecessary-condition` at `supabase.ts:38` is finding 16, at `index.ts:72` finding 12, at `site-language.ts:12` finding 13. `captcha.tsx:9` is finding 20.

## 3. Configuration proposals (not applied)

| Proposal | Errors today in the app code | Covered by |
|---|---|---|
| `@typescript-eslint/no-unnecessary-condition` | 3 | findings 12, 13, 16 |
| `@typescript-eslint/prefer-nullish-coalescing` | 5, all false positives | useful only with `ignoreBooleanCoercion` and `ignorePrimitives: { string: true }` |
| `@typescript-eslint/no-non-null-assertion` | 0 (was 6 on 23 October) | can be turned on today |
| `no-explicit-any`, `switch-exhaustiveness-check`, `consistent-type-imports`, `only-throw-error`, `react-hooks` `recommended-latest` | 0 | |
| The five stricter compiler flags | 0 | |
| Regenerate `database.types.ts` with nullable function returns | | findings 6, 7 |

## 4. Project rules that override a best practice

| Project rule | Where | Overrides |
|---|---|---|
| "Constants that are implementation choices stay in the code next to what they protect, with a test that pins them" | AGENTS.md, Conventions | No dead code: exports used only by their test are not dead |
| "`index.web.ts` is an empty stand-in because the web build has no app" | AGENTS.md, The client module | Platform files stay in step, for that one file (finding 17 stays listed) |
| Existing `useMemo`, `useCallback` and `React.memo` stay under the React Compiler | this skill | none of them is a finding |

## 5. Rules with no finding

No `any`; no non-null assertions; unions handled exhaustively; type-only imports marked; every promise awaited, returned or caught; no promise where void is expected; only `Error` thrown; every empty `catch` has its why; props and state never mutated; hooks unconditional; components at module level; dependency arrays complete; state reset by `key` (`PinPicker`'s content, the captcha's `WebView`); every timer and listener removed in cleanup (`usePlaceSuggestions`, the resend countdown); no `console.*`; text scales; colour never the only carrier; only routes in `src/app`; typed hrefs; route params parsed; magic numbers named (`SUGGEST_DELAY_MS`, `MIN_LETTERS`, `RESEND_AFTER_SECONDS`, `PIN`, `STEM`); formatting consistent within each file.

## Commits

None. **Skipped:** 1, 2, 14, 21, 22, 23, 27 (rule 2); 6, 7, 34 (rule 3); every other likely finding (rule 1).

**Commits the project wants proven in the app:** none.
