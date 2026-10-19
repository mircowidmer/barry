---
name: audit-consistency
description: Audit the whole Barry repository for inconsistencies between the migrations, the Edge Function, the app code, CONTEXT.md, the spec, the config files, the guides, the tests, the German and English texts, and the platform variants, and report them with both sides quoted. Read-only. Use when asked to find inconsistencies, drift, stale docs, or mismatches across the repository.
---

# Audit Barry for inconsistencies

You are auditing the repository at the current working directory, Barry: an Expo SDK 58 iPhone app with a Supabase backend that alerts an Adventurer's Emergency Contacts when a Deadline passes without a Check-in. Your job is to find every place where two parts of the repository disagree with each other. You are not fixing anything. The deliverable is a report.

## What counts as an inconsistency

A statement, value, name, or behaviour in one place that contradicts the same thing in another place. Both sides must be quoted with file and line. Examples of the kind of thing to find:

- A number in the spec that differs from the number in a migration or in app code.
- A screen text, message text, or permission string that uses a term CONTEXT.md says to avoid.
- An English text with no German counterpart, or a German one with no English counterpart.
- A refusal code the database raises that the client does not map, or the client maps a code the database never raises.
- A command in README.md or AGENTS.md that does not exist in package.json, or vice versa.
- A document that describes a behaviour the code no longer has, or a behaviour the code has that the document denies.
- Two platform variants of one module (`.ts` and `.web.ts`, `.tsx` and `.ios.tsx`) that export different surfaces or behave differently where the caller expects the same thing.
- A URL, path, bundle identifier, scheme, sender address, or port that differs between config files, docs, scripts, and code.
- Generated types in `src/lib/database.types.ts` that no longer match the migrations.
- A test that asserts one thing while the spec promises another.

Not an inconsistency: a style preference, a thing you would have done differently, a comment that is merely terse, or a design sketch that says of itself that it is a sketch. Both design documents under `docs/design/` state that nothing in them runs. Treat them as history. Flag them only where the shipped code contradicts a claim the document makes about the current repository, or where another document links to them as if they were current.

## Sources of truth, in the order you should trust them

1. **Migrations** in `supabase/migrations/` and the Edge Function in `supabase/functions/deliver/`. Later migrations override earlier ones. Several toggle the same thing more than once (text messages are enabled, disabled, and enabled again; the trail cadence changes), so always establish the final state before comparing anything to it.
2. **App code** in `src/`, especially `src/lib/barry/` (the client module), `src/lib/texts.ts` (every screen text in English and German), `src/lib/wording.ts`, and `src/app/` (the routes).
3. **CONTEXT.md**, the glossary. Every capitalised term and every "Avoid" list is a rule for user-facing text.
4. **docs/spec.md**, the specification, including its numeric constants and its tables of who receives which message with which content.
5. **Config**: `app.json`, `app.config.js`, `eas.json`, `supabase/config.toml`, `supabase/seed.sql`, `.env.example`, `tsconfig.json`, `eslint.config.js`, the `jest` block in `package.json`, `.github/workflows/trail-map.yml`, `plugins/without-push.js`.
6. **Guides**: `README.md`, `AGENTS.md`, everything in `docs/*.md`, `docs/adr/`, and the verify skill in `.claude/skills/verify/` with its feature files and scripts.
7. **Tests**: `src/**/*.test.ts`, `supabase/tests/database/*.test.sql`, `supabase/functions/deliver/*.test.ts`, `e2e/*.e2e.mjs`.
8. **Web and static content**: `web/*.html`, `locales/de.json`, `barry-prompts.html`, `docs/overview/`.

When two sources disagree, say which one you believe is right and why. If you cannot tell, say so.

## Checks to run

Work through every group. For each group, read both sides fully before comparing. Do not sample.

### 1. Terminology

- Build the list of defined terms and the list of "Avoid" words from CONTEXT.md.
- Search every user-facing string for the avoided words: `src/lib/texts.ts`, `supabase/functions/deliver/messages.en.ts`, `messages.de.ts`, `locales/de.json`, the `infoPlist` strings in `app.json`, `web/*.html`, and the screens under `src/app/`. Report each hit with the sentence around it. Code identifiers and comments are out of scope for this check unless they leak into a user-facing string.
- Check that the same concept is named the same way in English across the app, the messages to contacts, and the web pages, and the same way in German across `texts.ts`, `messages.de.ts`, `locales/de.json`, and `web/*.html` if any German appears there.
- German must follow Swiss High German: `ss` never `ß`, and the quotation marks used in `locales/de.json` should be the ones used everywhere else. Report every `ß` and every mismatched quote style.

### 2. Numbers and timing

