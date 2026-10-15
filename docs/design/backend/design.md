# Barry backend: the clock lives in Postgres, messages are an outbox

Files in this directory:

- `schema.sql` is the migration sketch, with row-level security (RLS) and grants.
- `barry.ts` becomes `src/lib/barry.ts`, the client module that screens import.
- `deliver.ts` becomes `supabase/functions/deliver/index.ts`, the Edge Function that sends.

Bodies marked `not implemented` and the pseudocode in comments are the sketch. Nothing here runs yet.

## Problem

Barry must raise an Alert when the phone is dead. So Supabase owns the Deadline and sends every message ([ADR 0001](../../adr/0001-server-owns-the-deadline.md)). Five kinds of message go out at different moments. The Heads-up goes at Start and to each contact added later. The Reminder goes 30 minutes before the Deadline. The Overdue Notice goes at the Deadline. Up to three Alerts go out one hour apart, starting when the Grace Period ends. The All-clear goes after a Check-in from an Alerted Adventure.

These moments interact with commands the Adventurer can send at any time. Moving the Deadline re-arms the Reminder and turns an Overdue Adventure back into an Active one. A Check-in can race the first Alert. Every path must survive running twice or crashing halfway. A missed Alert is the worst outcome. A duplicate email is acceptable.

The constraints come from the local stack and the spec. Local Supabase runs Postgres 17 with pg_cron 1.6.4 (30-second schedules work), pg_net 0.20.4, supabase_vault 0.3.1 and pgtap 1.3.3. Mail goes to the Mailpit container `supabase_inbucket_barry-local`. The Expo app uses supabase-js with the publishable key. Email comes first and text messages follow as a small change. The scheduled check must report to an outside monitor.

## Usage (caller's view)

```ts
import { barry } from '@/lib/barry-instance';

// Start screen
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
const removed = await barry.removeContact(contact.id);
if (removed.kind === 'in_use') showToast('Anna is a contact of your current Adventure.');

// App root
AppState.addEventListener('change', s => s === 'active' && barry.flushPendingCheckIns());
const failures = await barry.deliveryFailures(adventure.id);   // "Text messages are not set up yet" for Anna
```

On the server, the only thing anyone runs by hand is `select private.tick();` in a test. pg_cron runs everything else.

## Shape

### One rule for writes

The app writes directly only to rows the clock never reads: `adventurer_profiles`, `emergency_contacts` and `push_devices`. The Adventure tables and `messages` are read-only for the app. Five security-definer remote procedure calls (RPCs) change Adventures: `save_adventure`, `delete_adventure`, `start_adventure`, `move_deadline` and `check_in`. Stage rules live in those five functions and nowhere else, per boundary-discipline. A reviewer checks one place.

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

pg_cron runs `private.tick()` every 30 seconds inside the database. The Deadline check never crosses a network hop. If the Edge Runtime is down, Stages still advance and Alerts still pile up in the outbox. They go out when delivery recovers. `tick` selects due Adventures through a partial index on `deadline`. The earliest clock event is always 30 minutes before the Deadline, so no cached "next wake" column has to stay in sync.

`tick` runs `reconcile` for each Adventure in its own exception block. If one Adventure throws, `tick` writes the error to `private.tick_error` and moves on to the next one. One bad row cannot stop the Alerts of every other Adventurer.

### One decision function

`private.decide(stage, deadline, deadline_set_at, alerts_sent, last_alert_at, now)` is a pure, immutable SQL function. It returns the next Stage transition, whether a Reminder or an Overdue Notice is owed, and which Alert round is owed. `private.reconcile(adventure_id)` locks the row, calls `decide` until nothing is owed, and enqueues messages. `tick` calls `reconcile` for due Adventures. Every command RPC calls `reconcile` for its own Adventure after its own change, never before. So one code path decides what Barry sends, whether the clock or a tap triggered it.

A Heads-up for a newly added contact needs no extra code. `reconcile` always enqueues a Heads-up for every address of every current contact, and the unique key turns that into "only the new ones". The catch-up rules sit inside `decide`. No Overdue Notice goes out once its Alert time has passed. Alert rounds are spaced from `last_alert_at` and never fire in a burst.

### Messages are rows, and the unique key is the idempotency

One row in `messages` is one message to one address on one channel. The constraint `unique nulls not distinct (adventure_id, kind, round, for_deadline, channel, to_address)` makes every enqueue an `on conflict` insert. Re-running `tick`, retrying a command, or reconciling twice cannot send twice. Reminder and Overdue Notice rows carry `for_deadline` in the key, so a moved Deadline re-arms them with no flags to reset, per make-operations-idempotent. A contact removed and re-added gets its cancelled Heads-up back, because the conflict clause revives a cancelled Heads-up row.

### Channels are configuration

