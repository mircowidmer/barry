import type { Database } from '@/lib/database';
import type { AppLanguage } from '@/lib/language';

import type { PendingCheckIn } from './check-in-queue';
import type { ConditionsResult } from './conditions';

type Brand<T, B extends string> = T & { readonly __brand: B };
export type AdventureId = Brand<string, 'AdventureId'>;
export type EmergencyContactId = Brand<string, 'EmergencyContactId'>;

// The trigger guard_deadline_bound raises deadline_too_far instead of a command returning it, so the client adds it here.
export type Refusal = Database['public']['Enums']['refusal'] | 'deadline_too_far';
export type Channel = Database['public']['Enums']['channel'];

/** The messages to the contacts follow the phone's language. */
export type MessageLanguage = AppLanguage;

export type AdventurerProfile = {
  name: string;
  phone: string | null;
  carMake: string | null;
  carColour: string | null;
  carPlate: string | null;
  medicalNotes: string | null;
};

/** An address that is switched off is kept, but Barry does not use it. */
export type EmergencyContact = {
  id: EmergencyContactId;
  name: string;
  email: string | null;
  emailEnabled: boolean;
  phone: string | null;
  phoneEnabled: boolean;
};

export type ContactDraft = Omit<EmergencyContact, 'id'> & { id?: EmergencyContactId };

export type Point = { latitude: number; longitude: number };

/** A place Apple Maps knows, such as a summit or a hut, with where it lies. */
export type Place = { name: string; subtitle: string; point: Point };

export type Plan = {
  destination: string;
  /** Where the destination is on the map. The phone shows the Arrival Notice there. */
  destinationPoint: Point | null;
};

/** The Plan of a Planned Adventure, where any part may still be missing. */
export type UnfinishedPlan = { [K in keyof Plan]?: Plan[K] | undefined };

export type Position = Point & { takenAt: Date; accuracyM: number | null };

type AdventureBase = { id: AdventureId; contacts: EmergencyContact[] };

export type PlannedAdventure = AdventureBase & {
  stage: 'planned';
  plan: UnfinishedPlan;
  deadline: Date | null;
};

type StartedFields = AdventureBase & {
  plan: Plan;
  deadline: Date;
  alertAt: Date;
  timeZone: string;
  startedAt: Date;
  lastKnownPosition: Position | null;
};

export type ActiveAdventure = StartedFields & { stage: 'active' };
export type OverdueAdventure = StartedFields & { stage: 'overdue' };
/** alertsSent counts the Alerts for the current Deadline, at most three. */
export type AlertedAdventure = StartedFields & { stage: 'alerted'; alertsSent: number };
/** alertsSent counts every Alert of the Adventure, for each Deadline it missed. */
export type EndedAdventure = StartedFields & { stage: 'ended'; checkedInAt: Date; alertsSent: number };

export type InProgressAdventure = ActiveAdventure | OverdueAdventure | AlertedAdventure;
export type Adventure = PlannedAdventure | InProgressAdventure | EndedAdventure;

export type MessageKind = Database['public']['Enums']['message_kind'];

/**
 * A message that went out to an address of the Adventure's contacts, or failed. Contacts who share the address
 * are all named. Only a text message can become `delivered`, once Twilio confirms it; `at` is the time of the outcome.
 */
export type SentMessage = {
  id: number;
  message: MessageKind;
  /** Which Alert of the current Deadline, from 1; null for every other message. */
  round: number | null;
  channel: Channel;
  address: string;
  contacts: { id: EmergencyContactId; name: string }[];
  outcome: 'sent' | 'delivered' | 'failed';
  at: Date;
  reason: string | null;
  /** A text message Twilio reported not delivered, as opposed to one that failed to send. */
  undelivered: boolean;
};

/** A message that could not be delivered. */
export type DeliveryFailure = SentMessage & { outcome: 'failed' };

export type ShowPhoneContactOptions = {
  /** Explains why Barry asks for access to the contacts, before iOS asks; true to go on. */
  beforeAsking(): Promise<boolean>;
  /** The title of the button that closes the card. */
  closeTitle: string;
};

export type StartWarning =
  | { kind: 'no_notifications' }
  | { kind: 'email_only'; contacts: EmergencyContact[] }
  | { kind: 'unreachable'; contacts: EmergencyContact[] }
  | { kind: 'no_trail' }
  | { kind: 'after_dark'; dark: Date };

export type StartChecks = { smsEnabled: boolean; notificationsPermitted: boolean; trailPermitted: boolean };

export type RawLocation = { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number | null } };

/** What iOS reports for a monitored region: its identifier and whether the phone is now inside it. */
export type FenceEvent = { region: string; entered: boolean };

export type TrailStatus = 'delivering' | 'recording' | 'off';

export type Trail = {
  /** Brings the OS updates and the fence in line with `trailMode`, then flushes. Idempotent. */
  sync(): Promise<TrailStatus>;
  status(): Promise<TrailStatus>;
  requestPermission(): Promise<boolean>;
  /** Background task entry. Recording: buffers, re-centres the fence, flushes. Delivering: sends the queued Check-ins, then syncs. Never throws. */
  onLocations(locations: readonly RawLocation[]): Promise<void>;
  /**
   * Geofence task entry, also after a relaunch. Entering the destination's region shows the Arrival
   * Notice. Leaving the Trail's region takes one reading, then syncs. Never throws.
   */
  onFenceEvent(event: FenceEvent): Promise<void>;
};

