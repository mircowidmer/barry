import type { Database } from '@/lib/database.types';

type Brand<T, B extends string> = T & { readonly __brand: B };
export type AdventureId = Brand<string, 'AdventureId'>;
export type EmergencyContactId = Brand<string, 'EmergencyContactId'>;

export type Refusal = Database['public']['Enums']['refusal'];
export type Channel = Database['public']['Enums']['channel'];

export type AdventurerProfile = {
  name: string;
  phone: string;
  carMake: string | null;
  carColour: string | null;
  carPlate: string | null;
  medicalNotes: string | null;
};

export type EmergencyContact = {
  id: EmergencyContactId;
  name: string;
} & ({ phone: string; email: string | null } | { phone: string | null; email: string });

export type ContactDraft = { id?: EmergencyContactId; name: string; phone: string | null; email: string | null };

export type Plan = {
  destination: string;
  route: string | null;
  startingPoint: string | null;
  notes: string | null;
};

export type Position = { takenAt: Date; latitude: number; longitude: number; accuracyM: number | null };

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
  message: 'heads_up' | 'plan_update' | 'alert' | 'all_clear';
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

export type TrailStatus = 'delivering' | 'recording' | 'off';

export type Trail = {
  /** Brings the OS updates and the fence in line with `trailMode`, then flushes. Idempotent. */
  sync(): Promise<TrailStatus>;
  status(): Promise<TrailStatus>;
  requestPermission(): Promise<boolean>;
  /** Background task entry. Recording: buffers, re-centres the fence, flushes. Delivering: sends the queued Check-ins, then syncs. Never throws. */
  onLocations(locations: readonly RawLocation[]): Promise<void>;
  /** Geofence task entry after a relaunch. Takes one reading, then syncs. Never throws. */
  onFenceExit(): Promise<void>;
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
  listContacts(): Promise<EmergencyContact[]>;
  saveContact(contact: ContactDraft): Promise<EmergencyContact>;
  removeContact(id: EmergencyContactId): Promise<{ kind: 'removed' } | { kind: 'in_use' }>;
  enabledChannels(): Promise<ReadonlySet<Channel>>;
  /** Called each time the app opens. Upsert, so a repeat is harmless. */
  registerPushDevice(expoPushToken: string): Promise<void>;

  listAdventures(): Promise<Adventure[]>;
  getAdventure(id: AdventureId): Promise<Adventure | null>;
  getInProgressAdventure(): Promise<InProgressView>;
  saveAdventure(draft: AdventureDraft): Promise<SaveAdventureResult>;
  deleteAdventure(id: AdventureId): Promise<{ kind: 'deleted' } | { kind: 'refused'; refusal: Refusal }>;
  /** Deletes the signed-in account with everything it owns, then signs out on this phone. */
  deleteAccount(): Promise<{ kind: 'deleted' } | { kind: 'refused'; refusal: Refusal }>;

  startConditions(): Promise<StartConditions>;
  start(id: AdventureId): Promise<StartResult>;
  moveDeadline(id: AdventureId, deadline: Date): Promise<MoveDeadlineResult>;
  checkIn(id: AdventureId): Promise<CheckInResult>;
  pendingCheckIns(): { adventureId: AdventureId; checkedInAt: Date }[];
  flushPendingCheckIns(): Promise<void>;

  deliveryFailures(id: AdventureId): Promise<DeliveryFailure[]>;
  /** Every reading of the Adventure, oldest first, from Start, Deadline moves and the Trail. */
  /** Oldest first. With `after`, only the readings taken after it. */
  readings(id: AdventureId, after?: Date): Promise<Position[]>;
  watchAdventure(id: AdventureId, onChange: (adventure: Adventure) => void): () => void;

  trail: Trail;
};
