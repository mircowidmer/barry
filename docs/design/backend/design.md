# Barry backend: the clock lives in Postgres, messages are an outbox

Files in this directory:

- `schema.sql` is the migration sketch, with row-level security (RLS) and grants.
- `barry.ts` becomes `src/lib/barry.ts`, the client module that screens import.
- `deliver.ts` becomes `supabase/functions/deliver/index.ts`, the Edge Function that sends.

Bodies marked `not implemented` and the pseudocode in comments are the sketch. Nothing here runs yet.

## Problem

Barry must raise an Alert when the phone is dead. So Supabase owns the Deadline and sends every message ([ADR 0001](../../adr/0001-server-owns-the-deadline.md)). Five kinds of message go out at different moments. The Heads-up goes at Start and to each contact added later. The Reminder goes 30 minutes before the Deadline. The Overdue Notice goes at the Deadline. Up to three Alerts go out one hour apart, starting when the Grace Period ends. The All-clear goes after a Check-in from an Alerted Adventure.

These moments interact with commands the Adventurer can send at any time. Moving the Deadline re-arms the Reminder and turns an Overdue Adventure back into an Active one. A Check-in can race the first Alert. Every path must survive running twice or crashing halfway. A missed Alert is the worst outcome. A duplicate email is acceptable.

The constraints come from the local stack and the spec. Local Supabase runs Postgres 17 with pg_cron 1.6.4, pg_net 0.20.4, supabase_vault 0.3.1 and pgtap 1.3.3. Mail goes to the Mailpit container `supabase_inbucket_barry-local`. The Expo app uses supabase-js with the publishable key. Email comes first and text messages follow as a small change. The scheduled check must report to an outside monitor.

## Usage (caller's view)

```ts
import { barry } from '@/lib/barry-instance';

// Start screen
const warnings = await barry.startWarnings(adventure.id);   // 'no_push', 'email_only', 'unreachable'
const result = await barry.start(adventure.id);   // reads the location and the time zone itself
switch (result.kind) {
  case 'protected':   router.replace(`/adventure/${result.adventure.id}`); break;
  case 'refused':     showRefusal(result.refusal); break;   // 'deadline_not_in_future', 'profile_incomplete', ...
  case 'unconfirmed': showNotProtected({ retry: () => barry.start(adventure.id) }); break;
}

// In-progress screen: press-and-hold completes
const r = await barry.checkIn(adventure.id);
if (r.kind === 'queued') showBanner('Check-in saved. Barry sends it when you have signal.');

// Overdue screen
await barry.moveDeadline(adventure.id, addHours(adventure.deadline, 2));
// adventure.stage === 'overdue' -> countdown to adventure.alertAt

// Contacts screen
const channels = await barry.enabledChannels();   // no 'sms' -> "Text messages not set up yet"
const removed = await barry.removeContact(contact.id);
if (removed.kind === 'in_use') showToast('Anna is a contact of your current Adventure.');

// App root
await barry.registerPushDevice(expoPushToken);   // each time the app opens
AppState.addEventListener('change', s => s === 'active' && barry.flushPendingCheckIns());
const failures = await barry.deliveryFailures(adventure.id);   // "Text messages are not set up yet" for Anna
```

On the server, the only thing anyone runs by hand is `select private.tick();` in a test. pg_cron runs everything else.

## Shape

### One rule for writes

The app writes directly only to rows the clock never reads: `adventurer_profiles`, `emergency_contacts` and `push_devices`. The Adventure tables and `messages` are read-only for the app. The app reads `private.channel_config` only through `public.enabled_channels()`. Five security-definer remote procedure calls (RPCs) change Adventures: `save_adventure`, `delete_adventure`, `start_adventure`, `move_deadline` and `check_in`. Stage rules live in those five functions and nowhere else, per boundary-discipline. A reviewer checks one place.

Privileges fail closed. The migration revokes all table privileges from `anon` and `authenticated`, and revokes the default privileges for tables, sequences and functions created later. It then grants exactly what the app needs. A table someone adds without a policy and a grant is invisible to the app, not open to it. `save_adventure` checks that every contact id belongs to `auth.uid()` and is not removed. Otherwise it refuses with `unknown_contact`, so one Adventurer cannot attach another Adventurer's contact.

### Stage rules by command

