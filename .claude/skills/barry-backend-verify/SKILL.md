---
name: barry-backend-verify
description: Prove a change to Barry's backend (the migrations, the Adventure commands, the clock, the outbox, the Edge Function deliver and its messages, delivery reports, the Trail Map data and the heartbeat) against the local Supabase stack, without the app, and capture proof. Runs on a Mac and in a Linux cloud session alike. Use before calling any change under supabase/ done; a change to the screens or to src/lib/barry goes to barry-frontend-verify.
---

# Verify Barry's backend

Supabase owns the Deadline (`docs/adr/0001-server-owns-the-deadline.md`): pg_cron runs the clock, the commands change Adventures, the outbox holds every message to an Emergency Contact, and `deliver` sends email to Mailpit and text messages to a local relay that prints them. All of it can be proven without the phone, the way the app would call it: signed in as an Adventurer through the public RPCs. This skill does that. What only the phone does (the screens, the client module in `src/lib/barry`, local notifications, recording the Trail) is [barry-frontend-verify](../barry-frontend-verify/SKILL.md)'s.

Helpers live in `.claude/skills/barry-backend-verify/scripts/`, run from the repo root. Shell commands that touch Docker need the sandbox disabled.

## Launch

From the repo root, in this order:

1. Docker. On a Mac, Docker Desktop. In a Claude Code cloud session the SessionStart hook (`.claude/hooks/session-start.sh`) starts the daemon; if `docker info` fails, run that hook again.
2. `npx supabase start`. On a fresh machine it pulls the images first, which takes several minutes. After a change to a migration or to `supabase/seed.sql`, run `npx supabase db reset --local`, which applies every migration and the seed (the Vault secrets `deliver` needs). A reset also deletes the test account `.env.local` names, which barry-frontend-verify drives the app with; this skill does not need it.
3. `node scripts/sms-relay.mjs` as a background process. Ready when it prints `sms relay listening on http://localhost:8788`.
4. After a change under `supabase/functions`, `docker restart supabase_edge_runtime_barry-local`. The local edge runtime does not always reload the functions, and messages then still go out with the old code.
5. Run the doctor. Every line must say `ok`.

Only one stack exists: one database, one relay port. If the doctor shows a stack you did not start, use it only if the user said so, and never reset it.

## Doctor

`.claude/skills/barry-backend-verify/scripts/doctor.sh` is read-only. It checks Docker, the three Supabase containers, the API, a pg_cron tick in the last two minutes, and the text message relay on :8788. Run it first, and again whenever anything looks off.

## Prove it

Work from the fastest proof to the slowest, and stop at the first failure.

1. **The checks without the stack.** `deno test supabase/functions/deliver` for a change under `supabase/functions`.
2. **The pgTAP files of the change.** `npx supabase test db supabase/tests/database/<file>.test.sql`, one per file the map below names, then `grep -l <function or kind>` over `supabase/tests/database/` for any it missed.
3. **The e2e files of the change.** `node --test --test-timeout=300000 e2e/<file>.e2e.mjs ...`, every file the map names in one run, so they run in parallel.
4. **A probe, where no case covers the change.** See below.
5. **The full suites.** `npx supabase test db`, `deno test supabase/functions/deliver` and `npm run e2e`. A change to one function can break a case the map does not name, and only the full run says it did not.

### Which tests cover what

| The change touches | pgTAP | e2e |
| --- | --- | --- |
| `private.decide`, `private.reconcile`, `private.tick`: the clock, the stages, the Grace Period, the Alert rounds | `decide`, `reconcile`, `tick` | `missed-deadline`, `alert-rounds`, `check-in-in-time`, `check-in-while-overdue`, `overdue-move`, `move-after-alert`, `planned-adventure`, `queued-check-in-after-alert` |
| `save_adventure`, `start_adventure`, `delete_adventure` and the Stage rules | `commands` | `start-needs-profile`, `start-refuses-past-deadline`, `alerted-is-locked`, `planned-adventure`, `delete-ended-adventure` |
| `move_deadline` and the Deadline Update | `commands`, `deadline_update` | `move-deadline`, `move-records-position`, `move-sends-no-plan-update`, `overdue-move`, `move-after-alert`, `deadline-update`, `deadline-update-cancelled-by-check-in`, `deadline-update-cancelled-by-alert` |
| `check_in` and the All-clear | `commands` | `check-in-in-time`, `check-in-while-overdue`, `queued-check-in-after-alert`, `missed-deadline` |
| The Plan Update | `plan_update` | `plan-update`, `alert-carries-latest-plan`, `move-sends-no-plan-update` |
| Emergency Contacts and their addresses | `contact_switches`, `shared_address` | `contact-switches`, `contact-switched-back-on`, `contact-needs-address`, `contact-in-use`, `contact-in-use-while-overdue`, `contact-added-while-overdue`, `last-contact-stays`, `removed-contact`, `shared-address` |
| `delete_account` and Auth | `account` | `delete-account`, `delete-account-refused-while-alerted`, `delete-account-refused-while-overdue`, `delete-account-waits-for-all-clear`, `account-changes`, `password-reset` |
| `record_trail` and the Trail Map data | `trail`, `trail_after` | `trail`, `trail-stops-at-check-in`, `trail-map-hides-overdue`, `trail-map-shows-plan`, `own-trail-map-link` |
| `deliver`: `messages.en.ts`, `messages.de.ts`, `facts.ts`, `links.ts`, `senders.ts`, `claim_messages` | `deliver` | `german`, `alert-states-facts`, `alert-carries-latest-plan`, `own-trail-map-link`, `undelivered-alert` |
| Twilio's delivery reports | `delivery_report` | `delivery-report`, `forged-delivery-report`, `undelivered-alert` |
| `health()` and the heartbeat | `health` | `health` |
| Grants and privileges | `access` | none: the pgTAP file is the proof |

