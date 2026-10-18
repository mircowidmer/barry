import { SitePage } from '@/components/site-page';
import { TrailMapView } from '@/components/trail-map-view';
import { siteText, useSiteLanguage } from '@/lib/site-language';
import type { TrailMap } from '@/lib/trail-map/types';
import { useTrailMap } from '@/lib/trail-map/use-trail-map';

export const generateMetadata = () => ({ title: 'Adventure', robots: { index: false, follow: false } });

export default function AdventureRoute() {
  const view = useTrailMap();
  const t = siteText[useSiteLanguage()];
  switch (view.kind) {
    case 'loading':
      return (
        <SitePage title={t.adventure}>
          <p className="lead">{t.loading}</p>
        </SitePage>
      );
    case 'not_found':
      return (
        <SitePage title={t.adventure}>
          <p className="note">{t.linkBroken}</p>
        </SitePage>
      );
    case 'offline':
      return view.last ? (
        <TrailMapPage map={view.last} staleSince={view.since} />
      ) : (
        <SitePage title={t.adventure}>
          <p className="note">{t.unreachable}</p>
        </SitePage>
      );
    case 'ready':
      return <TrailMapPage map={view.map} />;
  }
}

function TrailMapPage({ map, staleSince }: { map: TrailMap; staleSince?: Date }) {
  const t = siteText[useSiteLanguage()];
  const { plan } = map;
  return (
    <SitePage title={t.adventureOf(map.adventurerName)} lead={map.status === 'checked_in' ? undefined : t.updatesEveryMinute}>
      {staleSince && <p className="note">{t.staleSince(staleSince)}</p>}
      {map.status === 'alerted' && <p className="note danger">{t.alerted(map.adventurerName)}</p>}
      {map.status === 'checked_in' && <p className="note success">{t.checkedIn(map.adventurerName, map.checkedInAt)}</p>}
      <TrailMapView trail={map.trail} last={map.lastKnownPosition} />
      <p className="caption">{t.lastKnownPosition(map.lastKnownPosition)}</p>
      <div className="card">
        <h2>{t.plan}</h2>
        <dl>
          <dt>{t.destination}</dt>
          <dd>{plan.destination}</dd>
          {plan.route && (
            <>
              <dt>{t.route}</dt>
              <dd>{plan.route}</dd>
            </>
          )}
        </dl>
      </div>
    </SitePage>
  );
}