| Command | Planned | Active, Overdue | Alerted | Ended |
| --- | --- | --- | --- | --- |
| `save_adventure` | Plan, Deadline and contacts. Destination, Deadline and contacts may be missing. | Plan and contacts. At least one contact remains. | `wrong_stage` | `wrong_stage` |
| `move_deadline` | `wrong_stage` | Later than the current Deadline and the current time. Overdue becomes Active. | `wrong_stage` | `wrong_stage` |
| `start_adventure` | Needs a Profile, a destination, a future Deadline and one contact. | Returns success (idempotent). | Returns success. | `wrong_stage` |
| `check_in` | `wrong_stage` | Ends it. No message. | Ends it. All-clear. | Returns success (idempotent). |
| `delete_adventure` | Deletes it. | `wrong_stage` | `wrong_stage` | `wrong_stage` |

A Profile row exists only once the name and the phone number are filled in, so "Profile complete" means "the row exists". Every Emergency Contact has a phone number or an email address by table check, so one contact satisfies the Start rule for reachability.

### The clock is Postgres

pg_cron runs `private.tick()` every minute inside the database. The Deadline check never crosses a network hop. If the Edge Runtime is down, Stages still advance and Alerts still pile up in the outbox. They go out when delivery recovers. `tick` selects due Adventures through a partial index on `deadline`. The earliest clock event is always 30 minutes before the Deadline, so no cached "next wake" column has to stay in sync.

`tick` runs `reconcile` for each Adventure in its own exception block. If one Adventure throws, `tick` writes the error to `private.tick_error` and moves on to the next one. One bad row cannot stop the Alerts of every other Adventurer.

### One decision function

`private.decide(stage, deadline, deadline_set_at, alerts_sent, last_alert_at, now)` is a pure, immutable SQL function. It returns the next Stage transition, whether a Reminder or an Overdue Notice is owed, and which Alert round is owed. `private.reconcile(adventure_id)` locks the row, calls `decide` until nothing is owed, and enqueues messages. `tick` calls `reconcile` for due Adventures. Every command RPC calls `reconcile` for its own Adventure after its own change, never before. So one code path decides what Barry sends, whether the clock or a tap triggered it.

A Heads-up for a newly added contact needs no extra code. `reconcile` always enqueues a Heads-up for every address of every current contact, and the unique key turns that into "only the new ones". The catch-up rules sit inside `decide`. No Overdue Notice goes out once its Alert time has passed. Alert rounds are spaced from `last_alert_at` and never fire in a burst.

### Messages are rows, and the unique key is the idempotency

One row in `messages` is one message to one address on one channel. The constraint `unique nulls not distinct (adventure_id, kind, round, for_deadline, channel, to_address)` makes every enqueue an `on conflict` insert. Re-running `tick`, retrying a command, or reconciling twice cannot send twice. Reminder and Overdue Notice rows carry `for_deadline` in the key, so a moved Deadline re-arms them with no flags to reset, per make-operations-idempotent. A contact removed and re-added gets its cancelled Heads-up back, because the conflict clause revives a cancelled Heads-up row.

### Channels are configuration

`private.channel_config(channel, enabled)` says which channels Barry sends on. Email and push are enabled. Text messages are disabled. `private.enqueue_to_contacts` creates one row for each channel that the contact has and Barry has enabled. A contact with no enabled channel gets exactly one row, born `failed` with the reason `channel_not_enabled`. The app shows that row as a Delivery Failure, so a phone-only contact is never dropped in silence. A contact with an email address and a phone number gets only the email row while text messages are disabled. That contact gets no Delivery Failure for the phone number.

The app learns which channels are enabled through `public.enabled_channels()`, a read-only security-definer function. `barry.enabledChannels()` wraps it for the contact screen, which marks a phone number "Text messages not set up yet". `barry.startWarnings()` gives the Start screen every warning in one call. It returns `no_push` when push permission is denied or no `push_devices` row exists, `email_only` with the contacts that get email only, and `unreachable` with the contacts that have only a phone number and get nothing. The app registers its push token each time it opens, so a lost registration heals on the next launch.

Adding text messages takes two steps. Replace `notEnabled` with a text-message sender in the `Record<Channel, Sender>` in `deliver.ts`. Then set `sms` to enabled in `private.channel_config`. The schema, the clock and the templates do not change. The app drops the "not set up" marks and the `email_only` and `unreachable` warnings by itself.

### Delivery is a plain drain

`deliver` reaches Postgres only through supabase-js with the service role key. It has no direct Postgres connection. It calls four public functions: `claim_messages`, `settle_message`, `message_facts` and `health`. The migration revokes execute on them from `public`, `anon` and `authenticated` and grants it only to `service_role`. They are security-definer functions, so they read `private` tables without exposing the schema.

