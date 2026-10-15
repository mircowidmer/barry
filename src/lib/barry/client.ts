import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

import { createAdventureCache } from './adventure-cache';
import { createCheckInQueue, type SendOutcome } from './check-in-queue';
import { createTrail, type LocationService } from './trail';
import { createTrailBuffer } from './trail-buffer';
import { ADVENTURE_SELECT, type AdventureWithRelations, parseAdventure, parseContact, parseProfile } from './rows';
import type {
  Adventure,
  AdventureId,
  Barry,
  Channel,
  DeliveryFailure,
  EndedAdventure,
  InProgressAdventure,
  Position,
  Refusal,
} from './types';

export type BarryDeps = {
  supabase: SupabaseClient<Database>;
  /** One reading, or null when permission is denied or there is no fix in time. */
  readPosition(): Promise<Position | null>;
  timeZone(): string;
  now(): Date;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Whether the system lets Barry show notifications. */
  pushPermitted(): Promise<boolean>;
  location: LocationService;
};

// A Postgres or PostgREST error always has a code. A failed request has none, and then the
// command may or may not have reached Supabase.
const isNoSignal = (error: PostgrestError) => !error.code;

const fail = (what: string, error: PostgrestError): never => {
  throw new Error(`${what}: ${error.message}`);
};

const positionArgs = (position: Position | null) => ({
  p_latitude: position?.latitude,
  p_longitude: position?.longitude,
  p_accuracy_m: position?.accuracyM ?? undefined,
  p_position_taken_at: position?.takenAt.toISOString(),
});

// The generated argument types mark every parameter as required, but Postgres takes null for them.
const orNull = <T,>(value: T | null | undefined): T => (value ?? null) as T;

const isInProgress = (a: Adventure | null): a is InProgressAdventure =>
  a !== null && (a.stage === 'active' || a.stage === 'overdue' || a.stage === 'alerted');

