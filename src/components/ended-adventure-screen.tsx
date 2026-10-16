import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Notice, Screen, Section } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { TrailMapView } from '@/components/trail-map-view';
import { useLoad } from '@/hooks/use-load';
import { barry, type EndedAdventure } from '@/lib/barry';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { useTexts } from '@/lib/texts';

/** With onDone it is the screen right after the Check-in; without, an entry of the history. */
export function EndedAdventureScreen({ adventure, onDone }: { adventure: EndedAdventure; onDone?: () => void }) {
  const readings = useLoad(() => barry.readings(adventure.id));
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const t = useTexts();

  const remove = async () => {
    setDeleteError(null);
    const outcome = await askToDeleteAdventure(adventure.id, 'ended');
    if (outcome.kind === 'deleted') router.back();
    else if (outcome.kind === 'failed') setDeleteError(outcome.message);
  };

  return (
    <Screen title={adventure.plan.destination}>
      <Notice tone="success">
        {t.ended.checkedIn(t.when(adventure.checkedInAt))}
        {onDone && t.ended.welcome}
      </Notice>
      {onDone && <Button title={t.common.done} onPress={onDone} />}

      {readings.status === 'error' && (
        <>
          <Notice tone="warning">{t.ended.mapFailed(readings.error.message)}</Notice>
          <Button title={t.common.tryAgain} kind="secondary" onPress={readings.reload} />
        </>
      )}
      {readings.status === 'ready' &&
        (readings.data.length > 0 ? (
          <TrailMapView trail={readings.data} last={readings.data.at(-1)!} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t.ended.noPositions}
          </ThemedText>
        ))}

      <Section title={t.adventure.planSection}>
        <ThemedText type="small">{t.adventure.destination(adventure.plan.destination)}</ThemedText>
        {adventure.plan.route && <ThemedText type="small">{t.adventure.route(adventure.plan.route)}</ThemedText>}
        {adventure.plan.startingPoint && <ThemedText type="small">{t.adventure.startingPoint(adventure.plan.startingPoint)}</ThemedText>}
        {adventure.plan.notes && <ThemedText type="small">{t.adventure.notes(adventure.plan.notes)}</ThemedText>}
        {adventure.alertsSent > 0 && <ThemedText type="small">{t.ended.alertsSent(adventure.alertsSent)}</ThemedText>}
      </Section>

      {!onDone && (
        <>
          {deleteError && <Notice tone="danger">{deleteError}</Notice>}
          <Button title={t.common.delete} kind="danger" onPress={remove} />
        </>
      )}
    </Screen>
  );
}
