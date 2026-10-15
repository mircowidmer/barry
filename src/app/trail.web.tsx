import { SitePage } from '@/components/site-page';
import { TrailMapView } from '@/components/trail-map-view';
import type { TrailMap } from '@/lib/trail-map/types';
import { useTrailMap } from '@/lib/trail-map/use-trail-map';
import { formatWhen } from '@/lib/wording';

export const generateMetadata = () => ({ title: 'Trail Map', robots: { index: false, follow: false } });

export default function TrailMapRoute() {
  const view = useTrailMap();
  switch (view.kind) {
    case 'loading':
      return (
        <SitePage title="Trail Map">
          <p className="lead">Loading…</p>
        </SitePage>
      );
    case 'not_found':
      return (
        <SitePage title="Trail Map">
          <p className="note">This link does not work.</p>
        </SitePage>
      );
    case 'offline':
      return view.last ? (
        <TrailMapPage map={view.last} staleSince={view.since} />
      ) : (
        <SitePage title="Trail Map">
          <p className="note">Barry cannot be reached. Try again in a moment.</p>
        </SitePage>
      );
    case 'ready':
      return <TrailMapPage map={view.map} />;
  }
}

function TrailMapPage({ map, staleSince }: { map: TrailMap; staleSince?: Date }) {
  const { plan } = map;
  return (
    <SitePage
      title={`${map.adventurerName}'s Trail`}
      lead={map.status === 'checked_in' ? undefined : 'Barry updates this map every minute.'}>
      {staleSince && (
        <p className="note">Barry cannot be reached since {formatWhen(staleSince)}. This is the last Trail Map it sent.</p>
      )}
      {map.status === 'alerted' && (
        <p className="note danger">{map.adventurerName} has not checked in. Barry has raised the Alert.</p>
      )}
      {map.status === 'checked_in' && (
        <p className="note success">
          {map.adventurerName} checked in at {formatWhen(map.checkedInAt)}.
        </p>
      )}
      {map.status !== 'checked_in' && (
        <>
          <TrailMapView trail={map.trail} last={map.lastKnownPosition} />
          <p className="caption">
            {map.lastKnownPosition
              ? `Last Known Position at ${formatWhen(map.lastKnownPosition.takenAt)}: ${map.lastKnownPosition.latitude.toFixed(5)}, ${map.lastKnownPosition.longitude.toFixed(5)}` +
                (map.lastKnownPosition.accuracyM === null ? '' : ` (within ${Math.round(map.lastKnownPosition.accuracyM)} m)`)
              : 'Last Known Position: not recorded'}
          </p>
        </>
      )}
      <div className="card">
        <h2>Plan</h2>
        <dl>
          <dt>Destination</dt>
          <dd>{plan.destination}</dd>
          {plan.route && (
            <>
              <dt>Route</dt>
              <dd>{plan.route}</dd>
            </>
          )}
          {plan.startingPoint && (
            <>
              <dt>Starting point</dt>
              <dd>{plan.startingPoint}</dd>
            </>
          )}
          {plan.notes && (
            <>
              <dt>Notes</dt>
              <dd>{plan.notes}</dd>
            </>
          )}
        </dl>
      </div>
    </SitePage>
  );
}
