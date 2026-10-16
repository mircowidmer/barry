import { Alert } from 'react-native';

import { barry, type Refusal } from '@/lib/barry';
import { currentTexts, refusalText } from '@/lib/texts';

export type DeleteAccountOutcome = { kind: 'cancelled' } | { kind: 'deleted' } | { kind: 'failed'; message: string };

const accountRefusals = (): Partial<Record<Refusal, string>> => ({
  adventure_in_progress: currentTexts().dialogs.accountInProgress,
  messages_pending: currentTexts().dialogs.accountMessagesPending,
});

const confirmed = () => {
  const t = currentTexts();
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      t.dialogs.deleteAccountTitle,
      t.dialogs.deleteAccountMessage,
      [
        { text: t.common.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: t.common.delete, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
};

export const askToDeleteAccount = async (onConfirmed: () => void): Promise<DeleteAccountOutcome> => {
  if (!(await confirmed())) return { kind: 'cancelled' };
  onConfirmed();
  const result = await barry.deleteAccount().catch(() => null);
  if (result?.kind === 'deleted') return { kind: 'deleted' };
  if (!result) return { kind: 'failed', message: currentTexts().dialogs.couldNotDeleteAccount };
  return { kind: 'failed', message: accountRefusals()[result.refusal] ?? refusalText(result.refusal) };
};
