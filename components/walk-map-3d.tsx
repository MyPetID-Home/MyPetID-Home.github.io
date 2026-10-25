"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Free 3D walk map: MapLibre + OpenFreeMap vector tiles (3D buildings) + AWS open
 * terrain tiles. Dog-friendly places come from OpenStreetMap via Overpass, and
 * search uses Photon (OSM). No API keys and no Google quota.
 */
export type MapPoint = { lat: number; lng: number; label?: string };
/** A labelled pin drawn on the map (scan history, saved places, meetups...). */
export type MapPin = { lat: number; lng: number; label: string; tone?: 'brand' | 'blue' | 'red' | 'gold' | 'violet'; glyph?: string };
type SpotKind = 'park' | 'water' | 'vet' | 'shop' | 'bin';
type Spot = { id: string; kind: SpotKind; lat: number; lng: number; name: string };

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const DEFAULT_CENTER: [number, number] = [-70.1654, 44.0974]; // Maine, matches the app's old default map
const KINDS: Record<SpotKind, { label: string; color: string; glyph: string }> = {
  park: { label: 'Dog parks', color: '#87e06f', glyph: '🐕' },
  water: { label: 'Water', color: '#57d7ff', glyph: '💧' },
  vet: { label: 'Vets', color: '#ff7a7a', glyph: '✚' },
  shop: { label: 'Pet shops', color: '#ffce6b', glyph: '🦴' },
  bin: { label: 'Waste bins', color: '#b99cff', glyph: '♻' },
};

