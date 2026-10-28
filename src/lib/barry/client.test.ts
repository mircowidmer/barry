import { describe, expect, it } from '@jest/globals';
import { AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database';

import { createAdventureCache } from './adventure-cache';
import type { NotificationService } from './alarms';
import { createBarry } from './client';
import type { PhoneContact } from './phone-contact';
import type { AdventureWithRelations, ContactRow } from './rows';
import type { LocationService } from './trail';
import type { AdventureId } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const a1 = 'a1' as AdventureId;

const row = (overrides: Partial<AdventureWithRelations>): AdventureWithRelations => ({
  id: 'a1',
  adventurer_id: 'u1',
  stage: 'active',
  destination: 'Grosser Mythen',
  destination_latitude: null,
  destination_longitude: null,
  deadline: '2026-10-17T16:00:00Z',
  alert_at: '2026-10-17T16:30:00Z',
  time_zone: 'Europe/Zurich',
  started_at: '2026-10-17T06:00:00Z',
  alerts_sent: 0,
  earlier_alerts: 0,
  plan_revision: 0,
  last_alert_at: null,
  checked_in_at: null,
  ended_at: null,
  created_at: '2026-10-15T08:00:00Z',
  updated_at: '2026-10-15T08:00:00Z',
  adventure_contacts: [],
  last_position: [],
  ...overrides,
});

const contactRow = (overrides: Partial<ContactRow>): ContactRow => ({
  id: 'c1',
  adventurer_id: 'u1',
  name: 'Sara',
  email: 'sara@example.com',
  email_enabled: true,
  phone: null,
  phone_enabled: false,
  removed_at: null,
  created_at: '2026-10-15T08:00:00Z',
  ...overrides,
});

const setup = ({ cached = true, picked = null as PhoneContact | null, contacts = [] as ContactRow[] } = {}) => {
  const storage = memoryStorage();
  const now = () => new Date('2026-10-17T15:00:00Z');
  if (cached) createAdventureCache(storage, now).save(row({}));
  const ended = row({ stage: 'ended', checked_in_at: '2026-10-17T15:00:00Z', ended_at: '2026-10-17T15:10:00Z' });
  const world = {
    signal: false,
    reads: true,
    server: ended,
    contacts,
    session: { data: { session: { user: { id: 'u1' } } }, error: null } as { data: { session: unknown }; error: unknown },
  };
  const contactsQuery = {
    select: () => contactsQuery,
    is: () => contactsQuery,
    order: async () => ({ data: world.contacts.filter((c) => c.removed_at === null), error: null }),
    insert: (values: Partial<ContactRow>) => ({
      select: () => ({
        single: async () => {
          // The server's own limit on saved contacts, which the fake makes small.
          if (world.contacts.filter((c) => c.removed_at === null).length >= 2) {
            return { data: null, error: { message: 'barry:too_many_contacts' } };
          }
          const inserted = contactRow({ ...values, id: `c${world.contacts.length + 1}` });
          world.contacts.push(inserted);
          return { data: inserted, error: null };
        },
      }),
    }),
  };
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () =>
      world.signal && world.reads ? { data: world.server, error: null } : { data: null, error: { message: 'Network request failed' } },
  };
  const signOuts: unknown[] = [];
  const supabase = {
    auth: {
      getSession: async () => world.session,
      signOut: async (options: unknown) => void signOuts.push(options),
    },
    rpc: async () => (world.signal ? { data: null, error: null } : { data: null, error: { message: 'Network request failed' } }),
    from: (table: string) => (table === 'emergency_contacts' ? contactsQuery : query),
  } as unknown as SupabaseClient<Database>;
  const updates: string[] = [];
  const fences: string[][] = [];
  const location: LocationService = {
    backgroundPermitted: async () => true,
    requestBackground: async () => true,
    startUpdates: async (mode) => void updates.push(mode),
    stopUpdates: async () => void updates.push('off'),
    setFences: async (watched) => void fences.push(watched.map((f) => f.identifier)),
    lastReading: async () => null,
  };
  const scheduled = new Map<string, string>();
  const arrivals: string[] = [];
  const notifications: NotificationService = {
    scheduledIdentifiers: async () => [...scheduled.keys()],
    schedule: async (alarm) => void scheduled.set(alarm.identifier, alarm.at.toISOString()),
    cancel: async (id) => void scheduled.delete(id),
    showArrival: async (adventure) => void arrivals.push(adventure.plan.destination),
  };
  const barry = createBarry({
    supabase,
    readPosition: async () => null,
    findPlaces: async () => [],
    timeZone: () => 'Europe/Zurich',
    language: () => 'de',
    now,
    pickContact: async () => picked,
    region: () => 'CH',
    storage,
    notificationsPermitted: async () => true,
    notifications,
    location,
  });
  return { barry, world, updates, fences, arrivals, signOuts, scheduled: () => Object.fromEntries(scheduled) };
};

describe('flushPendingCheckIns', () => {
  it('forgets the Ended Adventure once the queued Check-in is accepted, so the Trail stops', async () => {
    const { barry, world } = setup();
    expect(await barry.checkIn(a1)).toMatchObject({ kind: 'queued' });
    expect(await barry.trail.status()).toBe('delivering');

    world.signal = true;
    await barry.flushPendingCheckIns();
    expect(barry.pendingCheckIns()).toEqual([]);
    expect(await barry.trail.status()).toBe('off');
  });

  it('forgets the Ended Adventure even when the refetch after the accepted Check-in fails', async () => {
    const { barry, world, scheduled } = setup();
    world.signal = true;
    world.reads = false;
    expect(await barry.checkIn(a1)).toMatchObject({ kind: 'queued' });
    expect(barry.pendingCheckIns()).toEqual([]);
    expect(await barry.trail.status()).toBe('off');
    expect(scheduled()).toEqual({});
  });
});

