import { reachableAddresses } from './reach';
import type { EmergencyContact, StartConditions, StartWarning } from './types';

export const startWarnings = (contacts: EmergencyContact[], conditions: StartConditions): StartWarning[] => {
  const warnings: StartWarning[] = [];
  if (!conditions.trailPermitted) warnings.push({ kind: 'no_trail' });
  if (!conditions.notificationsPermitted) warnings.push({ kind: 'no_notifications' });
  if (!conditions.smsEnabled) {
    const withPhone = contacts.filter((c) => reachableAddresses(c).phone !== null);
    const emailOnly = withPhone.filter((c) => reachableAddresses(c).email !== null);
    const unreachable = withPhone.filter((c) => reachableAddresses(c).email === null);
    if (emailOnly.length > 0) warnings.push({ kind: 'email_only', contacts: emailOnly });
    if (unreachable.length > 0) warnings.push({ kind: 'unreachable', contacts: unreachable });
  }
  return warnings;
};
