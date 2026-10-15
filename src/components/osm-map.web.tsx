import 'leaflet/dist/leaflet.css';

import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';

import type { OsmMapProps } from './osm-map';

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function OsmMap({ trail, last }: OsmMapProps) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      if (line.length > 1) L.polyline(line, { color: '#208AEF', weight: 4 }).addTo(m);
      if (last) {
        L.circleMarker([last.latitude, last.longitude], { radius: 8, color: '#fff', weight: 2, fillColor: '#E5484D', fillOpacity: 1 }).addTo(m);
        if (last.accuracyM) L.circle([last.latitude, last.longitude], { radius: last.accuracyM, weight: 1 }).addTo(m);
      }
      const bounds = L.latLngBounds(last ? [...line, L.latLng(last.latitude, last.longitude)] : line);
      if (bounds.isValid()) m.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    });
    return () => {
      cancelled = true;
    };
  }, [trail, last]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={element} style={{ height: 420, width: '100%', borderRadius: 12, overflow: 'hidden' }} />;
}