describe('signedIn', () => {
  it('keeps recording the Trail when the expired token cannot be refreshed for lack of signal', async () => {
    const { barry, world } = setup();
    world.session = { data: { session: null }, error: new AuthRetryableFetchError('Network request failed', 0) };
    expect(await barry.trail.status()).toBe('recording');
  });

  it('stops the Trail once the session is really gone', async () => {
    const { barry, world } = setup();
    world.session = { data: { session: null }, error: null };
    expect(await barry.trail.status()).toBe('off');
  });
});

describe('the Trail', () => {
  it('starts recording when Barry first learns of a live Adventure after the launch found none', async () => {
    const { barry, world, updates } = setup({ cached: false });
    await barry.trail.sync();
    expect(updates).toEqual(['off']);

    world.signal = true;
    world.server = row({});
    await barry.getInProgressAdventure();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updates).toEqual(['off', 'recording']);
  });

  it('watches the destination once the Adventurer puts it on the map while the Adventure is in progress', async () => {
    const { barry, world, fences } = setup();
    world.signal = true;
    world.server = row({});
    await barry.getInProgressAdventure();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fences).toEqual([]);

    world.server = row({ destination_latitude: 47.0336, destination_longitude: 8.6703 });
    await barry.getInProgressAdventure();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fences).toEqual([['arrival.a1']]);
  });

  it('shows the Arrival Notice once when iOS reports the destination, and not after the Check-in', async () => {
    const { barry, arrivals } = setup();
    await barry.trail.onFenceEvent({ region: 'arrival.a1', entered: true });
    await barry.trail.onFenceEvent({ region: 'arrival.a1', entered: true });
    expect(arrivals).toEqual(['Grosser Mythen']);

    const later = setup();
    await later.barry.checkIn(a1);
    await later.barry.trail.onFenceEvent({ region: 'arrival.a1', entered: true });
    expect(later.arrivals).toEqual([]);
  });
});

describe('local notifications', () => {
  it('schedules the Reminder and the Overdue Notice without signal, and a waiting Check-in cancels both', async () => {
    const { barry, scheduled } = setup();
    await barry.getInProgressAdventure();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scheduled()).toEqual({
      'barry.reminder.a1': '2026-10-17T15:30:00.000Z',
      'barry.overdue_notice.a1': '2026-10-17T16:00:00.000Z',
    });

    expect(await barry.checkIn(a1)).toMatchObject({ kind: 'queued' });
    expect(scheduled()).toEqual({});
  });
});

describe('addContactFromPhone', () => {
  const luca: PhoneContact = {
    fullName: 'Luca Meier',
    company: null,
    phones: [{ label: 'mobile', number: '079 111 11 11' }],
    emails: [{ label: 'home', address: 'Luca@example.com' }],
  };

  it('copies the picked Phone Contact into the list with both addresses switched on', async () => {
    const { barry, world } = setup({ picked: luca });
    expect(await barry.addContactFromPhone()).toEqual({
      kind: 'added',
      contact: { id: 'c1', name: 'Luca Meier', email: 'Luca@example.com', emailEnabled: true, phone: '+41791111111', phoneEnabled: true },
    });
    expect(world.contacts).toHaveLength(1);
  });

  it('reports a cancelled pick and saves nothing', async () => {
    const { barry, world } = setup({ picked: null });
    expect(await barry.addContactFromPhone()).toEqual({ kind: 'cancelled' });
    expect(world.contacts).toEqual([]);
  });

  it('refuses a pick whose email address, in any case, or phone number a contact already has', async () => {
    const byEmail = setup({ picked: luca, contacts: [contactRow({ name: 'Luca', email: 'luca@example.com' })] });
    expect(await byEmail.barry.addContactFromPhone()).toEqual({ kind: 'duplicate', name: 'Luca' });
    expect(byEmail.world.contacts).toHaveLength(1);

    const byPhone = setup({ picked: luca, contacts: [contactRow({ name: 'L. Meier', email: null, phone: '+41791111111', phone_enabled: true })] });
    expect(await byPhone.barry.addContactFromPhone()).toEqual({ kind: 'duplicate', name: 'L. Meier' });
  });

  it('reports a full list when the server refuses another contact', async () => {
    const full = [contactRow({ id: 'c1', name: 'Mia', email: 'mia@example.com' }), contactRow({ id: 'c2', name: 'Noah', email: 'noah@example.com' })];
    const { barry, world } = setup({ picked: luca, contacts: full });
    expect(await barry.addContactFromPhone()).toEqual({ kind: 'full' });
    expect(world.contacts).toHaveLength(2);
  });

  it('refuses a pick with nothing Barry can reach, naming the contact', async () => {
    const { barry, world } = setup({ picked: { ...luca, phones: [{ label: 'home', number: '12' }], emails: [] } });
    expect(await barry.addContactFromPhone()).toEqual({ kind: 'unreachable', name: 'Luca Meier' });
    expect(world.contacts).toEqual([]);
  });
});

describe('deleteAccount', () => {
  it('forgets the saved Adventure and signs out on this phone only', async () => {
    const { barry, world, signOuts } = setup();
    world.signal = true;
    expect(await barry.deleteAccount()).toEqual({ kind: 'deleted' });
    expect(signOuts).toEqual([{ scope: 'local' }]);
    world.signal = false;
    expect((await barry.getInProgressAdventure()).adventure).toBeNull();
  });
});