`private.channel_config(channel, enabled)` says which channels Barry sends on. Email and push are enabled. Text messages are disabled. `private.enqueue_to_contacts` creates one row for each channel that the contact has and Barry has enabled. A contact with no enabled channel gets exactly one row, born `failed` with the reason `channel_not_enabled`. The app shows that row as a Delivery Failure, so a phone-only contact is never dropped in silence. A contact with an email address and a phone number gets only the email row while text messages are disabled.

Adding text messages takes two steps. Replace `notEnabled` with a text-message sender in the `Record<Channel, Sender>` in `deliver.ts`. Then set `sms` to enabled in `private.channel_config`. The schema, the clock, the templates and the app do not change.

### Delivery is a plain drain

The `deliver` Edge Function claims rows with `FOR UPDATE SKIP LOCKED` and a 2-minute lease. It reads `private.message_facts(id)` at send time, so the Alert carries the latest Plan, Last Known Position and Adventurer Profile. It renders with `messages.en.ts`, sends through `Record<Channel, Sender>`, and settles the row. Crash safety comes from the lease. A crash between send and settle lets the lease expire, and the row goes out again. Delivery is at least once.

pg_net kicks `deliver` inside each command's transaction. pg_net queues the request in a table, so a rolled-back Start kicks nothing. The Heads-up leaves seconds after Start, not at the next tick.

### Ordering and the All-clear rule

The claim query in `private.claim_messages` enforces ordering per address, by kind:

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

Each tick kicks `deliver`, so `deliver` runs every 30 seconds whether or not there is mail. After it drains the outbox, it calls `private.health()`, which checks three things:

- The clock ticked in the last 2 minutes.
- No `private.tick_error` row is younger than 2 minutes.
- No `pending` row is more than 5 minutes overdue.

If all three hold, `deliver` pings the healthchecks URL. Otherwise it pings `/fail` with the reason. If pg_cron, pg_net, the Edge Runtime, the `deliver` code or the database dies, the pings stop or turn into failures, and the monitor tells the operator. One heartbeat covers every link, not only the scheduler.

### Guards for contacts and accounts

Contacts use soft delete, so Ended Adventures and sent messages keep their contact. A trigger refuses the removal while an Active, Overdue or Alerted Adventure uses the contact. A Planned Adventure does not block removal. The contact leaves that Adventure instead, and Start refuses with `no_contacts` if none remain.

`adventures.adventurer_id` cascades on delete. A trigger on `auth.users` raises while the Adventurer has an Active, Overdue or Alerted Adventure. Otherwise the account delete cascades through every table. `delete_my_account()` checks the same rule first and returns `adventure_in_progress` as a typed refusal. The trigger also covers a delete through the Auth admin API.

### Types encode the rules

`Adventure` is a union on `stage`. A started Adventure always has `plan.destination`, `deadline` and `timeZone`, and table checks mirror that. `Refusal` and `Channel` come from the generated Postgres enums, so the refusal list exists once, per encode-lessons-in-structure. RPCs return a refusal instead of raising one, so it arrives typed. `StartResult.unconfirmed` makes the "not protected until Supabase confirms" rule hard to forget at the call site. `start_adventure` is idempotent, so Retry is always safe.

Only the Alert carries the full Adventurer Profile. `MessageFacts` in `deliver.ts` is a union on `kind`, and only the `alert` variant has a `profile` field. A Heads-up or All-clear template that prints the phone number or the medical notes does not compile. `private.message_facts` builds the same shape on the server side.

`check_in` takes the phone's gesture time and clamps it into `[started_at, now()]`. A wrong phone clock cannot write a Check-in time before the Start or in the future.

### Derived, never copied

The Last Known Position is the latest `position_readings` row. `alert_at` is a generated column from the single `private.grace_period()`.

### Interface depth

Screens see one module with about 19 methods, three effect injections and outcome unions. The module hides the location reading, the time zone capture, the offline queue with single-flight flushing, the RPC wire shapes, the row-to-domain parsing and all Stage rules, which live on the server. It does not expose raw table writes for Adventures, any way to send a message, or any clock value that the client could compute differently.

## Synthesis decision

The arena ran two runners. Candidate A (Opus runner) is the base. It has the pure `decide()` plus `reconcile()` as the single decision path, typed client outcomes (`unconfirmed`, `queued` and refusals), the type-enforced Profile rule, and the heartbeat that proves the whole chain. The cross-judge (Sonnet) scored A 22 and B 21 and recommended A. The Fable and Haiku runners did not run, because they were blocked.

The two runners converged on the same overall shape. Both put the clock in Postgres, used an outbox with a unique key, exposed five command RPCs and sent through an Edge Function. The synthesis therefore grafts details, not structure.

Grafts from candidate B:

- Security. `revoke all` on every table plus default-privilege revocation, so a missing policy fails closed. `save_adventure` checks contact ownership. An account-delete guard trigger replaces A's `on delete restrict`, which contradicted A's own `delete_my_account`.
- Channels. `private.channel_config` and the fan-out that creates rows only for enabled channels, with one row born `failed` for a contact that has none.
- Re-adding a removed contact revives its cancelled Heads-up.
- Robustness. A per-Adventure exception block in `tick`, the `private.tick_error` table, and a heartbeat that reports `/fail` when any Adventure errored. The check sits in A's `private.health()`.
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

