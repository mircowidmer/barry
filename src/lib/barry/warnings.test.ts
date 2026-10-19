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

describe('startWarnings', () => {
  it('warns about nothing when notifications are allowed and text messages work', () => {
    expect(startWarnings([luca, mia, sara], { smsEnabled: true, notificationsPermitted: true, trailPermitted: true })).toEqual([]);
  });

  it('warns that there will be no Reminder while notifications are off', () => {
    expect(startWarnings([luca], { smsEnabled: true, notificationsPermitted: false, trailPermitted: true })).toEqual([{ kind: 'no_notifications' }]);
  });

  it('names who gets email only and who gets nothing while text messages are off', () => {
    expect(startWarnings([luca, mia, sara], { smsEnabled: false, notificationsPermitted: true, trailPermitted: true })).toEqual([
      { kind: 'email_only', contacts: [mia] },
      { kind: 'unreachable', contacts: [sara] },
    ]);
  });

  it('warns that Barry can share only where you started without the Always permission', () => {
    expect(startWarnings([luca], { smsEnabled: true, notificationsPermitted: true, trailPermitted: false })).toEqual([
      { kind: 'no_trail' },
    ]);
  });

  it('counts only the addresses that are switched on', () => {
    const miaPhoneOff = contact('Mia', 'mia@example.com', '+41791111111', { phoneEnabled: false });
    const miaEmailOff = contact('Mia', 'mia@example.com', '+41791111111', { emailEnabled: false });
    expect(startWarnings([miaPhoneOff], { smsEnabled: false, notificationsPermitted: true, trailPermitted: true })).toEqual([]);
    expect(startWarnings([miaEmailOff], { smsEnabled: false, notificationsPermitted: true, trailPermitted: true })).toEqual([
      { kind: 'unreachable', contacts: [miaEmailOff] },
    ]);
  });
});
