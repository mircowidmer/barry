import { Alert } from 'react-native';

import { type AdventureId, barry } from '@/lib/barry';
import { currentTexts, refusalText } from '@/lib/texts';

export type DeleteOutcome = { kind: 'cancelled' } | { kind: 'deleted' } | { kind: 'failed'; message: string };

export type DeletableStage = 'planned' | 'ended';

const confirmed = (stage: DeletableStage) => {
  const t = currentTexts();
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      t.dialogs.deleteAdventureTitle,
      stage === 'planned' ? t.dialogs.deletePlanned : t.dialogs.deleteEnded,
      [
        { text: t.common.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: t.common.delete, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
};

export const askToDeleteAdventure = async (id: AdventureId, stage: DeletableStage): Promise<DeleteOutcome> => {
  if (!(await confirmed(stage))) return { kind: 'cancelled' };
  const result = await barry.deleteAdventure(id).catch(() => null);
  if (result?.kind === 'deleted') return { kind: 'deleted' };
  return { kind: 'failed', message: result ? refusalText(result.refusal) : currentTexts().dialogs.couldNotDelete };
};