## Tradeoffs accepted

- We accept clock logic written in PL/pgSQL and tested with pgTAP in exchange for state transitions and their messages committing atomically, with no network hop between "Deadline passed" and "Alert owed".
- We accept at-least-once delivery in exchange for never losing an Alert. A crash between send and settle resends one email. Email providers get `barry-<message id>` as an idempotency key where they support one.
- We accept a 30-second clock resolution. An Alert can leave up to about 30 seconds after the Grace Period ends.
- We accept a Deadline move or a Check-in that lands in that 30-second lag. `move_deadline` does not reconcile before the move. The spec allows a move any time before the Alert, and during the lag the Alert has not gone out. So an Overdue Adventure whose Grace Period ended a few seconds ago can still become Active again.
- We accept `deliver` running every 30 seconds even when idle, in exchange for a heartbeat that proves the full chain.
- We accept snapshotting `to_address` at enqueue. If the Adventurer edits a contact's email during an Adventure, the new address gets a Heads-up and earlier rows keep the old one. That looks like a bug, but it is the honest record of what went where.
- We accept one Heads-up per address per Adventure once it was sent. A contact removed and re-added after its Heads-up went out gets no second one.
- We accept that a Heads-up in retry backoff can arrive after an Alert to the same address, in exchange for an Alert that never waits behind it.
- We accept one Delivery Failure per Alert round for a phone-only contact while text messages are disabled, so up to three for one contact.

## Alternatives considered

- **Clock in an Edge Function.** pg_cron calls a `tick` function in TypeScript with a pure `dueMessages()`. It is easier to unit-test in Deno. But the "Deadline passed" decision then depends on the Edge Runtime and the network, and the Stage transition and the enqueue are no longer one transaction. It still needs idempotency keys in the database, so it hides less than it seems. Rejected because it adds a failure mode to the single point of failure that ADR 0001 names.
- **Precomputed schedule table.** Start inserts future rows for the Reminder, the Overdue Notice and the Alerts, and every Deadline move or Check-in reschedules them. Every command then has to know every future message and keep it in sync. Rejected in favour of deriving what is owed from the current state with `decide()`.
- **Direct table writes for the Plan and contacts of an in-progress Adventure, guarded by triggers.** Fewer RPCs. But the Stage rules would split across RLS, column grants and triggers, and the Deadline would have two write paths. Rejected for the one-rule boundary.
- **Supabase Queues (pgmq) as the outbox.** pgmq 1.5.1 is available and gives visibility timeouts. But a queue message has no unique business key. The idempotency Barry needs is "this Alert round to this address exists once", and a table constraint expresses that while a queue does not.

## Implementation reconciliation

Nothing implemented yet.

## Open questions and risks

- The spec does not say whether an Active or Overdue Adventure may drop to zero contacts. The sketch refuses with `no_contacts`. Is that right?
- The spec does not say what happens to a Planned Adventure when one of its contacts is removed from the list. The sketch drops the contact from that Adventure. Should removal be refused instead?
- The spec says a Reminder goes 30 minutes before the Deadline. If the Adventurer sets a Deadline less than 30 minutes ahead, `decide()` sends no Reminder. Is that right, or should a Reminder go at once?
- The spec says each message goes to every channel the contact has. While text messages are disabled, a contact with an email address and a phone number gets only the email, and the app shows nothing for the phone. Should the app say so, for example on the contact or at Start?
- Should `deliver` use a direct Postgres connection (`SUPABASE_DB_URL`, as sketched, keeping `private` off PostgREST)? The alternative is claim and settle as service-role-only RPCs. Does the direct connection work in hosted Edge Functions without pooler trouble?
- Bounces arrive after `sent`, through the provider's webhook. Should a bounce turn the row into `failed` so it shows as a Delivery Failure? The sketch keeps `provider_ref` for that but adds no webhook.
- Expo push receipts arrive later. Is "accepted by Expo" good enough for the Reminder and the Overdue Notice, given that their failures are never shown?
- With no push device registered, the Reminder and the Overdue Notice produce zero rows. Is the warning at Start enough?
- Is a 30-second pg_cron schedule acceptable on hosted Supabase, or is 1 minute enough?
- `delete_my_account()` is a security-definer function that deletes from `auth.users`. Is that acceptable, or should an Edge Function call the Auth admin API?
- The Edge Runtime container must reach SMTP on `supabase_inbucket_barry-local` over the Docker network. Check that once before writing `emailSender`.

## Next implementation step

Write `private.decide()` and its pgTAP case table first. The table covers each Stage against the current time relative to the Deadline, the Grace Period and the last Alert, including the catch-up cases. Every message Barry sends follows from it.
