import { useEffect, useRef, useState } from 'react';
import { osmExternalUrl } from './format';

export type MapMarker = { latitude: number; longitude: number; label: string; kind?: 'farm' | 'hub' };

type LeafletWindow = Window & { L?: any };

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if ((window as LeafletWindow).L) resolve();
      else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Map library could not be loaded')), { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Map library could not be loaded'));
    document.head.appendChild(script);
  });
}

export function MapPanel({
  title,
  latitude,
  longitude,
  caption,
  markers = [],
  geofenceRadiusKm,
}: {
  title: string;
  latitude?: number | null;
  longitude?: number | null;
  caption?: string;
  markers?: MapMarker[];
  geofenceRadiusKm?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const markersKey = JSON.stringify(markers);

  useEffect(() => {
    let map: any;
    let cancelled = false;
    const validMarkers = markers.map((marker) => ({
      ...marker,
      latitude: Number(marker.latitude),
      longitude: Number(marker.longitude),
    })).filter((marker) =>
      Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude),
    );

    if (!validMarkers.length && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
      validMarkers.push({ latitude: Number(latitude), longitude: Number(longitude), label: caption || title, kind: 'farm' });
    }

    if (!validMarkers.length) {
      setStatus('error');
      return;
    }

    setStatus('loading');
    let link = document.querySelector<HTMLLinkElement>(`link[href="${LEAFLET_CSS}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const timeout = window.setTimeout(() => {
      if (!cancelled) setStatus('error');
    }, 10000);

    loadScript(LEAFLET_JS).then(() => {
      if (cancelled || !containerRef.current) return;
      const L = (window as LeafletWindow).L;
      if (!L) throw new Error('Map library unavailable');

      map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const bounds: any[] = [];
      for (const marker of validMarkers) {
        const markerLocation = [marker.latitude, marker.longitude];
        const icon = L.divIcon({
          className: `ym16-map-marker ym16-map-marker--${marker.kind || 'farm'}`,
          html: marker.kind === 'hub' ? 'H' : 'F',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
        L.marker(markerLocation, { icon }).addTo(map).bindPopup(marker.label);
        bounds.push(markerLocation);
      }

      const hub = validMarkers.find((marker) => marker.kind === 'hub');
      if (hub && geofenceRadiusKm && geofenceRadiusKm > 0) {
        L.circle([hub.latitude, hub.longitude], {
          radius: geofenceRadiusKm * 1000,
          color: '#1b4b3d',
          fillColor: '#55a679',
          fillOpacity: 0.12,
          weight: 2,
        }).addTo(map).bindPopup(`${geofenceRadiusKm.toFixed(1)} km collection hub geofence`);
      }

      if (bounds.length === 1) {
        map.setView(bounds[0], 12);
      } else {
        map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 13 });
      }
      window.clearTimeout(timeout);
      setStatus('ready');
    }).catch(() => {
      if (!cancelled) setStatus('error');
      window.clearTimeout(timeout);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (map) map.remove();
    };
  }, [latitude, longitude, caption, title, markersKey, geofenceRadiusKm]);

  const externalUrl = osmExternalUrl(latitude, longitude);

  return (
    <div className="ym16-card">
      <p className="ym16-kicker">{title}</p>
      <h3 style={{ marginTop: 6 }}>{caption || 'Operational geofence'}</h3>
      {status === 'loading' && <div className="ym16-map-status" role="status">Loading interactive map…</div>}
      {status === 'error' && (
        <div className="ym16-map-status ym16-map-error" role="alert">
          <span>Map data could not be loaded.</span>
          {validMapUrl(latitude, longitude) ? (
            <a href={externalUrl} target="_blank" rel="noreferrer">Open this location in OpenStreetMap</a>
          ) : <span>Coordinates are unavailable for this reservation.</span>}
        </div>
      )}
      <div
        ref={containerRef}
        className={`ym16-map ${status === 'ready' ? 'is-ready' : ''}`}
        aria-label={`${title} interactive map`}
        hidden={status !== 'ready'}
      />
    </div>
  );
}

function validMapUrl(latitude?: number | null, longitude?: number | null) {
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}
