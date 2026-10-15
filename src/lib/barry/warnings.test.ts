import { describe, expect, it } from '@jest/globals';

import type { EmergencyContact, EmergencyContactId } from './types';
import { startWarnings } from './warnings';

const contact = (name: string, email: string | null, phone: string | null) =>
  ({ id: name as EmergencyContactId, name, email, phone }) as EmergencyContact;

const luca = contact('Luca', 'luca@example.com', null);
const mia = contact('Mia', 'mia@example.com', '+41791111111');
const sara = contact('Sara', null, '+41792222222');

describe('startWarnings', () => {
  it('warns about nothing when push is registered and text messages work', () => {
    expect(startWarnings([luca, mia, sara], { smsEnabled: true, pushRegistered: true, trailPermitted: true })).toEqual([]);
  });

  it('warns that there will be no Reminder without a registered phone', () => {
    expect(startWarnings([luca], { smsEnabled: true, pushRegistered: false, trailPermitted: true })).toEqual([{ kind: 'no_push' }]);
  });

  it('names who gets email only and who gets nothing while text messages are off', () => {
    expect(startWarnings([luca, mia, sara], { smsEnabled: false, pushRegistered: true, trailPermitted: true })).toEqual([
      { kind: 'email_only', contacts: [mia] },
      { kind: 'unreachable', contacts: [sara] },
    ]);
  });

  it('warns that Barry can share only where you started without the Always permission', () => {
    expect(startWarnings([luca], { smsEnabled: true, pushRegistered: true, trailPermitted: false })).toEqual([
      { kind: 'no_trail' },
    ]);
  });

  it('says nothing about text messages for email-only contacts', () => {
    expect(startWarnings([luca], { smsEnabled: false, pushRegistered: true, trailPermitted: true })).toEqual([]);
  });
});
