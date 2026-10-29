---
name: barry-e2e-gaps
description: Find the use cases Barry's documents promise (docs/spec.md, CONTEXT.md, the ADR, the guides under docs/ and the barry-frontend-verify feature files) that no end-to-end case in e2e/ proves against the running stack, and report each gap with the document that promises it, the nearest existing case, and a sketch of the missing case. Read-only unless invoked with --fix, which then writes the cases the report sketched, runs each against the running stack and commits it. Use when asked which use cases lack end-to-end tests, what to test next, to check e2e coverage against the docs, or to write the missing cases.
---

# Find the use cases without an end-to-end test

You are reading the repository at the current working directory, Barry: an Expo SDK 58 iPhone app with a Supabase backend that alerts an Adventurer's Emergency Contacts when a Deadline passes without a Check-in. Your job is to list every use case the documents promise, say which end-to-end case proves it, and report the ones none does. The deliverable is a report, and with `--fix`, the cases that close the gaps.

## Arguments

- No argument: every use case in every document.
- A path, such as `docs/spec.md`, `docs/text-messages.md` or `.claude/skills/barry-frontend-verify/features/trail.md`: only the use cases that document promises.
- `--fix`: the report first, then the cases the section **Writing cases with --fix** allows, each run against the stack and committed on its own. Can be combined with a path. The report comes first either way, so a case is never written for a gap the report does not sketch.

Any other argument is an error. Say so and stop.

## What counts as a use case

One behaviour an Adventurer, an Emergency Contact or the operator would notice, promised by a document:

- A row of the stage table or the message table in `docs/spec.md`, and each sentence in its prose that states a rule: "Barry refuses while…", "If the phone has no signal…", "A contact added to the Adventure gets a Heads-up", "After the third Alert, Barry sends nothing more".
- A definition in `CONTEXT.md` that names a behaviour, such as "Quick moves in a row send one" under Deadline Update.
- A claim in `docs/adr/0001-server-owns-the-deadline.md`.
- A procedure a guide promises: the delivery reports in `docs/text-messages.md`, the monitor in `docs/hosted-supabase.md`, the links in `docs/trail-map-hosting.md`.
- A sub-feature id in `.claude/skills/barry-frontend-verify/features/*.md`, such as `live-offline-checkin` or `contacts-in-use`.

One use case per observable outcome. "The Alert carries the Plan, the Deadline, the Last Position, the Profile and the link" is five use cases, because a case can prove four of them and miss one. A design sketch under `docs/design/` promises nothing; both say so themselves.

## What counts as end to end

An `e2e/*.e2e.mjs` case that drives the local stack the way the app and the clock do and asserts the outcome the document promises: a command through `anna.client.rpc(...)`, the clock's `private.tick` or `missDeadline` and `assertClockRan`, `deliver` through `runDeliver` or the kick after an insert, the email in Mailpit through `waitForMail` and `mailCount`, the text message in the relay through `waitForText` and `textsTo`, the Trail Map through `trailMap` and `trailToken`, the monitor through `heartbeatsSince`, and the rows through `admin` and `messageKinds`. Read `e2e/stack.mjs` first; those are its helpers, and `adventurer()` is the fixture every case starts from: Anna, her Profile, Luca with an email address and Sara with a phone number.

A case counts for a use case only when it asserts that outcome. A Start that merely happens on the way to another claim does not prove the Heads-up; `waitForMail(anna.luca.email, 'Anna is heading out …')` does. A Jest test or a pgTAP test is not end to end: note it under the gap as the coverage that exists, nothing more.

Three further statuses, because the suite drives the database and `deliver` directly and never taps through the app:

