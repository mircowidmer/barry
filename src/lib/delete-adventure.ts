import { type AdventureId, barry } from '@/lib/barry';
import { confirmDestructive } from '@/lib/confirm-destructive';
import { currentTexts, refusalText } from '@/lib/texts';

export type DeleteOutcome = { kind: 'cancelled' } | { kind: 'deleted' } | { kind: 'failed'; message: string };

export type DeletableStage = 'planned' | 'ended';

const confirmed = (stage: DeletableStage) => {
  const t = currentTexts();
  return confirmDestructive({
    title: t.dialogs.deleteAdventureTitle,
    message: stage === 'planned' ? t.dialogs.deletePlanned : t.dialogs.deleteEnded,
  });
};

export type DeleteManyOutcome = { kind: 'cancelled' } | { kind: 'done'; failures: string[] };

/** One confirmation for all of them; each refusal, such as an All-clear still on its way, is collected. */
export const askToDeleteAdventures = async (ids: AdventureId[]): Promise<DeleteManyOutcome> => {
  const t = currentTexts();
  const ok = await confirmDestructive({
    title: t.history.deleteTitle(ids.length),
    message: ids.length === 1 ? t.dialogs.deleteEnded : t.history.deleteMany,
  });
  if (!ok) return { kind: 'cancelled' };
  const failures: string[] = [];
  for (const id of ids) {
    const result = await barry.deleteAdventure(id).catch(() => null);
    if (result?.kind !== 'deleted') failures.push(result ? refusalText(result.refusal) : t.dialogs.couldNotDelete);
  }
  return { kind: 'done', failures };
};

export const askToDeleteAdventure = async (id: AdventureId, stage: DeletableStage): Promise<DeleteOutcome> => {
  if (!(await confirmed(stage))) return { kind: 'cancelled' };
  const result = await barry.deleteAdventure(id).catch(() => null);
  if (result?.kind === 'deleted') return { kind: 'deleted' };
  return { kind: 'failed', message: result ? refusalText(result.refusal) : currentTexts().dialogs.couldNotDelete };
};
