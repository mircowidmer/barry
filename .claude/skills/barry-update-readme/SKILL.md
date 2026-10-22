---
name: barry-update-readme
description: Keep Barry's README.md true to the repository: the commands to run and check it, the files they need, the guides under docs/ and the skills under .claude/skills/. Compares every claim in the README with the repository and reports what is stale, missing or wrong. Read-only unless invoked with --fix, which then edits README.md and commits each change. Use after adding or removing a document, a script, a test suite, an env variable or a skill, or when asked whether the README is current.
---

# Keep the README up to date

You are checking `README.md` of the repository at the current working directory, Barry: an Expo SDK 58 iPhone app with a Supabase backend that alerts an Adventurer's Emergency Contacts when a Deadline passes without a Check-in. The README is the front door: a developer at a fresh checkout reads it to learn what Barry is, how to run it, how to check it, and where the rest is written down. Your job is to make sure every sentence of it is still true and that nothing a newcomer needs is missing. The deliverable is a report, and with `--fix`, a README that matches the repository.

The README follows the repository, never the other way round. If a command, a file or a guide has changed, the README changes. If the README promises something the repository does not have, the README loses the promise. Changing code, scripts, documents or skills to make the README true is the barry-audit-consistency skill's business, not this one's.

## Arguments

- No argument: check and report. Change nothing.
- `--fix`: check, write the report, then apply the changes the section **Applying changes with --fix** allows, and commit each one. The report comes first either way.

Any other argument is an error. Say so and stop.

## What the README holds

Four sections after the title and one paragraph, in this order. Each must match the sources named here, which are the truth.

| Section | What it says | Sources of truth |
| --- | --- | --- |
| The opening paragraph | What Barry is, for whom, and what it is built with | `CONTEXT.md`, the first paragraph of `docs/spec.md`, `package.json` (`expo`, `@supabase/supabase-js`) |
| **Run it locally** | The commands that start the backend and the app, the env file to copy and the keys to fill in, and which build the app needs | `package.json` scripts, `.env.example`, `supabase/config.toml`, `docs/iphone.md`, `docs/builds.md`, `AGENTS.md` |
| **Check it** | Every command that checks the repository, one per line, and what each needs before it runs | `package.json` scripts (`lint`, `test`, `e2e`), `tsconfig.json`, `supabase/functions/deliver/*.test.ts`, `supabase/tests/database/`, `e2e/stack.mjs`, `.claude/skills/barry-backend-verify/SKILL.md`, `.claude/skills/barry-frontend-verify/SKILL.md` |
| **Guides** | One link per document a person would read, with the document's title as the link text | every `docs/**/*.md`, `docs/adr/*.md`, `docs/overview/`, `barry-prompts.html`, `CONTEXT.md` |
| **Skills** | One line per skill under `.claude/skills/`: its name, what it does in one sentence, and `--fix` where it has one | the `name` and `description` of every `.claude/skills/*/SKILL.md` |

A section that is missing is a finding. A fifth section the author added stays and is checked like the others against whatever it names.

Rules the README keeps, so it rarely needs a change:

- It names things and links to them. Details live in the guides. A sentence that paraphrases a guide is a sentence that goes stale.
- It carries no count that moves with every commit: no number of migrations, tests, screens or commits. Those belong in the overview, which is dated.
- It carries no version number except where a command needs one.
- A link's text is the linked file's H1, or a short name when the H1 is a sentence, as for the two design sketches.
- The commands run from the repository root, as written, on a fresh checkout that followed the section before.

## Checks to run

Read the README fully, then each source named above fully. Do not sample.

