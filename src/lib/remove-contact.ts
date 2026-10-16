import { Alert } from 'react-native';

import { barry, type EmergencyContact } from '@/lib/barry';

export type RemoveOutcome = { kind: 'cancelled' } | { kind: 'removed' } | { kind: 'in_use' } | { kind: 'failed' };

const confirmed = (name: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      `Delete ${name}?`,
      `${name} is no longer offered as an emergency contact for new adventures.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

export const askToRemoveContact = async (contact: EmergencyContact): Promise<RemoveOutcome> => {
  if (!(await confirmed(contact.name))) return { kind: 'cancelled' };
  return barry.removeContact(contact.id).catch((): RemoveOutcome => ({ kind: 'failed' }));
};
