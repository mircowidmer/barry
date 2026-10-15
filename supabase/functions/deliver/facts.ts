export type Channel = 'email' | 'sms' | 'push';

export type Plan = {
  destination: string;
  route: string | null;
  startingPoint: string | null;
  notes: string | null;
};

export type Position = { takenAt: Date; latitude: number; longitude: number; accuracyM: number | null };

export type ProfileDetails = {
  phone: string;
  carMake: string | null;
  carColour: string | null;
  carPlate: string | null;
  medicalNotes: string | null;
};

// The Profile beyond the name exists only on the Alert, so no other template can print it.
export type MessageFacts = {
  adventurerName: string;
  contactName: string | null;
  timeZone: string;
  plan: Plan;
  deadline: Date;
} & (
  | { kind: 'heads_up' }
  | { kind: 'reminder' }
  | { kind: 'overdue_notice'; alertAt: Date }
  | { kind: 'alert'; round: number; profile: ProfileDetails; lastKnownPosition: Position | null }
  | { kind: 'all_clear'; checkedInAt: Date }
);

type Json = Record<string, unknown>;

const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value === '') throw new Error(`message_facts: ${field} is missing`);
  return value;
};

const optionalText = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

const date = (value: unknown, field: string): Date => new Date(text(value, field));

const position = (value: unknown): Position | null => {
  if (value === null || value === undefined) return null;
  const p = value as Json;
  return {
    takenAt: date(p.taken_at, 'last_known_position.taken_at'),
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    accuracyM: p.accuracy_m === null ? null : Number(p.accuracy_m),
  };
};

export const parseFacts = (raw: unknown): MessageFacts => {
  const f = raw as Json;
  const plan = (f.plan ?? {}) as Json;
  const base = {
    adventurerName: text(f.adventurer_name, 'adventurer_name'),
    contactName: optionalText(f.contact_name),
    timeZone: text(f.time_zone, 'time_zone'),
    plan: {
      destination: text(plan.destination, 'plan.destination'),
      route: optionalText(plan.route),
      startingPoint: optionalText(plan.starting_point),
      notes: optionalText(plan.notes),
    },
    deadline: date(f.deadline, 'deadline'),
  };

  switch (f.kind) {
    case 'heads_up':
    case 'reminder':
      return { ...base, kind: f.kind };
    case 'overdue_notice':
      return { ...base, kind: f.kind, alertAt: date(f.alert_at, 'alert_at') };
    case 'alert': {
      const p = (f.profile ?? {}) as Json;
      return {
        ...base,
        kind: f.kind,
        round: Number(f.round),
        profile: {
          phone: text(p.phone, 'profile.phone'),
          carMake: optionalText(p.car_make),
          carColour: optionalText(p.car_colour),
          carPlate: optionalText(p.car_plate),
          medicalNotes: optionalText(p.medical_notes),
        },
        lastKnownPosition: position(f.last_known_position),
      };
    }
    case 'all_clear':
      return { ...base, kind: f.kind, checkedInAt: date(f.checked_in_at, 'checked_in_at') };
    default:
      throw new Error(`message_facts: unknown kind ${String(f.kind)}`);
  }
};
