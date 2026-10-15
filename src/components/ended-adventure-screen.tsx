import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Notice, Screen, Section } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { TrailMapView } from '@/components/trail-map-view';
import { useLoad } from '@/hooks/use-load';
import { barry, type EndedAdventure } from '@/lib/barry';
import { formatWhen, refusalText } from '@/lib/wording';

/** With onDone it is the screen right after the Check-in; without, an entry of the history. */
export function EndedAdventureScreen({ adventure, onDone }: { adventure: EndedAdventure; onDone?: () => void }) {
  const readings = useLoad(() => barry.readings(adventure.id));
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteAdventure = async () => {
    setDeleting(true);
    setDeleteError(null);
    const result = await barry.deleteAdventure(adventure.id).catch(() => null);
    setDeleting(false);
    if (result?.kind === 'deleted') router.back();
    else setDeleteError(result ? refusalText(result.refusal) : 'Could not delete.');
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete this Adventure?',
      'Its Plan, its Trail and its messages are removed. Links your Emergency Contacts got stop working.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteAdventure },
      ],
    );

  return (
    <Screen title={adventure.plan.destination}>
      <Notice tone="success">
        You checked in at {formatWhen(adventure.checkedInAt)}.{onDone && ' Welcome back.'}
      </Notice>
      {onDone && <Button title="Done" onPress={onDone} />}

      {readings.status === 'error' && (
        <>
          <Notice tone="warning">Could not load the map. {readings.error.message}</Notice>
          <Button title="Try again" kind="secondary" onPress={readings.reload} />
        </>
      )}
      {readings.status === 'ready' &&
        (readings.data.length > 0 ? (
          <TrailMapView trail={readings.data} last={readings.data.at(-1)!} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No positions were recorded.
          </ThemedText>
        ))}

      <Section title="Plan">
        <ThemedText type="small">Destination: {adventure.plan.destination}</ThemedText>
        {adventure.plan.route && <ThemedText type="small">Route: {adventure.plan.route}</ThemedText>}
        {adventure.plan.startingPoint && <ThemedText type="small">Starting point: {adventure.plan.startingPoint}</ThemedText>}
        {adventure.plan.notes && <ThemedText type="small">Notes: {adventure.plan.notes}</ThemedText>}
        {adventure.alertsSent > 0 && (
          <ThemedText type="small">
            {adventure.alertsSent} Alert{adventure.alertsSent > 1 ? 's' : ''} sent
          </ThemedText>
        )}
      </Section>

      {!onDone && (
        <>
          {deleteError && <Notice tone="danger">{deleteError}</Notice>}
          <Button title="Delete Adventure" kind="danger" onPress={confirmDelete} busy={deleting} />
        </>
      )}
    </Screen>
  );
}
