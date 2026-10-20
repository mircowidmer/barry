---
name: barry-assure-code-quality
description: Review the app's TypeScript and React Native code against current best practices in coding style and code quality, and report each finding with its source. Read-only unless invoked with --fix, which then applies the certain, behaviour-preserving fixes and commits each one. Use when asked to check or raise code quality, find code smells or style problems, or before a release.
---

# Assure code quality

You are reviewing the app code of the repository at the current working directory: a React Native app in TypeScript, built with Expo. Your job is to find every place where the code falls short of current best practice in coding style and code quality, and to say for each one what the rule is, where it comes from and what the better code looks like. The deliverable is a report, and with `--fix`, the fixes that are certain and change no behaviour, one commit each.

Best practice here means a written rule from a primary source (react.dev, reactnative.dev, docs.expo.dev, typescriptlang.org, typescript-eslint.io) or from the project itself. Taste is not a finding. A finding names its rule, quotes the code, and would survive the author asking "says who?".

## Arguments

- No argument: review every TypeScript file the app ships: `src/**/*.{ts,tsx}` and the root entry files (`index.ts`, `app.config.*`). Tests, `e2e/`, `scripts/`, `supabase/` and generated files (such as `src/lib/database.types.ts`, `expo-env.d.ts`) are out of scope. Change nothing.
- A path, such as `src/lib/barry` or `src/app/(app)/(tabs)/profile/index.tsx`: review only the files under it.
- `--fix`: review, write the report, then apply the fixes the section **Applying fixes with --fix** allows, and commit each one. Can be combined with a path. The report comes first either way, so a fix is never applied to a finding the report does not name.

Any other argument is an error. Say so and stop.

## The project's rules come first

Before judging anything, read what the project already decided:

- `AGENTS.md` and `CLAUDE.md`, and the user and project instructions already in your context (for example a method style, a comment rule or a naming rule).
- `eslint.config.js`, `tsconfig.json`, `package.json` (the `expo`, `react`, `react-native` and `typescript` versions) and the app config (`app.json`, `app.config.*`), in particular `experiments.reactCompiler` and `experiments.typedRoutes`.
- The code's own conventions where nothing is written: how screens, hooks, components and modules are named and laid out. Read three neighbouring files before calling something inconsistent.

A project rule beats a rule from this skill. Where they contradict, follow the project, report nothing for that rule, and list the override under **Project rules that override a best practice**. Expo changes with every SDK: before calling an Expo or React Native API deprecated or wrong, fetch the versioned docs for the installed major (`https://docs.expo.dev/versions/v<major>.0.0/`, and `https://docs.expo.dev/llms.txt` for the index and its corrections), never memory.

## The rules

Each rule is one checkable sentence with its source. *Tool* marks the rules the machine checks below catch; the others need reading.

### Types