Extract every duration and count from `docs/spec.md` and CONTEXT.md and find where each is implemented. At minimum:

- Grace Period length.
- Reminder lead time.
- Overdue Notice timing.
- Number of Alerts and the interval between them.
- The Deadline Update delay and the coalescing of quick moves in a row.
- Trail reading cadence. Note that a migration is named `ten_second_trail` while CONTEXT.md, `locales/de.json`, and the `app.json` permission strings say about once a minute. Establish what the server enforces, what the phone uploads, what the unique index collapses to, and what each text promises, and report every disagreement.
- How long the Trail Map stays reachable after a Check-in, and after an Ended Adventure is deleted.
- Any retention, cleanup, or health-check interval in the migrations and in `scripts/` or the verify doctor.

Compare each against the SQL, the TypeScript in `src/lib/barry/`, the Edge Function, the e2e tests, and the design documents. A number that appears in a test but nowhere in a document is also a finding, with low severity.

### 3. Messages to contacts

For each message kind in CONTEXT.md and the spec table (Heads-up, Plan Update, Deadline Update, Alert, All-clear, Delivery Failure):

- Confirm the kind exists in the SQL enum or check constraint, in `supabase/functions/deliver/messages.ts`, in both language files, and in the client types in `src/lib/barry/types.ts`.
- Confirm the content the spec lists for each kind is what the English and German templates actually include, field by field, and that the English and German templates include the same fields as each other.
- Confirm the sender address and the channel rules (email, text, both; the contact's switches) match between `supabase/functions/deliver/senders.ts`, `supabase/config.toml`, `supabase/seed.sql`, the migrations, `docs/text-messages.md`, `docs/hosted-supabase.md`, and `docs/local-messages.md`.
- Confirm the date formatting in `src/lib/wording.ts`, which says it mirrors the server's German messages, produces the same shape as the server's formatting in the German message file. Compare the test fixtures on both sides.

### 4. Refusals and failures

- List every refusal code raised in the migrations and every code in the `refusals` object in `src/lib/texts.ts` for both languages, and the `Refusal` type in `src/lib/barry/types.ts`. Report codes present on one side only.
- Do the same for Delivery Failure reasons between the Edge Function, the SQL, and `texts.ts`.
- Check that the rules in the spec that say "Barry refuses while..." (deleting an account or an Ended Adventure while a message is still being sent; deleting a contact an Active Adventure uses; Start with no contact) each have a server-side refusal, a client-side text, and a test.

### 5. Platform variants

For every pair of files that differ only by a platform suffix, compare the exported names and signatures:

- `src/lib/barry/index.ts` and `index.web.ts`
- `src/lib/barry/trail-task.ts` and `trail-task.web.ts`
- `src/lib/notifications.ts` and `notifications.web.ts`
- `src/lib/storage.ts` and `storage.web.ts`
- `src/hooks/use-color-scheme.ts` and `use-color-scheme.web.ts`
- `src/components/button.tsx` and `button.ios.tsx`
- `src/components/trail-map-view.tsx` and `trail-map-view.web.tsx`
- `src/app/adventure.tsx` and `adventure.web.tsx`, `confirmed.tsx` and `confirmed.web.tsx`
- `src/app/(app)/_layout.tsx` and `_layout.web.tsx`

Report an export on one side that is missing on the other, a differing signature, and any behaviour a shared caller relies on that only one side provides. Then check that `npx tsc --noEmit` actually sees both variants, given the `include` and `exclude` in `tsconfig.json`.

### 6. Routes, links, and hosting

- Collect every URL and path: the confirmation page in the spec, the Trail Map link built in `supabase/functions/deliver/links.ts`, the routes in `src/app/`, the files copied in `.github/workflows/trail-map.yml`, the links inside `web/*.html`, `docs/trail-map-hosting.md`, `docs/hosted-supabase.md`, and the `scheme` values in `app.json` and `app.config.js`. The trail design document names the route `/trail`; the workflow copies `adventure.html`. Establish the current route and report every stale reference.
- Check the `environment.url` expression in the workflow for correctness.
- Check that the Supabase URL and publishable key in `eas.json` match what `docs/hosted-supabase.md` and `docs/builds.md` say, and that `.env.example` matches what `README.md` tells the reader to do with it.

### 7. Build and run configuration

- `app.json` versus `app.config.js`: which keys the config function overrides, and whether anything in `app.json` becomes wrong for a non-production variant (scheme, bundle identifier, display name, permission strings).
- `eas.json` profiles versus the `build:*` scripts in `package.json`, versus `docs/builds.md`, versus `docs/iphone.md`, versus the verify skill's launch steps (bundle identifier `support.barry.dev`, simulator name, Metro port, relay port).
- `plugins/without-push.js` versus the `BARRY_WITHOUT_PUSH` rule in `AGENTS.md` and `docs/iphone.md`.
- `AGENTS.md` says to use `bunx` when `bun.lock` is present. State whether it is present and whether any doc or script assumes bun anyway.
- The commands under **Check it** in `README.md` versus `package.json` scripts, versus `AGENTS.md`, versus the verify skill. Every command must exist and run from the repo root.
- `tsconfig.json` excludes, `eslint.config.js` ignores, and the `jest.testPathIgnorePatterns` block: do they agree on what is app code and what is not? Is there a test file that none of the runners picks up?
- The Expo SDK major in `package.json` versus every version mentioned in docs and skill files.

### 8. Tests versus promises

- The verify skill's description of the e2e suite lists the cases it covers. Compare with the files actually in `e2e/`. Report cases listed but absent and files present but unlisted.
- Map each feature file in `.claude/skills/verify/features/` to the screens in `src/app/`. Report screens with no recipe and recipes for screens that no longer exist, and quoted button labels that do not appear in `texts.ts`.
- For each row in the spec's stage table and message table, name the test that covers it, or say none does.
- Compare `supabase/tests/database/*.test.sql` names and assertions with the migrations they test. A test that still asserts a behaviour a later migration changed is a finding.

### 9. Generated and derived files

- Regenerate the database types in a scratch location with the Supabase CLI against the local migrations if the stack is available, or otherwise compare `src/lib/database.types.ts` by hand with the final shape of every table, view, function, and enum in the migrations. Report every difference.
- Compare `locales/de.json` keys with the `infoPlist` keys in `app.json` and the ones `app.config.js` adds. Report keys on one side only, and English strings whose German counterpart says something different.
- Check `barry-prompts.html` and `docs/overview/` against the spec. These are likely to be stale. Report, with low severity, each claim they make that the spec or the code no longer supports.

### 10. Documents against each other and against the code

- Every relative link in every Markdown file must resolve. Every guide listed in `README.md` must exist and every file in `docs/` must be reachable from `README.md` or another doc, or be flagged as orphaned.
- `docs/spec.md` against CONTEXT.md: same definitions, same stage names, same message names.
- `docs/adr/0001` against the code: does the app really wait for Supabase to confirm a Start before showing the Adventure as Active? Does the Check-in queue behave as the ADR says? Does the tick report to an outside monitor, and does `health.e2e.mjs` test that?
- The spec says which Adventure fields exist. A migration drops the starting point and notes. Search docs, texts, tests, design documents, and the HTML files for any remaining reference to either.
- Recent commit messages describe behaviours (pull to reload, a shared load state, refit rules on the live map, a tap in the gap between History rows). For the last thirty commits, check that any document or feature file that describes the touched behaviour was updated with it.

## How to work

- Read and search. Use `grep -rn` across the repository for each term, number, URL, and identifier you compare. Do not guess from memory what a file contains.
- Run `npx expo lint`, `npx tsc --noEmit`, and `npm test`, and include their results. If the local Supabase stack is running, also run `npx supabase test db` and `deno test supabase/functions/deliver`. If it is not, say so and skip them.
- Do not edit any file. Do not create branches or commits. Scratch output goes to a temporary directory outside the repository.
- One finding per root cause. If a stale number appears in five documents, that is one finding with five locations.
- Quote both sides verbatim with `path:line`. A finding without two quoted locations is not a finding.
- Say what is true, not only that two things differ. If you cannot determine which side is right, say what you checked and why it was not enough.
- Do not pad. A group where everything agrees gets one line saying what you compared.

## Report format

Write the report in Markdown with these sections, in this order:

1. **Summary**: counts by severity, the three findings that matter most, and the results of the checks you ran.
2. **Findings**, grouped by severity:
   - **Blocking**: a mismatch that could mislead an Adventurer, an Emergency Contact, or the operator in a safety situation, or that makes a documented command or build fail.
   - **High**: docs or texts that promise a behaviour the code does not have, or code paths that disagree with each other.
   - **Medium**: stale references, missing counterparts in one language or one platform, tests out of step with the spec.
   - **Low**: cosmetic drift in historical documents, orphaned files, naming that differs without changing meaning.

   Each finding has: an identifier, a one-sentence title, the two or more quoted locations, what is actually true, the suggested fix in one sentence, and a confidence of high, medium, or low.
3. **Checked and consistent**: one line per group above, listing what was compared.
4. **Could not check**: anything that needed a running stack, a device, or external access you did not have.

If the report is for a German-speaking reader, write it in Swiss High German with `ss`, never `ß`.
