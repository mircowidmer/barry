import type { Database } from '@/lib/database.types';

import type {
  Adventure,
  AdventureId,
  AdventurerProfile,
  EmergencyContact,
  EmergencyContactId,
  Position,
} from './types';

type Tables = Database['public']['Tables'];
export type AdventureRow = Tables['adventures']['Row'];
export type ContactRow = Tables['emergency_contacts']['Row'];
export type ProfileRow = Tables['adventurer_profiles']['Row'];
export type PositionRow = Pick<Tables['position_readings']['Row'], 'taken_at' | 'latitude' | 'longitude' | 'accuracy_m'>;

export type AdventureWithRelations = AdventureRow & {
  adventure_contacts: { emergency_contacts: ContactRow | null }[];
  /** At most the newest reading: every query orders and limits the embed. */
  last_position: PositionRow[];
};

export const ADVENTURE_SELECT =
  '*, adventure_contacts(emergency_contacts(*)), last_position:position_readings(taken_at, latitude, longitude, accuracy_m)';


const date = (value: string | null, field: string): Date => {
  if (value === null) throw new Error(`adventure row: ${field} is missing`);
  return new Date(value);
};

export const parseContact = (row: ContactRow): EmergencyContact => {
  const base = { id: row.id as EmergencyContactId, name: row.name };
  if (row.email !== null) return { ...base, email: row.email, phone: row.phone };
  if (row.phone !== null) return { ...base, phone: row.phone, email: row.email };
  throw new Error('contact row: neither phone nor email');
};

export const parseProfile = (row: ProfileRow): AdventurerProfile => ({
  name: row.name,
  phone: row.phone,
  carMake: row.car_make,
  carColour: row.car_colour,
  carPlate: row.car_plate,
  medicalNotes: row.medical_notes,
});

// A cache written by an older build has no last_position.
const latestPosition = (rows: PositionRow[] | undefined): Position | null => {
  const latest = rows?.[0];
  return latest
    ? {
        takenAt: new Date(latest.taken_at),
        latitude: latest.latitude,
        longitude: latest.longitude,
        accuracyM: latest.accuracy_m,
      }
    : null;
};

export const parseAdventure = (row: AdventureWithRelations): Adventure => {
  const id = row.id as AdventureId;
  const contacts = row.adventure_contacts
    .map((link) => link.emergency_contacts)
    .filter((c): c is ContactRow => c !== null)
    .map(parseContact)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (row.stage === 'planned') {
    return {
      id,
      contacts,
      stage: 'planned',
      plan: {
        destination: row.destination ?? undefined,
        route: row.route,
        startingPoint: row.starting_point,
        notes: row.notes,
      },
      deadline: row.deadline === null ? null : new Date(row.deadline),
    };
  }

  if (!row.destination) throw new Error('adventure row: a started Adventure has no destination');
  const started = {
    id,
    contacts,
    plan: { destination: row.destination, route: row.route, startingPoint: row.starting_point, notes: row.notes },
    deadline: date(row.deadline, 'deadline'),
    alertAt: date(row.alert_at, 'alert_at'),
    timeZone: row.time_zone ?? 'UTC',
    startedAt: date(row.started_at, 'started_at'),
    lastKnownPosition: latestPosition(row.last_position),
  };

  switch (row.stage) {
    case 'active':
    case 'overdue':
      return { ...started, stage: row.stage };
    case 'alerted':
      return { ...started, stage: 'alerted', alertsSent: row.alerts_sent };
    case 'ended':
      return { ...started, stage: 'ended', alertsSent: row.alerts_sent, checkedInAt: date(row.checked_in_at, 'checked_in_at') };
  }
};
