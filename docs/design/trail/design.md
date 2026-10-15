# Trail and Trail Map: the token lives on the contact row, the minute lives in a unique index

Design for the [Location and Trail Map sections of the spec](../../spec.md). It is a sketch: bodies are `not implemented` or pseudocode. Paths are relative to the repository root at `824b8fb`. Four candidate designs were compared; [Synthesis decision](#synthesis-decision) records what was taken from each.

The design has three load-bearing ideas:

1. **The one-per-minute rule is a unique index.** `position_readings` gets a generated `minute` column and a partial unique index `(adventure_id, minute) where reason = 'trail'`. Every upload is `insert ... on conflict do nothing`. Retries, duplicates, a crash after commit and an overlapping flush all collapse to the same rows. The phone thins by the same key only to keep its buffer and its uploads small; the server is the authority.
2. **The Trail Map link is a column of `adventure_contacts`.** `adventure_contacts.trail_token` is born with the row. Removing the contact from the Adventure deletes the row (`save_adventure` line 89 already does this), so the link dies with it. Re-adding inserts a new row, so the contact gets a new link. There is no link table, no revoke step and nothing to keep in sync.
3. **The token travels in the URL fragment of a single static route.** The link is `https://<web origin>/trail#<token>`. `/trail` is one pre-rendered page under `web.output: "static"`, so there is no dynamic route to solve. The fragment never reaches EAS Hosting's logs, and it never leaves the page in the `Referer` sent to the OpenStreetMap tile servers.

Everything else follows the existing patterns: one security-definer command for the upload, one security-definer projection for `anon`, facts read at send time by `deliver`.

---

## Usage (caller's view)

Written first. The type sketch below is derived from these call sites.

### 1. The background task (phone, no UI)

```ts
// index.ts (new app entry; package.json "main": "index.ts")
import '@/lib/barry/trail-task';   // TaskManager.defineTask must run at module top level, before any UI
import 'expo-router/entry';
```

```ts
// src/lib/barry/trail-task.ts
import * as TaskManager from 'expo-task-manager';
import { barry } from '@/lib/barry';
import { TRAIL_FENCE_TASK, TRAIL_LOCATION_TASK } from './trail';

TaskManager.defineTask(TRAIL_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  await barry.trail.onLocations((data as { locations: LocationObject[] }).locations);
});

TaskManager.defineTask(TRAIL_FENCE_TASK, async ({ data, error }) => {
  if (error) return;
  // iOS relaunched a terminated Barry because the Adventurer left the 200 m area.
  await barry.trail.onFenceExit();
});
```

The task bodies are one line each. All logic sits in `barry.trail`, which is built with injected effects and tested with fakes.

### 2. The app shell and the live screen

```ts
// src/app/(app)/_layout.tsx  (the current root layout, moved into a group)
useEffect(() => {
  const catchUp = () => {
    barry.flushPendingCheckIns();
    barry.trail.sync();            // start or stop recording to match the Adventure; flush the buffer
    registerForPush();
  };
  catchUp();
  const sub = AppState.addEventListener('change', (s) => s === 'active' && catchUp());
  return () => sub.remove();
}, [session]);
```

```tsx
// src/app/(app)/(tabs)/index.tsx, LiveAdventure
const trail = useTrailStatus();     // 'recording' | 'off', re-read on focus and on AppState 'active'
...
{trail === 'recording'
  ? <Notice>Barry is recording your Trail. Closing Barry stops the Trail.</Notice>
  : <Notice>Barry can share only where you started.</Notice>}
{adventure.lastKnownPosition && <Text>Last position {formatTime(adventure.lastKnownPosition.takenAt)}</Text>}
```

`start`, `moveDeadline` and `checkIn` call `trail.sync()` themselves after the command settles, so screens never start or stop recording.

### 3. The Start screen

```ts
// src/app/(app)/plan.tsx
const conditions = await barry.startConditions();   // { smsEnabled, pushRegistered, trailPermitted }
const warnings = startWarnings(selectedContacts, conditions);
// -> [{ kind: 'no_trail' }, ...]  rendered via the exhaustive warningText: Record<StartWarning['kind'], ...>
//    'no_trail' -> "Barry can share only where you started"   (+ button "Allow Always" -> barry.trail.requestPermission())
await barry.start(adventure.id);   // Start is still allowed with the warning
```

### 4. The Trail Map page (web, no account)

```tsx
// src/app/trail.tsx   -> pre-rendered to dist/trail.html
export default function TrailMapRoute() {
  const view = useTrailMap();           // reads location.hash, polls trail_map every 60 s
  switch (view.kind) {
    case 'loading':   return <Loading />;
    case 'not_found': return <Text>This link does not work.</Text>;      // unknown, revoked, or Planned
    case 'offline':   return <Stale since={view.since} map={view.last} />;
    case 'ready':     return <TrailMapPage map={view.map} />;
  }
}

// TrailMapPage
switch (map.status) {
  case 'underway':   // Active or Overdue: indistinguishable on purpose
  case 'alerted':    // after the first Alert: banner "Barry has raised the Alert"
    return <><Header name={map.adventurerName} plan={map.plan} alerted={map.status === 'alerted'} />
             <OsmMap trail={map.trail} last={map.lastKnownPosition} />
             <LastKnown position={map.lastKnownPosition} timeZone={map.timeZone} /></>;
  case 'checked_in':
    return <><Header name={map.adventurerName} plan={map.plan} />
             <Text>Checked in at {formatTime(map.checkedInAt, map.timeZone)}</Text></>;
}
```

### 5. The deliver function

```ts
// supabase/functions/deliver/index.ts (boot)
const links = trailMapLinks(Deno.env.get('TRAIL_MAP_URL'));   // null when unset: messages go out without the link

// send(row)
const facts = parseFacts(await messageFacts(row.id));   // heads_up and alert now carry trailToken: string | null
const rendered = render(facts, links);                   // adds "Follow Anna's Trail: https://.../trail#Xk3..."
```

```ts
// supabase/functions/deliver/messages.en.ts
export const render = (facts: MessageFacts, links: TrailMapLinks | null): Rendered => ...
// Heads-up and Alert: if (links && facts.trailToken) lines.push(`Follow ${name}'s Trail: ${links.forToken(facts.trailToken)}`)
```

### 6. The two remote procedure calls, as callers see them

```ts
// phone, authenticated
await supabase.rpc('record_trail', { p_id: adventureId, p_readings: [{ taken_at, latitude, longitude, accuracy_m }, ...] });
// -> null (stored or already stored) | 'not_found' | 'wrong_stage'

// web page, anon (publishable key, no session, plain fetch, no supabase-js)
POST {SUPABASE_URL}/rest/v1/rpc/trail_map  { "p_token": "Xk3..." }
// -> null | { status, adventurer_name, plan, time_zone, checked_in_at?, last_known_position?, trail? }
```

---

## Shape

### Data structures

#### `public.position_readings` (changed)

```sql
alter table public.position_readings
  drop constraint position_readings_reason_check,
  add constraint position_readings_reason_check check (reason in ('start', 'deadline_move', 'trail')),
  add column minute timestamptz generated always as (date_trunc('minute', taken_at at time zone 'UTC') at time zone 'UTC') stored;

-- The one-per-minute rule. A second Trail reading in the same minute, a retried batch, or an
-- overlapping flush all hit this index and change nothing.
create unique index position_readings_trail_minute
  on public.position_readings (adventure_id, minute) where reason = 'trail';
-- Existing (adventure_id, taken_at desc) stays: it serves the Last Known Position and the Trail line.
```

`date_trunc` on `timestamptz` is only `stable` (it depends on the session time zone), so the generated column truncates in UTC explicitly, which is `immutable`. Start and Deadline-move readings are outside the partial index: they are never thinned and never deduplicated against the Trail.

#### `public.adventure_contacts` (changed)

```sql
alter table public.adventure_contacts
  add column trail_token text not null unique
    default translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_');
-- 128 random bits, 22 URL-safe characters. Short enough for a text message.

-- The Adventurer can read the tokens of their own Adventures through own_read. That is harmless:
-- the links show the Adventurer's own Trail.
```

Invariants carried by structure, not code:

- **One link per contact per Adventure.** The primary key `(adventure_id, contact_id)` plus the column.
- **A removed contact's link stops working.** Removal is `delete from adventure_contacts` (`commands.sql:89`); the token is deleted with the row. No revoke code exists to forget.
- **A re-added contact gets a fresh link.** `on conflict do nothing` at `commands.sql:94` only applies while the row still exists; after a removal the insert creates a new row with a new default token.
- **Account deletion** already cascades through `adventure_contacts`.

Planned Adventures have tokens too. `trail_map` refuses them, and no message carries them before Start.

### Who owns what

| Rule | Owner | Where |
| --- | --- | --- |
| At most one Trail reading per minute | Server | unique index `position_readings_trail_minute` |
| Trail only while Active, Overdue, Alerted | Server | `record_trail` stage check under `for share` |
| Readings inside the Adventure's time | Server | `record_trail` drops `taken_at < started_at` or `> now() + 2 min` |
| Trail deleted at Check-in | Server | `check_in`, same transaction as `stage = 'ended'` |
| Last Known Position | Derived, never stored | `order by taken_at desc limit 1` on the existing index |
| What a contact may see | Server | `trail_map` builds the projection by hand |
| Recording on or off | Phone | `trail.sync()`, a pure function of (Adventure, permission, pending Check-in) |
| Link URL base | `deliver` | `TRAIL_MAP_URL` secret; SQL hands out only the token |

The phone thins by minute too, but only as a size optimisation. If the phone thinned wrongly, the index would still hold.

### SQL sketch

#### Upload command

```sql
create function public.record_trail(p_id uuid, p_readings jsonb)
returns public.refusal language plpgsql security definer set search_path = '' as $$
declare a public.adventures;
begin
  -- for share, not for update: it serialises against check_in (which holds for update) so no
  -- reading lands after the Trail delete, while two uploads never wait on each other.
  -- tick's `for update skip locked` skips this row for the few milliseconds the upload holds it;
  -- the next tick catches up (one-minute resolution, Gotcha 18).
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for share;
  if not found then return 'not_found'; end if;
  if a.stage not in ('active', 'overdue', 'alerted') then return 'wrong_stage'; end if;

  insert into public.position_readings (adventure_id, taken_at, latitude, longitude, accuracy_m, reason)
  select a.id, r.taken_at, r.latitude, r.longitude, r.accuracy_m, 'trail'
  from jsonb_to_recordset(p_readings)
       as r(taken_at timestamptz, latitude double precision, longitude double precision, accuracy_m real)
  where r.taken_at between a.started_at and now() + interval '2 minutes'
    and r.latitude between -90 and 90 and r.longitude between -180 and 180
    and (r.accuracy_m is null or r.accuracy_m >= 0)
  limit 500                                 -- one call is at most ~8 h of readings; the phone batches 200
  on conflict (adventure_id, minute) where reason = 'trail' do nothing;

  return null;                              -- no reconcile: a reading changes no Stage and no message
end $$;

revoke execute on function public.record_trail(uuid, jsonb) from public, anon;
grant execute on function public.record_trail(uuid, jsonb) to authenticated;
```

Invalid rows inside a valid batch are dropped silently, not refused. A refusal makes the phone drop the whole batch, and one bad fix must not cost the other 199.

#### Check-in

```sql
-- check_in, on the non-Ended path, after `update ... set stage = 'ended'` (commands.sql:232-235)
delete from public.position_readings where adventure_id = a.id and reason = 'trail';
```

It runs only on the path that changes the Stage, so a resent Check-in (early return at line 228-230) does nothing. It runs under the row lock, and `record_trail` takes `for share` on the same row, so an upload racing the Check-in either commits before it (and is deleted) or waits and is refused with `wrong_stage`.

**Interaction with late Alert retries.** `check_in` keeps `pending` Alerts with `attempts > 0`, and `deliver` re-reads `message_facts` on each attempt. After the delete, such a retry renders the newest kept reading (Start or Deadline move) with its own time, which is true but older. This design accepts that, because the All-clear for the same address is ordered after every Alert (`claim_messages` lines 39-61), so the contact reads the All-clear next. The Trail Map link in that late Alert already shows the Check-in time. See Tradeoffs.

#### Anon projection

```sql
-- Returns null for an unknown token, a removed contact, and a Planned Adventure alike, so a
-- caller cannot tell them apart. Never returns deadline, alert_at, the Overdue stage, the
-- Profile, or any contact data.
create function public.trail_map(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', case a.stage when 'alerted' then 'alerted' when 'ended' then 'checked_in' else 'underway' end,
    'adventurer_name', p.name,
    'time_zone', a.time_zone,
    'plan', jsonb_build_object('destination', a.destination, 'route', a.route,
                               'starting_point', a.starting_point, 'notes', a.notes)
  )
  || case when a.stage = 'ended'
       then jsonb_build_object('checked_in_at', a.checked_in_at)
       else jsonb_build_object(
         'last_known_position', (
           select jsonb_build_object('taken_at', r.taken_at, 'latitude', r.latitude,
                                     'longitude', r.longitude, 'accuracy_m', r.accuracy_m)
           from public.position_readings r where r.adventure_id = a.id
           order by r.taken_at desc limit 1),
         'trail', coalesce((
           select jsonb_agg(jsonb_build_array(r.latitude, r.longitude, r.taken_at) order by r.taken_at)
           from public.position_readings r where r.adventure_id = a.id), '[]'::jsonb))
     end
  from public.adventure_contacts ac
  join public.adventures a on a.id = ac.adventure_id
  join public.adventurer_profiles p on p.id = a.adventurer_id
  where ac.trail_token = p_token and a.stage <> 'planned'
$$;

revoke execute on function public.trail_map(text) from public, authenticated;
grant execute on function public.trail_map(text) to anon;
```

The `trail` array holds every reading of the Adventure (Start, moves and Trail), so without "Always" the page shows exactly the Start and move readings, as the spec requires. The page polls once per minute. A 10-hour Adventure is about 600 points, roughly 30 KB of JSON, served from the `(adventure_id, taken_at desc)` index. That is the dominant access pattern and it needs no other structure.

`anon` gets exactly one function and no table. `stage = 'overdue'` maps to `underway` inside SQL, so no client code can leak it.

#### Facts for messages

```sql
-- message_facts (deliver.sql:97-128): add to the heads_up and alert branches
'trail_token', (select ac.trail_token from public.adventure_contacts ac
                where ac.adventure_id = m.adventure_id and ac.contact_id = m.contact_id)
-- null when the contact was removed after enqueue; render then omits the line.
```

### Types (TypeScript)

```ts
// src/lib/barry/types.ts (additions)
export type Reading = { takenAt: Date; latitude: number; longitude: number; accuracyM: number | null };

export type StartConditions = { smsEnabled: boolean; pushRegistered: boolean; trailPermitted: boolean };
export type StartWarning =
  | { kind: 'no_push' } | { kind: 'email_only'; contacts: Contact[] } | { kind: 'unreachable'; contacts: Contact[] }
  | { kind: 'no_trail' };

export type TrailStatus = 'recording' | 'off';

export type Trail = {
  /** Make recording match the world: on iff an Adventure is in progress, has no queued Check-in,
   *  and "Always" is granted. Starts or stops updates and the fence, then flushes. Idempotent. */
  sync(): Promise<TrailStatus>;
  status(): Promise<TrailStatus>;
  requestPermission(): Promise<boolean>;
  /** Background task entry. Thins, buffers, re-centres the fence, flushes. Never throws. */
  onLocations(locations: readonly RawLocation[]): Promise<void>;
  /** Geofence task entry after a relaunch. Takes one reading, then sync(). Never throws. */
  onFenceExit(): Promise<void>;
};

export type Barry = { /* existing */ trail: Trail };
```

```ts
// src/lib/barry/client.ts, BarryDeps (additions). Every OS effect is injected; Jest fakes them.
export type LocationService = {
  backgroundPermitted(): Promise<boolean>;
  requestBackground(): Promise<boolean>;
  startUpdates(): Promise<void>;       // idempotent: hasStartedLocationUpdatesAsync guard inside
  stopUpdates(): Promise<void>;
  setFence(center: Reading | null): Promise<void>;   // null stops geofencing
  lastReading(): Promise<Reading | null>;
};
export type BarryDeps = { /* existing */ location: LocationService };
```

```ts
// src/lib/barry/trail-buffer.ts  (sibling of check-in-queue.ts, same discipline)
export type TrailSendOutcome = 'accepted' | 'refused' | 'retry';
export type TrailBuffer = {
  /** Write-before-send. Keeps the first reading per UTC minute per Adventure (same key as the index). */
  add(adventureId: AdventureId, readings: readonly Reading[]): void;
  /** Single-flight. Oldest first, batches of 200. Removes a batch on accepted or refused, stops on retry. */
  flush(send: (adventureId: AdventureId, batch: readonly Reading[]) => Promise<TrailSendOutcome>): Promise<void>;
  drop(adventureId: AdventureId): void;
  newest(adventureId: AdventureId): Reading | null;
};
export const minuteKey = (r: Reading): string => r.takenAt.toISOString().slice(0, 16);  // "2026-10-15T09:41"
export const createTrailBuffer = (storage: Pick<Storage, 'getItem' | 'setItem'>): TrailBuffer => { throw new Error('not implemented'); };
// Storage key 'barry.trailBuffer': { [adventureId]: { [minuteKey]: { t, lat, lon, acc } } }.
// Cap: 1440 minutes per Adventure; beyond it the oldest minute is evicted (newest positions matter most).
```

```ts
// src/lib/trail-map/types.ts  (web page; imports nothing from @/lib/barry or @/lib/supabase)
export type TrailPoint = { latitude: number; longitude: number; takenAt: Date };
export type LastKnown = TrailPoint & { accuracyM: number | null };
type Base = { adventurerName: string; plan: Plan; timeZone: string };
export type TrailMap =
  | (Base & { status: 'underway' | 'alerted'; trail: TrailPoint[]; lastKnownPosition: LastKnown | null })
  | (Base & { status: 'checked_in'; checkedInAt: Date });
// No deadline, no 'overdue', no positions on checked_in: the type cannot express what the page must not show.

export type TrailMapView =
  | { kind: 'loading' } | { kind: 'not_found' } | { kind: 'ready'; map: TrailMap }
  | { kind: 'offline'; since: Date; last: TrailMap | null };

// src/lib/trail-map/fetch.ts
export const tokenFromHash = (hash: string): string | null => { throw new Error('not implemented'); };  // /^#([A-Za-z0-9_-]{22})$/
export const parseTrailMap = (json: unknown): TrailMap | null => { throw new Error('not implemented'); };  // strict, boundary
export const fetchTrailMap = (fetchFn: typeof fetch, base: string, key: string) =>
  async (token: string): Promise<TrailMap | null | 'offline'> => { throw new Error('not implemented'); };
```

```ts
// supabase/functions/deliver/facts.ts (changes): heads_up and alert gain trailToken: string | null
// supabase/functions/deliver/links.ts (new)
export type TrailMapLinks = { forToken(token: string): string };
export const trailMapLinks = (base: string | undefined): TrailMapLinks | null => {
  // new URL(base) validates once at boot. Result: `${base}#${token}`. Unset or invalid -> null + console.error.
  throw new Error('not implemented');
};
```

### Data flow: a reading from GPS to the page

```
iOS (distance or deferred batch)
  -> TRAIL_LOCATION_TASK -> trail.onLocations(locations)
       1. adventureId = adventureCache.read()?.id; if none or a Check-in is queued -> trail.sync() (stops) ; return
       2. readings = locations.map(toReading)              (boundary: parse the OS shape)
       3. buffer.add(adventureId, readings)                (persisted before any network)
       4. location.setFence(newest)                        (only if > 50 m from the current centre)
       5. buffer.flush(sendTrail)                          (single-flight)
  -> sendTrail = supabase.rpc('record_trail', ...)
       error without code (no signal)          -> 'retry'
       error with code (JWT expired, 401, ...) -> 'retry'   (never drop readings for an auth problem)
       data = 'wrong_stage' | 'not_found'      -> 'refused' (the Adventure is over; drop the batch)
       data = null                             -> 'accepted'
  -> position_readings (unique minute index)
  -> trail_map(token) <- /trail page every 60 s
```

### Idempotency, retries and crashes

| Failure | Result |
| --- | --- |
| Batch sent, response lost | Batch stays in the buffer, is resent, every row hits the index, nothing changes, the second response removes it. |
| Crash after `buffer.add`, before send | Next `onLocations`, `sync()` or foreground flush sends it. |
| Crash after commit, before `buffer` removes the batch | Same as a lost response. |
| Two flushes at once (task and foreground) | `flush` is single-flight inside one JS runtime; across a relaunch the index absorbs the overlap. |
| Two fixes in one minute, possibly in two batches | First stored wins on the phone and on the server. |
| Buffered readings flushed after Check-in | `wrong_stage`, dropped. `check_in` already deleted the Trail. |
| Buffered readings of an old Adventure | `record_trail` with the old id refuses, or `taken_at < started_at` drops them for the new one. Keyed by Adventure id, so they never attach to the wrong Adventure. |
| Upload races Check-in | `for share` waits for `check_in`'s `for update`; then `wrong_stage`. |

### Auth in the background

`supabase.ts` stops auto-refresh when the app is not `active`. That only stops the *timer*. supabase-js still refreshes an expired session on demand: every request goes through `getSession()`, which refreshes the access token when it has expired. In a background launch there is one JS runtime, so the foreground refresh and the background refresh share supabase-js's lock and cannot rotate the refresh token twice.

The design relies on that and adds one rule: an auth error is `retry`, never `refused`. If the refresh fails for lack of signal, the readings wait. If the session is gone (signed out), `sync()` sees no session, stops recording and drops the buffer.

This is the riskiest assumption in the design. It is verified in the simulator with a short `jwt_expiry` (see Testing). If it fails, the fallback is listed under Alternatives (a per-Adventure upload key).

### Recording on iOS

```ts
// src/lib/barry/index.ts, the real LocationService
startUpdates: () => Location.startLocationUpdatesAsync(TRAIL_LOCATION_TASK, {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 10,                 // iOS has no time interval; this avoids stationary spam
  deferredUpdatesInterval: 60_000,      // let iOS batch about one minute of fixes per wake
  deferredUpdatesDistance: 0,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
  showsBackgroundLocationIndicator: true,
}),
setFence: (c) => c ? Location.startGeofencingAsync(TRAIL_FENCE_TASK,
  [{ identifier: 'trail', latitude: c.latitude, longitude: c.longitude, radius: 200, notifyOnEnter: false, notifyOnExit: true }])
  : Location.stopGeofencingAsync(TRAIL_FENCE_TASK),
```

When the Adventurer stands still there are no new readings. The page then shows an older time on the Last Known Position, which is honest.

`app.json`: the `expo-location` plugin gets `locationAlwaysAndWhenInUsePermission` and `isIosBackgroundLocationEnabled: true` (adds `location` to `UIBackgroundModes`). `expo-task-manager` is added with `npx expo install expo-task-manager`. Both need a new development build. Android is out of scope for now; its options are left off so nothing pretends to work there.

**Geofence relaunch.** iOS relaunches a terminated app for a region exit. The custom entry `index.ts` imports `trail-task.ts` before `expo-router/entry`, so the task is defined before iOS delivers the event. `onFenceExit` reads one position, adds it to the buffer, then calls `sync()`, which restarts `startLocationUpdatesAsync` (allowed after a location launch with "Always") and moves the fence. The Trail continues, with a gap from the force-quit to the fence exit.

**`sync()`** is the only function that turns recording on or off, and it is idempotent:

```ts
sync = async () => {
  // want = signed in && inProgress(adventureCache) && !checkInQueue.has(id) && await location.backgroundPermitted()
  // want ? (startUpdates(), setFence(newest reading ?? lastReading())) : (stopUpdates(), setFence(null), buffer.drop(old ids))
  // then buffer.flush(sendTrail); return want ? 'recording' : 'off'
  throw new Error('not implemented');
};
```

It reads the in-progress Adventure from the existing `adventure-cache.ts` (`barry.inProgressAdventure`), which `getAdventure` already keeps exactly while the Adventure is in progress. It does not store a second "recording for Adventure X" flag.

### Last Known Position stays cheap

The client stops embedding every reading.

```ts
// src/lib/barry/rows.ts
export const ADVENTURE_SELECT =
  '*, adventure_contacts(emergency_contacts(*)), last_position:position_readings(taken_at, latitude, longitude, accuracy_m)';
// every query that uses it adds:
//   .order('taken_at', { referencedTable: 'last_position', ascending: false })
//   .limit(1, { referencedTable: 'last_position' })
```

PostgREST applies an embedded `limit` per parent row, so `listAdventures` gets at most one reading per Adventure. `latestPosition()` becomes `rows[0] ?? null`. The Adventure cache shrinks to one reading. The phone never needs the Trail itself: it is for contacts.


### The web route under static output

- **One static route, no dynamic segment.** `src/app/trail.tsx` exports to `dist/trail.html`. The token is read from `location.hash` after hydration. `web.output` stays `"static"`; no `generateStaticParams`, no server output, no hosting rewrite.
- **The root layout stops carrying native side effects.** Today `src/app/_layout.tsx` imports `@/lib/barry` and `@/lib/push`, which pull in expo-location, expo-notifications and the expo-sqlite localStorage. The static export evaluates every route module in Node. The split:
  - `src/app/_layout.tsx` becomes a bare `<Stack screenOptions={{ headerShown: false }} />`.
  - The current root layout (auth gate, splash, foreground catch-up) moves to `src/app/(app)/_layout.tsx`. Groups do not change URLs.
  - `src/app/(app)/_layout.web.tsx` renders "Barry runs on iPhone" and mounts no screen.
  - `src/lib/barry/index.web.ts` and `src/lib/push.web.ts` export stubs with no import-time side effects, so the `(app)` screen modules that the export still evaluates import nothing native.
  - `src/lib/supabase.ts` moves its `expo-sqlite/localStorage/install` import into `src/lib/storage.native.ts`; `src/lib/storage.web.ts` exports the browser's `localStorage`.
- **The page imports only `src/lib/trail-map/*`**: plain `fetch` to `/rest/v1/rpc/trail_map` with the publishable key, no supabase-js, no session storage.
- **Map.** Leaflet with OpenStreetMap tiles, loaded with `import('leaflet')` inside `useEffect` in `src/components/osm-map.web.tsx`, because Leaflet touches `window` at import and the static render runs in Node. Polyline for `trail`, a marker for `lastKnownPosition`, the attribution "© OpenStreetMap contributors" as the tile policy requires. `osm-map.tsx` (native) renders nothing.
- **Headers.** `+html.tsx` adds `<meta name="robots" content="noindex">`. The default referrer policy sends only the origin to the tile servers, and the fragment never leaves the page.
- **Locally.** `npx expo start --web` serves `http://localhost:8081/trail`. `[edge_runtime.secrets] TRAIL_MAP_URL = "http://localhost:8081/trail"` in `config.toml`. On EAS Hosting it becomes `https://<project>.expo.app/trail` as a function secret.

### The URL base in messages

The origin is presentation, so it belongs to `deliver`, not SQL. SQL hands out the token, `deliver` composes `TRAIL_MAP_URL + '#' + token`. If `TRAIL_MAP_URL` is unset, `trailMapLinks` returns null, `deliver` logs once at boot, and every Heads-up and Alert goes out without the line. A missing link must never turn an Alert into a retry and then a Delivery Failure, because a missed Alert is the worst outcome.

### Interface depth

- The phone's public surface grows by `trail` (five functions) and one field on `StartConditions`. Behind it: two OS tasks, a persisted buffer, minute thinning, batching, the fence, auth-error classification and the start/stop policy.
- The server's public surface grows by two functions. Behind `record_trail`: ownership, Stage, time window, coordinate checks, batching and deduplication. Behind `trail_map`: token resolution, revocation, Stage masking and the Check-in blackout.
- `anon` gets one function that returns one JSON object or null. There is no table, view or policy to audit.

### What the design deliberately does not do

- No Realtime for the page or for readings. The page polls; the phone does not need the Trail.
- No Last Known Position column on `adventures`. It is derived from the index, so it cannot drift.
- No `reconcile` call per reading. A reading changes no Stage and no message.
- No per-reading client id. The minute is the identity of a Trail reading.
- No Android background recording yet.

---

## Module map

| File | Change |
| --- | --- |
| `index.ts` (new), `package.json` `main` | Custom entry: import `trail-task` first, then `expo-router/entry`. |
| `app.json` | `expo-location` plugin: Always string, `isIosBackgroundLocationEnabled`; add `expo-task-manager`. |
| `supabase/migrations/<ts>_trail.sql` (new) | `reason` check, `minute` column, unique index, `trail_token`, `record_trail`, `trail_map`, replace `check_in`, replace `message_facts`. |
| `supabase/config.toml` | `[edge_runtime.secrets] TRAIL_MAP_URL`. |
| `supabase/functions/deliver/links.ts` (new) | `trailMapLinks`. |
| `supabase/functions/deliver/facts.ts` | `trailToken` on `heads_up` and `alert`. |
| `supabase/functions/deliver/messages.en.ts` | `render(facts, links)`; the "Follow ...'s Trail" line. |
| `supabase/functions/deliver/index.ts` | Build `links` at boot, pass to `render`. |
| `src/lib/database.types.ts` | Regenerate. |
| `src/lib/barry/trail-buffer.ts` (new) | Persisted per-minute buffer, single-flight flush. |
| `src/lib/barry/trail.ts` (new) | `createTrail(deps)`: `sync`, `status`, `onLocations`, `onFenceExit`, `requestPermission`, task names. |
| `src/lib/barry/trail-task.ts` (new) | Two `TaskManager.defineTask` one-liners. |
| `src/lib/barry/index.ts` | Real `LocationService`; wire `location` into `createBarry`. |
| `src/lib/barry/index.web.ts`, `src/lib/push.web.ts`, `src/lib/storage.{native,web}.ts` (new) | Side-effect-free stubs and the storage split for the static export. |
| `src/lib/barry/client.ts` | `trail` on `Barry`; `start`, `moveDeadline`, `checkIn` call `trail.sync()`; `startConditions` adds `trailPermitted`. |
| `src/lib/barry/rows.ts` | `last_position` embed with limit 1. |
| `src/lib/barry/types.ts`, `warnings.ts` | `Reading`, `TrailStatus`, `no_trail` warning. |
| `src/app/_layout.tsx` | Bare stack. |
| `src/app/(app)/_layout.tsx`, `(app)/_layout.web.tsx` | Moved auth gate; web placeholder. |
| `src/app/(app)/plan.tsx`, `(app)/(tabs)/*` | Moved; `warningText` becomes an exhaustive `Record`; live-screen Trail notice. |
| `src/app/trail.tsx`, `src/app/+html.tsx` (new) | The Trail Map page. |
| `src/lib/trail-map/{types,fetch,use-trail-map}.ts` (new) | Token, parse, poll. |
| `src/components/osm-map.web.tsx`, `osm-map.tsx` (new) | Leaflet map; native no-op. |
| `scripts/fixture.mjs` | `trail <n>` inserts n Trail readings; `state` prints reading counts per reason and tokens. (Write-protected here; listed for the implementer.) |

Call chain for any question stays within three files: the task → `trail.ts` → `trail-buffer.ts`; the page → `use-trail-map.ts` → `fetch.ts`; a message → `message_facts` → `messages.en.ts`.

---

## Testing

**pgTAP** (`supabase/tests/database/trail.test.sql`, new, plus additions to `commands`, `access`, `deliver`):

- `record_trail` as Anna on her Active Adventure stores readings with `reason = 'trail'`; the same batch again changes nothing (`count` unchanged); two readings in one minute store one; a reading before `started_at` and one 10 minutes in the future are dropped; Overdue and Alerted accept; Planned and Ended return `wrong_stage`; Ben on Anna's Adventure returns `not_found`.
- The unique index does not touch Start and move readings: a move in the same minute as a Trail reading stores both.
- `check_in` deletes Trail rows and keeps `start` and `deadline_move`; a resent `check_in` deletes nothing new; a `record_trail` after it returns `wrong_stage` and inserts nothing.
- `trail_map` as `anon`: unknown token → null; Planned → null; Active and Overdue → `status = 'underway'`; JSON has no key `deadline`, `alert_at`, `stage`, `profile` (assert `not (result ?| array[...])`); Alerted → `alerted`; Ended → `checked_in` with `checked_in_at` and no `trail` or `last_known_position` key.
- Revocation: `save_adventure` without Ben → Ben's old token → null; re-adding Ben → a different token that resolves.
- Access: `anon` can execute `trail_map` and nothing else new (`has_function_privilege`); `anon` cannot execute `record_trail`; `authenticated` cannot execute `trail_map`.
- `message_facts` for a Heads-up and an Alert carries Ben's `trail_token`; for a removed Ben it is null. An Alert after a Trail reading carries that reading; after `check_in` a pending attempted Alert carries the Start reading (documents the accepted tradeoff).

**Jest with fakes** (`src/lib/barry/trail-buffer.test.ts`, `trail.test.ts`, `src/lib/trail-map/fetch.test.ts`):

- Buffer with `memoryStorage`: thins by minute, and `minuteKey` agrees with the SQL `minute` column for a fixed timestamp (asserted against the same literal in pgTAP); survives a re-created buffer (crash); `flush` stops at `retry` and keeps order; removes on `accepted` and `refused`; two concurrent `flush` calls send once; cap evicts the oldest minute.
- `createTrail` with a fake `LocationService` and a fake `send`: `sync` starts updates and the fence only when an in-progress Adventure is cached, no Check-in is queued and permission is granted; calling `sync` twice starts once; Check-in queued → stops; `onLocations` with no cached Adventure stops and buffers nothing; an auth error from the fake RPC maps to `retry` and keeps the readings; `onFenceExit` adds one reading and restarts updates.
- `startWarnings` with `trailPermitted: false` yields `no_trail`. `warningText` is typed `Record<StartWarning['kind'], ...>`, so a missing wording fails the typecheck.
- `parseTrailMap` rejects any payload with a `deadline` field or an unknown `status`; `tokenFromHash` rejects anything but 22 URL-safe characters.

**Deno** (`messages.en.test.ts`): Heads-up and Alert with a token and links contain `Follow Anna's Trail: http://localhost:8081/trail#<token>`; with `links = null` or `trailToken = null` they contain no such line and still render; `trailMapLinks(undefined)` → null.

**Static export**: `npx expo export -p web` succeeds and writes `dist/trail.html`; grep the web bundle for `expo-task-manager` and `expo-sqlite` to prove the native modules stayed out.

**End to end** (`scripts/e2e-deliver.mjs`): after Start, extract the link from the Heads-up email in Mailpit, `POST /rpc/trail_map` with the anon key, assert `underway`; force the Alert, assert `alerted`; Check-in, assert `checked_in` and no positions.

**iOS Simulator** (verify skill, development build):

1. Grant "Always" in the prompt. Start an Adventure. The live screen shows "Closing Barry stops the Trail."
2. `xcrun simctl location booted start --speed=1.4 --distance=20 47.0286,8.6885 47.0310,8.6950` (walking route). After 5 minutes, `fixture.mjs state` shows about 5 `trail` readings, never two in one minute.
3. `fixture.mjs offline`, walk 5 more minutes, `fixture.mjs online`, foreground the app: the missing minutes arrive, no duplicates.
4. Open the Heads-up link from Mailpit in Safari on the simulator (or `expo start --web` on the Mac): the line grows on reload.
5. Force-quit Barry. Move the simulated location 500 m away (`xcrun simctl location booted set ...`). Barry relaunches in the background; new `trail` readings appear.
6. Set `jwt_expiry = 120` locally, background the app for 5 minutes while walking: readings still arrive (proves on-demand refresh), or stay buffered and arrive on foreground (then the fallback is needed).
7. Check in: `trail` readings are gone, `start` stays, the page shows the Check-in time and no map.
8. Revoke "Always" in Settings, plan a new Adventure: Start shows "Barry can share only where you started" and Start still works.

---

## Synthesis decision

Four runners (Opus, Fable, Sonnet, Haiku) produced candidates. A cross-judge on Fable scored them 26, 25, 20 and 18 out of 30 on correctness, background reliability, privacy, fit, web feasibility and testability. My own read agreed on the base.

**Base: Opus.** Opus and Fable converged on the same load-bearing shape: the minute rule as a partial unique index, the token as a column of the membership row, a static `/trail` route with the token in the fragment, the Trail delete inside `check_in`, and one `anon` function returning a hand-built projection. Opus won on two points. A missing `TRAIL_MAP_URL` drops the link line instead of failing the message, so a configuration slip never costs an Alert. And the root layout split keeps native modules out of the public page.

**Grafts.**

- From Fable: the `storage.native.ts` and `storage.web.ts` split for the expo-sqlite localStorage install, which the Opus stubs did not cover. Also the test that the phone's minute key agrees with the SQL bucket.
- From Sonnet: the per-Adventure upload key stays the documented fallback if the background session refresh fails in the simulator.
- From Haiku: nothing structural. Its `messages.alert_position` snapshot fixes the late Alert retry, but it copies a derived value; the Opus tradeoff is kept instead.

**Rejected from the base.** The column grant that hid `trail_token` from the Adventurer. The Adventurer owns the Adventure, the links show their own Trail, and the grant risked breaking the PostgREST embed of `adventure_contacts`.

**Checked and corrected.** Changing a column type does not drop its check constraint, so the migration drops `position_readings_reason_check` explicitly, as this design already does. A `sending` Alert can belong to a contact removed after enqueue, so `trail_token` in the facts is nullable and the line is then left out.

## Tradeoffs accepted

- We accept that a late retry of an already-attempted Alert after Check-in shows the newest kept reading (Start or move) instead of the newest Trail reading, in exchange for deleting the Trail in the Check-in transaction with no deferred-purge job. The All-clear follows it on the same address.
- We accept a full Trail refetch every minute on the page (about 30 KB for 10 hours) in exchange for a stateless anon function with one argument and no incremental cursor to get wrong.
- We accept "first reading in the minute wins" instead of "most accurate in the minute", in exchange for an `on conflict do nothing` that makes every replay a no-op.
- We accept that a contact re-added after a sent Heads-up receives their new link only with an Alert, in exchange for keeping the existing Heads-up deduplication unchanged (`design.md:213`).
- We accept storing the token in plaintext on `adventure_contacts`, readable by the Adventurer who owns the Adventure, in exchange for `deliver` reading it at send time like every other fact. A database dump exposes live links; that is the same exposure as the Plan itself.
- We accept splitting the root layout into a bare root and an `(app)` group, plus two `.web.ts` stubs, in exchange for a public page that loads no native module and no session storage.
- We accept that readings stop while the Adventurer stands still, in exchange for using iOS distance updates as designed instead of fighting them with timers.

## Alternatives considered

- **A `trail_links` table with an explicit revoke in `save_adventure`.** It exposes a second lifecycle that must be kept in step with `adventure_contacts` (revoke on removal, mint on add, the Planned-to-Active edge). Folding the token into the join row hides all of that behind the existing delete and insert, so it lost.
- **A dynamic route `/trail/[token]`.** Under `output: "static"` it needs `generateStaticParams` (impossible for random tokens), `output: "server"`, or a hosting rewrite. It also puts the token in the hosting logs and in the `Referer` to the tile servers. The fragment avoids all three with zero hosting configuration.
- **A per-Adventure upload key instead of the session** (`record_trail(p_upload_key, ...)` granted to `anon`, key returned by `start_adventure`). It removes the dependency on token refresh in the background, at the cost of a second credential, a second anon-reachable writer and its own revocation. Kept as the fallback if simulator step 6 fails.
- **Client-side one-per-minute only, with a client-generated reading id for idempotency.** It makes the rule depend on every phone build being correct and adds an id the phone must persist. The index makes the rule hold for any client.
- **A `last_position` column on `adventures`, updated by `record_trail`.** It is a copy that must be kept in sync with three writers and the Check-in delete, and it would fire a Realtime update to the phone every minute. The derived query on the existing index is already cheap; the client cost came from the embed, which the limited embed fixes.

## Implementation reconciliation

- **`record_trail` orders the batch by `taken_at` before the insert.** The design says the first reading in a minute wins. Without an order, `on conflict do nothing` inside one statement keeps whichever row the set happens to yield first. The order makes "first" mean the earliest fix (`supabase/migrations/20261015140000_trail.sql`).
- **There is no separate `Reading` type.** It had exactly the shape of the existing `Position`, so the Trail uses `Position` (`src/lib/barry/trail-buffer.ts`, `trail.ts`).
- **`TrailBuffer.drop(adventureId)` became `keepOnly(adventureId | null)`.** `sync()` must forget every Adventure except the live one, and the buffer is the only place that knows which ids it holds. A `refused` batch drops the whole Adventure, not just the batch, because every later batch of that Adventure would be refused too.
- **`createTrail` takes `recordTrail` returning the raw `{ data, error }`** and maps it with the exported `trailOutcome`. That puts the rule "an auth error is `retry`" inside the tested module instead of in `client.ts`.
- **`status()` answers from the same conditions as `sync()`** (live Adventure, no queued Check-in, signed in, "Always"), without asking the OS whether updates run.
- **The foreground catch-up runs `trail.sync()` after the Check-in flush**, not beside it, so a Check-in sent on foreground stops the Trail in the same pass.
- **The `no_trail` warning has an "Allow Always" button** that calls `requestPermission()` and opens the Settings app when iOS does not show the prompt again. The live screen shows "Last position <time>" in the Plan section.
- **`noindex` comes from `generateMetadata()` in `src/app/trail.tsx`, not from `+html.tsx`.** In SDK 58 a custom `+html.tsx` must render `useServerDocumentContext()`'s nodes, and the first one written without them exported pages with no scripts and no stylesheets. `<Head>` from `expo-router/head` adds its tags only after hydration. `generateMetadata()` writes `<title>` and `<meta name="robots" content="noindex, nofollow">` into `dist/trail.html`.
- **The storage split is `src/lib/storage.ts` and `src/lib/storage.web.ts`**, not `storage.native.ts`. TypeScript resolves the plain `.ts` file for types, so the native variant takes the base name.
- **`src/lib/barry/trail-task.web.ts` is an empty module.** The custom entry `index.ts` imports `trail-task` on every platform, and the web bundle must not pull in `expo-task-manager`.
- **The page reloads on `hashchange`**, so a second link opened in the same tab reads its own token. On native the route renders "This link does not work" without touching `window`.
- **`message_facts` reads `trail_token` through a left join on `adventure_contacts`** instead of a scalar subquery per branch. The result is the same, null once the contact has left the Adventure.
- **The fence is best-effort and comes after the upload.** In the iOS 27 simulator `startGeofencingAsync` throws, and with the fence before the flush no reading ever reached the server. `moveFence` now swallows the failure, and `sync()` and `onLocations` flush first, taking the fence centre from the buffer before the flush empties it. Found in the simulator run of 15 October; covered by the test "records and uploads when iOS refuses the fence".
- **The Check-in keeps the Trail.** `20261015150000_keep_trail.sql` replaces `check_in` without the `trail` delete, so the "Trail deleted at Check-in" row above no longer holds. `trail_map` still answers an Ended Adventure with `checked_in_at` and no `trail` or `last_known_position`, and the owner reads the readings through `own_read`. A late Alert retry after the Check-in now carries the newest Trail reading instead of the newest Start or Deadline-move reading, because `message_facts` picks the newest reading of any reason.
- **`barry.readings(id)` returns `Position[]`**, every reading of the Adventure in `taken_at` order, read through `own_read`. `Position` already has the shape of the map's `LastKnown`, so no new type. `parsePosition` and `POSITION_SELECT` in `rows.ts` serve it and the `last_position` embed, which stays limited to one row.
- **`OsmMap` became `TrailMapView`** in `src/components/trail-map-view.tsx` (native) and `trail-map-view.web.tsx` (Leaflet). The view-state union in `src/lib/trail-map/types.ts` that already had that name is now `TrailMapState`.
- **The native map is `AppleMaps.View` from `expo-maps`** (SDK 58 docs, `https://docs.expo.dev/versions/v58.0.0/sdk/maps.md`): a `polylines` entry for the Trail, one `circles` entry per reading, a red `markers` entry for the newest reading titled with its time, and a circle for its accuracy. It renders on iOS only. Android would need a Google Maps API key and Barry runs on iPhone. expo-maps draws on iOS 17 or later.
- **Reading dots are circles in meters, not points in pixels.** expo-maps has no fixed-size dot, so `fitCamera` (`src/lib/trail-map/camera.ts`) sizes each circle to 1/80 of the fitted span. The dots grow and shrink when the Adventurer zooms. A dot has no time label, because tap callbacks need iOS 18 and the web tooltip has no native counterpart. Only the newest reading's marker names its time.
- **The camera fit is computed, not asked of the map.** expo-maps takes a centre and a zoom and turns the zoom into a square region of `360 / 2^zoom` degrees, so `fitCamera` picks the zoom from the larger of the two spans with 40% room, capped at zoom 16 like the web page.
- **`EndedAdventureScreen`** (`src/components/ended-adventure-screen.tsx`) is the Check-in screen and the history entry. With `onDone` it adds "Welcome back." and the Done button. The history route is `src/app/(app)/adventure/[id].tsx`, and Past Adventures cards push it with the label `Open <destination>`.

## Open questions and risks

- Does supabase-js refresh an expired session on demand during a background location wake, with auto-refresh stopped? Simulator step 6 answers it before any UI work; the upload-key alternative is ready if not.
- Does iOS allow `startLocationUpdatesAsync` from a geofence relaunch through expo-location in SDK 58, and does the custom `index.ts` entry run before the event is delivered? The iOS 27 simulator refuses geofencing, so this needs a real iPhone.
- Does supabase-js refresh an expired session during a background wake? The simulator run uploaded in the background within the token's first hour only; the expiry case is still unverified.
- The live screen's "Last position" shows the reading from when the screen loaded. A reading does not update `adventures`, so Realtime does not refresh it.
- Does Expo Router allow a `_layout.web.tsx` for a group, and does the static export still evaluate the `(app)` screens on web? The `.web.ts` stubs cover the second case either way.
- ~~How long should an Ended Adventure's link keep showing the Check-in time?~~ Settled on 15 October: the link never expires, as `trail_map` already behaves (spec, Trail Map section). An expiry would be one `and (a.ended_at > now() - interval '…')` in `trail_map`.
- Should the page say "Barry has raised the Alert" in those words, and should it suggest calling the Adventurer? Wording is a product call.
- Battery: `BestForNavigation` with `distanceInterval: 10` for a 10-hour Adventure. Is `Accuracy.High` acceptable if field tests show heavy drain?

## Next implementation step

Write `supabase/migrations/<ts>_trail.sql` with the `minute` index, `trail_token`, `record_trail`, `trail_map` and the `check_in` delete, together with `trail.test.sql`, because every other piece depends on those two function contracts.
