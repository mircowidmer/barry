import { describe, expect, it } from '@jest/globals';

import type { EmergencyContact, EmergencyContactId } from './types';
import { startWarnings } from './warnings';

const contact = (name: string, email: string | null, phone: string | null, switches: Partial<EmergencyContact> = {}): EmergencyContact => ({
  id: name as EmergencyContactId,
  name,
  email,
  emailEnabled: true,
  phone,
  phoneEnabled: true,
  ...switches,
});

const luca = contact('Luca', 'luca@example.com', null);
const mia = contact('Mia', 'mia@example.com', '+41791111111');
const sara = contact('Sara', null, '+41792222222');

const zermatt = { latitude: 46.02, longitude: 7.75 };
const daylit = { deadline: null, point: null };
const all = { smsEnabled: true, notificationsPermitted: true, trailPermitted: true };

describe('startWarnings', () => {
  it('warns about nothing when notifications are allowed and text messages work', () => {
    expect(startWarnings([luca, mia, sara], { smsEnabled: true, notificationsPermitted: true, trailPermitted: true }, daylit)).toEqual([]);
  });

  it('warns that there will be no Reminder while notifications are off', () => {
    expect(startWarnings([luca], { smsEnabled: true, notificationsPermitted: false, trailPermitted: true }, daylit)).toEqual([{ kind: 'no_notifications' }]);
  });

  it('names who gets email only and who gets nothing while text messages are off', () => {
    expect(startWarnings([luca, mia, sara], { smsEnabled: false, notificationsPermitted: true, trailPermitted: true }, daylit)).toEqual([
      { kind: 'email_only', contacts: [mia] },
      { kind: 'unreachable', contacts: [sara] },
    ]);
  });

  it('warns that Barry can share only where you started without the Always permission', () => {
    expect(startWarnings([luca], { smsEnabled: true, notificationsPermitted: true, trailPermitted: false }, daylit)).toEqual([
      { kind: 'no_trail' },
    ]);
  });

  it('counts only the addresses that are switched on', () => {
    const miaPhoneOff = contact('Mia', 'mia@example.com', '+41791111111', { phoneEnabled: false });
    const miaEmailOff = contact('Mia', 'mia@example.com', '+41791111111', { emailEnabled: false });
    expect(startWarnings([miaPhoneOff], { smsEnabled: false, notificationsPermitted: true, trailPermitted: true }, daylit)).toEqual([]);
    expect(startWarnings([miaEmailOff], { smsEnabled: false, notificationsPermitted: true, trailPermitted: true }, daylit)).toEqual([
      { kind: 'unreachable', contacts: [miaEmailOff] },
    ]);
  });

  it('warns when the Deadline falls after Dark at the destination on the map, naming that Dark', () => {
    const [warning] = startWarnings([luca], all, { deadline: new Date('2026-12-21T20:00:00Z'), point: zermatt });
    expect(warning?.kind).toBe('after_dark');
    expect(warning?.kind === 'after_dark' && Math.abs(warning.dark.getTime() - Date.parse('2026-12-21T16:21:58Z'))).toBeLessThan(2 * 60_000);
  });

  it('does not warn about a Deadline in daylight, or without a destination on the map', () => {
    expect(startWarnings([luca], all, { deadline: new Date('2026-12-21T12:00:00Z'), point: zermatt })).toEqual([]);
    expect(startWarnings([luca], all, { deadline: new Date('2026-12-21T20:00:00Z'), point: null })).toEqual([]);
  });
});
