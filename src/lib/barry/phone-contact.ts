import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';

import { formatPhoneNumber } from '@/lib/phone';

import { isEmailAddress, isPhoneNumber } from './reach';

/** What Barry reads from the Phone Contact the Adventurer picked. */
export type PhoneContact = {
  fullName: string;
  company: string | null;
  /** `region` is the phone's own reading of the number's country, such as `ch`, when it has one. */
  phones: { label?: string; number?: string; region?: string }[];
  emails: { label?: string; address?: string }[];
};

/** What an Emergency Contact keeps of a Phone Contact. */
export type ContactCopy = { name: string; email: string | null; phone: string | null };

/** A number whose label contains one of these can get a text message. */
export const MOBILE_LABELS = ['mobile', 'mobil', 'iphone', 'cell'];

const isMobile = (label: string | undefined): boolean => {
  const lower = (label ?? '').toLowerCase();
  return MOBILE_LABELS.some((mobile) => lower.includes(mobile));
};

/** The number with its country code, or null when it cannot be read as one. A number without a code is read in the region given. */
export const fullPhoneNumber = (number: string, region: string | null | undefined): string | null => {
  const parsed = parsePhoneNumberFromString(number, (region?.toUpperCase() ?? undefined) as CountryCode | undefined);
  if (!parsed?.isPossible() || !isPhoneNumber(parsed.number)) return null;
  return parsed.number;
};

/**
 * The name, the first mobile number Barry can use, else the first other one, and the first email address of a
 * Phone Contact. A number is read in the region the phone gave it, else in the phone's own region.
 */
export const copyPhoneContact = (contact: PhoneContact, region: string | null): ContactCopy => {
  const numbers = contact.phones.filter((p) => (p.number?.trim() ?? '') !== '');
  const ordered = [...numbers.filter((p) => isMobile(p.label)), ...numbers.filter((p) => !isMobile(p.label))];
  const phone = ordered.map((p) => fullPhoneNumber(p.number!, p.region ?? region)).find((n) => n !== null) ?? null;
  const email = contact.emails.map((e) => e.address?.trim() ?? '').find(isEmailAddress) ?? null;
  const name = contact.fullName.trim() || contact.company?.trim() || email || (phone ? formatPhoneNumber(phone) : '');
  return { name, email, phone };
};
