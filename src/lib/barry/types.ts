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
  message: 'heads_up' | 'alert' | 'all_clear';
  contactName: string;
  channel: Channel;
  address: string;
  reason: string;
};

export type StartWarning =
  | { kind: 'no_push' }
  | { kind: 'email_only'; contacts: EmergencyContact[] }
  | { kind: 'unreachable'; contacts: EmergencyContact[] };

export type StartConditions = { smsEnabled: boolean; pushRegistered: boolean };

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
  getInProgressAdventure(): Promise<InProgressAdventure | null>;
  saveAdventure(draft: AdventureDraft): Promise<SaveAdventureResult>;
  deleteAdventure(id: AdventureId): Promise<{ kind: 'deleted' } | { kind: 'refused'; refusal: Refusal }>;

  startConditions(): Promise<StartConditions>;
  start(id: AdventureId): Promise<StartResult>;
  moveDeadline(id: AdventureId, deadline: Date): Promise<MoveDeadlineResult>;
  checkIn(id: AdventureId): Promise<CheckInResult>;
  pendingCheckIns(): { adventureId: AdventureId; checkedInAt: Date }[];
  flushPendingCheckIns(): Promise<void>;

  deliveryFailures(id: AdventureId): Promise<DeliveryFailure[]>;
  watchAdventure(id: AdventureId, onChange: (adventure: Adventure) => void): () => void;
};
