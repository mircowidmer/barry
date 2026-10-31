import { barry, type EmergencyContact } from '@/lib/barry';
import { confirmDestructive } from '@/lib/confirm-destructive';
import { currentTexts } from '@/lib/texts';

type RemoveOutcome = { kind: 'cancelled' } | { kind: 'removed' } | { kind: 'in_use' } | { kind: 'failed' };

const confirmed = (name: string) => {
  const t = currentTexts();
  return confirmDestructive({ title: t.contacts.deleteTitle(name), message: t.contacts.deleteMessage(name) });
};

export const askToRemoveContact = async (contact: EmergencyContact): Promise<RemoveOutcome> => {
  if (!(await confirmed(contact.name))) return { kind: 'cancelled' };
  return barry.removeContact(contact.id).catch((): RemoveOutcome => ({ kind: 'failed' }));
};
