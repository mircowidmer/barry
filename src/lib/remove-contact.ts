import { Alert } from 'react-native';

import { barry, type EmergencyContact } from '@/lib/barry';
import { currentTexts } from '@/lib/texts';

export type RemoveOutcome = { kind: 'cancelled' } | { kind: 'removed' } | { kind: 'in_use' } | { kind: 'failed' };

const confirmed = (name: string) => {
  const t = currentTexts();
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      t.contacts.deleteTitle(name),
      t.contacts.deleteMessage(name),
      [
        { text: t.common.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: t.common.delete, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
};

export const askToRemoveContact = async (contact: EmergencyContact): Promise<RemoveOutcome> => {
  if (!(await confirmed(contact.name))) return { kind: 'cancelled' };
  return barry.removeContact(contact.id).catch((): RemoveOutcome => ({ kind: 'failed' }));
};
