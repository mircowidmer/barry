import { describe, expect, it } from '@jest/globals';

import { fetchTrailMap, mergeTrailMap, newestReading, parseTrailMap, tokenFromHash } from './fetch';

const plan = { destination: 'Rigi', route: 'North face' };
const underway = {
  status: 'underway',
  adventurer_name: 'Anna',
  time_zone: 'Europe/Zurich',
  plan,
  last_known_position: { taken_at: '2026-10-15T09:41:00Z', latitude: 47.03, longitude: 8.68, accuracy_m: 12 },
  trail: [
    [47.0, 8.6, '2026-10-15T08:00:00Z'],
    [47.03, 8.68, '2026-10-15T09:41:00Z'],
  ],
};

describe('tokenFromHash', () => {
  it('reads a 22-character URL-safe token from the fragment', () => {
    expect(tokenFromHash('#IW4w4EYG9ordT7LiJugZhg')).toBe('IW4w4EYG9ordT7LiJugZhg');
    expect(tokenFromHash('#Xk3v-Q9pL2mN8rT5wY1z_b')).toBe('Xk3v-Q9pL2mN8rT5wY1z_b');
  });

  it('rejects anything else', () => {
    expect(tokenFromHash('')).toBeNull();
    expect(tokenFromHash('#short')).toBeNull();
    expect(tokenFromHash('#IW4w4EYG9ordT7LiJugZhgX')).toBeNull();
    expect(tokenFromHash('#IW4w4EYG9ordT7LiJugZ+g')).toBeNull();
    expect(tokenFromHash('IW4w4EYG9ordT7LiJugZhg')).toBeNull();
  });
});

describe('parseTrailMap', () => {
  it('parses an Adventure underway with its Trail and Last Position', () => {
    expect(parseTrailMap(underway)).toEqual({
      status: 'underway',
      adventurerName: 'Anna',
      plan: { destination: 'Rigi', route: 'North face' },
      lastKnownPosition: { latitude: 47.03, longitude: 8.68, accuracyM: 12, takenAt: new Date('2026-10-15T09:41:00Z') },
      trail: [
        { latitude: 47.0, longitude: 8.6, takenAt: new Date('2026-10-15T08:00:00Z') },
        { latitude: 47.03, longitude: 8.68, takenAt: new Date('2026-10-15T09:41:00Z') },
      ],
    });
  });

  it('parses a checked-in Adventure with its Trail and the Check-in time', () => {
    expect(parseTrailMap({ ...underway, status: 'checked_in', checked_in_at: '2026-10-15T16:05:00Z' })).toEqual({
      status: 'checked_in',
      adventurerName: 'Anna',
      plan: { destination: 'Rigi', route: 'North face' },
      lastKnownPosition: { latitude: 47.03, longitude: 8.68, accuracyM: 12, takenAt: new Date('2026-10-15T09:41:00Z') },
      trail: [
        { latitude: 47.0, longitude: 8.6, takenAt: new Date('2026-10-15T08:00:00Z') },
        { latitude: 47.03, longitude: 8.68, takenAt: new Date('2026-10-15T09:41:00Z') },
      ],
      checkedInAt: new Date('2026-10-15T16:05:00Z'),
    });
  });

  it('rejects a payload that carries the Deadline, an unknown status, or a Check-in without its time', () => {
    expect(parseTrailMap({ ...underway, deadline: '2026-10-15T16:00:00Z' })).toBeNull();
    expect(parseTrailMap({ ...underway, status: 'overdue' })).toBeNull();
    expect(parseTrailMap({ ...underway, status: 'checked_in' })).toBeNull();
    expect(parseTrailMap({ ...underway, trail: [[47, 'east', '2026-10-15T08:00:00Z']] })).toBeNull();
    expect(parseTrailMap(null)).toBeNull();
  });
});