The `deliver` Edge Function claims rows with `FOR UPDATE SKIP LOCKED` and a 2-minute lease. It reads `message_facts(id)` at send time, so the Alert carries the latest Plan, Last Known Position and Adventurer Profile. It renders with `messages.en.ts`, sends through `Record<Channel, Sender>`, and settles the row. Crash safety comes from the lease. A crash between send and settle lets the lease expire, and the row goes out again. Delivery is at least once.

pg_net kicks `deliver` inside each command's transaction. pg_net queues the request in a table, so a rolled-back Start kicks nothing. The Heads-up leaves seconds after Start, not at the next tick.

### Ordering and the All-clear rule

The claim query in `claim_messages` enforces ordering per address, by kind:

- An Alert waits only for older Alert rounds to the same address. It never waits for a Heads-up, so a Heads-up in retry backoff cannot hold back an Alert.
- An All-clear waits until every Alert to the same address is `sent` or `failed`.
- A Heads-up, a Reminder and an Overdue Notice wait for nothing.

The All-clear audience is the set of addresses whose Alert may have reached them when the Check-in commits. That is an Alert row that is `sent`, `sending`, or `pending` after at least one attempt. A retry after a timed-out attempt counts, because the earlier attempt may have been delivered. `check_in` builds that set in three steps under the Adventure row lock:

1. It cancels every `pending` row of the Adventure, except an Alert with at least one attempt. It never touches a `sending` row.
2. It calls `private.enqueue_all_clear`, which reads the Alert rows in a later statement.
3. It kicks `deliver`.

The race works out because Postgres runs these statements at READ COMMITTED. Suppose `deliver` has claimed an Alert row but not committed. The cancel in step 1 waits for that row lock, rereads the row, sees `sending` and leaves it. Step 2 then sees the row as `sending` and includes its address. Suppose instead the cancel commits first. Then `deliver` never claims the row, and the address gets no All-clear because it got no Alert.

`deliver` never cancels an Alert. The cancel step in `claim_messages` touches only `pending` Heads-up, Reminder and Overdue Notice rows. So an Alert that was `sending` at the Check-in and then settles as `retry` stays in the queue until it is sent or fails. Its All-clear waits for it. If every Alert to an address fails, the claim step cancels that address's All-clear with `no_alert_delivered`. No contact gets an All-clear without its Alert.

### Delivery Failure is a status, not a table

A `retry` outcome backs off for up to 6 attempts and then becomes `failed`. A permanent error fails at once. The `delivery_failures` view uses `security_invoker`, so RLS applies, and the app reads it. The view leaves out push messages, because the spec limits Delivery Failures to messages for Emergency Contacts.

### The heartbeat proves the whole chain

Each tick kicks `deliver`, so `deliver` runs every minute whether or not there is mail. After it drains the outbox, it calls `health()`, which checks three things:

- The clock ticked in the last 2 minutes.
- No `private.tick_error` row is younger than 2 minutes.
- No `pending` row is more than 5 minutes overdue.

If all three hold, `deliver` pings the healthchecks URL. Otherwise it pings `/fail` with the reason. If pg_cron, pg_net, the Edge Runtime, the `deliver` code or the database dies, the pings stop or turn into failures, and the monitor tells the operator. One heartbeat covers every link, not only the scheduler.

### Guards for contacts and accounts

Contacts use soft delete, so Ended Adventures and sent messages keep their contact. A trigger refuses the removal while an Active, Overdue or Alerted Adventure uses the contact. A Planned Adventure does not block removal. The contact leaves that Adventure instead, and Start refuses with `no_contacts` if none remain.

The v1 app cannot delete the account. `adventures.adventurer_id` cascades on delete. A trigger on `auth.users` raises while the Adventurer has an Active, Overdue or Alerted Adventure. So a delete from the Supabase dashboard or the Auth admin API is blocked while an Adventure is live. Otherwise the account delete cascades through every table.

### Types encode the rules

`Adventure` is a union on `stage`. A started Adventure always has `plan.destination`, `deadline` and `timeZone`, and table checks mirror that. `Refusal` and `Channel` come from the generated Postgres enums, so the refusal list exists once, per encode-lessons-in-structure. RPCs return a refusal instead of raising one, so it arrives typed. `StartResult.unconfirmed` makes the "not protected until Supabase confirms" rule hard to forget at the call site. `start_adventure` is idempotent, so Retry is always safe.

