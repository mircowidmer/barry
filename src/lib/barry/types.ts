import type { Database } from '@/lib/database.types';
import type { AppLanguage } from '@/lib/language';

import type { PendingCheckIn } from './check-in-queue';

type Brand<T, B extends string> = T & { readonly __brand: B };
export type AdventureId = Brand<string, 'AdventureId'>;
export type EmergencyContactId = Brand<string, 'EmergencyContactId'>;

export type Refusal = Database['public']['Enums']['refusal'];
export type Channel = Database['public']['Enums']['channel'];

/** The messages to the contacts follow the phone's language. */
export type MessageLanguage = AppLanguage;

export type AdventurerProfile = {
  name: string;
  phone: string;
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

export type Plan = {
  destination: string;
  /** Where the destination is on the map. The phone shows the Arrival Notice there. */
  destinationPoint: Point | null;
  route: string | null;
};

export type Position = Point & { takenAt: Date; accuracyM: number | null };

type AdventureBase = { id: AdventureId; contacts: EmergencyContact[] };

export type PlannedAdventure = AdventureBase & {
  stage: 'planned';
  plan: Partial<Plan>;
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
export type AlertedAdventure = StartedFields & { stage: 'alerted'; alertsSent: number };
export type EndedAdventure = StartedFields & { stage: 'ended'; checkedInAt: Date; alertsSent: number };

export type InProgressAdventure = ActiveAdventure | OverdueAdventure | AlertedAdventure;
export type Adventure = PlannedAdventure | InProgressAdventure | EndedAdventure;

export type DeliveryFailure = {
  message: 'heads_up' | 'plan_update' | 'deadline_update' | 'alert' | 'all_clear';
  contactName: string;
  channel: Channel;
  address: string;
  reason: string;
};

export type StartWarning =
  | { kind: 'no_notifications' }
  | { kind: 'email_only'; contacts: EmergencyContact[] }
  | { kind: 'unreachable'; contacts: EmergencyContact[] }
  | { kind: 'no_trail' };

export type StartConditions = { smsEnabled: boolean; notificationsPermitted: boolean; trailPermitted: boolean };

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
   * Notice. Any event of the Trail's region takes one reading, then syncs. Never throws.
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
  | { kind: 'unreachable'; name: string };

export type AdventureDraft = {
  id?: AdventureId;
  plan: Partial<Plan>;
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
  enabledChannels(): Promise<ReadonlySet<Channel>>;

  listAdventures(): Promise<Adventure[]>;
  getAdventure(id: AdventureId): Promise<Adventure | null>;
  getInProgressAdventure(): Promise<InProgressView>;
  saveAdventure(draft: AdventureDraft): Promise<SaveAdventureResult>;
  /** Where Apple Maps finds a place name, or null when it finds none or there is no signal. */
  findPlace(name: string): Promise<Point | null>;
  /** One reading of where the phone is, or null without permission or a fix in time. */
  currentPosition(): Promise<Position | null>;
  deleteAdventure(id: AdventureId): Promise<{ kind: 'deleted' } | { kind: 'refused'; refusal: Refusal }>;
  /** Deletes the signed-in account with everything it owns, then signs out on this phone. */
  deleteAccount(): Promise<{ kind: 'deleted' } | { kind: 'refused'; refusal: Refusal }>;
  /** Signs out and forgets the live Adventure, so its Reminder and Overdue Notice no longer fire. */
  logOut(): Promise<void>;

  startConditions(): Promise<StartConditions>;
  start(id: AdventureId): Promise<StartResult>;
  moveDeadline(id: AdventureId, deadline: Date): Promise<MoveDeadlineResult>;
  checkIn(id: AdventureId): Promise<CheckInResult>;
  pendingCheckIns(): PendingCheckIn[];
  flushPendingCheckIns(): Promise<void>;

  deliveryFailures(id: AdventureId): Promise<DeliveryFailure[]>;
  /** Every reading of the Adventure, from Start, Deadline moves and the Trail, oldest first. With `after`, only the readings taken after it. */
  readings(id: AdventureId, after?: Date): Promise<Position[]>;
  watchAdventure(id: AdventureId, onChange: (adventure: Adventure) => void): () => void;

  trail: Trail;
};
