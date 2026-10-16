// supabase/functions/deliver/: drains public.messages, renders, sends, settles, reports health.
//
// Files:
//   index.ts         Deno.serve handler (below: `deliver`)
//   messages.en.ts   ALL message text, one place, per kind and channel (spec: "kept in one place")
//   senders.ts       Record<Channel, Sender>
//
// deliver holds NO clock logic and NO audience logic. Stages, due times, who gets what,
// idempotency, cancellation and ordering are decided in Postgres (private.reconcile,
// private.enqueue_to_contacts, public.claim_messages). deliver only turns rows into sends.

// ─── Rows and facts (parsed at the boundary from public.claim_messages / message_facts) ───

type Channel = 'email' | 'sms' | 'push';
type MessageKind = 'heads_up' | 'reminder' | 'overdue_notice' | 'alert' | 'all_clear';

type ClaimedMessage = {
  id: number;
  attempt: number; // attempts after the claim; settle_message ignores stale attempts
  kind: MessageKind;
  channel: Channel;
  toAddress: string;
};

type Position = { takenAt: Date; latitude: number; longitude: number; accuracyM?: number };

/** Everything beyond the name. Only the Alert variant below can carry it. */
type ProfileDetails = {
  phone: string;
  car?: { make?: string; colour?: string; plate?: string };
  medicalNotes?: string;
};

/**
 * What a template may say. Built by public.message_facts at send time.
 * The full Adventurer Profile exists only on `kind: 'alert'`, so a Heads-up or All-clear
 * template that tries to print the phone number or medical notes does not compile.
 */
type MessageFacts = {
  timeZone: string;
  adventurerName: string;
  plan: { destination: string; route?: string; startingPoint?: string; notes?: string };
  deadline: Date;
  contactName?: string;
} & (
  | { kind: 'heads_up' }
  | { kind: 'reminder' }
  | { kind: 'overdue_notice'; alertAt: Date }
  | { kind: 'alert'; round: 1 | 2 | 3; lastKnownPosition?: Position; profile: ProfileDetails }
  | { kind: 'all_clear'; checkedInAt: Date }
);

type Rendered = { subject: string; text: string; html?: string };

// ─── messages.en.ts ─────────────────────────────────────────────────────────────────

/**
 * Exhaustive over kind (switch + `never`), so a new kind fails the build here.
 * Times always via formatTime(): "18:00 Zurich time" in facts.timeZone.
 * Alert: facts only, no guidance. Map link: https://www.openstreetmap.org/?mlat=..&mlon=..
 * SMS uses `text`; templates keep `text` self-contained so SMS needs no new template.
 */
export function render(facts: MessageFacts, channel: Channel): Rendered {
  void facts; void channel;
  throw new Error('not implemented');
}

export function formatTime(at: Date, timeZone: string): string {
  // TODO Intl.DateTimeFormat('en-GB', { timeZone, hour, minute, weekday, day, month })
  //   + city from IANA name: 'Europe/Zurich' -> 'Zurich time'
  void at; void timeZone;
  throw new Error('not implemented');
}

// ─── senders.ts ─────────────────────────────────────────────────────────────────────

/** `retry` = transient (timeout, 5xx, rate limit). `failed` = permanent (bad address, not enabled). */
type SendOutcome =
  | { kind: 'sent'; providerRef?: string }
  | { kind: 'retry'; reason: string; afterSeconds?: number }
  | { kind: 'failed'; reason: string };

type Sender = (to: string, message: Rendered, idempotencyKey: string) => Promise<SendOutcome>;

/** Local: SMTP to the Mailpit container (supabase_inbucket_barry-local). Production: provider HTTP API with Idempotency-Key. */
declare function emailSender(env: { mode: 'smtp' | 'resend' }): Sender;
/**
 * Expo push API. Accepted by Expo -> 'sent'. DeviceNotRegistered -> 'failed'.
 * v1 reads no delivery receipts and removes no expired tokens.
 */
declare function expoPushSender(): Sender;
/**
 * No sms row is created while private.channel_config has sms disabled. This sender exists
 * because Record<Channel, Sender> is exhaustive, and it fails permanently if a row slips through.
 */
const notEnabled: Sender = async () => ({ kind: 'failed', reason: 'channel_not_enabled' });

// Adding text messages: replace `notEnabled` with a provider's sender, set its secrets, and
// set sms to enabled in private.channel_config. The clock, the templates and the app do not change.
export function senders(): Record<Channel, Sender> {
  return {
    email: emailSender({ mode: Deno.env.get('EMAIL_MODE') === 'resend' ? 'resend' : 'smtp' }),
    sms: notEnabled,
    push: expoPushSender(),
  };
}

// ─── index.ts ───────────────────────────────────────────────────────────────────────

type Health = { clockOk: boolean; adventuresOk: boolean; outboxOk: boolean; detail: string };

/**
 * Backed by supabase-js with SUPABASE_SERVICE_ROLE_KEY. Each method is one supabase.rpc() call
 * to a public function that only service_role may execute. No direct Postgres connection.
 *   claimMessages -> rpc('claim_messages', { p_limit })
 *   messageFacts  -> rpc('message_facts', { p_message_id })
 *   settle        -> rpc('settle_message', { p_id, p_attempt, p_outcome, p_provider_ref, p_reason, p_retry_after })
 *   health        -> rpc('health')
 */
type Db = {
  claimMessages(limit: number): Promise<ClaimedMessage[]>;
  messageFacts(id: number): Promise<MessageFacts>;
  settle(id: number, attempt: number, outcome: SendOutcome): Promise<void>;
  health(): Promise<Health>;
};

/**
 * Invoked by pg_net: after every command that enqueued messages, and after every tick
 * (every minute). Overlapping invocations are safe: claims use FOR UPDATE SKIP LOCKED.
 * Auth: Authorization: Bearer DELIVER_SECRET (constant-time compare), else 401.
 */
export async function deliver(db: Db, send: Record<Channel, Sender>, heartbeat: (ok: boolean, detail: string) => Promise<void>): Promise<void> {
  // TODO:
  // const deadline = Date.now() + 20_000;           // stay well inside the lease (2 min)
  // while (Date.now() < deadline) {
  //   const batch = await db.claimMessages(20); if (batch.length === 0) break;
  //   await Promise.all(batch.map(async (m) => {
  //     const outcome = await safe(async () =>      // a throw becomes { kind: 'retry' }
  //       send[m.channel](m.toAddress, render(await db.messageFacts(m.id), m.channel), `barry-${m.id}`));
  //     await db.settle(m.id, m.attempt, outcome);
  //   }));
  // }
  // const h = await db.health();
  // await heartbeat(h.clockOk && h.adventuresOk && h.outboxOk, h.detail);
  //   // GET HEALTHCHECK_URL, or HEALTHCHECK_URL/fail with the detail; skipped if unset (local)
  void db; void send; void heartbeat;
  throw new Error('not implemented');
}

declare const Deno: { env: { get(name: string): string | undefined } };