Only the Alert carries the full Adventurer Profile. `MessageFacts` in `deliver.ts` is a union on `kind`, and only the `alert` variant has a `profile` field. A Heads-up or All-clear template that prints the phone number or the medical notes does not compile. `message_facts` builds the same shape on the server side.

`check_in` takes the phone's gesture time and clamps it into `[started_at, now()]`. A wrong phone clock cannot write a Check-in time before the Start or in the future.

### Derived, never copied

The Last Known Position is the latest `position_readings` row. `alert_at` is a generated column from the single `private.grace_period()`.

### Interface depth

Screens see one module with about 20 methods, five injected effects and outcome unions. The module hides the location reading, the time zone capture, the offline queue with single-flight flushing, the RPC wire shapes, the row-to-domain parsing and all Stage rules, which live on the server. It does not expose raw table writes for Adventures, any way to send a message, or any clock value that the client could compute differently.

## Synthesis decision

The arena ran two runners. Candidate A (Opus runner) is the base. It has the pure `decide()` plus `reconcile()` as the single decision path, typed client outcomes (`unconfirmed`, `queued` and refusals), the type-enforced Profile rule, and the heartbeat that proves the whole chain. The cross-judge (Sonnet) scored A 22 and B 21 and recommended A. The Fable and Haiku runners did not run, because they were blocked.

The two runners converged on the same overall shape. Both put the clock in Postgres, used an outbox with a unique key, exposed five command RPCs and sent through an Edge Function. The synthesis therefore grafts details, not structure.

Grafts from candidate B:

- Security. `revoke all` on every table plus default-privilege revocation, so a missing policy fails closed. `save_adventure` checks contact ownership. An account-delete guard trigger replaces A's `on delete restrict`, which contradicted A's own `delete_my_account`.
- Channels. `private.channel_config` and the fan-out that creates rows only for enabled channels, with one row born `failed` for a contact that has none.
- Re-adding a removed contact revives its cancelled Heads-up.
- Robustness. A per-Adventure exception block in `tick`, the `private.tick_error` table, and a heartbeat that reports `/fail` when any Adventure errored. The check sits in A's `health()`.
- The Check-in time clamp into `[started_at, now()]`.
- Realtime publication of `adventures`, which A's `watchAdventure` needed.

Fixes to A that the arena found:

- A's first-in-first-out ordering per address let a Heads-up in retry backoff hold back an Alert. The claim rules now order by kind.
- The All-clear race that the judge found in B also applied to A. `deliver` now never cancels an Alert, and the All-clear audience is the set of addresses with a `sent` or `sending` Alert.
- An Alert in retry backoff at the Check-in may already have reached its contact through a timed-out attempt. `check_in` no longer cancels an Alert with at least one attempt, and its address gets an All-clear. The orchestrator found this gap while reviewing the synthesis.
- A's contact guard now matches the spec. Planned does not block removal.

Rejected from B:

- Thrown errors instead of typed refusals. They reach the client as strings.
- The stage-transition trigger. It duplicates the rules that `decide()` and the five RPCs already own.
- Relevance rules duplicated in TypeScript. Who gets what stays in Postgres only.
- The heartbeat from `tick`. It proves the scheduler but not delivery.

### Answers from 2026-10-15

The user answered the open questions on 2026-10-15:

1. A live Adventure keeps at least one Emergency Contact, and `save_adventure` refuses to remove the last one with `no_contacts`.
2. Deleting a contact that only Planned Adventures use is allowed, and Start refuses later if a Planned Adventure has no contact left.
3. A Deadline set less than 30 minutes ahead gets no Reminder, but the Overdue Notice still goes out.
4. While text messages are not set up, the contact screen and the Start warnings say so, and the unused phone number records no Delivery Failure.
5. No registered push device shows the same Start warning as denied permission, and the app registers its push token each time it opens.
6. `deliver` calls service-role-only public functions through supabase-js, with no `SUPABASE_DB_URL` and no `barry_deliverer` role.
7. Email bounces are out of scope for v1, and `provider_ref` stays for later.
8. "Accepted by Expo" counts as sent, and Expo receipts and expired-token cleanup are out of scope for v1.
9. The scheduler runs every minute instead of every 30 seconds.
10. The v1 app has no account delete, and the `auth.users` guard trigger stays.

## Tradeoffs accepted