export const createBarry = ({
  supabase,
  readPosition,
  timeZone,
  now,
  storage,
  pushPermitted,
  location,
}: BarryDeps): Barry => {
  const userId = async () => {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('not signed in');
    return id;
  };

  const cache = createAdventureCache(storage, now);

  const getAdventure = async (id: AdventureId) => {
    const { data, error } = await supabase
      .from('adventures')
      .select(ADVENTURE_SELECT)
      .eq('id', id)
      .order('taken_at', { referencedTable: 'last_position', ascending: false })
      .limit(1, { referencedTable: 'last_position' })
      .maybeSingle();
    if (error) fail('getAdventure', error);
    const row = data as unknown as AdventureWithRelations | null;
    const adventure = row ? parseAdventure(row) : null;
    if (isInProgress(adventure)) cache.save(row);
    else if (cache.load()?.row.id === id) cache.save(null);
    return adventure;
  };

  const enabledChannels = async () => {
    const { data, error } = await supabase.rpc('enabled_channels');
    if (error) fail('enabledChannels', error);
    return new Set<Channel>(data ?? []);
  };

  const queue = createCheckInQueue(storage, async ({ adventureId, checkedInAt }): Promise<SendOutcome> => {
    const { data, error } = await supabase.rpc('check_in', {
      p_id: adventureId,
      p_checked_in_at: checkedInAt.toISOString(),
    });
    if (error) return isNoSignal(error) ? 'no_signal' : fail('checkIn', error);
    return data === null ? 'accepted' : 'refused';
  });

  const trail = createTrail({
    location,
    buffer: createTrailBuffer(storage),
    signedIn: async () => (await supabase.auth.getSession()).data.session !== null,
    inProgressId: () => (cache.load()?.row.id as AdventureId | undefined) ?? null,
    checkInQueued: (id) => queue.pending().some((c) => c.adventureId === id),
    recordTrail: async (id, batch) => {
      const { data, error } = await supabase.rpc('record_trail', {
        p_id: id,
        p_readings: batch.map((r) => ({
          taken_at: r.takenAt.toISOString(),
          latitude: r.latitude,
          longitude: r.longitude,
          accuracy_m: r.accuracyM,
        })),
      });
      return { data, error };
    },
  });

  const syncTrail = () => {
    trail.sync().catch(() => undefined);
  };

  return {
    getProfile: async () => {
      const { data, error } = await supabase.from('adventurer_profiles').select('*').maybeSingle();
      if (error) fail('getProfile', error);
      return data ? parseProfile(data) : null;
    },

    saveProfile: async (profile) => {
      const { error } = await supabase.from('adventurer_profiles').upsert({
        id: await userId(),
        name: profile.name,
        phone: profile.phone,
        car_make: profile.carMake,
        car_colour: profile.carColour,
        car_plate: profile.carPlate,
        medical_notes: profile.medicalNotes,
        updated_at: now().toISOString(),
      });
      if (error) fail('saveProfile', error);
    },

    listContacts: async () => {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .is('removed_at', null)
        .order('name');
      if (error) fail('listContacts', error);
      return (data ?? []).map(parseContact);
    },

    saveContact: async ({ id, name, phone, email }) => {
      const values = { name, phone, email };
      const { data, error } = id
        ? await supabase.from('emergency_contacts').update(values).eq('id', id).select().single()
        : await supabase.from('emergency_contacts').insert(values).select().single();
      if (error) fail('saveContact', error);
      return parseContact(data!);
    },

    removeContact: async (id) => {
      const { error } = await supabase
        .from('emergency_contacts')
        .update({ removed_at: now().toISOString() })
        .eq('id', id);
      if (error?.message.includes('barry:contact_in_use')) return { kind: 'in_use' };
      if (error) fail('removeContact', error);
      return { kind: 'removed' };
    },

    enabledChannels,

    registerPushDevice: async (expoPushToken) => {
      const { error } = await supabase
        .from('push_devices')
        .upsert({ expo_push_token: expoPushToken, adventurer_id: await userId(), updated_at: now().toISOString() });
      if (error) fail('registerPushDevice', error);
    },

    listAdventures: async () => {
      const { data, error } = await supabase
        .from('adventures')
        .select(ADVENTURE_SELECT)
        .order('taken_at', { referencedTable: 'last_position', ascending: false })
        .limit(1, { referencedTable: 'last_position' })
        .order('created_at', { ascending: false });
      if (error) fail('listAdventures', error);
      return ((data ?? []) as unknown as AdventureWithRelations[]).map(parseAdventure);
    },

    getAdventure,

    getInProgressAdventure: async () => {
      const { data, error } = await supabase
        .from('adventures')
        .select(ADVENTURE_SELECT)
        .in('stage', ['active', 'overdue', 'alerted'])
        .order('taken_at', { referencedTable: 'last_position', ascending: false })
        .limit(1, { referencedTable: 'last_position' })
        .maybeSingle();
      if (error) {
        if (!isNoSignal(error)) fail('getInProgressAdventure', error);
        const cached = cache.load();
        const adventure = cached ? parseAdventure(cached.row) : null;
        return { adventure: isInProgress(adventure) ? adventure : null, offlineSince: cached?.savedAt ?? now() };
      }
      const row = data as unknown as AdventureWithRelations | null;
      cache.save(row);
      const adventure = row ? parseAdventure(row) : null;
      return { adventure: isInProgress(adventure) ? adventure : null, offlineSince: null };
    },

    saveAdventure: async ({ id, plan, deadline, contactIds }) => {
      const { data, error } = await supabase.rpc('save_adventure', {
        p_id: orNull(id),
        p_destination: orNull(plan.destination),
        p_route: orNull(plan.route),
        p_starting_point: orNull(plan.startingPoint),
        p_notes: orNull(plan.notes),
        p_deadline: orNull(deadline?.toISOString()),
        p_contact_ids: contactIds,
      });
      if (error) fail('saveAdventure', error);
      const [result] = data!;
      if (result.refusal) return { kind: 'refused', refusal: result.refusal };
      const adventure = await getAdventure(result.adventure_id as AdventureId);
      if (!adventure) throw new Error('saveAdventure: the saved Adventure is missing');
      return { kind: 'saved', adventure };
    },

    deleteAdventure: async (id) => {
      const { data, error } = await supabase.rpc('delete_adventure', { p_id: id });
      if (error) fail('deleteAdventure', error);
      return data ? { kind: 'refused', refusal: data } : { kind: 'deleted' };
    },

    startConditions: async () => {
      const [channels, devices, permitted, trailPermitted] = await Promise.all([
        enabledChannels(),
        supabase.from('push_devices').select('expo_push_token', { count: 'exact', head: true }),
        pushPermitted(),
        location.backgroundPermitted(),
      ]);
      return {
        smsEnabled: channels.has('sms'),
        pushRegistered: permitted && (devices.count ?? 0) > 0,
        trailPermitted,
      };
    },

    start: async (id) => {
      const position = await readPosition();
      const { data, error } = await supabase.rpc('start_adventure', {
        p_id: id,
        p_time_zone: timeZone(),
        ...positionArgs(position),
      });
      if (error) return isNoSignal(error) ? { kind: 'unconfirmed' } : fail('start', error);
      if (data) return { kind: 'refused', refusal: data as Refusal };
      const adventure = await getAdventure(id);
      syncTrail();
      return isInProgress(adventure) ? { kind: 'protected', adventure } : { kind: 'unconfirmed' };
    },

    moveDeadline: async (id, deadline) => {
      const position = await readPosition();
      const { data, error } = await supabase.rpc('move_deadline', {
        p_id: id,
        p_deadline: deadline.toISOString(),
        ...positionArgs(position),
      });
      if (error) return isNoSignal(error) ? { kind: 'unconfirmed' } : fail('moveDeadline', error);
      if (data) return { kind: 'refused', refusal: data as Refusal };
      const adventure = await getAdventure(id);
      syncTrail();
      return isInProgress(adventure) ? { kind: 'moved', adventure } : { kind: 'unconfirmed' };
    },

    checkIn: async (id) => {
      const checkedInAt = now();
      queue.add({ adventureId: id, checkedInAt });
      const done = await queue.flush();
      const adventure = done.has(id) ? await getAdventure(id).catch(() => null) : null;
      syncTrail();
      return adventure?.stage === 'ended'
        ? { kind: 'ended', adventure: adventure as EndedAdventure }
        : { kind: 'queued', checkedInAt };
    },

    pendingCheckIns: () => queue.pending(),

    flushPendingCheckIns: async () => {
      await queue.flush();
    },

    deliveryFailures: async (id) => {
      const { data, error } = await supabase
        .from('delivery_failures')
        .select('kind, contact_name, channel, to_address, failure_reason')
        .eq('adventure_id', id)
        .order('created_at');
      if (error) fail('deliveryFailures', error);
      return (data ?? []).map(
        (row): DeliveryFailure => ({
          message: row.kind as DeliveryFailure['message'],
          contactName: row.contact_name ?? '',
          channel: row.channel!,
          address: row.to_address!,
          reason: row.failure_reason ?? '',
        }),
      );
    },

    trail,

    watchAdventure: (id, onChange) => {
      const channel = supabase
        .channel(`adventure:${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'adventures', filter: `id=eq.${id}` }, () => {
          getAdventure(id).then((adventure) => adventure && onChange(adventure), () => undefined);
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
};
