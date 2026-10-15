import type { EmergencyContact, StartConditions, StartWarning } from './types';

export const startWarnings = (contacts: EmergencyContact[], conditions: StartConditions): StartWarning[] => {
  const warnings: StartWarning[] = [];
  if (!conditions.pushRegistered) warnings.push({ kind: 'no_push' });
  if (!conditions.smsEnabled) {
    const withPhone = contacts.filter((c) => c.phone !== null);
    const emailOnly = withPhone.filter((c) => c.email !== null);
    const unreachable = withPhone.filter((c) => c.email === null);
    if (emailOnly.length > 0) warnings.push({ kind: 'email_only', contacts: emailOnly });
    if (unreachable.length > 0) warnings.push({ kind: 'unreachable', contacts: unreachable });
  }
  return warnings;
};