export type StartResult =
  | { kind: 'protected'; adventure: InProgressAdventure }
  | { kind: 'refused'; refusal: Refusal }
  | { kind: 'unconfirmed' };

export type MoveDeadlineResult =
  | { kind: 'moved'; adventure: InProgressAdventure }
  | { kind: 'refused'; refusal: Refusal }
  | { kind: 'unconfirmed' };

export type CheckInResult = { kind: 'ended'; adventure: EndedAdventure } | { kind: 'queued'; checkedInAt: Date };

/** What came of the phone's picker. `duplicate` names the contact already in the list, `unreachable` the picked one. */
export type AddContactResult =
  | { kind: 'added'; contact: EmergencyContact }
  | { kind: 'cancelled' }
  | { kind: 'duplicate'; name: string }
  | { kind: 'unreachable'; name: string }
  | { kind: 'full' };

export type AdventureDraft = {
  id?: AdventureId | undefined;
  plan: UnfinishedPlan;
  deadline: Date | null;
  contactIds: EmergencyContactId[];
};

/** The live Adventure, or the last one seen when the server cannot be reached. */
export type InProgressView = { adventure: InProgressAdventure | null; offlineSince: Date | null };

export type SaveAdventureResult =
  | { kind: 'saved'; adventure: Adventure }
  | { kind: 'refused'; refusal: Refusal };

export type Barry = {
  getProfile(): Promise<AdventurerProfile | null>;
  saveProfile(profile: AdventurerProfile): Promise<void>;
  /** Writes the phone's language to the Profile, so the next messages to the contacts use it. */
  syncMessageLanguage(): Promise<void>;
  listContacts(): Promise<EmergencyContact[]>;
  /** Opens the phone's picker and copies the picked Phone Contact into the list, both addresses switched on. */
  addContactFromPhone(): Promise<AddContactResult>;
  saveContact(contact: ContactDraft): Promise<EmergencyContact>;
  removeContact(id: EmergencyContactId): Promise<{ kind: 'removed' } | { kind: 'in_use' }>;
  /**
   * Shows the card of the Phone Contact an Emergency Contact was copied from, read-only. False when this phone does
   * not know which one it was, access to the contacts is refused, or the Phone Contact is gone.
   */
  showPhoneContact(id: EmergencyContactId, options: ShowPhoneContactOptions): Promise<boolean>;
  enabledChannels(): Promise<ReadonlySet<Channel>>;

  listAdventures(): Promise<Adventure[]>;
  getAdventure(id: AdventureId): Promise<Adventure | null>;
  getInProgressAdventure(): Promise<InProgressView>;
  saveAdventure(draft: AdventureDraft): Promise<SaveAdventureResult>;
  /** The places Apple Maps finds for what the Adventurer typed, nearest first; none without signal. */
  findPlaces(query: string): Promise<Place[]>;
  /** One reading of where the phone is, or null without permission or a fix in time. */
  currentPosition(): Promise<Position | null>;
  /** The forecast and the avalanche bulletin at a destination on the map. */
  conditions(point: Point): Promise<ConditionsResult>;
  deleteAdventure(id: AdventureId): Promise<{ kind: 'deleted' } | { kind: 'refused'; refusal: Refusal }>;
  /** Deletes the signed-in account with everything it owns, then signs out on this phone. */
  deleteAccount(): Promise<{ kind: 'deleted' } | { kind: 'refused'; refusal: Refusal }>;
  /** Signs out and forgets the live Adventure, so its Reminder and Overdue Notice no longer fire. */
  logOut(): Promise<void>;

  startChecks(): Promise<StartChecks>;
  /** Saves the draft and starts it in one step; when the Start is refused, nothing of the draft is saved. */
  start(draft: AdventureDraft): Promise<StartResult>;
  moveDeadline(id: AdventureId, deadline: Date): Promise<MoveDeadlineResult>;
  checkIn(id: AdventureId): Promise<CheckInResult>;
  pendingCheckIns(): PendingCheckIn[];
  flushPendingCheckIns(): Promise<void>;

  /** The messages to the contacts that went out or failed, newest first. */
  messages(id: AdventureId): Promise<SentMessage[]>;
  /** Calls `onChange` with the messages each time one goes out, is delivered or fails, and after each reconnect. */
  watchMessages(id: AdventureId, onChange: (messages: SentMessage[]) => void): () => void;
  /** Shows a notification for each text message of the live or last Adventure that Twilio reported not delivered, once. */
  noticeDeliveryFailures(): Promise<void>;
  /** Calls `noticeDeliveryFailures` each time a message of the Adventurer fails, and after each reconnect. */
  watchDeliveryFailures(): () => void;
  /** Every reading of the Adventure, from Start, Deadline moves and the Trail, oldest first. With `after`, only the readings taken after it. */
  readings(id: AdventureId, after?: Date): Promise<Position[]>;
  watchAdventure(id: AdventureId, onChange: (adventure: Adventure) => void): () => void;

  trail: Trail;
};