function overpassQuery(s: number, w: number, n: number, e: number) {
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:20];(
    nwr["leisure"="dog_park"](${bbox});
    node["amenity"="drinking_water"](${bbox});
    nwr["amenity"="veterinary"](${bbox});
    nwr["shop"="pet"](${bbox});
    node["amenity"="waste_basket"]["waste"~"dog_excrement"](${bbox});
    node["vending"="excrement_bags"](${bbox});
  );out center 250;`;
}

function kindOf(tags: Record<string, string>): SpotKind {
  if (tags.leisure === 'dog_park') return 'park';
  if (tags.amenity === 'drinking_water') return 'water';
  if (tags.amenity === 'veterinary') return 'vet';
  if (tags.shop === 'pet') return 'shop';
  return 'bin';
}

export function WalkMap3D({ start, current, end, pins, height = 420 }: { start?: MapPoint; current?: MapPoint; end?: MapPoint; pins?: MapPin[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const meRef = useRef<Marker | null>(null);
  const pinRefs = useRef<Marker[]>([]);
  const orbitRef = useRef<number | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const [ready, setReady] = useState(false);
  const [is3d, setIs3d] = useState(true);
  const [orbiting, setOrbiting] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [shown, setShown] = useState<Record<SpotKind, boolean>>({ park: true, water: true, vet: true, shop: true, bin: true });
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ name: string; lng: number; lat: number }[]>([]);

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibre = await import('maplibre-gl');
      if (cancelled || !containerRef.current) return;
      // MapLibre 6 runs its tile worker from a separate module file; the bundler doesn't emit it,
      // so a copy ships in public/maplibre (keep the version in the name in sync with package.json).
      maplibre.setWorkerUrl('/maplibre/worker-6.15.0.mjs');
      libRef.current = maplibre;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: STYLE,
        center: current ? [current.lng, current.lat] : start ? [start.lng, start.lat] : DEFAULT_CENTER,
        zoom: 15.2,
        pitch: 58,
        bearing: -18,
        maxPitch: 80,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibre.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');
      map.addControl(new maplibre.ScaleControl({ unit: 'imperial' }), 'bottom-left');
      map.on('load', () => {
        map.addSource('terrain', { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
        map.setTerrain({ source: 'terrain', exaggeration: 1.3 });
        map.addLayer({ id: 'hills', type: 'hillshade', source: 'terrain', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#0d1510' } }, map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id);
        try { map.setSky({ 'sky-color': '#163d47', 'horizon-color': '#21402d', 'fog-color': '#101712', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.4 }); } catch { /* older style spec */ }
        map.addSource('walk', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'walk-glow', type: 'line', source: 'walk', paint: { 'line-color': '#87e06f', 'line-width': 12, 'line-opacity': 0.25, 'line-blur': 6 } });
        map.addLayer({ id: 'walk-line', type: 'line', source: 'walk', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#87e06f', 'line-width': 4, 'line-dasharray': [1.2, 1.4] } });
        setReady(true);
      });
    })();
    return () => { cancelled = true; if (orbitRef.current) cancelAnimationFrame(orbitRef.current); mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Walk line + "you are here" marker follow the GPS points from the dashboard
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const coords = [start, current, end].filter(Boolean).map((p) => [p!.lng, p!.lat]);
    (map.getSource('walk') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: coords.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [] });
    const here = current || end || start;
    if (here) {
      if (!meRef.current) {
        const el = document.createElement('div');
        el.className = 'mapMe';
        meRef.current = new lib.Marker({ element: el }).setLngLat([here.lng, here.lat]).addTo(map);
      } else meRef.current.setLngLat([here.lng, here.lat]);
      map.easeTo({ center: [here.lng, here.lat], duration: 800 });
    }
  }, [ready, start, current, end]);

  // Labelled pins passed in by the page; the map frames them all
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    pinRefs.current.forEach((m) => m.remove());
    pinRefs.current = (pins || []).map((pin) => {
      const el = document.createElement('div');
      el.className = `mapPin ${pin.tone || 'brand'}`;
      el.innerHTML = `<span class="mapPinDot">${pin.glyph || ''}</span><span class="mapPinLabel"></span>`;
      (el.querySelector('.mapPinLabel') as HTMLElement).textContent = pin.label;
      return new lib.Marker({ element: el, anchor: 'bottom' }).setLngLat([pin.lng, pin.lat]).addTo(map);
    });
    if (pins && pins.length > 1) {
      const lngs = pins.map((p) => p.lng); const lats = pins.map((p) => p.lat);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 70, maxZoom: 16.5, pitch: 55, duration: 1200 });
    } else if (pins && pins.length === 1) map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: 16, duration: 900 });
  }, [ready, pins]);

  // Draw dog-friendly spots as markers
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = spots.filter((spot) => shown[spot.kind]).map((spot) => {
      // MapLibre positions the outer element with an inline transform, so the animated pin goes inside it.
      const el = document.createElement('div');
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `mapSpot ${spot.kind}`;
      pin.innerHTML = `<span>${KINDS[spot.kind].glyph}</span>`;
      pin.setAttribute('aria-label', `${KINDS[spot.kind].label}: ${spot.name}`);
      el.appendChild(pin);
      return new lib.Marker({ element: el, anchor: 'bottom' }).setLngLat([spot.lng, spot.lat]).setPopup(new lib.Popup({ offset: 18, closeButton: false }).setHTML(`<strong>${spot.name.replace(/[<>&]/g, '')}</strong><br><small>${KINDS[spot.kind].label}</small>`)).addTo(map);
    });
  }, [spots, shown]);

  // Spots from the vector tiles already on screen (OpenMapTiles "poi" layer, from OpenStreetMap).
  const spotsFromTiles = useCallback((): Spot[] => {
    const map = mapRef.current;
    if (!map) return [];
    const seen = new Set<string>();
    const out: Spot[] = [];
    for (const f of map.querySourceFeatures('openmaptiles', { sourceLayer: 'poi' })) {
      const props = (f.properties || {}) as Record<string, string>;
      const sub = props.subclass || '';
      const cls = props.class || '';
      const kind: SpotKind | null = sub === 'dog_park' ? 'park' : sub === 'drinking_water' ? 'water' : sub === 'veterinary' || cls === 'veterinary' ? 'vet' : sub === 'pet' ? 'shop' : null;
      if (!kind || f.geometry.type !== 'Point') continue;
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const id = `${kind}:${props.name || ''}:${lng.toFixed(4)},${lat.toFixed(4)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, kind, lat, lng, name: props.name || props['name:en'] || KINDS[kind].label.replace(/s$/, '') });
    }
    return out;
  }, []);

  const findSpots = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getZoom() < 12) { setStatus('Zoom in a little to search this area.'); return; }
    const summarize = (list: Spot[]) => (Object.keys(KINDS) as SpotKind[]).map((k) => [k, list.filter((s) => s.kind === k).length] as const).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${n === 1 ? KINDS[k].label.toLowerCase().replace(/s$/, '') : KINDS[k].label.toLowerCase()}`).join(' · ');
    const fromTiles = spotsFromTiles();
    setSpots(fromTiles);
    setStatus(fromTiles.length ? `Found ${summarize(fromTiles)} in view. Checking for more…` : 'Sniffing out dog-friendly spots…');
    const b = map.getBounds();
    const body = new URLSearchParams({ data: overpassQuery(b.getSouth(), b.getWest(), b.getNorth(), b.getEast()) });
    let json: unknown = null;
    // Public Overpass servers are free but sometimes slow; they only add extras (like dog waste bins).
    for (const endpoint of OVERPASS) {
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 9000);
        const response = await fetch(endpoint, { method: 'POST', body, signal: controller.signal });
        window.clearTimeout(timer);
        if (response.ok) { json = await response.json(); break; }
      } catch { /* try the next server */ }
    }
    const extra = json ? ((json as { elements: { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] }).elements.map((el) => {
      const lat = el.lat ?? el.center?.lat; const lng = el.lon ?? el.center?.lon;
      if (lat === undefined || lng === undefined) return null;
      const tags = el.tags || {};
      const kind = kindOf(tags);
      return { id: `${el.type}${el.id}`, kind, lat, lng, name: tags.name || KINDS[kind].label.replace(/s$/, '') } as Spot;
    }).filter(Boolean) as Spot[]) : [];
    // Merge, dropping Overpass points that duplicate a tile point within ~30 m.
    const merged = [...fromTiles, ...extra.filter((e) => !fromTiles.some((t) => t.kind === e.kind && Math.abs(t.lat - e.lat) < 0.0003 && Math.abs(t.lng - e.lng) < 0.0003))];
    setSpots(merged);
    setStatus(merged.length ? `Found ${summarize(merged)} in view.` : 'No mapped dog spots here yet. OpenStreetMap volunteers add more all the time.');
  }, [spotsFromTiles]);

  function toggle3d() {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3d;
    setIs3d(next);
    if (next) { map.setTerrain({ source: 'terrain', exaggeration: 1.3 }); map.easeTo({ pitch: 58, duration: 900 }); }
    else { map.setTerrain(null); map.easeTo({ pitch: 0, bearing: 0, duration: 900 }); }
  }

  // "Scope it out": a slow orbit around the area so owners can preview it before going
  function toggleOrbit() {
    const map = mapRef.current;
    if (!map) return;
    if (orbiting) { if (orbitRef.current) cancelAnimationFrame(orbitRef.current); orbitRef.current = null; setOrbiting(false); return; }
    if (!is3d) toggle3d();
    setOrbiting(true);
    map.easeTo({ pitch: 66, zoom: Math.max(map.getZoom(), 15.5), duration: 1000 });
    let last = performance.now();
    const spin = (now: number) => { map.setBearing(map.getBearing() + (now - last) * 0.006); last = now; orbitRef.current = requestAnimationFrame(spin); };
    orbitRef.current = requestAnimationFrame(spin);
    if (!spots.length) findSpots();
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    try {
      const center = mapRef.current?.getCenter();
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=5${center ? `&lat=${center.lat}&lon=${center.lng}` : ''}`);
      const json = await response.json() as { features: { geometry: { coordinates: [number, number] }; properties: { name?: string; city?: string; state?: string } }[] };
      setResults(json.features.map((f) => ({ name: [f.properties.name, f.properties.city, f.properties.state].filter(Boolean).join(', '), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })));
    } catch { setStatus('Search is unavailable right now.'); }
  }
  function goTo(result: { lng: number; lat: number; name: string }) {
    setResults([]);
    setQuery(result.name);
    mapRef.current?.flyTo({ center: [result.lng, result.lat], zoom: 15.5, pitch: is3d ? 60 : 0, duration: 2200, essential: true });
    window.setTimeout(findSpots, 2400);
  }

  return (
    <div className="map3d">
      <div className="map3dCanvas" ref={containerRef} style={{ height }} />
      <form className="mapSearch" onSubmit={search}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a park, trail or town" aria-label="Search places" />
        <button type="submit" className="primary">Go</button>
        {results.length > 0 && <ul className="mapResults">{results.map((r) => <li key={`${r.lng},${r.lat}`}><button type="button" onClick={() => goTo(r)}>{r.name}</button></li>)}</ul>}
      </form>
      <div className="mapToolbar">
        <button type="button" className={is3d ? 'on' : ''} onClick={toggle3d}>{is3d ? '3D' : '2D'}</button>
        <button type="button" className={orbiting ? 'on' : ''} onClick={toggleOrbit}>{orbiting ? 'Stop scouting' : 'Scope it out'}</button>
        <button type="button" onClick={findSpots}>Find dog spots</button>
      </div>
      <div className="mapLegend">
        {(Object.keys(KINDS) as SpotKind[]).map((kind) => <button key={kind} type="button" className={`mapChip ${kind} ${shown[kind] ? 'on' : ''}`} onClick={() => setShown({ ...shown, [kind]: !shown[kind] })}><span>{KINDS[kind].glyph}</span>{KINDS[kind].label}</button>)}
      </div>
      {status && <p className="mapStatus" role="status">{status}</p>}
    </div>
  );
}
