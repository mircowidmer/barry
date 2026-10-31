import { isAuthRetryableFetchError, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database';

import { createAdventureCache } from './adventure-cache';
import { createAlarms, dueAlarms, type NotificationService } from './alarms';
import { createArrival } from './arrival';
import { createFailureNotices } from './failure-notices';
import { createCheckInQueue, type SendOutcome } from './check-in-queue';
import { createConditions } from './conditions';
import { createLiveActivity, liveActivityView, type LiveActivityService } from './live-activity';
import { copyPhoneContact, createPhoneContactLinks, type PhoneContact } from './phone-contact';
import { createTrail, type LocationService } from './trail';
import { createTrailBuffer } from './trail-buffer';
import {
  ADVENTURE_SELECT,
  type AdventureWithRelations,
  parseAdventure,
  parseContact,
  parsePosition,
  parseProfile,
  MESSAGE_SELECT,
  parseSentMessage,
  POSITION_SELECT,
} from './rows';
import type {
  Adventure,
  AdventureDraft,
  AdventureId,
  Barry,
  Channel,
  ContactDraft,
  EmergencyContact,
  InProgressAdventure,
  MessageLanguage,
  Place,
  Position,
  SentMessage,
  ShowPhoneContactOptions,
} from './types';

export type BarryDeps = {
  supabase: SupabaseClient<Database>;
  /** One reading, or null when permission is denied or there is no fix in time. */
  readPosition(): Promise<Position | null>;
  /** The places Apple Maps finds for a query, nearest the phone first, or none. */
  findPlaces(query: string): Promise<Place[]>;
  timeZone(): string;
  /** The phone's language, which Barry also writes the messages to the contacts in. */
  language(): MessageLanguage;
  now(): Date;
  /** The phone's picker: the picked Phone Contact, or null when the Adventurer cancels. */
  pickContact(): Promise<PhoneContact | null>;
  /**
   * Shows the phone's own card of a Phone Contact, asking for access to the contacts first if the Adventurer has
   * not answered yet, and only if `beforeAsking` agrees. False when access is refused or the contact is gone.
   */
  showPhoneContact(phoneId: string, options: ShowPhoneContactOptions): Promise<boolean>;
  /** The phone's region, such as CH, which a number without a country code is read in. */
  region(): string | null;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Whether the system lets Barry show notifications. */
  notificationsPermitted(): Promise<boolean>;
  notifications: NotificationService;
  /** The Live Activity on the Lock Screen. */
  liveActivity: LiveActivityService;
  location: LocationService;
  /** The parsed JSON at a URL outside Supabase, such as the forecast; throws without signal or on an error status. */
  fetchJson(url: string): Promise<unknown>;
};

// A Postgres or PostgREST error always has a code. A failed request has none, and then the
// command may or may not have reached Supabase.
const isNoSignal = (error: PostgrestError) => !error.code;

// Raised by the trigger that bounds the Deadline to a year ahead, on a save, a Start and a move alike.
const isDeadlineTooFar = (error: PostgrestError) => error.message.includes('barry:deadline_too_far');

const fail = (what: string, error: PostgrestError): never => {
  throw new Error(`${what}: ${error.message}`);
};

const positionArgs = (position: Position | null) =>
  position
    ? {
        p_latitude: position.latitude,
        p_longitude: position.longitude,
        p_position_taken_at: position.takenAt.toISOString(),
        ...(position.accuracyM !== null && { p_accuracy_m: position.accuracyM }),
      }
    : {};

// The generated argument types mark every parameter as required, but Postgres takes null for them.
const orNull = <T,>(value: T | null | undefined): T => (value ?? null) as T;

const draftArgs = ({ id, plan, deadline, contactIds }: AdventureDraft) => ({
  p_id: orNull(id),
  p_destination: orNull(plan.destination),
  ...(plan.destinationPoint && { p_destination_point: plan.destinationPoint }),
  p_deadline: orNull(deadline?.toISOString()),
  p_contact_ids: contactIds,
});

const isInProgress = (a: Adventure | null): a is InProgressAdventure =>
  a !== null && (a.stage === 'active' || a.stage === 'overdue' || a.stage === 'alerted');

// SUBSCRIBED only means the channel joined. Realtime says in a system message once it hears the database, and a
// change committed before then never arrives, so a watcher reloads on that message instead.
const hearsDatabase = (message: { extension?: string; status?: string }) =>
  message.extension === 'postgres_changes' && message.status === 'ok';

export const createBarry = ({
  supabase,
  readPosition,
  findPlaces,
  timeZone,
  language,
  now,
  pickContact,
  showPhoneContact,
  region,
  storage,
  notificationsPermitted,
  notifications,
  liveActivity,
  location,
  fetchJson,
}: BarryDeps): Barry => {
  const userId = async () => {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('not signed in');
    return id;
  };

  const cache = createAdventureCache(storage, now);
  const phoneContacts = createPhoneContactLinks(storage);
  let messageWatchers = 0;
  const conditions = createConditions({ fetchJson, storage, now, language });

  const cachedInProgress = () => {
    const cached = cache.load();
    const adventure = cached ? parseAdventure(cached.row) : null;
    return isInProgress(adventure) ? adventure : null;
  };

  const checkedIn = (id: AdventureId | undefined) => queue.pending().some((c) => c.adventureId === id);

  const alarms = createAlarms({
    notifications,
    due: () => {
      const adventure = cachedInProgress();
      return dueAlarms(adventure, checkedIn(adventure?.id), now());
    },
  });

  const activity = createLiveActivity({
    service: liveActivity,
    due: () => {
      const adventure = cachedInProgress();
      return liveActivityView(adventure, checkedIn(adventure?.id));
    },
    textContext: () => `${now().toDateString()} ${language()}`,
  });

  const arrival = createArrival({ storage, show: (adventure) => notifications.showArrival(adventure), inProgress: cachedInProgress, checkedIn });

  const syncLockScreen = () => Promise.all([alarms.sync().catch(() => undefined), activity.sync().catch(() => undefined)]);

  // The fences follow the live Adventure and where its destination is.
  const fenceKey = (row: AdventureWithRelations | null | undefined) =>
    row ? [row.id, row.destination_latitude, row.destination_longitude].join(' ') : null;

  const remember = (row: AdventureWithRelations | null) => {
    const before = fenceKey(cache.load()?.row);
    cache.save(row);
    void syncLockScreen();
    if (fenceKey(row) !== before) syncTrail();
  };

  const messages = async (id: AdventureId): Promise<SentMessage[]> => {
    const { data, error } = await supabase
      .from('adventure_messages')
      .select(MESSAGE_SELECT)
      .eq('adventure_id', id)
      .order('outcome_at', { ascending: false })
      .order('id', { ascending: false });
    if (error) fail('messages', error);
    return (data ?? []).map(parseSentMessage);
  };

  const failureNotices = createFailureNotices({
    storage,
    show: (message, adventureId) => notifications.showDeliveryFailure(message, adventureId),
    inProgress: cachedInProgress,
    messages,
  });

  const getAdventure = async (id: AdventureId) => {
    const { data, error } = await supabase
      .from('adventures')
      .select(ADVENTURE_SELECT)
      .eq('id', id)
      .order('taken_at', { referencedTable: 'last_position', ascending: false })
      .limit(1, { referencedTable: 'last_position' })
      .maybeSingle();
    if (error) fail('getAdventure', error);
    const row: AdventureWithRelations | null = data;
    const adventure = row ? parseAdventure(row) : null;
    if (isInProgress(adventure)) remember(row);
    else if (cache.load()?.row.id === id) remember(null);
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

  const flushCheckIns = async () => {
    const done = await queue.flush();
    // A Check-in that left the queue ended the Adventure, so it is no longer the live one even when
    // the refetch below fails; otherwise its notifications would be scheduled again.
    const live = cache.load()?.row.id as AdventureId | undefined;
    if (live && done.has(live)) remember(null);
    return new Map(await Promise.all([...done].map(async (id) => [id, await getAdventure(id).catch(() => null)] as const)));
  };

  const trail = createTrail({
    location,
    buffer: createTrailBuffer(storage),
    // An expired token whose refresh fails for lack of signal still belongs to a signed-in Adventurer.
    signedIn: async () => {
      const { data, error } = await supabase.auth.getSession();
      return data.session !== null || (error !== null && isAuthRetryableFetchError(error));
    },
    inProgressId: () => (cache.load()?.row.id as AdventureId | undefined) ?? null,
    destinationPoint: () => cachedInProgress()?.plan.destinationPoint ?? null,
    arrived: arrival.arrived,
    pendingCheckIn: () => queue.pending().length > 0,
    flushCheckIns: async () => {
      await flushCheckIns();
    },
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

  const listContacts = async (): Promise<EmergencyContact[]> => {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .is('removed_at', null)
      .order('name');
    if (error) fail('listContacts', error);
    return (data ?? []).map(parseContact);
  };

  const saveContact = async ({ id, name, email, emailEnabled, phone, phoneEnabled }: ContactDraft): Promise<EmergencyContact> => {
    const values = { name, email, email_enabled: emailEnabled, phone, phone_enabled: phoneEnabled };
    const { data, error } = id
      ? await supabase.from('emergency_contacts').update(values).eq('id', id).select().single()
      : await supabase.from('emergency_contacts').insert(values).select().single();
    if (error) return fail('saveContact', error);
    return parseContact(data);
  };

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
        message_language: language(),
        updated_at: now().toISOString(),
      });
      if (error) fail('saveProfile', error);
    },

    syncMessageLanguage: async () => {
      const { error } = await supabase
        .from('adventurer_profiles')
        .update({ message_language: language() })
        .eq('id', await userId());
      if (error) fail('syncMessageLanguage', error);
    },

    listContacts,

    addContactFromPhone: async () => {
      const picked = await pickContact();
      if (!picked) return { kind: 'cancelled' };
      const copy = copyPhoneContact(picked, region());
      if (copy.email === null && copy.phone === null) return { kind: 'unreachable', name: copy.name };
      const sameAddress = (await listContacts()).find(
        (c) =>
          (copy.email !== null && c.email?.toLowerCase() === copy.email.toLowerCase()) || (copy.phone !== null && c.phone === copy.phone),
      );
      if (sameAddress) return { kind: 'duplicate', name: sameAddress.name };
      try {
        const contact = await saveContact({
          name: copy.name,
          email: copy.email,
          emailEnabled: copy.email !== null,
          phone: copy.phone,
          phoneEnabled: copy.phone !== null,
        });
        if (picked.phoneId) phoneContacts.set(contact.id, picked.phoneId);
        return { kind: 'added', contact };
      } catch (error) {
        if (error instanceof Error && error.message.includes('barry:too_many_contacts')) return { kind: 'full' };
        throw error;
      }
    },

    saveContact,

    removeContact: async (id) => {
      const { error } = await supabase
        .from('emergency_contacts')
        .update({ removed_at: now().toISOString() })
        .eq('id', id);
      if (error?.message.includes('barry:contact_in_use')) return { kind: 'in_use' };
      if (error) fail('removeContact', error);
      phoneContacts.forget(id);
      return { kind: 'removed' };
    },

    showPhoneContact: async (id, options) => {
      const phoneId = phoneContacts.get(id);
      return phoneId !== null && showPhoneContact(phoneId, options);
    },

    enabledChannels,

    listAdventures: async () => {
      const { data, error } = await supabase
        .from('adventures')
        .select(ADVENTURE_SELECT)
        .order('taken_at', { referencedTable: 'last_position', ascending: false })
        .limit(1, { referencedTable: 'last_position' })
        .order('created_at', { ascending: false });
      if (error) fail('listAdventures', error);
      return (data ?? []).map(parseAdventure);
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
        void syncLockScreen();
        return { adventure: cachedInProgress(), offlineSince: cache.load()?.savedAt ?? now() };
      }
      const row: AdventureWithRelations | null = data;
      remember(row);
      const adventure = row ? parseAdventure(row) : null;
      return { adventure: isInProgress(adventure) ? adventure : null, offlineSince: null };
    },

    saveAdventure: async (draft) => {
      const { data, error } = await supabase.rpc('save_adventure', draftArgs(draft));
      if (error) return isDeadlineTooFar(error) ? { kind: 'refused', refusal: 'deadline_too_far' } : fail('saveAdventure', error);
      const [result] = data;
      if (!result) throw new Error('saveAdventure: the command returned no row');
      if (result.refusal) return { kind: 'refused', refusal: result.refusal };
      const adventure = await getAdventure(result.adventure_id as AdventureId);
      if (!adventure) throw new Error('saveAdventure: the saved Adventure is missing');
      return { kind: 'saved', adventure };
    },

    findPlaces: async (query) => (query.trim() ? findPlaces(query.trim()) : []),

    currentPosition: readPosition,
    conditions: conditions.at,

    deleteAdventure: async (id) => {
      const { data, error } = await supabase.rpc('delete_adventure', { p_id: id });
      if (error) fail('deleteAdventure', error);
      if (data) return { kind: 'refused', refusal: data };
      await syncLockScreen();
      return { kind: 'deleted' };
    },

    deleteAccount: async () => {
      const { data, error } = await supabase.rpc('delete_account');
      if (error) fail('deleteAccount', error);
      if (data) return { kind: 'refused', refusal: data };
      remember(null);
      conditions.forget();
      await supabase.auth.signOut({ scope: 'local' });
      return { kind: 'deleted' };
    },

    logOut: async () => {
      remember(null);
      conditions.forget();
      await supabase.auth.signOut();
    },

    startChecks: async () => {
      const [channels, notificationsAllowed, trailPermitted] = await Promise.all([
        enabledChannels(),
        notificationsPermitted(),
        location.backgroundPermitted(),
      ]);
      return { smsEnabled: channels.has('sms'), notificationsPermitted: notificationsAllowed, trailPermitted };
    },

    start: async (draft) => {
      const position = await readPosition();
      const { data, error } = await supabase.rpc('save_and_start_adventure', {
        ...draftArgs(draft),
        p_time_zone: timeZone(),
        ...positionArgs(position),
      });
      if (error) {
        if (isDeadlineTooFar(error)) return { kind: 'refused', refusal: 'deadline_too_far' };
        return isNoSignal(error) ? { kind: 'unconfirmed' } : fail('start', error);
      }
      const [result] = data;
      if (!result) throw new Error('start: the command returned no row');
      if (result.refusal) return { kind: 'refused', refusal: result.refusal };
      // The command went through; a refetch that fails for lack of signal is only unconfirmed.
      const adventure = await getAdventure(result.adventure_id as AdventureId).catch(() => null);
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
      if (error) {
        if (isDeadlineTooFar(error)) return { kind: 'refused', refusal: 'deadline_too_far' };
        return isNoSignal(error) ? { kind: 'unconfirmed' } : fail('moveDeadline', error);
      }
      if (data) return { kind: 'refused', refusal: data };
      const adventure = await getAdventure(id).catch(() => null);
      syncTrail();
      return isInProgress(adventure) ? { kind: 'moved', adventure } : { kind: 'unconfirmed' };
    },

    checkIn: async (id) => {
      const checkedInAt = now();
      queue.add({ adventureId: id, checkedInAt });
      const [, sent] = await Promise.all([syncLockScreen(), flushCheckIns()]);
      const adventure = sent.get(id) ?? null;
      syncTrail();
      return adventure?.stage === 'ended'
        ? { kind: 'ended', adventure }
        : { kind: 'queued', checkedInAt };
    },

    pendingCheckIns: () => queue.pending(),

    flushPendingCheckIns: async () => {
      await flushCheckIns();
    },

    messages,

    watchMessages: (id, onChange) => {
      const refresh = () => messages(id).then(onChange, () => undefined);
      // Supabase hands out the open channel for a name already in use, and a subscribed one takes no more
      // listeners, so the live screen and the contacts sheet each need their own.
      const channel = supabase
        .channel(`messages:${id}:${++messageWatchers}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `adventure_id=eq.${id}` }, (change) => {
          // A message waiting or being sent is not listed, so only an outcome changes the list.
          const status = 'status' in change.new ? change.new.status : null;
          if (status === 'sent' || status === 'failed') void refresh();
        })
        .on('system', {}, (message) => hearsDatabase(message) && void refresh())
        .subscribe();
      return () => {
        supabase.removeChannel(channel).catch(() => undefined);
      };
    },

    noticeDeliveryFailures: failureNotices.notice,

    watchDeliveryFailures: () => {
      const notice = () => void failureNotices.notice().catch(() => undefined);
      // Row level security limits the changes to the Adventurer's own messages.
      const channel = supabase
        .channel(`delivery-failures:${++messageWatchers}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'status=eq.failed' }, notice)
        .on('system', {}, (message) => hearsDatabase(message) && notice())
        .subscribe();
      return () => {
        supabase.removeChannel(channel).catch(() => undefined);
      };
    },

    readings: async (id, after) => {
      const query = supabase.from('position_readings').select(POSITION_SELECT).eq('adventure_id', id);
      const { data, error } = await (after ? query.gt('taken_at', after.toISOString()) : query).order('taken_at');
      if (error) fail('readings', error);
      return (data ?? []).map(parsePosition);
    },

    trail,

    watchAdventure: (id, onChange) => {
      const refresh = () => getAdventure(id).then((adventure) => adventure && onChange(adventure), () => undefined);
      const channel = supabase
        .channel(`adventure:${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'adventures', filter: `id=eq.${id}` }, () => void refresh())
        // Realtime does not replay the updates missed while the socket was down, so each connection refetches.
        .on('system', {}, (message) => hearsDatabase(message) && void refresh())
        .subscribe();
      return () => {
        supabase.removeChannel(channel).catch(() => undefined);
      };
    },
  };
};
