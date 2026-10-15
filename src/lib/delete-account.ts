import { Alert } from 'react-native';

import { barry, type Refusal } from '@/lib/barry';
import { refusalText } from '@/lib/wording';

export type DeleteAccountOutcome = { kind: 'cancelled' } | { kind: 'deleted' } | { kind: 'failed'; message: string };

const accountRefusals: Partial<Record<Refusal, string>> = {
  adventure_in_progress: 'Check in from your Adventure before you delete your account.',
  messages_pending: 'Barry is still sending messages for one of your Adventures. Try again in a few minutes.',
};

const confirmed = () =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      'Delete your account?',
      'Your Profile, your Emergency Contacts and every Adventure with its Trail are deleted. Links your Emergency Contacts got stop working. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

export const askToDeleteAccount = async (onConfirmed: () => void): Promise<DeleteAccountOutcome> => {
  if (!(await confirmed())) return { kind: 'cancelled' };
  onConfirmed();
  const result = await barry.deleteAccount().catch(() => null);
  if (result?.kind === 'deleted') return { kind: 'deleted' };
  if (!result) return { kind: 'failed', message: 'Could not delete your account. Try again with signal.' };
  return { kind: 'failed', message: accountRefusals[result.refusal] ?? refusalText(result.refusal) };
};
