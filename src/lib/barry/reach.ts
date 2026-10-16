import type { EmergencyContact } from './types';

/** The addresses Barry reaches a contact on: filled in and switched on. */
export const reachableAddresses = (contact: EmergencyContact): { email: string | null; phone: string | null } => ({
  email: contact.emailEnabled ? contact.email : null,
  phone: contact.phoneEnabled ? contact.phone : null,
});
