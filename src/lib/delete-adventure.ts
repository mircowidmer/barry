import { Alert } from 'react-native';

import { type AdventureId, barry } from '@/lib/barry';
import { refusalText } from '@/lib/wording';

export type DeleteOutcome = { kind: 'cancelled' } | { kind: 'deleted' } | { kind: 'failed'; message: string };

const confirmed = () =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      'Delete this Adventure?',
      'Its Plan, its Trail and its messages are removed. Links your Emergency Contacts got stop working.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

export const askToDeleteAdventure = async (id: AdventureId): Promise<DeleteOutcome> => {
  if (!(await confirmed())) return { kind: 'cancelled' };
  const result = await barry.deleteAdventure(id).catch(() => null);
  if (result?.kind === 'deleted') return { kind: 'deleted' };
  return { kind: 'failed', message: result ? refusalText(result.refusal) : 'Could not delete.' };
};