### Probes

A probe drives the stack the way the app would, for a behaviour no case proves yet. Write it as a `node:test` file in the run's proof folder, `.verify-artifacts/<run-id>/probe.e2e.mjs`, import from `../../e2e/stack.mjs`, and run it from the repo root with `node --test --test-timeout=300000 .verify-artifacts/<run-id>/probe.e2e.mjs`. The helpers it needs are already there:

- `adventurer()` creates a signed-in Adventurer with a Profile and the contacts Luca (email) and Sara (phone), and deletes the account again when the file ends, also on failure. Its `client` calls the RPCs as the app does; `start()` saves and starts an Adventure to `Grosser Mythen`.
- `missDeadline(id)`, `tick()` and `hourAfterAlert(id)` skip the waiting: they move the Deadline or the last Alert into the past, or run the clock once.
- `runDeliver()` runs `deliver` the way the clock does and returns its health.
- `waitForMail(to, subject)`, `mailCount`, `waitForText(to, start)`, `textsTo(to)` and `messageKinds(id)` read Mailpit, the relay and the outbox.
- `trailMap(token)` and `trailToken(text)` read the Trail Map the way the page does.

A probe proves one change once. When the change adds or alters a behaviour that `docs/spec.md` or `CONTEXT.md` promises, the probe becomes a case in `e2e/` within the same change, following the rules of barry-e2e-gaps `--fix`, so the suite guards it from then on.

## End-to-end suite

`npm run e2e` checks the most important use cases against the running stack in about four minutes: a missed Deadline with its Alert and All-clear, the second and third Alert an hour apart and nothing after the third, the latest Plan and the full Profile in the Alert, an Alerted Adventure that refuses an edit and a deletion and ends only with the Check-in, a Deadline moved after the third Alert that brings three more Alerts when missed, a removed contact who hears nothing more, a Check-in in time, a Planned Adventure that Barry neither watches nor messages, a moved Deadline, two quick moves that send one Deadline Update, a Deadline Update dropped by the Check-in or by the Alert, a Plan Update, a contact's switched-off address, a shared address that gets one message, a contact the live Adventure keeps on the list, Twilio's delivery reports, German messages, the Trail on the Trail Map, a Trail that stops at the Check-in, each contact's own Trail Map link in every message, deleting an Ended Adventure, deleting an account, an account that waits for an All-clear still on its way, a live Adventure that keeps its last contact, a Check-in while Overdue, an Overdue Adventure that a moved Deadline makes Active again, a Start refused for a passed Deadline, a Start that waits for the name and an Alert without a phone line, the position a Deadline move records, an account that cannot be deleted while Alerted, a Trail Map that hides the Overdue stage, the name and the latest Plan on the Trail Map, a Deadline move that sends no Plan Update, a contact that needs an address, an Alert that states facts only, a forgotten password reset with the code from the recovery email, a password change that checks the current password and an email address change that both addresses confirm, an All-clear that follows the Alert for a Check-in that waited for signal, an undelivered Alert that shows as a Delivery Failure, a contact an Overdue or Alerted Adventure keeps on the list, a Heads-up to a contact added while Overdue, an account that cannot be deleted while Overdue, a switched-off address that is reached again once switched back on, a forged delivery report that changes nothing, and the heartbeat to the monitor. It needs Supabase and `node scripts/sms-relay.mjs` running, and reads emails from Mailpit and texts and heartbeats from the relay. Each file in `e2e/` creates its own account with unique contacts and deletes it afterwards, also when a test fails, so the files run in parallel and never touch the test account. The suite drives the database, the clock and `deliver` directly. It does not tap through the app; that is barry-frontend-verify's.

## Evidence

Write proof to `.verify-artifacts/<run-id>/`, which git ignores, with `<run-id>` as `YYYYMMDD-HHMM-<change>`.

- Test output: each run's output, with `2>&1 | tee .verify-artifacts/<run-id>/<suite>.txt`.
- Probes: the probe file itself and its output.
- Messages: the Mailpit subjects and recipients (`curl -s 'http://127.0.0.1:54324/api/v1/search?query=to:<address>'`) and the relay's lines (`curl -s http://localhost:8788/messages`) for the messages the change sends or stops.
- Stored state, where the change is about rows: `npx supabase db query --local "<select>"` before and after.

Proof standards: drive the backend through the RPCs as a signed-in Adventurer, the way the app calls them, never by writing the tables a command owns. Only the time-travel helpers of `e2e/stack.mjs` write directly, to skip waiting. A message counts as sent when it is in Mailpit or the relay, not when its outbox row says `sent`. A check you could not run is reported as unverified with the unmet precondition. It is never passed through a different path.

## Cleanup

- Probes and e2e files delete their own accounts. If a run was killed, `npx supabase db query --local "select email from auth.users where email like 'anna-%@example.com'"` lists the leftovers; delete them with the Auth admin API only if the user agrees.
- Stop only the processes this run started: the text message relay by its task ID, and `npx supabase stop` if the run started Supabase.
- Keep `.verify-artifacts/`. Cleanup never deletes proof.
