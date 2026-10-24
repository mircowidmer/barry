export type Channel = 'email' | 'sms' | 'push';

export type Language = 'en' | 'de';

export type Plan = {
  destination: string;
};

export type Position = { takenAt: Date; latitude: number; longitude: number; accuracyM: number | null };

export type ProfileDetails = {
  phone: string | null;
  carMake: string | null;
  carColour: string | null;
  carPlate: string | null;
  medicalNotes: string | null;
};

// The Profile beyond the name exists only on the Alert, so no other template can print it.
export type MessageFacts = {
  language: Language;
  adventurerName: string;
  timeZone: string;
  plan: Plan;
  deadline: Date;
} & (
  | { kind: 'heads_up'; trailToken: string | null }
  | { kind: 'plan_update'; trailToken: string | null }
  | { kind: 'deadline_update'; trailToken: string | null; previousDeadline: Date }
  | { kind: 'reminder' }
  | { kind: 'overdue_notice'; alertAt: Date }
  | {
      kind: 'alert';
      round: number;
      trailToken: string | null;
      profile: ProfileDetails;
      lastKnownPosition: Position | null;
    }
  | { kind: 'all_clear'; checkedInAt: Date; trailToken: string | null }
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
    language: f.language === 'de' ? ('de' as const) : ('en' as const),
    adventurerName: text(f.adventurer_name, 'adventurer_name'),
    timeZone: text(f.time_zone, 'time_zone'),
    plan: {
      destination: text(plan.destination, 'plan.destination'),
    },
    deadline: date(f.deadline, 'deadline'),
  };

  switch (f.kind) {
    case 'heads_up':
    case 'plan_update':
      return { ...base, kind: f.kind, trailToken: optionalText(f.trail_token) };
    case 'deadline_update':
      return {
        ...base,
        kind: f.kind,
        trailToken: optionalText(f.trail_token),
        previousDeadline: date(f.previous_deadline, 'previous_deadline'),
      };
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
        trailToken: optionalText(f.trail_token),
        profile: {
          phone: optionalText(p.phone),
          carMake: optionalText(p.car_make),
          carColour: optionalText(p.car_colour),
          carPlate: optionalText(p.car_plate),
          medicalNotes: optionalText(p.medical_notes),
        },
        lastKnownPosition: position(f.last_known_position),
      };
    }
    case 'all_clear':
      return { ...base, kind: f.kind, checkedInAt: date(f.checked_in_at, 'checked_in_at'), trailToken: optionalText(f.trail_token) };
    default:
      throw new Error(`message_facts: unknown kind ${String(f.kind)}`);
  }
};
