import { describe, expect, it } from '@jest/globals';

import { byDay } from './history-days';

// Local times, so the tests hold in any time zone.
const now = new Date(2026, 9, 23, 13, 0);
const at = (day: number, hour: number, minute = 0) => ({ checkedInAt: new Date(2026, 9, day, hour, minute) });

describe('byDay', () => {
  it('groups by the local calendar day, newest first, and names today and yesterday', () => {
    const items = [at(23, 12, 31), at(23, 7, 42), at(22, 21, 48), at(22, 0, 1), at(20, 9)];
    const days = byDay(items, (i) => i.checkedInAt, now);
    expect(days.map((d) => [d.relative, d.items.length])).toEqual([
      ['today', 2],
      ['yesterday', 2],
      [null, 1],
    ]);
    expect(days[2]?.date).toEqual(new Date(2026, 9, 20, 9));
  });

  it('counts a Check-in a minute before midnight to its own day', () => {
    const days = byDay([at(23, 0, 0), at(22, 23, 59)], (i) => i.checkedInAt, now);
    expect(days.map((d) => d.relative)).toEqual(['today', 'yesterday']);
  });

  it('names yesterday across the turn of a month', () => {
    const firstOfMonth = new Date(2026, 10, 1, 9, 0);
    const days = byDay([{ checkedInAt: new Date(2026, 9, 31, 20, 0) }], (i) => i.checkedInAt, firstOfMonth);
    expect(days[0]?.relative).toBe('yesterday');
  });
});
