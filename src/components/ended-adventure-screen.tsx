import { Button, Notice, Screen, Section } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { TrailMapView } from '@/components/trail-map-view';
import { useLoad } from '@/hooks/use-load';
import { barry, type EndedAdventure } from '@/lib/barry';
import { formatWhen } from '@/lib/wording';

/** With onDone it is the screen right after the Check-in; without, an entry of the history. */
export function EndedAdventureScreen({ adventure, onDone }: { adventure: EndedAdventure; onDone?: () => void }) {
  const readings = useLoad(() => barry.readings(adventure.id));

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
          <TrailMapView trail={readings.data} last={readings.data.at(-1)!} timeZone={adventure.timeZone} />
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
    </Screen>
  );
}