- **No `any`, no unchecked casts.** `any`, `as unknown as X` and `as X` on data from outside (network, storage, route params, JSON) hide the bug they skip; parse or narrow instead. *Tool:* `@typescript-eslint/no-explicit-any`. [typescript-eslint](https://typescript-eslint.io/rules/no-explicit-any/)
- **No non-null assertions** (`x!`) where a check or a narrower type would do. *Tool:* `@typescript-eslint/no-non-null-assertion`.
- **Indexed access is possibly undefined.** `array[i]`, `record[key]` and `.find()` results are checked before use. *Tool:* the `noUncheckedIndexedAccess` probe. [tsconfig](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess)
- **Unions are handled exhaustively.** A `switch` or `if` chain over a union or enum covers every member, or ends in a `never` check, so a new member is a compile error. *Tool:* `@typescript-eslint/switch-exhaustiveness-check`.
- **States are modelled, not flagged.** A value that is loading, loaded or failed is a discriminated union, not three booleans that can disagree.
- **Type-only imports are marked** `import type`. *Tool:* `@typescript-eslint/consistent-type-imports`.
- **No dead conditions.** A check the types prove always true or always false is either a bug or noise. *Tool:* `@typescript-eslint/no-unnecessary-condition`.
- **Defaults use `??`**, not `||`, where `0`, `''` or `false` are valid values. *Tool:* `@typescript-eslint/prefer-nullish-coalescing`.

### Async and errors

- **Every promise is awaited, returned, or handed to a `catch`.** A floating promise loses its error and its ordering. *Tool:* `@typescript-eslint/no-floating-promises`. [typescript-eslint](https://typescript-eslint.io/rules/no-floating-promises/)
- **No promise where a function returning void is expected,** such as an `async` handler passed to `onPress` or `addListener` without handling its rejection. *Tool:* `@typescript-eslint/no-misused-promises`.
- **Only `Error` objects are thrown,** and a `catch` narrows `unknown` before reading it. *Tool:* `@typescript-eslint/only-throw-error`; `useUnknownInCatchVariables` comes with `strict`.
- **An empty or swallowing `catch` says why** in its one line, or rethrows. A failure the user should see reaches the screen.
- **An effect that starts async work ignores the result after cleanup** (an `ignore` flag or an `AbortController`), so a late answer cannot overwrite a newer one. [react.dev: fetching data](https://react.dev/learn/you-might-not-need-an-effect#fetching-data)

### Components and hooks (Rules of React)

- **Components and hooks are pure during render.** No side effects, no reads or writes of mutable globals, no `ref.current` reads or writes in render. [react.dev: Rules of React](https://react.dev/reference/rules)
- **Props, state, hook arguments and values passed to JSX are never mutated;** copy, then set. *Tool:* `react-hooks/immutability`.
- **Hooks are called unconditionally at the top level** of components and custom hooks; a function that calls a hook is named `use…`. *Tool:* `react-hooks/rules-of-hooks`.
- **Components are defined at module level,** never inside another component or created by a factory during render, so their state survives the parent's render. *Tool:* `react-hooks/static-components`, `react-hooks/component-hook-factories`.
- **Lists render with a stable, unique `key`** from the data, never the index for items that move, insert or delete.
- **Dependency arrays are complete.** *Tool:* `react-hooks/exhaustive-deps`. A disabled `exhaustive-deps` is a finding unless its one-line reason is a real ordering constraint.

### Effects and state

Effects are an escape hatch for syncing with something outside React. Each of these is a finding: [react.dev: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

- **Derived values live in render,** not in state kept in sync by an effect.
- **State that resets with an identity resets with a `key`,** not with an effect on that prop.
- **State adjusted on a prop change is adjusted during render** (store the previous prop), not in an effect.
- **Work caused by an event runs in the handler,** not in an effect watching a flag the handler set.
- **Chains of effects that set each other's state** become one computation in the handler or render.
- **Every subscription, timer and listener an effect starts is removed in its cleanup.**
- **State holds the minimum:** no copy of a prop, no value computable from other state, no duplicated object where an id would do.

### With the React Compiler on

When `experiments.reactCompiler` is true:

- **New code relies on the compiler for memoization.** A new `useMemo`, `useCallback` or `React.memo` needs a reason the compiler cannot see, such as a value used as an effect dependency that must keep its identity. Existing manual memoization stays: removing it can change the compiled output, so it is never a `--fix`. [react.dev: React Compiler](https://react.dev/learn/react-compiler/introduction)
- **A component the compiler skips is a finding.** The compiler bails out of a component or hook that breaks a Rule of React; the `react-hooks` lint rules surface these diagnostics. [eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks)
- **Sources disagree on lists:** reactnative.dev still recommends `useCallback` for `renderItem` and `memo` for list items, written before the compiler. Under the compiler, report a missing one only when the item is measurably slow.

### React Native rendering and performance

- **Long or growing lists use a virtualized list** (`FlatList`, `SectionList` or the project's list library), not `ScrollView` with `map`; they have `keyExtractor` and, for fixed-height rows, `getItemLayout`. [reactnative.dev: FlatList](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- **List items are light:** no heavy work, no network call and no large image at full resolution per row.
- **Styles are static where they can be:** `StyleSheet.create` at module level, inline style objects only for values that change.
- **No `console.*` left in app code** outside a deliberate logger. In a release build it costs JavaScript thread time. [reactnative.dev: Performance](https://reactnative.dev/docs/performance)
- **Animations that can run on the native thread do** (`useNativeDriver: true`, or Reanimated worklets where the project uses Reanimated).
- **Images come in the size they are shown,** through the project's image component.

### Accessibility

- **Every pressable has a role and a name:** `accessibilityRole` (or `role`) and an `accessibilityLabel` (or `aria-label`) when its visible text does not say what it does, as for an icon button. [reactnative.dev: Accessibility](https://reactnative.dev/docs/accessibility)
- **State is announced:** `accessibilityState` (disabled, selected, checked, busy) matches what the screen shows.
- **A hint explains a non-obvious result** (`accessibilityHint`), and changing content that matters is announced.
- **Touch targets are at least 44 by 44 points,** using `hitSlop` where the visual is smaller.
- **Text scales with the system font size;** a `maxFontSizeMultiplier` or a fixed-height container that clips large text is a finding.
- **Colour is not the only carrier** of an error, a state or a warning.

### Expo Router and navigation

- **Only routes live in the route directory** (`app/` or `src/app/`): every file there is a screen or a `_layout`. Components, hooks and helpers live outside it. [Expo Router](https://docs.expo.dev/router/introduction/)
- **Navigation uses Expo Router's `Link`, `router` and `useLocalSearchParams`,** not a second navigation library side by side.
- **With typed routes on, hrefs are typed:** no string built by concatenation and cast, no `as Href`.
- **Route params are parsed, not cast:** a param can be missing, an array or any string.
- **Screen options are declared where the navigator is** (`_layout`) or with `Stack.Screen` in the screen, consistently with the project's choice.

### Platform-specific code

- **Small differences use `Platform.OS` or `Platform.select`; larger ones use `.ios.tsx`, `.android.tsx` or `.web.tsx` files** that export the same interface, so callers import one path. [reactnative.dev: Platform-specific code](https://reactnative.dev/docs/platform-specific-code)
- **Platform files of one module stay in step:** same exports, same types. A function missing from one variant is a finding.

### Modules, naming and style

- **One responsibility per module, imported through its public entry.** A screen that reaches into another module's internals is a finding when the module has an entry (`index.ts`).
- **Names say what a thing is in the domain's words.** Where the project has a glossary (such as `CONTEXT.md`), code uses its terms and avoids the ones it lists to avoid.
- **Imports use the project's path alias** (`@/…`) instead of long relative chains, the way neighbouring files do.
- **No dead code:** unused exports, unused parameters, commented-out code, unreachable branches. *Tool:* the `noUnusedLocals` and `noUnusedParameters` probe.
- **Magic numbers that encode a decision are named constants** next to what they protect.
- **Comments say why, not what,** in the project's comment style.
- **Formatting is the formatter's job.** Where the project has Prettier, a formatting nit is not a finding; where it has none, report only inconsistency inside one file.

## Machine checks

Run these first and keep their output; each message becomes a finding under its rule.

1. The project's own checks: `npx expo lint`, `npx tsc --noEmit` and the unit tests (`npm test`). Anything they report is a finding of the highest rank in its area: the project already asked for it.
2. A stricter compiler probe, which changes no file: `npx tsc --noEmit --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitReturns --noFallthroughCasesInSwitch --noImplicitOverride --noUnusedLocals --noUnusedParameters`. Attribute each error to its flag by running the flags one at a time when the count is small enough to matter.
3. A type-aware lint probe. Write a temporary `eslint.quality-probe.config.js` at the repository root that extends the project's own config and adds, for `**/*.{ts,tsx}`, the `@typescript-eslint/parser` with `parserOptions: { projectService: true, tsconfigRootDir: __dirname }`, the `react-hooks` plugin's latest recommended rules (`eslint-plugin-react-hooks` `recommended-latest` in version 6 and later), and the typescript-eslint rules the rules above mark *Tool*. Use the plugins the project already has installed (`@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` come with `eslint-config-expo`); install nothing. Run `npx eslint -c eslint.quality-probe.config.js --format json <scope>`, then delete the file. `git status --short` must not list it afterwards.

A probe finding is a real finding about the code. Whether the project should turn the flag or the rule on for good is a separate question: report it under **Configuration proposals** with the number of errors it would raise today.

## How to work

1. **The project's rules.** Read the files the section above names and write down every project rule that touches a rule of this skill.
2. **Machine checks.** Run the three in order and group their output by rule.
3. **Read every file in scope fully,** not from its name or its imports. For each file, go through every rule above and write one line per occurrence: `path:line`, the rule, the code quoted (one line, or the first line of a block), what the better code is in one sentence, and **certain** or **likely**. Certain means the rule applies with no judgement call and the fix keeps behaviour. The step is done when every file in scope has been read and every rule has been applied to it, including the files with no finding.
4. **Merge** the machine findings and the reading findings; one occurrence is one finding, even when a tool and the reading both found it.
5. **Rank:** first what can misbehave at runtime (a floating or misused promise, a missing cleanup, a broken Rule of React, a mutated prop or state, a missing `key`, an unhandled union member, a param used without parsing); then accessibility; then performance; then maintainability and style.

## Report

Write the report in Markdown with these sections, in this order:

1. **Summary:** files reviewed, findings per area and per rank, certain against likely, the results of the project's own checks, and the three findings that matter most.
2. **Findings,** ranked as above. One entry each: `path:line`, the rule and its source, the code quoted, the better code in one sentence, certain or likely. With `--fix`, each entry also carries an outcome: **fixed** with the commit hash, or **skipped** with the rule below that stopped it.
3. **Configuration proposals:** each stricter compiler flag and each probe lint rule that found something, with the number of errors it would raise and whether the findings above already fix them. Never applied by this skill.
4. **Project rules that override a best practice:** the project rule quoted with its `path:line`, the rule of this skill it overrides, one line each.
5. **Rules with no finding:** one line listing them, so the reader sees what was checked.

Quote code verbatim with `path:line`. One finding per occurrence. Do not pad.

With `--fix`, append a list of the commits made, in order, one line each, and a list of the skipped findings with their rules.

## Applying fixes with --fix

Only after the report is complete. Apply a fix only when every rule below holds. Skip it otherwise and say which rule stopped it.

1. **The finding is certain.** A likely finding is the author's call.
2. **Behaviour stays the same.** The fix is a refactor: the same screens, texts, network calls, stored data and timing. Handling a floating promise with a `catch` that only reports what was lost before counts; deciding what the user should now see does not. Removing existing `useMemo`, `useCallback` or `React.memo` under the React Compiler never counts.
3. **Nothing is silenced.** No `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `as any`, `as unknown as`, `!` or rule turned off to make a finding go away. No configuration file changes: flags and lint rules are proposals.
4. **The tests stay as they are.** No test is edited, removed or added; a test that fails after the fix means the fix changed behaviour.
5. **One finding, one commit,** or one rule across one file when its occurrences there are the same fix. After each, run `npx expo lint`, `npx tsc --noEmit` and the unit tests. If anything fails, revert the files with `git checkout -- <files>` and mark the finding skipped with the failing output.
6. **Commit messages follow the repository's convention,** as `AGENTS.md` and `git log` show it, followed by the attribution lines the session requires.
7. **Changes the project wants proven in the app are named.** Where the project asks for a check in the simulator or on a device after a change to screens or app logic (as a `/barry-verify` skill does), list the commits that need it at the end of the report; do not claim them verified.
8. **Never push, never open a pull request.** If the current branch is the default branch, create a branch first and say which. Leave pushing to the user unless they asked for it in the same message.