1. **The opening paragraph.** Every claim about what Barry does is in `CONTEXT.md` or `docs/spec.md`, in the glossary's words. Every claim about what it is built with is in `package.json`.
2. **Run it locally.** Each command exists: an npm script in `package.json`, or a CLI the repository depends on. The env instructions name every key in `.env.example`, say which the reader fills in and where the value comes from, and name no key that `.env.example` lacks. The sentence about the development build matches `docs/iphone.md` and `docs/builds.md`, which it links. Nothing `AGENTS.md` lists under Commands as the way to run the app is missing or contradicted.
3. **Check it.** Every check the repository has is listed, and nothing listed is gone: `npx expo lint`, `npx tsc --noEmit`, `npm test`, the Deno tests under `supabase/functions/deliver/`, `npx supabase test db`, `npm run e2e`, and any runner added since. Each prerequisite the code imposes is stated: the generated file `tsconfig.json` includes, the local stack for the database tests and the e2e cases, `node scripts/sms-relay.mjs` where `e2e/stack.mjs` refuses to run without it, Deno for the Edge Function tests. Run `npx expo lint`, `npx tsc --noEmit` and `npm test` and report the results; run the others when the stack and Deno are there, else say so.
4. **Guides.** Every document the table names has a link, every link resolves, and every link text is the file's H1 or its agreed short name. A document that two links share, as the two design sketches do, counts once. A document that is not for a person, such as `AGENTS.md`, which is for coding agents, is named only if the author chose to.
5. **Skills.** Every `.claude/skills/*/SKILL.md` has a line, with the name from its frontmatter, a one-sentence purpose taken from its description, and `--fix` only when the skill's Arguments section has it. A skill that is gone has no line.
6. **Links and commands.** Every relative link in the README resolves. Every command in a code block is one the reader can paste.
7. **Style.** Short sentences. The glossary's terms, capitalised as `CONTEXT.md` writes them when they name the concept, lower case in running prose about the app as the app's own texts do. No count, no date, no version that drifts.

One finding per root cause, with the README line and the source line quoted. Say what is true. If the README and a source disagree and the source itself is contradicted by the code, say so and leave that to the barry-audit-consistency skill.

## Report

Write the report in Markdown with these sections, in this order:

1. **Summary**: counts of stale, missing and extra items; the results of the checks you ran.
2. **Findings**, grouped as **Stale** (a README line that no longer matches its source), **Missing** (a command, key, guide or skill the repository has and the README lacks), **Extra** (a README line about something the repository no longer has), and **Style** (a rule above that a line breaks). Each has an identifier, the quoted README line with its number, the quoted source with its path and line, the proposed README text, and a confidence of high, medium or low.
3. **Checked and consistent**: one line per section of the README, saying what it was compared with.
4. **Could not check**: a command you could not run and why.

With `--fix`, each finding also carries an outcome: **fixed** with the commit hash, or **skipped** with the rule below that stopped it.

## Applying changes with --fix

Only after the report is complete. Apply a change only when every rule below holds. Skip the finding otherwise and say which rule stopped it.

1. **Confidence is high.** A medium or low finding is never applied.
2. **Only `README.md` changes.** Never a script, a document, a skill, a config file or code. If the repository is what should change, say so and leave it.
3. **A line, a bullet or a prerequisite, not a rewrite.** Add or remove the bullet, the command line or the sentence the finding names. Add a missing section from the table above with its heading and its lines, and nothing more. Never paste a guide's content into the README, never add a count, a date or a version.
4. **Link texts come from the file.** The H1 of the linked file, or the short name the README already uses for its kind.
5. **One finding, one commit.** After each change run `npx expo lint` and `npx tsc --noEmit`; a README change cannot break them, but the repository asks for both before any task is done. Commit the change alone, with a message in the style of the repository's history: one sentence that says what the reader now sees, not what the diff does, for example "README: the e2e suite also needs the text message relay", followed by the attribution lines the session requires.
6. **Never push, never open a pull request.** If the current branch is the default branch, create a branch first and say which. Leave pushing to the user unless they asked for it in the same message.

When all findings have been handled, append to the report a list of the commits made, in order, with one line each, and a list of the skipped findings with their rules.
