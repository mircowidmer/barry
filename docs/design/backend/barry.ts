// src/lib/barry.ts: the only module screens import to talk to Supabase about Adventures.
//
// Screens never call supabase.from('adventures') or supabase.rpc(...) themselves. This module
// parses rows into domain types, reads the location, knows the time zone, and owns the
// offline Check-in queue. Generated DB types (`supabase gen types`) stay private to it.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // generated; never re-exported

// ─── Domain types ─────────────────────────────────────────────────────────────────────

type Brand<T, B extends string> = T & { readonly __brand: B };
export type AdventureId = Brand<string, 'AdventureId'>;
export type EmergencyContactId = Brand<string, 'EmergencyContactId'>;

/** Derived from the Postgres enum, so the client cannot drift from the server's list. */
export type Refusal = Database['public']['Enums']['refusal'];
export type Channel = Database['public']['Enums']['channel'];

export type AdventurerProfile = {
  name: string;
  phone: string; // E.164
  car: { make?: string; colour?: string; plate?: string };
  medicalNotes?: string;
};

/** Reachable by phone, email, or both: never neither. */
export type EmergencyContact = {
  id: EmergencyContactId;
  name: string;
} & ({ phone: string; email?: string } | { phone?: string; email: string });

export type Plan = {
  destination: string;
  route?: string;
  startingPoint?: string;
  notes?: string;
};

export type Position = {
  takenAt: Date;
  latitude: number;
  longitude: number;
  accuracyM?: number;
};

type AdventureBase = {
  id: AdventureId;
  contacts: EmergencyContact[];
};

/** Planned: destination, Deadline and contacts may be missing; Start checks them. */
export type PlannedAdventure = AdventureBase & {
  stage: 'planned';
  plan: Partial<Plan>;
  deadline?: Date;
};

type StartedFields = AdventureBase & {
  plan: Plan;
  deadline: Date;
  timeZone: string; // IANA, fixed at Start
  startedAt: Date;
  lastKnownPosition?: Position;
};

export type ActiveAdventure = StartedFields & { stage: 'active' };
/** `alertAt` is what the Overdue screen counts down to (Deadline + Grace Period, computed server-side). */
export type OverdueAdventure = StartedFields & { stage: 'overdue'; alertAt: Date };
export type AlertedAdventure = StartedFields & { stage: 'alerted'; alertsSent: 1 | 2 | 3 };
export type EndedAdventure = StartedFields & {
  stage: 'ended';
  checkedInAt: Date;
  alertsSent: 0 | 1 | 2 | 3;
};

export type InProgressAdventure = ActiveAdventure | OverdueAdventure | AlertedAdventure;
export type Adventure = PlannedAdventure | InProgressAdventure | EndedAdventure;

export type DeliveryFailure = {
  adventureId: AdventureId;
  message: 'heads_up' | 'alert' | 'all_clear';
  contactName: string;
  channel: Exclude<Channel, 'push'>;
  address: string;
  /** 'channel_not_enabled' renders as "Text messages are not set up yet". */
  reason: 'channel_not_enabled' | 'retries_exhausted' | (string & {});
  at: Date;
};

/** What the Start screen shows before Start. None of them blocks Start. */
export type StartWarning =
  /** "You will get no Reminder or Overdue Notice". */
  | { kind: 'no_push'; reason: 'permission_denied' | 'no_device_registered' }
  /** While text messages are not set up: contacts with a phone number that get email only. */
  | { kind: 'email_only'; contacts: EmergencyContact[] }
  /** While text messages are not set up: contacts with only a phone number, who get nothing. */
  | { kind: 'unreachable'; contacts: EmergencyContact[] };

// ─── Command outcomes ─────────────────────────────────────────────────────────────────

/**
 * Start is never queued. `unconfirmed` means the request may or may not have reached Supabase
 * (timeout, dropped response): the screen must show "not protected" and offer Retry. Start is
 * idempotent server-side, so Retry on an already-started Adventure returns `protected`.
 */
export type StartResult =
  | { kind: 'protected'; adventure: ActiveAdventure }
  | { kind: 'refused'; refusal: Refusal }
  | { kind: 'unconfirmed' };

export type MoveDeadlineResult =
  | { kind: 'moved'; adventure: ActiveAdventure }
  | { kind: 'refused'; refusal: Refusal } // 'wrong_stage' once Alerted
  | { kind: 'unconfirmed' };

/**
 * Check-in is the one command that survives no signal. `queued` means it is persisted on the
 * phone and will be sent when the app next has signal; the Adventure is still in progress on
 * the server until then (and may be Alerted; the All-clear follows).
 */
export type CheckInResult =
  | { kind: 'ended'; adventure: EndedAdventure }
  | { kind: 'queued'; checkedInAt: Date };

export type AdventureDraft = {
  id?: AdventureId; // absent = create
  plan: Partial<Plan>;
  /** Planned only. In-progress Adventures ignore it; use moveDeadline. */
  deadline?: Date;
  /** The Adventurer's own, not removed. Anything else is refused with 'unknown_contact'. */
  contactIds: EmergencyContactId[];
};

// ─── The API screens call ─────────────────────────────────────────────────────────────

