# Code quality report (`/barry-assure-code-quality --fix`)

Branch `claude/barry-maintenance-27f3d4`, the first step of the maintenance pass of 30 October 2026.

## 1. Summary

- **Scope:** the app files, `src/**/*.{ts,tsx}` without tests and `database.types.ts`, plus `index.ts` and `app.config.js`. The 29 files changed since the pass of 28 October (the Conditions with their forecast, avalanche bulletin and daylight, the Keychain session, the limits and `clip`, the live Adventure screen, the Plan sheet, Watching, Contacts, Profile, Sign-in, the wording) were read in full. For the unchanged files, each finding the 28 October report left open was checked against today's code; those that still stand are listed below with today's line numbers.
- **The project's own checks** (`npx expo lint`, `npx tsc --noEmit`, `npm test`): clean. 0 lint problems, 0 type errors, 241 of 241 Jest tests passing in 32 suites.
- **Stricter compiler probe** (`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`; `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on already): 0 errors.
- **Type-aware lint probe** (`react-hooks` `recommended-latest` 7.1.1, the typescript-eslint rules marked *Tool*): 14 messages, 0 from the `react-hooks` rules. 4 cleared by reading, the other 10 are findings 11, 12, 13, 16, 17, 20 and 24 (end of section 2).
- **Findings:** 41, 5 certain and 36 likely. Runtime 25, accessibility 2, performance 4, maintainability 10. 14 are new since 28 October, most in the Conditions code that landed since.
- **Fixes:** the 5 certain findings, one commit each (section 2 and **Commits**). Every other finding is the author's call, or changes behaviour, or needs a configuration change.
- **Since 28 October:** findings 1, 2 and 22 of that report were fixed after it (acd37e1, e0e43e5, 6ce0772). `done-seal.tsx` is gone. `no-non-null-assertion` could have been turned on then with 0 errors; the Conditions and the wording brought 5 back.
- **The three findings that matter most:**
  1. `LiveAdventure` mirrors the stage into a ref through an effect so a stable callback can compare against it, and resets `movedFrom` in render as well; storing the move together with the stage it was made in would derive the same in render with no ref and no effect (finding 3).
  2. `ConditionsAt` disables `exhaustive-deps` on the `useMemo` of the forecast view so the hours recompute once an hour instead of once a tick; the reason is identity, not ordering, so the rule asks for a dependency list that says what the memo reads (finding 4).
  3. The Open-Meteo and SLF responses and the kept Conditions are cast, not parsed (`json as OpenMeteo`, `parsed as Kept[]`, `as { features?: Feature[] }`); a changed feed shape throws inside the parser and surfaces as "stale" or "unavailable" rather than as the bug it is (finding 9).

## 2. Findings

Ranked: runtime, then accessibility, performance and maintainability. **New** marks a finding first raised today; the others carry the number they had on 28 October in brackets.

| # | Where | Rule (source) | Code | Better | Certainty | Outcome |
|---|---|---|---|---|---|---|
| 1 | src/app/(app)/sign-in.tsx:143 | [3] Every subscription an effect starts is removed, and effects sync with something outside React (react.dev, Separating Events from Effects) | `useEffect(() => { const subscription = AppState.addEventListener(...` with no dependency array | read `busy` and `captcha` through `useEffectEvent` and subscribe once with `[]` | likely | skipped: rule 1 |
| 2 | src/components/destination-map.tsx:58 | [4] Components are pure; no `ref.current` reads in render, effects not used to track mount (react.dev, Rules of React) | `const mounted = useRef(false); useEffect(() => { if (!mounted.current) {` | the comment names a real native constraint; in Strict Mode the double effect run moves the map on mount anyway | likely | skipped: rule 1 |
| 3 | src/app/(app)/(tabs)/(adventure)/index.tsx:149, 164 | **New.** Derived values live in render; state holds the minimum (react.dev, You Might Not Need an Effect) | `const stage = useRef<Adventure['stage']>(initial.stage); useEffect(() => { stage.current = adventure.stage; }, [adventure]);` and `if (initial.stage !== adventure.stage) setMovedFrom(null);` in render | keep `{ from, stage }` in one state and show it while `moved.stage === adventure.stage`, so no ref, no effect and no render-time reset | likely | skipped: rule 1 |
| 4 | src/components/conditions-section.tsx:67 | **New.** Dependency arrays are complete; a disabled `exhaustive-deps` needs an ordering reason (react.dev, eslint-plugin-react-hooks) | `// eslint-disable-next-line react-hooks/exhaustive-deps` over `useMemo(() => forecast && forecastView(forecast, point, deadline, now), [forecast, point, deadline, hour])` | let the memo read `hour` instead of `now`, by giving `forecastView` the hour it starts from; not certain, because `otherDay` compares `day > now` and in a half-hour time zone the hour start and `now` fall on different sides of midnight | likely | skipped: rule 1 |
| 5 | src/app/(app)/(tabs)/(adventure)/plan.tsx:311 | [5] Stable, unique key from the data (react.dev, Rendering Lists) | `` key={`${place.point.latitude},${place.point.longitude}`} `` | add the name: two places at one coordinate share a key | likely | skipped: rule 1 |
| 6 | src/lib/barry/client.ts:167, 359, 367, 379, 397, 412 | [6] No dead conditions (typescript-eslint no-unnecessary-condition) | `data === null ? 'accepted' : 'refused'`, `if (data)` | generate the commands' refusal as nullable | likely | skipped: rule 3, generated file |
| 7 | src/lib/barry/client.ts:78 | [7] No unchecked casts | `const orNull = <T,>(value: T \| null \| undefined): T => (value ?? null) as T;` | nullable argument types in the generated functions | likely | skipped: rule 3 |
| 8 | src/lib/barry/check-in-queue.ts:25, adventure-cache.ts:14, trail-buffer.ts:34, 37 | [8] No casts on data from outside (storage) | `JSON.parse(raw) as ...` | parse the stored shape | likely | skipped: rule 1 |
| 9 | src/lib/barry/conditions.ts:91, 243, 252, 263 | **New.** No casts on data from outside (network, storage) | `const { hourly } = json as OpenMeteo;`, `kept = Array.isArray(parsed) ? (parsed as Kept[]) : [];`, `JSON.parse(JSON.stringify({ point, ...conditions })) as Kept`, `(await fetchJson(slfUrl(lang))) as { features?: Feature[] }` | parse the two feeds and the kept entries; a wrong shape then fails where it is read, not inside `parseForecast` | likely | skipped: rule 1 |
| 10 | src/lib/barry/phone-contact.ts:30 | **New.** No unchecked casts | `(region?.toUpperCase() ?? undefined) as CountryCode \| undefined` | check the region against `getCountries()` from libphonenumber-js, or accept that an unknown region makes the parse fail, which it does | likely | skipped: rule 1 |
| 11 | src/lib/wording.ts:12, 15; 24, 27, 31, 35, 71 | **New** (12, 15) and [9]. No non-null assertions; indexed access is possibly undefined (typescript-eslint, tsconfig) | `ENGLISH_WEEKDAYS[at.getDay()]!`, `GERMAN_WEEKDAYS[at.getDay()]!`; `` `${ENGLISH_MONTHS[at.getMonth()]}` `` | a lookup keyed by a literal union, or `?? ''`; not certain, because an Invalid Date then prints `''` instead of `undefined` | likely | skipped: rule 1 |
| 12 | src/lib/barry/conditions.ts:125, 126 | **New.** No non-null assertions (typescript-eslint no-non-null-assertion) | `const [xi, yi] = ring[i]!; const [xj, yj] = ring[j]!;` | iterate the ring's pairs with `entries()` and keep the previous vertex in a variable, so no index needs asserting | likely | skipped: rule 1 |
| 13 | src/lib/barry/conditions.ts:214 | **New.** same | `newDay: i > 0 && !sameDay(h.at, shown[i - 1]!.at)` | `const previous = shown[i - 1];` then `previous !== undefined && ...`, which is the same check the `i > 0` made | certain | **fixed** 15692c4 |
| 14 | src/lib/trail-map/fetch.ts:45 | [10] No unchecked casts | `trail: trail as TrailPoint[]` | build the array in a loop that returns null on the first bad point | likely | skipped: rule 1 |
| 15 | src/app/(app)/(tabs)/history/index.tsx:91 | [11] No dead conditions | `rows.current.findIndex((r, i) => r && ...)` | type the sparse array with `\| undefined` | likely | skipped: rule 1 |
| 16 | src/lib/barry/index.ts:82 | [12] same (probe) | `contact.name?.trim() \|\| parts.join(' ')` | `expo-contacts` types `name: string`; the comment says the picker does not always fill it, so the type or the chain is wrong | likely | skipped: rule 1 |
| 17 | src/lib/site-language.ts:12 | [13] same (probe) | `navigator.languages?.length` | drop the chain or name the browser that lacks it | likely | skipped: rule 1 |
| 18 | src/app/(app)/(tabs)/(adventure)/plan.tsx:376; src/app/(app)/(tabs)/(adventure)/index.tsx:225 | [14] and **New** (index.tsx). Components are pure during render (react.dev, Rules of React) | `minimumDate={new Date()}`; `const to = movedDeadline(adventure.deadline, m.minutes);` in the menu's render, which reads `Date.now()` | read the clock from `useNow()`, which both screens already have; the menu's subtitles then tick with the card | likely | skipped: rule 2 |
| 19 | src/components/form.tsx:105 | [15] No unchecked casts | `useImperativeHandle(ref, () => scroll.current as ScrollViewInstance, [])` | a callback ref | likely | skipped: rule 1 |
| 20 | src/lib/storage.web.ts:2, src/lib/supabase.ts:38 | [16] Platform files stay in step (probe) | `storage: Storage \| undefined` against `storage.ts`'s `Storage`, which makes `authStorage &&` look always true | a shared `... \| undefined` type | likely | skipped: rule 1 |
| 21 | src/lib/barry/index.web.ts:13 | [17] same | `export const barry = {} as Barry;` | the deliberate stand-in AGENTS.md names | likely | skipped: rule 1 |
| 22 | src/lib/texts.ts:152, 255, 493 | [18] No unchecked casts | `({ ... } as Record<string, string>)[f.reason]` | a typed map of reasons | likely | skipped: rule 1 |
| 23 | src/components/pin-picker.tsx:38 | [19] An effect or handler's async work keeps its state honest (react.dev) | `setLocating(true); const here = await barry.currentPosition(); setLocating(false);` | `readPosition` never rejects today; a `try/finally` would keep it so | likely | skipped: rule 1 |
| 24 | src/components/captcha.tsx:9; src/lib/barry/conditions.ts:242 | [20] and **New** (conditions.ts). Defaults use `??` (probe) | `process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY \|\| null`; `JSON.parse(storage.getItem(KEY) \|\| '[]')` | both `\|\|` are right (an empty key means none; `forget` writes `''`) but, unlike `phone-contact.ts:48`, say nothing about it | likely | skipped: rule 1 |
| 25 | src/app/(app)/_layout.web.tsx:7 | [21] Texts live in the texts modules (AGENTS.md) | `<ThemedText>Barry runs on iPhone.</ThemedText>` | `siteText` | likely | skipped: rule 2 |
| 26 | src/components/button.tsx:21 | [23] State is announced (reactnative.dev, Accessibility) | `<Pressable accessibilityRole="button" ...>` without `busy` | `accessibilityState={{ busy, disabled }}` | likely | skipped: rule 2 |
| 27 | src/components/form.tsx:255 | [24] same | `accessibilityState={{ disabled, busy: disabled }}` | `busy` only while a Check-in runs | likely | skipped: rule 1 |
| 28 | src/app/(app)/(tabs)/history/index.tsx:383 | [26] Long or growing lists are virtualized (reactnative.dev, FlatList) | `days.map(...)` inside `Screen`'s `ScrollView` | a `SectionList`; the drag selection measures rows, so it needs a redesign | likely | skipped: rule 1 |
| 29 | src/components/form.tsx:238 | [27] Animations on the native thread (reactnative.dev, Performance) | `useNativeDriver: false` | animate `scaleX` with the native driver | likely | skipped: rule 2 |
| 30 | src/components/button.tsx:32, form.tsx:266, swipe-to-delete.tsx:63 | [28] Styles are static where they can be | `style={{ color, fontWeight: 600 }}` | the weight in `StyleSheet.create` | likely | skipped: rule 1 |
| 31 | src/components/conditions-section.tsx:101 | **New.** New code relies on the React Compiler for memoization (react.dev, React Compiler) | `const Forecast = memo(function Forecast(...` with the comment "the Plan sheet re-renders on every keystroke" | `forecast` and `day` are a memoised object and a string, which the compiler's own memoisation of the element already compares, so the `memo` adds nothing the compiler cannot see | likely | skipped: rule 1; removing manual memoisation is never a fix |
| 32 | src/app/(app)/(tabs)/(adventure)/index.tsx:19 | **New.** One module, imported through its public entry (AGENTS.md: `src/lib/barry` is the one module screens import, as `@/lib/barry`) | `import { LIMITS } from '@/lib/barry/limits';` next to an import from `@/lib/barry`, which exports `LIMITS` | one import | certain | **fixed** f1b789b |
| 33 | src/lib/texts.ts:2 | **New.** same | `import { LIMITS } from '@/lib/barry/limits';` | `@/lib/barry`; not certain, because `index.ts` loads the native modules, which `texts.test.ts` then loads too | likely | skipped: rule 1 |
| 34 | src/lib/barry/client.ts:80, src/app/(app)/(tabs)/history/index.tsx:23 | [29] One responsibility per module | two copies of `isInProgress` | export the module's one | likely | skipped: rule 1 |
| 35 | src/app/(app)/(tabs)/(adventure)/plan.tsx:66, src/components/profile-edit.tsx:17 | [30] same | two copies of `orNull` for trimmed text | one helper | likely | skipped: rule 1 |
| 36 | src/lib/site-language.ts:33 | [31] No dead code | `type Position = LastKnown;` | use `LastKnown` | likely | skipped: rule 1 |
| 37 | src/app/(app)/(tabs)/contacts/index.tsx:134, 160 | [32] Names say what a thing is | the prop `reach` shadows the module's `reach()` | rename the prop | likely | skipped: rule 1 |
| 38 | src/app/(app)/sign-in.tsx:169, 173 | [33] Derived values computed once | `const counting = secondsLeft > 0;` then `secondsLeft > 0` twice more | use `counting` | certain | **fixed** 13d8656 |
| 39 | src/lib/barry/index.ts:16 | [34] Imports use the project's path alias | `import { searchPlaces } from '../../../modules/place-search';` | `@/*` maps only `src/`; an alias for `modules/` needs a config change | likely | skipped: rule 3 |
| 40 | src/app/(app)/(tabs)/(adventure)/index.tsx:382 | **New.** Formatting consistent within one file (no formatter in the project) | two blank lines before `const styles`, one everywhere else in the file | one | certain | **fixed** 2f22eec |
| 41 | src/app/(app)/(tabs)/contacts/index.tsx:87 | **New.** same | `}` then `else if` on its own line, where the file otherwise writes `} else if` | `} else if` | certain | **fixed** 990ffc5 |

**Probe messages that reading cleared:** `prefer-nullish-coalescing` at `button.tsx:23` and `button.ios.tsx:33` (`disabled || busy` combines two booleans) and the two at `phone-contact.ts:49` (the `||` chain skips empty names on purpose, and says so). The other ten are findings 11 (`wording.ts:12, 15`), 12 and 13 (`conditions.ts:125, 126, 214`), 16, 17, 20 (`no-unnecessary-condition`) and 24 (`captcha.tsx:9`, `conditions.ts:242`).

## 3. Configuration proposals (not applied)

| Proposal | Errors today in the app code | Covered by |
|---|---|---|
| `@typescript-eslint/no-non-null-assertion` | 5 before the fixes, 4 after (was 0 on 28 October) | findings 11, 12, 13 |
| `@typescript-eslint/no-unnecessary-condition` | 3 | findings 16, 17, 20 |
| `@typescript-eslint/prefer-nullish-coalescing` | 6, 4 false positives | useful only with `ignoreBooleanCoercion` and `ignorePrimitives: { string: true }` |
| `no-explicit-any`, `switch-exhaustiveness-check`, `consistent-type-imports`, `only-throw-error`, `react-hooks` `recommended-latest` | 0 | |
| The five stricter compiler flags | 0 | |
| Regenerate `database.types.ts` with nullable function returns | | findings 6, 7 |

## 4. Project rules that override a best practice

| Project rule | Where | Overrides |
|---|---|---|
| "Constants that are implementation choices stay in the code next to what they protect, with a test that pins them" | AGENTS.md, Conventions | No dead code: exports used only by their test are not dead |
| "`index.web.ts` is an empty stand-in because the web build has no app" | AGENTS.md, The client module | Platform files stay in step, for that one file (finding 21 stays listed) |
| Existing `useMemo`, `useCallback` and `React.memo` stay under the React Compiler | this skill | none of them is a fix (finding 31 stays listed) |
| "Zero new comments by default" | the user's instructions | Comments say why: the one-line reasons on `||` (finding 24) are asked for, not forbidden |

## 5. Rules with no finding

No `any`; unions handled exhaustively (`warningText`, the result unions); type-only imports marked; every promise awaited, returned or caught; no promise where void is expected; only `Error` thrown; every empty `catch` has its why; props and state never mutated (`covering.sort` sorts a local copy); hooks unconditional; components at module level; every timer and listener removed in cleanup (`useLiveTrail`, `useTrailStatus`, the resend countdown); state reset by `key` (`ConditionsAt` per place, the captcha's `WebView`); no `console.*`; every pressable has a role and a name (the Conditions' hours, clocks and bulletin are `accessible` with a label); touch targets at 44 points (the bulletin link's padding, the Adjust target); text scales; colour never the only carrier (the danger level carries its number and name); only routes in `src/app`; typed hrefs; route params parsed through `useStringParam`; platform files in step apart from finding 21; magic numbers named (`CONDITIONS_REFRESH_MS`, `MIN_FORECAST_HOURS`, `KEPT`, `DARK_ALTITUDE`, `TRAIL_REFRESH_MS`); glossary terms used.

## Commits

1. f1b789b The live Adventure screen takes LIMITS from the client module's entry, like the other screens, instead of reaching into limits.ts
2. 2f22eec The live Adventure screen keeps one blank line between its parts, as the rest of the file does
3. 13d8656 Check Your Inbox reads the countdown's state once, through counting, where it disables and labels Send Again
4. 990ffc5 The Contacts screen's add handler keeps its else branches on the closing brace, as the rest of the file does
5. 15692c4 The forecast marks a new day by looking at the hour before it, without asserting that it exists

After each: `npx expo lint` 0 problems, `npx tsc --noEmit` 0 errors, 241 of 241 Jest tests passing. No test was changed.

**Skipped:** 18, 25, 26, 29 (rule 2); 6, 7, 39 (rule 3); every other likely finding (rule 1).

**Commits the project wants proven in the app:** all five touch screens or `src/lib/barry`, so `/barry-frontend-verify` covers them; none changes what a screen shows. The maintenance pass's last step, `/barry-verify`, drives the baseline after them; none is verified by this step.
