import 'leaflet/dist/leaflet.css';

import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';

import { Colors } from '@/constants/theme';
import { siteText, useSiteLanguage } from '@/lib/site-language';
import { formatWhen, formatWhenGerman } from '@/lib/wording';

import type { TrailMapViewProps } from './trail-map-view';

// The OpenStreetMap tiles are light in either scheme.
const { accent: TRAIL, text: LAST } = Colors.light;

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function TrailMapView({ trail, last }: TrailMapViewProps) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const fitted = useRef(false);
  const language = useSiteLanguage();
  const empty = trail.length === 0 && !last;

  useEffect(() => {
    if (empty) return;
    let cancelled = false;
    const t = siteText[language];
    const when = language === 'de' ? formatWhenGerman : formatWhen;
    // Leaflet touches window at import, and the static export renders this page in Node.
    import('leaflet').then((L) => {
      if (cancelled || !element.current) return;
      map.current ??= L.map(element.current).addLayer(
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: ATTRIBUTION }),
      );
      const m = map.current;
      m.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) m.removeLayer(layer);
      });
      const line = trail.map((p) => L.latLng(p.latitude, p.longitude));
      if (line.length > 1) L.polyline(line, { color: TRAIL, weight: 4 }).addTo(m);
      for (const p of trail) {
        L.circleMarker([p.latitude, p.longitude], { radius: 4, color: '#fff', weight: 1.5, fillColor: TRAIL, fillOpacity: 1 })
          .bindTooltip(when(p.takenAt))
          .addTo(m);
      }
      if (last) {
        L.circleMarker([last.latitude, last.longitude], { radius: 8, color: '#fff', weight: 2, fillColor: LAST, fillOpacity: 1 })
          .bindTooltip(t.lastKnown(last.takenAt))
          .addTo(m);
        if (last.accuracyM) L.circle([last.latitude, last.longitude], { radius: last.accuracyM, color: TRAIL, weight: 1 }).addTo(m);
      }
      // The view fits the Trail once. A minute later the new readings must not undo the reader's zoom and pan.
      if (fitted.current) return;
      const bounds = L.latLngBounds(last ? [...line, L.latLng(last.latitude, last.longitude)] : line);
      if (bounds.isValid()) {
        m.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
        fitted.current = true;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [trail, last, language, empty]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  // With nothing to show, the caption says so; a map without a view would be a grey box.
  if (empty) return null;
  return <div ref={element} className="map" />;
}
