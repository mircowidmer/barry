import type { Database } from '@/lib/database.types';

import { reachableAddresses } from './reach';
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
  last_position: PositionRow[];
};

export const ADVENTURE_SELECT =
  '*, adventure_contacts(emergency_contacts(*)), last_position:position_readings(taken_at, latitude, longitude, accuracy_m)';

const date = (value: string | null, field: string): Date => {
  if (value === null) throw new Error(`adventure row: ${field} is missing`);
  return new Date(value);
};

export const parseContact = (row: ContactRow): EmergencyContact => {
  const contact: EmergencyContact = {
    id: row.id as EmergencyContactId,
    name: row.name,
    email: row.email,
    emailEnabled: row.email_enabled,
    phone: row.phone,
    phoneEnabled: row.phone_enabled,
  };
  const reach = reachableAddresses(contact);
  if (reach.email === null && reach.phone === null) throw new Error('contact row: no address switched on');
  return contact;
};

export const parseProfile = (row: ProfileRow): AdventurerProfile => ({
  name: row.name,
  phone: row.phone,
  carMake: row.car_make,
  carColour: row.car_colour,
  carPlate: row.car_plate,
  medicalNotes: row.medical_notes,
});

export const POSITION_SELECT = 'taken_at, latitude, longitude, accuracy_m';

export const parsePosition = (row: PositionRow): Position => ({
  takenAt: new Date(row.taken_at),
  latitude: row.latitude,
  longitude: row.longitude,
  accuracyM: row.accuracy_m,
});

const latestPosition = (rows: PositionRow[] | undefined): Position | null => {
  const latest = rows?.[0];
  return latest ? parsePosition(latest) : null;
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
      },
      deadline: row.deadline === null ? null : new Date(row.deadline),
    };
  }

  if (!row.destination) throw new Error('adventure row: a started Adventure has no destination');
  const started = {
    id,
    contacts,
    plan: { destination: row.destination, route: row.route },
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