describe('fetchTrailMap', () => {
  const respond = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it('posts the token to trail_map with the publishable key', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fetchFn = (async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify(underway), { status: 200 });
    }) as typeof fetch;
    const map = await fetchTrailMap(fetchFn, 'http://127.0.0.1:54321', 'sb_publishable_x')('IW4w4EYG9ordT7LiJugZhg');
    expect(map).toMatchObject({ status: 'underway', adventurerName: 'Anna' });
    expect(calls).toEqual([
      [
        'http://127.0.0.1:54321/rest/v1/rpc/trail_map',
        {
          method: 'POST',
          headers: { apikey: 'sb_publishable_x', 'Content-Type': 'application/json' },
          body: '{"p_token":"IW4w4EYG9ordT7LiJugZhg"}',
        },
      ],
    ]);
  });

  it('asks only for readings after the newest one it has', async () => {
    let body: unknown;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(underway), { status: 200 });
    }) as typeof fetch;
    await fetchTrailMap(fetchFn, 'http://x', 'k')('IW4w4EYG9ordT7LiJugZhg', new Date('2026-10-15T09:41:00Z'));
    expect(body).toEqual({ p_token: 'IW4w4EYG9ordT7LiJugZhg', p_after: '2026-10-15T09:41:00.000Z' });
  });

  it('tells an unknown link from no signal', async () => {
    const token = 'IW4w4EYG9ordT7LiJugZhg';
    expect(await fetchTrailMap(respond(200, null) as typeof fetch, 'http://x', 'k')(token)).toBeNull();
    expect(await fetchTrailMap(respond(503, {}) as typeof fetch, 'http://x', 'k')(token)).toBe('offline');
    const noSignal = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    expect(await fetchTrailMap(noSignal, 'http://x', 'k')(token)).toBe('offline');
  });
});

describe('mergeTrailMap', () => {
  const map = (overrides: Record<string, unknown>) => parseTrailMap({ ...underway, ...overrides })!;
  const at = (iso: string) => new Date(iso);

  it('adds the new readings to the Trail it already shows, and takes the rest from the answer', () => {
    const shown = map({});
    const update = map({
      plan: { ...plan, route: 'West ridge' },
      last_known_position: { taken_at: '2026-10-15T09:41:10Z', latitude: 47.04, longitude: 8.69, accuracy_m: 8 },
      trail: [[47.04, 8.69, '2026-10-15T09:41:10Z']],
    });
    const merged = mergeTrailMap(shown, update);
    expect(merged.trail.map((p) => p.takenAt.toISOString())).toEqual([
      '2026-10-15T08:00:00.000Z',
      '2026-10-15T09:41:00.000Z',
      '2026-10-15T09:41:10.000Z',
    ]);
    expect(merged.plan.route).toBe('West ridge');
    expect(merged.lastKnownPosition?.latitude).toBe(47.04);
  });

  it('keeps the Trail when nothing new arrived, and drops a reading it already has', () => {
    const shown = map({});
    expect(mergeTrailMap(shown, map({ trail: [] }))).toEqual(shown);
    expect(mergeTrailMap(shown, map({ trail: [[47.03, 8.68, '2026-10-15T09:41:00Z']] }))).toEqual(shown);
  });

  it('keeps the Trail it shows when the answer says Anna checked in, and shows the first answer as it is', () => {
    const checkedIn = map({ status: 'checked_in', checked_in_at: '2026-10-15T10:00:00Z', trail: [] });
    expect(mergeTrailMap(map({}), checkedIn)).toEqual({ ...checkedIn, trail: map({}).trail });
    expect(mergeTrailMap(null, map({}))).toEqual(map({}));
  });

  it('asks for readings after the newest point shown', () => {
    expect(newestReading(map({}))).toEqual(at('2026-10-15T09:41:00Z'));
    expect(newestReading(map({ trail: [] }))).toBeNull();
    expect(newestReading(null)).toBeNull();
  });
});