export type Barry = {
  // Adventurer Profile and Emergency Contacts (direct table writes under RLS)
  getProfile(): Promise<AdventurerProfile | null>; // null = not set up; Start will refuse 'profile_incomplete'
  saveProfile(profile: AdventurerProfile): Promise<void>;
  listContacts(): Promise<EmergencyContact[]>;
  saveContact(contact: Omit<EmergencyContact, 'id'> & { id?: EmergencyContactId }): Promise<EmergencyContact>;
  /**
   * Refused while an Active, Overdue or Alerted Adventure uses the contact.
   * A Planned Adventure does not block it: the contact leaves that Adventure.
   */
  removeContact(id: EmergencyContactId): Promise<{ kind: 'removed' } | { kind: 'in_use' }>;
  /** Called each time the app opens. Upsert, so a repeat is harmless. */
  registerPushDevice(expoPushToken: string): Promise<void>;
  /** The contact screen marks a phone number "Text messages not set up yet" when 'sms' is missing. */
  enabledChannels(): Promise<ReadonlySet<Channel>>;

  // Adventures (reads: tables; writes: RPCs)
  listAdventures(): Promise<Adventure[]>; // newest first, includes Ended history
  getAdventure(id: AdventureId): Promise<Adventure | null>;
  /** The one Active, Overdue or Alerted Adventure, if any. Home screen. */
  getInProgressAdventure(): Promise<InProgressAdventure | null>;
  /** Planned: all fields. Active, Overdue: Plan and contacts. Alerted, Ended: 'wrong_stage'. */
  saveAdventure(draft: AdventureDraft): Promise<{ kind: 'saved'; adventure: Adventure } | { kind: 'refused'; refusal: Refusal }>;
  deleteAdventure(id: AdventureId): Promise<{ kind: 'deleted' } | { kind: 'refused'; refusal: Refusal }>;

  startWarnings(id: AdventureId): Promise<StartWarning[]>;
  start(id: AdventureId): Promise<StartResult>;
  moveDeadline(id: AdventureId, deadline: Date): Promise<MoveDeadlineResult>;
  checkIn(id: AdventureId): Promise<CheckInResult>;
  /** Check-ins waiting for signal, so the UI can show "Check-in will be sent". */
  pendingCheckIns(): { adventureId: AdventureId; checkedInAt: Date }[];
  /** Called on app foreground and on reconnect. Safe to call any time, concurrently. */
  flushPendingCheckIns(): Promise<void>;

  deliveryFailures(id: AdventureId): Promise<DeliveryFailure[]>;
  /** Live Stage changes (Realtime on the own adventures row) so Overdue and Alerted show without pull-to-refresh. */
  watchAdventure(id: AdventureId, onChange: (a: Adventure) => void): () => void;
};

// ─── Construction: effects are injected, so tests run without a phone ────────────────

export type BarryDeps = {
  supabase: SupabaseClient<Database>;
  /** One reading, or null when permission is denied or no fix in time. Never blocks Start. */
  readPosition(): Promise<Position | null>;
  timeZone(): string; // Intl.DateTimeFormat().resolvedOptions().timeZone
  now(): Date;
  /** expo-sqlite localStorage; survives app restarts. */
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** expo-notifications getPermissionsAsync(). */
  pushPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
};

export function createBarry(deps: BarryDeps): Barry {
  // TODO start(id):
  //   const pos = await deps.readPosition();
  //   const { data, error } = await supabase.rpc('start_adventure', { p_id: id, p_time_zone: deps.timeZone(), ...pos });
  //   network error / timeout      -> { kind: 'unconfirmed' }
  //   data (Refusal) != null       -> { kind: 'refused', refusal: data }
  //   data == null                 -> refetch; must be 'active' -> { kind: 'protected', adventure }
  //
  // TODO checkIn(id):
  //   const checkedInAt = deps.now();   // the server clamps it into [started_at, now()]
  //   enqueue {id, checkedInAt} in storage FIRST (a crash after the gesture must not lose it),
  //   then flushPendingCheckIns(); return 'ended' if this id flushed, else 'queued'.
  //
  // TODO flushPendingCheckIns():
  //   single-flight (one in-progress promise shared by concurrent callers);
  //   for each pending: rpc('check_in', { p_id, p_checked_in_at })
  //     accepted (null)            -> remove from storage
  //     refused 'not_found'|'wrong_stage' (Planned) -> remove, log (cannot succeed later)
  //     network error              -> keep, stop the loop
  //
  // TODO enabledChannels():
  //   rpc('enabled_channels') -> new Set(data)
  //
  // TODO startWarnings(id):
  //   permission != 'granted'                        -> { kind: 'no_push', reason: 'permission_denied' }
  //   else no own push_devices row                   -> { kind: 'no_push', reason: 'no_device_registered' }
  //   'sms' not enabled and contacts with phone and email -> { kind: 'email_only', contacts }
  //   'sms' not enabled and contacts with phone only      -> { kind: 'unreachable', contacts }
  //
  // TODO removeContact(id):
  //   update emergency_contacts set removed_at = now(); error 'barry:contact_in_use' -> { kind: 'in_use' }
  //
  // TODO parse rows -> Adventure at this boundary only; a row that violates the union
  //   (e.g. stage 'active' without deadline) throws, because the DB checks make it impossible.
  void deps;
  throw new Error('not implemented');
}

// src/lib/barry-instance.ts wires the real effects:
//   export const barry = createBarry({ supabase, readPosition: readOnceWithTimeout(5_000),
//     timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
//     now: () => new Date(), storage: localStorage,
//     pushPermission: async () => (await Notifications.getPermissionsAsync()).status });
