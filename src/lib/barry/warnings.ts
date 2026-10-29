import { reachableAddresses } from './reach';
import type { EmergencyContact, StartChecks, StartWarning } from './types';

export const startWarnings = (contacts: EmergencyContact[], checks: StartChecks): StartWarning[] => {
  const warnings: StartWarning[] = [];
  if (!checks.trailPermitted) warnings.push({ kind: 'no_trail' });
  if (!checks.notificationsPermitted) warnings.push({ kind: 'no_notifications' });
  if (!checks.smsEnabled) {
    const withPhone = contacts.filter((c) => reachableAddresses(c).phone !== null);
    const emailOnly = withPhone.filter((c) => reachableAddresses(c).email !== null);
    const unreachable = withPhone.filter((c) => reachableAddresses(c).email === null);
    if (emailOnly.length > 0) warnings.push({ kind: 'email_only', contacts: emailOnly });
    if (unreachable.length > 0) warnings.push({ kind: 'unreachable', contacts: unreachable });
  }
  return warnings;
};