- We accept clock logic written in PL/pgSQL and tested with pgTAP in exchange for state transitions and their messages committing atomically, with no network hop between "Deadline passed" and "Alert owed".
- We accept at-least-once delivery in exchange for never losing an Alert. A crash between send and settle resends one email. Email providers get `barry-<message id>` as an idempotency key where they support one.
- We accept a one-minute clock resolution. An Alert can leave up to about a minute after the Grace Period ends.
- We accept a Deadline move or a Check-in that lands in that one-minute lag. `move_deadline` does not reconcile before the move. The spec allows a move any time before the Alert, and during the lag the Alert has not gone out. So an Overdue Adventure whose Grace Period ended a few seconds ago can still become Active again.
- We accept `deliver` running every minute even when idle, about 1,440 calls a day, in exchange for a heartbeat that proves the full chain.
- We accept public functions that only `service_role` may execute, in exchange for no direct Postgres connection and no pooler setup in `deliver`.
- We accept snapshotting `to_address` at enqueue. If the Adventurer edits a contact's email during an Adventure, the new address gets a Heads-up and earlier rows keep the old one. That looks like a bug, but it is the honest record of what went where.
- We accept one Heads-up per address per Adventure once it was sent. A contact removed and re-added after its Heads-up went out gets no second one.
- We accept that a Heads-up in retry backoff can arrive after an Alert to the same address, in exchange for an Alert that never waits behind it.
- We accept one Delivery Failure per Alert round for a phone-only contact while text messages are disabled, so up to three for one contact.
- We accept no Reminder for a Deadline set less than 30 minutes ahead. `decide()` gates the Reminder on `deadline_set_at`. The Overdue Notice still goes out.
- We accept a bounced email counting as `sent`. Bounces are out of scope for v1. `provider_ref` stays so a later webhook can mark the row `failed`.
- We accept "accepted by Expo" as `sent` for push. v1 reads no Expo delivery receipts and removes no expired tokens. A stale token produces a `failed` push row that the app never shows.

## Alternatives considered

- **Clock in an Edge Function.** pg_cron calls a `tick` function in TypeScript with a pure `dueMessages()`. It is easier to unit-test in Deno. But the "Deadline passed" decision then depends on the Edge Runtime and the network, and the Stage transition and the enqueue are no longer one transaction. It still needs idempotency keys in the database, so it hides less than it seems. Rejected because it adds a failure mode to the single point of failure that ADR 0001 names.
- **Precomputed schedule table.** Start inserts future rows for the Reminder, the Overdue Notice and the Alerts, and every Deadline move or Check-in reschedules them. Every command then has to know every future message and keep it in sync. Rejected in favour of deriving what is owed from the current state with `decide()`.
- **Direct table writes for the Plan and contacts of an in-progress Adventure, guarded by triggers.** Fewer RPCs. But the Stage rules would split across RLS, column grants and triggers, and the Deadline would have two write paths. Rejected for the one-rule boundary.
- **Supabase Queues (pgmq) as the outbox.** pgmq 1.5.1 is available and gives visibility timeouts. But a queue message has no unique business key. The idempotency Barry needs is "this Alert round to this address exists once", and a table constraint expresses that while a queue does not.

## Implementation reconciliation

- `private.decide()` is implemented in `supabase/migrations/20261015081453_clock_decide.sql`, with the `adventure_stage` enum, the four timing constants and the `clock_decision` type. `supabase/tests/database/decide.test.sql` checks it against 20 cases. The behaviour matches the sketch's pseudocode with no deviation. A Deadline set exactly 30 minutes ahead still gets a Reminder, and one set less than 30 minutes ahead does not.
- The tables, row-level security, grants and the two guard triggers are implemented in `supabase/migrations/20261015082020_core_tables.sql`, checked by `access.test.sql`. One local deviation: Postgres rejects `deadline + private.grace_period()` in a stored generated column because adding an interval to a timestamp is not immutable. `alert_at` therefore calls `private.alert_time()`, declared immutable. It only adds 30 minutes, so the result is the same in every time zone. The `refusal` enum, `clock_status`, `tick_error` and the pg_cron and pg_net extensions wait for the steps that use them.
- `private.reconcile()`, `private.enqueue_to_contacts()` and `private.enqueue_push()` are implemented in `supabase/migrations/20261015082022_reconcile.sql`, checked by `reconcile.test.sql`. One local deviation from the pseudocode: `decide()` owes a Reminder or an Overdue Notice on every call inside its window, so the loop continues only after a Stage change. Without that rule the loop would never end. `reconcile` also returns at once for a Planned, Ended or unknown Adventure.
- The five commands, the `refusal` enum and `private.enqueue_all_clear()` are implemented in `supabase/migrations/20261015082752_commands.sql`, checked by `commands.test.sql`. Three deviations, accepted in this session:
  - The command that makes a message stale now cancels it, instead of `claim_messages`. `save_adventure` cancels the pending rows of a removed contact. `move_deadline` cancels the pending Reminder and Overdue Notice for the old Deadline. `check_in` already cancelled the rest. The rule holds before `deliver` exists. Correction from the `deliver` step: `claim_messages` still needs its cancel step, because a row that was `sending` when the command ran can come back as a retry afterwards.
  - The commands do not call `kick_deliverer()` yet, because `deliver` does not exist. The step that builds `deliver` adds the call.
  - `save_adventure` refuses `destination_missing` when an Active or Overdue Adventure would lose its destination. The table check already forbade it, and the refusal makes it typed. `private.record_position()` is a small helper that Start and a Deadline move share.
