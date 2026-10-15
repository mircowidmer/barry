import { describe, expect, it } from '@jest/globals';

import { fetchTrailMap, parseTrailMap, tokenFromHash } from './fetch';

const plan = { destination: 'Rigi', route: 'North face', starting_point: null, notes: null };
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
  it('parses an Adventure underway with its Trail and Last Known Position', () => {
    expect(parseTrailMap(underway)).toEqual({
      status: 'underway',
      adventurerName: 'Anna',
      timeZone: 'Europe/Zurich',
      plan: { destination: 'Rigi', route: 'North face', startingPoint: null, notes: null },
      lastKnownPosition: { latitude: 47.03, longitude: 8.68, accuracyM: 12, takenAt: new Date('2026-10-15T09:41:00Z') },
      trail: [
        { latitude: 47.0, longitude: 8.6, takenAt: new Date('2026-10-15T08:00:00Z') },
        { latitude: 47.03, longitude: 8.68, takenAt: new Date('2026-10-15T09:41:00Z') },
      ],
    });
  });

  it('parses a checked-in Adventure with the Check-in time only', () => {
    expect(
      parseTrailMap({ status: 'checked_in', adventurer_name: 'Anna', time_zone: 'Europe/Zurich', plan, checked_in_at: '2026-10-15T16:05:00Z' }),
    ).toEqual({
      status: 'checked_in',
      adventurerName: 'Anna',
      timeZone: 'Europe/Zurich',
      plan: { destination: 'Rigi', route: 'North face', startingPoint: null, notes: null },
      checkedInAt: new Date('2026-10-15T16:05:00Z'),
    });
  });

  it('rejects a payload that carries the Deadline, an unknown status, or positions after the Check-in', () => {
    expect(parseTrailMap({ ...underway, deadline: '2026-10-15T16:00:00Z' })).toBeNull();
    expect(parseTrailMap({ ...underway, status: 'overdue' })).toBeNull();
    expect(parseTrailMap({ ...underway, status: 'checked_in', checked_in_at: '2026-10-15T16:05:00Z' })).toBeNull();
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
