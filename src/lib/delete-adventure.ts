import { Alert } from 'react-native';

import { type AdventureId, barry } from '@/lib/barry';
import { refusalText } from '@/lib/wording';

export type DeleteOutcome = { kind: 'cancelled' } | { kind: 'deleted' } | { kind: 'failed'; message: string };

export type DeletableStage = 'planned' | 'ended';

const CONSEQUENCES: Record<DeletableStage, string> = {
  planned: 'Its Plan is removed. Nobody was told about it yet.',
  ended: 'Its Plan, its Trail and its messages are removed. Links your emergency contacts got stop working.',
};

const confirmed = (stage: DeletableStage) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      'Delete this Adventure?',
      CONSEQUENCES[stage],
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

export const askToDeleteAdventure = async (id: AdventureId, stage: DeletableStage): Promise<DeleteOutcome> => {
  if (!(await confirmed(stage))) return { kind: 'cancelled' };
  const result = await barry.deleteAdventure(id).catch(() => null);
  if (result?.kind === 'deleted') return { kind: 'deleted' };
  return { kind: 'failed', message: result ? refusalText(result.refusal) : 'Could not delete.' };
};
