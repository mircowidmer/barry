import { describe, expect, it } from '@jest/globals';
import { AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database';

import { createAdventureCache } from './adventure-cache';
import type { NotificationService } from './alarms';
import { createBarry } from './client';
import type { PhoneContact } from './phone-contact';
import type { AdventureWithRelations, ContactRow, MessageRow } from './rows';
import type { LocationService } from './trail';
import type { AdventureId, EmergencyContactId } from './types';

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
    // The message of a raised exception the next RPC answers with, such as a trigger's barry: code.
    refuse: null as string | null,
    server: ended,
    contacts,
    session: { data: { session: { user: { id: 'u1' } } }, error: null } as { data: { session: unknown }; error: unknown },
  };
  const contactsQuery = {
    update: (values: Partial<ContactRow>) => ({
      eq: async (_column: string, id: string) => {
        world.contacts = world.contacts.map((c) => (c.id === id ? { ...c, ...values } : c));
        return { error: null };
      },
    }),
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
  const messageRows: MessageRow[] = [];
  const messagesQuery = {
    select: () => messagesQuery,
    eq: () => messagesQuery,
    order: () => messagesQuery,
    then: (resolve: (result: { data: MessageRow[]; error: null }) => void) => resolve({ data: [...messageRows], error: null }),
  };
  // The one Realtime subscription the test opens: its change handler, its system handler and its status callback.
  const realtime = {
    onChange: (_change: { new: object }) => undefined as void,
    onSystem: (_message: { extension: string; status: string }) => undefined as void,
    onStatus: (_status: string) => undefined as void,
    removed: false,
    names: [] as string[],
  };
  const channel = {
    on: (event: string, _filter: object, handler: (payload: never) => void) => {
      if (event === 'system') realtime.onSystem = handler as typeof realtime.onSystem;
      else realtime.onChange = handler as typeof realtime.onChange;
      return channel;
    },
    subscribe: (callback?: (status: string) => void) => {
      realtime.onStatus = callback ?? (() => undefined);
      return channel;
    },
  };
  const signOuts: unknown[] = [];
  const shownCards: string[] = [];
  const supabase = {
    channel: (name: string) => {
      realtime.names.push(name);
      return channel;
    },
    removeChannel: async () => {
      realtime.removed = true;
    },
    auth: {
      getSession: async () => world.session,
      signOut: async (options: unknown) => void signOuts.push(options),
    },
    rpc: async () => {
      if (world.refuse) return { data: null, error: { message: world.refuse, code: 'P0001' } };
      return world.signal ? { data: null, error: null } : { data: null, error: { message: 'Network request failed' } };
    },
    from: (table: string) => (table === 'emergency_contacts' ? contactsQuery : table === 'adventure_messages' ? messagesQuery : query),
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
    showPhoneContact: async (phoneId) => {
      shownCards.push(phoneId);
      return true;
    },
    region: () => 'CH',
    storage,
    notificationsPermitted: async () => true,
    notifications,
    location,
    fetchJson: async () => {
      throw new Error('no signal');
    },
  });
  return { barry, world, storage, updates, fences, arrivals, signOuts, messageRows, realtime, shownCards, scheduled: () => Object.fromEntries(scheduled) };
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
    phoneId: 'phone-luca',
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

  it('remembers on the phone which Phone Contact it copied, so its card can be shown, until the contact is removed', async () => {
    const { barry, world, shownCards } = setup({ picked: luca });
    const options = { beforeAsking: async () => true, closeTitle: 'Close' };
    await barry.addContactFromPhone();
    const id = world.contacts[0]?.id as EmergencyContactId;
    expect(await barry.showPhoneContact(id, options)).toBe(true);
    await barry.removeContact(id);
    expect(await barry.showPhoneContact(id, options)).toBe(false);
    expect(shownCards).toEqual(['phone-luca']);
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
  it('forgets the saved Adventure and the kept Conditions and signs out on this phone only', async () => {
    const { barry, world, storage, signOuts } = setup();
    storage.setItem('barry.conditions', '[{"point":{"latitude":46.02,"longitude":7.75}}]');
    world.signal = true;
    expect(await barry.deleteAccount()).toEqual({ kind: 'deleted' });
    expect(signOuts).toEqual([{ scope: 'local' }]);
    expect(storage.getItem('barry.conditions')).toBe('');
    world.signal = false;
    expect((await barry.getInProgressAdventure()).adventure).toBeNull();
  });
});

