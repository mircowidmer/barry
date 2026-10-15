import { Notice, Screen, Section } from '@/components/form';
import { OsmMap } from '@/components/osm-map';
import { ThemedText } from '@/components/themed-text';
import type { TrailMap } from '@/lib/trail-map/types';
import { useTrailMap } from '@/lib/trail-map/use-trail-map';

const formatTime = (at: Date, timeZone: string) => {
  const when = at.toLocaleString('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${when} ${timeZone.split('/').pop()!.replaceAll('_', ' ')} time`;
};

export const generateMetadata = () => ({ title: 'Trail Map', robots: { index: false, follow: false } });

export default function TrailMapRoute() {
  const view = useTrailMap();
  switch (view.kind) {
    case 'loading':
      return (
        <Screen title="Trail Map">
          <ThemedText>Loading…</ThemedText>
        </Screen>
      );
    case 'not_found':
      return (
        <Screen title="Trail Map">
          <Notice tone="warning">This link does not work.</Notice>
        </Screen>
      );
    case 'offline':
      return view.last ? (
        <TrailMapPage map={view.last} staleSince={view.since} />
      ) : (
        <Screen title="Trail Map">
          <Notice tone="warning">Barry cannot be reached. Try again in a moment.</Notice>
        </Screen>
      );
    case 'ready':
      return <TrailMapPage map={view.map} />;
  }
}

function TrailMapPage({ map, staleSince }: { map: TrailMap; staleSince?: Date }) {
  const time = (at: Date) => formatTime(at, map.timeZone);
  return (
    <Screen title={`${map.adventurerName}'s Trail`}>
      {staleSince && (
        <Notice tone="warning">Barry cannot be reached since {time(staleSince)}. This is the last Trail Map it sent.</Notice>
      )}
      {map.status === 'alerted' && (
        <Notice tone="danger">{map.adventurerName} has not checked in. Barry has raised the Alert.</Notice>
      )}
      {map.status === 'checked_in' && (
        <Notice tone="success">
          {map.adventurerName} checked in at {time(map.checkedInAt)}.
        </Notice>
      )}
      {map.status !== 'checked_in' && (
        <>
          <OsmMap trail={map.trail} last={map.lastKnownPosition} />
          <ThemedText type="small">
            {map.lastKnownPosition
              ? `Last Known Position at ${time(map.lastKnownPosition.takenAt)}: ${map.lastKnownPosition.latitude.toFixed(5)}, ${map.lastKnownPosition.longitude.toFixed(5)}` +
                (map.lastKnownPosition.accuracyM === null ? '' : ` (within ${Math.round(map.lastKnownPosition.accuracyM)} m)`)
              : 'Last Known Position: not recorded'}
          </ThemedText>
        </>
      )}
      <Section title="Plan">
        <ThemedText type="small">Destination: {map.plan.destination}</ThemedText>
        {map.plan.route && <ThemedText type="small">Route: {map.plan.route}</ThemedText>}
        {map.plan.startingPoint && <ThemedText type="small">Starting point: {map.plan.startingPoint}</ThemedText>}
        {map.plan.notes && <ThemedText type="small">Notes: {map.plan.notes}</ThemedText>}
      </Section>
    </Screen>
  );
}
