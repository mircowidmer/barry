import { barry, type Refusal } from '@/lib/barry';
import { confirmDestructive } from '@/lib/confirm-destructive';
import { currentTexts, refusalText } from '@/lib/texts';

type DeleteAccountOutcome = { kind: 'cancelled' } | { kind: 'deleted' } | { kind: 'failed'; message: string };

const accountRefusals = (): Partial<Record<Refusal, string>> => ({
  adventure_in_progress: currentTexts().dialogs.accountInProgress,
  messages_pending: currentTexts().dialogs.accountMessagesPending,
});

const confirmed = () => {
  const t = currentTexts();
  return confirmDestructive({ title: t.dialogs.deleteAccountTitle, message: t.dialogs.deleteAccountMessage });
};

export const askToDeleteAccount = async (onConfirmed: () => void): Promise<DeleteAccountOutcome> => {
  if (!(await confirmed())) return { kind: 'cancelled' };
  onConfirmed();
  const result = await barry.deleteAccount().catch(() => null);
  if (result?.kind === 'deleted') return { kind: 'deleted' };
  if (!result) return { kind: 'failed', message: currentTexts().dialogs.couldNotDelete };
  return { kind: 'failed', message: accountRefusals()[result.refusal] ?? refusalText(result.refusal) };
};