describe('logOut', () => {
  it('forgets the saved Adventure and the kept Conditions', async () => {
    const { barry, storage } = setup();
    storage.setItem('barry.conditions', '[{"point":{"latitude":46.02,"longitude":7.75}}]');
    await barry.logOut();
    expect(storage.getItem('barry.conditions')).toBe('');
    expect((await barry.getInProgressAdventure()).adventure).toBeNull();
  });
});

describe('a Deadline more than a year ahead', () => {
  const farAhead = new Date('2028-01-01T10:00:00Z');

  it('is refused on a save with its own refusal, which the sheet names', async () => {
    const { barry, world } = setup();
    world.signal = true;
    world.refuse = 'barry:deadline_too_far';
    const result = await barry.saveAdventure({ plan: { destination: 'Rigi' }, deadline: farAhead, contactIds: [] });
    expect(result).toEqual({ kind: 'refused', refusal: 'deadline_too_far' });
  });

  it('is refused on a Start with its own refusal, not as a lost signal', async () => {
    const { barry, world } = setup();
    world.signal = true;
    world.refuse = 'barry:deadline_too_far';
    const result = await barry.start({ plan: { destination: 'Rigi' }, deadline: farAhead, contactIds: [] });
    expect(result).toEqual({ kind: 'refused', refusal: 'deadline_too_far' });
  });

  it('is refused on a move with its own refusal, not as a lost signal', async () => {
    const { barry, world } = setup();
    world.signal = true;
    world.refuse = 'barry:deadline_too_far';
    expect(await barry.moveDeadline(a1, farAhead)).toEqual({ kind: 'refused', refusal: 'deadline_too_far' });
  });
});

describe('watchMessages', () => {
  const sent: MessageRow = {
    id: 1,
    kind: 'heads_up',
    round: null,
    channel: 'sms',
    to_address: '+41791111111',
    contacts: [{ id: 'c1', name: 'Luca' }],
    status: 'sent',
    delivered: false,
    outcome_at: '2026-10-17T06:01:00Z',
    failure_reason: null,
  };

  const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('lists the messages once each connection hears the database and after each outcome, but not while one waits or is being sent', async () => {
    const { barry, messageRows, realtime } = setup();
    const seen: number[] = [];
    const stop = barry.watchMessages(a1, (messages) => void seen.push(messages.length));

    realtime.onStatus('SUBSCRIBED');
    await settled();
    expect(seen).toEqual([]);
    realtime.onSystem({ extension: 'postgres_changes', status: 'ok' });
    await settled();
    messageRows.push(sent);
    realtime.onChange({ new: { status: 'pending' } });
    realtime.onChange({ new: { status: 'sending' } });
    await settled();
    realtime.onChange({ new: { status: 'sent' } });
    await settled();
    messageRows.push({ ...sent, id: 2, status: 'failed', failure_reason: 'retries_exhausted' });
    realtime.onChange({ new: { status: 'failed' } });
    await settled();
    stop();

    expect(seen).toEqual([0, 1, 2]);
    expect(realtime.removed).toBe(true);
  });

  it('opens a channel of its own for each screen that watches the same Adventure', () => {
    const { barry, realtime } = setup();
    barry.watchMessages(a1, () => undefined);
    barry.watchMessages(a1, () => undefined);
    expect(new Set(realtime.names).size).toBe(2);
  });
});