- `private.tick()`, `private.clock_status`, `private.tick_error` and the `barry-tick` pg_cron job are implemented in `supabase/migrations/20261015083131_tick.sql`, checked by `tick.test.sql`. A real pg_cron run on the local stack succeeded and updated `clock_status`. Two local deviations: `tick` takes `p_now` like `reconcile`, so tests drive it at any time, and pg_cron calls it with the default `now()`. `tick` does not call `kick_deliverer()` yet, because `deliver` does not exist.
- `deliver` is implemented. The database side is `supabase/migrations/20261015084008_deliver.sql` (`claim_messages`, `settle_message`, `message_facts`, `health`, `kick_deliverer`), checked by `deliver.test.sql`. The Edge Function is `supabase/functions/deliver/`, with Deno tests for the message text in `messages.en.test.ts`. `scripts/e2e-deliver.mjs` drives the real stack through the API: the Heads-up, the Alert and the All-clear all reached Mailpit, and `health()` reported all three checks healthy. Deviations, accepted in this session:
  - Email goes to Mailpit's HTTP send API instead of SMTP. Hosted email providers also take mail over HTTP, so going live replaces `mailpitEmail` in `senders.ts` and nothing else.
  - A statement trigger on `messages` wakes `deliver` whenever a row is inserted, and `tick` wakes it every minute. The commands do not call `kick_deliverer()` themselves. Every path that queues a message wakes `deliver`, whoever wrote it.
  - `health()` returns three booleans and no `detail` column. `deliver` names the failing checks in the `/fail` ping.
  - `facts.ts` parses the `message_facts` JSON into the typed `MessageFacts` union. `formatTime` builds the time from date parts, because the Edge runtime and Deno on macOS punctuate `Intl` output differently.
  - Local settings live in `config.toml` under `[edge_runtime.secrets]`, and the two Vault secrets in `supabase/seed.sql`. The hosted project sets its own.
  - Not yet proven: the heartbeat ping, because no Healthchecks.io URL is set locally, and the push sender, because no real device is registered.
- The client module is implemented in `src/lib/barry/`, with Jest tests for row parsing, the offline Check-in queue and the Start warnings. `public.enabled_channels()` is in `supabase/migrations/20261015085353_enabled_channels.sql`. The screens drove a full Adventure in the iOS simulator through Expo Go: sign-up, Profile, two contacts, Start with the warnings, a Deadline move, an Alert that reached the screen through Realtime, and a press-and-hold Check-in that sent the All-clear. Deviations, accepted in this session:
  - The sketch's single `barry.ts` is a folder. `types.ts`, `rows.ts`, `check-in-queue.ts` and `warnings.ts` hold logic that runs without a phone. `client.ts` builds the API from injected effects, and `index.ts` wires the real ones. Screens import only `@/lib/barry`.
  - `startWarnings(id)` became `barry.startConditions()` plus a pure `startWarnings(contacts, conditions)`. The Plan screen computes the warnings from the contacts selected on screen, so an Adventure that has not been saved yet also shows them.
  - The app does not register for push yet. `expo-notifications` needs a development build and project credentials, so every Start warns that there will be no Reminder or Overdue Notice. `registerPushDevice` waits for that step.
  - `StartResult` and `MoveDeadlineResult` carry an `InProgressAdventure`, because a retried Start can find the Adventure already Overdue.

## Open questions and risks

- Before writing `emailSender`, check that the Edge Runtime container reaches SMTP on `supabase_inbucket_barry-local` over the Docker network.

## Next implementation step

Write `private.decide()` and its pgTAP case table first. The table covers each Stage against the current time relative to the Deadline, the Grace Period and the last Alert, including the catch-up cases. Every message Barry sends follows from it.