- **By hand only.** The barry-frontend-verify skill's recipe covers the use case in the simulator (`.claude/skills/barry-frontend-verify/features/*.md`), and no `e2e/` case does. Name the sub-feature id.
- **Needs the phone.** The use case lives in the app or in iOS, so no `e2e/` case can prove it: the local notifications, background location and the geofence, the Check-in queue, the screens, the permission prompts. Name the recipe that covers it, or say none does.
- **Needs the outside.** Hosted Supabase, Resend, Twilio, GitHub Pages, Healthchecks.io. Say what the local stand-in proves instead (Mailpit, the relay, the relay's heartbeat endpoint).

## How to work

1. **Read the suite.** `e2e/stack.mjs` fully, then every `e2e/*.e2e.mjs` fully. For each case, write one line per assertion: file, line, what it proves, in the document's words. The sentence in `.claude/skills/barry-backend-verify/SKILL.md` that begins with `npm run e2e` names every case; check that it still matches the files.
2. **Read the documents.** `docs/spec.md`, `CONTEXT.md`, `docs/adr/0001-server-owns-the-deadline.md`, every `docs/*.md`, and every `.claude/skills/barry-frontend-verify/features/*.md`. Write the use cases as one line each with `path:line`. Do not sample; do not judge from headings.
3. **Map** every use case to the assertion lines that prove it, or to a recipe, or to one of the three statuses above. A use case a case proves only in part gets the gap for the missing part, in the document's words: "the second and third Alert an hour apart" when a case proves only the first.
4. **Rank the gaps.** First the ones where a wrong outcome misleads someone in a safety situation: an Alert that does not go out or goes to the wrong address, an All-clear that does not follow a Check-in, a Deadline move that does not stop the Alert, a Delivery Failure that stays hidden. Then data loss: a deletion that removes too much or too little. Then everything else.
5. **Sketch each gap.** One paragraph: the file name in the suite's style (`<behaviour>.e2e.mjs`), the fixture and the helpers it would use, the steps, and the assertions in the document's words. Say what it needs that the stack cannot give today, if anything, such as a way to move `last_alert_at` back an hour instead of waiting. Without `--fix` the sketch is for the author and this skill writes no test. With `--fix` the sketch is the plan for the case this skill writes.

## Report

Write the report in Markdown with these sections, in this order:

1. **Summary**: the counts of use cases that are proven end to end, proven in part, by hand only, needing the phone, needing the outside, and not covered at all; the three gaps that matter most.
2. **Gaps**, ranked as above: one entry each with the use case in the document's words and its `path:line`, the nearest existing case and what it proves instead, the coverage below end to end if any (Jest, pgTAP, Deno, a recipe), and the sketch.
3. **Proven in part**: the use case, the case that proves part of it, and the missing part.
4. **By hand only**, **Needs the phone** and **Needs the outside**: one line each with the recipe or the stand-in.
5. **Proven end to end**: one line per use case naming the file and line that proves it. Long is expected.
6. **Documents that disagree with the suite**: a case that asserts something a document denies, or a document that names a case the suite no longer has, with both sides quoted. These belong to the barry-audit-consistency skill too; name them here so they are not lost.

Quote documents verbatim with `path:line`. One gap per outcome. Do not pad.

With `--fix`, each gap also carries an outcome: **written** with the file and the commit hash, or **skipped** with the rule below that stopped it, and the report ends with a list of the commits made, in order, one line each, and a list of the skipped gaps with their rules.

## Writing cases with --fix

Only after the report is complete, and only when the stack is up: `npx supabase start` has run, `node scripts/sms-relay.mjs` listens on :8788, and an existing case such as `e2e/check-in-in-time.e2e.mjs` passes when run alone. Without that, write nothing and say so; a case nobody has seen pass proves nothing. Work through the gaps in the report's order and write a case only when every rule below holds. Skip the gap otherwise and say which rule stopped it.

1. **The gap is a real gap.** Not one that is by hand only, needs the phone or needs the outside; those stay with the recipe or the stand-in the report names.
2. **The stack can give what the case needs.** When the sketch says it needs something the stack cannot give today, such as moving `last_alert_at` back an hour, the case may get a helper in `e2e/stack.mjs` beside `missDeadline` that does only that, writes only the rows the clock would have written, and is named in the report. Nothing else outside `e2e/` changes: no migration, nothing under `src/` or `supabase/functions/`, no config. If the case needs the implementation to change, it is a finding for the author, not a case.
3. **One gap, one file, one `test(...)`,** named `e2e/<behaviour>.e2e.mjs` as the sketch says, in the shape of the files beside it: `assert` from `node:assert/strict`, `test` from `node:test`, the helpers from `./stack.mjs`, and `adventurer()` as the fixture, so the account and its contacts are deleted afterwards, also when the case fails. The assertions are the document's words, with the document and its section they come from in a comment, such as `docs/spec.md § Adventures > Move the Deadline`, never a line number, which moves with every edit. A case asserts the outcome the document promises, not the steps on the way to it, and never only that a command returned null.
4. **Nothing existing changes,** except one addition to `e2e/stack.mjs` under rule 2 and in `.claude/skills/barry-backend-verify/SKILL.md` the sentence that begins with `npm run e2e`, which gains the new case in the same commit so that it still names every file, and the table **Which tests cover what**, whose row for the area the case proves gains the file. No existing case is edited, weakened or merged.
5. **It passes, alone and with the suite.** Run the new file alone with `node --test --test-timeout=300000 e2e/<file>`, then `npm run e2e`, then `npx expo lint` and `npx tsc --noEmit`. A case that waits on the clock uses `missDeadline`, `assertClockRan` and `runDeliver` as its neighbours do, never a sleep of minutes. If the new file fails, read why: a wrong case is corrected and run again; a case that is right and fails because the stack does not do what the document promises is reverted with `git checkout -- e2e/` and reported as a finding for the barry-audit-consistency skill, with the output. A case that passes only sometimes is reverted too; the suite is not made flaky to close a gap.
6. **One case, one commit.** Commit the new file, the helper if any, and barry-backend-verify's sentence and table together, with a message in the style of the repository's history: one sentence that says what the suite now proves, not what the diff does, for example "The e2e suite proves that the second and third Alert follow an hour apart and that the fourth never comes", followed by the attribution lines the session requires.
7. **Never push, never open a pull request.** If the current branch is the default branch, create a branch first and say which. Leave pushing to the user unless they asked for it in the same message.
