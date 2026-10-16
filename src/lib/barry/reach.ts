import type { EmergencyContact } from './types';

// The same patterns as the checks on public.emergency_contacts.
export const isEmailAddress = (text: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text.trim());
export const isPhoneNumber = (text: string): boolean => /^\+[1-9][0-9]{6,14}$/.test(text.replace(/\s/g, ''));

/** The addresses Barry reaches a contact on: filled in and switched on. */
export const reachableAddresses = (contact: EmergencyContact): { email: string | null; phone: string | null } => ({
  email: contact.emailEnabled ? contact.email : null,
  phone: contact.phoneEnabled ? contact.phone : null,
});
