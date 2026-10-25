"use client";

import { createRoot, type Root } from 'react-dom/client';
import { MascotWalker } from './mascot';
import { StatusScreen } from './status-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';

/**
 * Free 3D walk map: MapLibre + OpenFreeMap vector tiles (3D buildings) + AWS open
 * terrain tiles. Dog-friendly places come from OpenStreetMap via Overpass, and
 * search uses Photon (OSM). No API keys and no Google quota.
 */
export type MapPoint = { lat: number; lng: number; label?: string };
/** A labelled pin drawn on the map (scan history, saved places, meetups...). */
export type MapPin = { lat: number; lng: number; label: string; tone?: 'brand' | 'blue' | 'red' | 'gold' | 'violet'; glyph?: string };
type SpotKind = 'park' | 'water' | 'vet' | 'shop' | 'bin' | 'other';
/** Kinds owners can pick for a shared community place (community_places.kind). */
type PlaceKind = 'vet' | 'dog_park' | 'pet_shop' | 'waste_bin' | 'water' | 'groomer' | 'trail' | 'emergency_vet' | 'other';
type CommunityInfo = { placeId: string; placeKind: PlaceKind; note: string | null; createdBy: string | null };
type Spot = { id: string; kind: SpotKind; lat: number; lng: number; name: string; community?: CommunityInfo };
type PlaceRow = { id: string; kind: PlaceKind; name: string; note: string | null; lat: number | string; lng: number | string; created_by: string | null };
type SearchResult = { name: string; lng: number; lat: number; community?: string };

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
  other: { label: 'Other', color: '#e9e4d4', glyph: '📍' },
};

const PLACE_KINDS: Record<PlaceKind, { label: string; spot: SpotKind }> = {
  dog_park: { label: 'Dog park', spot: 'park' },
  trail: { label: 'Trail', spot: 'park' },
  water: { label: 'Water', spot: 'water' },
  vet: { label: 'Vet', spot: 'vet' },
  emergency_vet: { label: 'Emergency vet', spot: 'vet' },
  pet_shop: { label: 'Pet shop', spot: 'shop' },
  groomer: { label: 'Groomer', spot: 'shop' },
  waste_bin: { label: 'Waste bin', spot: 'bin' },
  other: { label: 'Other', spot: 'other' },
};
const PLACE_COLUMNS = 'id, kind, name, note, lat, lng, created_by';
const COMMUNITY_MISSING = 'Community places switch on after the latest database update.';
const REPORT_REASONS = ['Wrong location', 'Closed or gone', 'Spam or offensive', 'Something else'];
const COMMUNITY_DOT = 'linear-gradient(135deg, #87e06f, #57d7ff)';

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /schema cache|does not exist/i.test(error.message || '');
}
function isRlsError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === '42501' || /row-level security|permission denied|violates/i.test(error.message || '');
}
function rowToSpot(row: PlaceRow): Spot | null {
  const lat = Number(row.lat); const lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const placeKind: PlaceKind = row.kind in PLACE_KINDS ? row.kind : 'other';
  return { id: `community:${row.id}`, kind: PLACE_KINDS[placeKind].spot, lat, lng, name: row.name, community: { placeId: row.id, placeKind, note: row.note, createdBy: row.created_by } };
}

/** The small gradient dot that marks a pin as added by the community. */
function communityDot() {
  const dot = document.createElement('span');
  dot.setAttribute('aria-hidden', 'true');
  Object.assign(dot.style, {
    position: 'absolute', top: '-4px', right: '-4px', width: '11px', height: '11px', borderRadius: '50%',
    background: COMMUNITY_DOT, border: '2px solid #071008', pointerEvents: 'none', zIndex: '1',
  } as Partial<CSSStyleDeclaration>);
  return dot;
}

/** Spot pin element; community places get an outline ring plus the community dot. */
function spotElement(kind: SpotKind, label: string, community: boolean) {
  const el = document.createElement('div');
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = `mapSpot ${kind}`;
  pin.innerHTML = `<span>${KINDS[kind].glyph}</span>`;
  pin.setAttribute('aria-label', label);
  if (kind === 'other') pin.style.background = KINDS.other.color;
  if (community) pin.style.boxShadow = `0 0 0 2px #071008, 0 0 0 4px ${KINDS[kind].color}, 0 6px 14px rgba(0,0,0,.4)`;
  el.appendChild(pin);
  if (community) el.appendChild(communityDot());
  return el;
}

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

/** [lng, lat] pair, the GeoJSON order. */
export type LngLat = [number, number];
/**
 * A planned or saved route drawn as a solid line. `path` is the full line; when `vertices`
 * is given (e.g. the waypoints of a path-snapped route) the draggable markers sit on those
 * instead of on every point of `path`.
 */
export type MapRoute = { path: LngLat[]; loop?: boolean; color?: string; vertices?: LngLat[] };

export type WalkMap3DProps = {
  start?: MapPoint;
  current?: MapPoint;
  /** While walking, the "you are here" marker is the little MyPetID dog trotting along. */
  walker?: boolean;
  end?: MapPoint;
  pins?: MapPin[];
  height?: number;
  /** Fires when the map itself is tapped (not a marker). While set, the cursor is a crosshair. */
  onMapClick?: (p: { lat: number; lng: number }) => void;
  route?: MapRoute | null;
  /** Shows small numbered, draggable markers on the route's vertices. */
  editableRoute?: boolean;
  /** Called after a vertex is dragged, with the edited vertex list (route.vertices if given, else route.path). */
  onRouteChange?: (path: LngLat[]) => void;
  /**
   * What to frame. Left out: the old behaviour (the map frames `pins` whenever they change).
   * 'route' / 'pins': frame that when it changes. null: never auto-frame.
   */
  fitTo?: 'route' | 'pins' | null;
  /** Fly the camera to a point; pass a new object (e.g. with a fresh `key`) to fly again. */
  flyTo?: { lat: number; lng: number; zoom?: number; key?: number } | null;
  /**
   * Puts the map into "Add a place" mode (share a community place). While active it takes
   * precedence over onMapClick. The parent should set it back to false in onAddPlaceDone.
   */
  addPlaceMode?: boolean;
  /** Fires when Add-a-place mode ends (saved or cancelled). */
  onAddPlaceDone?: () => void;
};

const ROUTE_COLOR = '#57d7ff';

function vertexElement(index: number, color: string) {
  const el = document.createElement('div');
  const dot = document.createElement('div');
  dot.textContent = String(index + 1);
  dot.setAttribute('aria-label', `Point ${index + 1}, drag to move`);
  Object.assign(dot.style, {
    width: '24px', height: '24px', borderRadius: '50%', display: 'grid', placeItems: 'center',
    font: '800 11px/1 system-ui, sans-serif', cursor: 'grab', touchAction: 'none', userSelect: 'none',
    border: `2px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,.45)',
    background: index === 0 ? color : '#0d1510', color: index === 0 ? '#071008' : '#fff',
  } as Partial<CSSStyleDeclaration>);
  el.appendChild(dot);
  el.addEventListener('click', (event) => event.stopPropagation());
  return el;
}

function closedPath(path: LngLat[], loop?: boolean): LngLat[] {
  if (!loop || path.length < 3) return path;
  const [a, b] = [path[0], path[path.length - 1]];
  return a[0] === b[0] && a[1] === b[1] ? path : [...path, a];
}

export function WalkMap3D({ start, current, end, walker, pins, height = 420, onMapClick, route, editableRoute, onRouteChange, fitTo, flyTo, addPlaceMode, onAddPlaceDone }: WalkMap3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const meRef = useRef<Marker | null>(null);
  const meIsDogRef = useRef(false);
  const dogRootRef = useRef<Root | null>(null);
  const lastHereRef = useRef<{ lat: number; lng: number } | null>(null);
  const facingRef = useRef<'left' | 'right'>('right');
  const movedAtRef = useRef(0);
  const pinRefs = useRef<Marker[]>([]);
  const vertexRefs = useRef<Marker[]>([]);
  const onMapClickRef = useRef(onMapClick);
  const onRouteChangeRef = useRef(onRouteChange);
  const orbitRef = useRef<number | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const [ready, setReady] = useState(false);
  const [mapDown, setMapDown] = useState(false);
  const [is3d, setIs3d] = useState(true);
  const [orbiting, setOrbiting] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [community, setCommunity] = useState<Spot[]>([]);
  const [communityMissing, setCommunityMissing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<SpotKind, boolean>>({ park: true, water: true, vet: true, shop: true, bin: true, other: true });
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  // Add-a-place mode: from the toolbar button, or switched on by the parent via addPlaceMode
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [placeKind, setPlaceKind] = useState<PlaceKind>('dog_park');
  const [placeName, setPlaceName] = useState('');
  const [placeNote, setPlaceNote] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const addActive = adding || Boolean(addPlaceMode);
  const [prevPropMode, setPrevPropMode] = useState(addPlaceMode);
  if (prevPropMode !== addPlaceMode) { setPrevPropMode(addPlaceMode); setAddDraft(null); setAddMsg(''); }
  const addActiveRef = useRef(addActive);
  const onAddPlaceDoneRef = useRef(onAddPlaceDone);
  useEffect(() => {
    onMapClickRef.current = onMapClick; onRouteChangeRef.current = onRouteChange;
    addActiveRef.current = addActive; onAddPlaceDoneRef.current = onAddPlaceDone;
  });

  // Who is signed in (only used to offer "Remove" on places you added)
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => { if (alive) setUserId(data.session?.user.id ?? null); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setUserId(session?.user.id ?? null); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

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
        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ROUTE_COLOR, 'line-width': 13, 'line-opacity': 0.25, 'line-blur': 6 } });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ROUTE_COLOR, 'line-width': 5 } });
        setReady(true);
      });
      // If the base style or tiles can't load, show the maps status screen instead of a blank box.
      let tileErrors = 0;
      const loadTimer = window.setTimeout(() => { if (!map.loaded()) setMapDown(true); }, 15000);
      map.on('load', () => { window.clearTimeout(loadTimer); setMapDown(false); });
      map.on('error', (event) => {
        const status = (event.error as { status?: number } | undefined)?.status;
        if (!map.loaded() || (status && status >= 500) || ++tileErrors > 12) setMapDown(true);
      });
      map.on('click', (event) => {
        const target = event.originalEvent?.target as HTMLElement | null;
        if (target?.closest?.('.maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl')) return;
        const point = { lat: event.lngLat.lat, lng: event.lngLat.lng };
        // Add-a-place mode wins over the parent's own map taps while it is active.
        if (addActiveRef.current) { setAddDraft(point); setAddMsg(''); return; }
        onMapClickRef.current?.(point);
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
      const asDog = Boolean(walker && current);
      if (meRef.current && meIsDogRef.current !== asDog) { meRef.current.remove(); meRef.current = null; dogRootRef.current?.unmount(); dogRootRef.current = null; }
      if (!meRef.current) {
        const el = document.createElement('div');
        el.className = asDog ? 'mapDog' : 'mapMe';
        if (asDog) dogRootRef.current = createRoot(el);
        meRef.current = new lib.Marker({ element: el, anchor: asDog ? 'bottom' : 'center' }).setLngLat([here.lng, here.lat]).addTo(map);
        meIsDogRef.current = asDog;
      } else meRef.current.setLngLat([here.lng, here.lat]);
      if (asDog && dogRootRef.current) {
        // Face the way we're going, but only after clear travel: GPS wobble while standing
        // still must not spin the dog around.
        const anchor = lastHereRef.current;
        const now = Date.now();
        if (!anchor) lastHereRef.current = { lat: here.lat, lng: here.lng };
        else {
          const dy = (here.lat - anchor.lat) * 111_320;
          const dx = (here.lng - anchor.lng) * 111_320 * Math.cos(here.lat * Math.PI / 180);
          if (Math.hypot(dx, dy) >= 5) {
            if (dx > 2) facingRef.current = 'right';
            else if (dx < -2) facingRef.current = 'left';
            lastHereRef.current = { lat: here.lat, lng: here.lng };
            movedAtRef.current = now;
          }
        }
        const moving = now - movedAtRef.current < 6000;
        dogRootRef.current.render(<MascotWalker size={64} walking={moving} facing={facingRef.current} />);
        if (!moving) window.setTimeout(() => dogRootRef.current?.render(<MascotWalker size={64} walking={Date.now() - movedAtRef.current < 6000} facing={facingRef.current} />), 6500);
      }
      if (!asDog) lastHereRef.current = { lat: here.lat, lng: here.lng };
      map.easeTo({ center: [here.lng, here.lat], duration: 800 });
    }
  }, [ready, start, current, end, walker]);

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
    // Without a fitTo prop the map frames the pins as it always did; fitTo picks (or turns off) framing.
    if (fitTo !== undefined && fitTo !== 'pins') return;
    if (pins && pins.length > 1) {
      const lngs = pins.map((p) => p.lng); const lats = pins.map((p) => p.lat);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 70, maxZoom: 16.5, pitch: 55, duration: 1200 });
    } else if (pins && pins.length === 1) map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: 16, duration: 900 });
  }, [ready, pins, fitTo]);

  // Crosshair while the page wants map taps (adding route points, dropping a pin)
  const wantsClicks = Boolean(onMapClick) || addActive;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getCanvas().style.cursor = wantsClicks ? 'crosshair' : '';
  }, [ready, wantsClicks]);

  // Planned / saved route line, plus numbered draggable vertices when editable
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const color = route?.color || ROUTE_COLOR;
    const source = map.getSource('route') as GeoJSONSource | undefined;
    const draw = (path: LngLat[]) => source?.setData({ type: 'FeatureCollection', features: path.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: closedPath(path, route?.loop) } }] : [] });
    draw(route?.path || []);
    map.setPaintProperty('route-line', 'line-color', color);
    map.setPaintProperty('route-glow', 'line-color', color);
    vertexRefs.current.forEach((m) => m.remove());
    vertexRefs.current = [];
    if (!route || !editableRoute) return;
    const vertices = route.vertices || route.path;
    const live = vertices.map((v) => [v[0], v[1]] as LngLat);
    vertexRefs.current = vertices.map((v, index) => {
      const marker = new lib.Marker({ element: vertexElement(index, color), draggable: true }).setLngLat(v).addTo(map);
      marker.on('drag', () => {
        const p = marker.getLngLat();
        live[index] = [p.lng, p.lat];
        if (!route.vertices) draw(live);
      });
      marker.on('dragend', () => onRouteChangeRef.current?.(live.map((x) => [x[0], x[1]] as LngLat)));
      return marker;
    });
  }, [ready, route, editableRoute]);

  // Frame the route when asked
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || fitTo !== 'route' || !route || route.path.length === 0) return;
    if (route.path.length === 1) { map.easeTo({ center: route.path[0], zoom: 16, duration: 900 }); return; }
    const lngs = route.path.map((p) => p[0]); const lats = route.path.map((p) => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 17, duration: 1200 });
  }, [ready, route, fitTo]);

  // Fly to a point on request
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !flyTo) return;
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 16.5, duration: 1600, essential: true });
  }, [ready, flyTo]);

  // Popup actions for community places; kept in a ref so the markers never hold stale closures.
  const placeActionsRef = useRef<{ report: (placeId: string, reason: string) => Promise<string>; remove: (placeId: string) => Promise<string> } | null>(null);
  useEffect(() => {
    placeActionsRef.current = {
      async report(placeId, reason) {
        if (!supabase) return 'Sign in to report places.';
        const { data } = await supabase.auth.getSession();
        if (!data.session) return 'Sign in to report places.';
        const { error } = await supabase.from('community_place_reports').insert({ place_id: placeId, reason });
        if (!error) return 'Thanks for the report. We will take a look.';
        if (error.code === '23505') return 'You already reported this place. Thanks!';
        if (isMissingTable(error)) return COMMUNITY_MISSING;
        if (isRlsError(error)) return 'Verify your email to report places.';
        return 'Could not send that report. Please try again.';
      },
      async remove(placeId) {
        if (!supabase) return 'Sign in to remove places.';
        const { error } = await supabase.from('community_places').delete().eq('id', placeId);
        if (error) return isRlsError(error) ? 'Only the person who added this place can remove it.' : 'Could not remove that place. Please try again.';
        setCommunity((list) => list.filter((s) => s.community?.placeId !== placeId));
        setStatus('Place removed.');
        return 'Removed.';
      },
    };
  });

  // Draw dog-friendly spots (OpenStreetMap + community places) as markers
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [...spots, ...community].filter((spot) => shown[spot.kind]).map((spot) => {
      // MapLibre positions the outer element with an inline transform, so the animated pin goes inside it.
      const info = spot.community;
      const label = info ? `Community place, ${PLACE_KINDS[info.placeKind].label}: ${spot.name}` : `${KINDS[spot.kind].label}: ${spot.name}`;
      const el = spotElement(spot.kind, label, Boolean(info));
      const popup = new lib.Popup({ offset: 18, closeButton: false, maxWidth: '260px' });
      if (info) popup.setDOMContent(communityPopup(spot, info, info.createdBy !== null && info.createdBy === userId));
      else popup.setHTML(`<strong>${spot.name.replace(/[<>&]/g, '')}</strong><br><small>${KINDS[spot.kind].label}</small>`);
      return new lib.Marker({ element: el, anchor: 'bottom' }).setLngLat([spot.lng, spot.lat]).setPopup(popup).addTo(map);
    });
    // communityPopup only reads refs and its arguments, so it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, community, shown, userId]);

  function communityPopup(spot: Spot, info: CommunityInfo, own: boolean) {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { display: 'grid', gap: '6px', maxWidth: '240px' } as Partial<CSSStyleDeclaration>);
    const title = document.createElement('strong');
    title.textContent = spot.name;
    const kind = document.createElement('small');
    kind.textContent = `${PLACE_KINDS[info.placeKind].label} · Community`;
    kind.style.color = KINDS[spot.kind].color;
    wrap.append(title, kind);
    if (info.note) {
      const note = document.createElement('span');
      note.textContent = info.note;
      Object.assign(note.style, { fontSize: '.86rem', lineHeight: '1.35', overflowWrap: 'anywhere' } as Partial<CSSStyleDeclaration>);
      wrap.appendChild(note);
    }
    const by = document.createElement('small');
    by.textContent = 'Added by the MyPetID community';
    by.style.opacity = '.7';
    wrap.appendChild(by);

    const buttonStyle = { padding: '6px 11px', fontSize: '.8rem' } as Partial<CSSStyleDeclaration>;
    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' } as Partial<CSSStyleDeclaration>);
    const directions = document.createElement('a');
    directions.href = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=%3B${spot.lat.toFixed(6)}%2C${spot.lng.toFixed(6)}`;
    directions.target = '_blank';
    directions.rel = 'noopener noreferrer';
    directions.textContent = 'Directions';
    Object.assign(directions.style, { fontWeight: '700', fontSize: '.84rem', color: 'var(--brand)' } as Partial<CSSStyleDeclaration>);
    const report = document.createElement('button');
    report.type = 'button';
    report.textContent = 'Report';
    Object.assign(report.style, buttonStyle);
    actions.append(directions, report);
    const msg = document.createElement('small');
    msg.setAttribute('role', 'status');

    report.addEventListener('click', () => {
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Why are you reporting this place?');
      Object.assign(select.style, { padding: '6px 8px', fontSize: '.82rem', width: '100%' } as Partial<CSSStyleDeclaration>);
      REPORT_REASONS.forEach((reason) => { const option = document.createElement('option'); option.value = reason; option.textContent = reason; select.appendChild(option); });
      const send = document.createElement('button');
      send.type = 'button';
      send.className = 'primary';
      send.textContent = 'Send report';
      Object.assign(send.style, buttonStyle);
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      Object.assign(cancel.style, buttonStyle);
      const form = document.createElement('div');
      Object.assign(form.style, { display: 'grid', gap: '6px' } as Partial<CSSStyleDeclaration>);
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', gap: '6px' } as Partial<CSSStyleDeclaration>);
      row.append(send, cancel);
      form.append(select, row);
      actions.replaceWith(form);
      cancel.addEventListener('click', () => { form.replaceWith(actions); msg.textContent = ''; });
      send.addEventListener('click', async () => {
        send.disabled = true;
        msg.textContent = 'Sending…';
        const text = await placeActionsRef.current?.report(info.placeId, select.value) ?? '';
        msg.textContent = text;
        form.replaceWith(actions);
        report.disabled = /Thanks/.test(text);
      });
    });

    if (own) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      Object.assign(remove.style, { ...buttonStyle, color: 'var(--danger)' });
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        msg.textContent = await placeActionsRef.current?.remove(info.placeId) ?? '';
        remove.disabled = false;
      });
      actions.appendChild(remove);
    }
    wrap.append(actions, msg);
    return wrap;
  }

  // Community places (shared by verified owners) inside the current view
  const loadCommunity = useCallback(async (): Promise<Spot[]> => {
    const map = mapRef.current;
    if (!map || !supabase) return [];
    const b = map.getBounds();
    const { data, error } = await supabase.from('community_places').select(PLACE_COLUMNS).eq('status', 'visible')
      .gte('lat', b.getSouth()).lte('lat', b.getNorth()).gte('lng', b.getWest()).lte('lng', b.getEast()).limit(300);
    if (error) {
      if (isMissingTable(error)) setCommunityMissing(true);
      return []; // community places are an extra; never block the map on them
    }
    const list = ((data || []) as PlaceRow[]).map(rowToSpot).filter(Boolean) as Spot[];
    setCommunityMissing(false);
    setCommunity(list);
    return list;
  }, []);

  // Once after the map first settles, show community places in view
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const run = () => { void loadCommunity(); };
    map.once('idle', run);
    return () => { map.off('idle', run); };
  }, [ready, loadCommunity]);

  // Temporary pin where the new community place will go
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib || !addActive || !addDraft) return;
    const spotKind = PLACE_KINDS[placeKind].spot;
    const marker = new lib.Marker({ element: spotElement(spotKind, 'New place', true), anchor: 'bottom' }).setLngLat([addDraft.lng, addDraft.lat]).addTo(map);
    return () => { marker.remove(); };
  }, [ready, addActive, addDraft, placeKind]);

  function finishAdding() {
    setAdding(false);
    setAddDraft(null);
    setAddMsg('');
    setPlaceName('');
    setPlaceNote('');
    onAddPlaceDoneRef.current?.();
  }

  async function startAdding() {
    if (addActive) { finishAdding(); return; }
    if (communityMissing) { setStatus(COMMUNITY_MISSING); return; }
    if (!supabase) { setStatus('Sign in to add places.'); return; }
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setStatus('Sign in to add places.'); return; }
    setResults([]);
    setAddDraft(null);
    setAddMsg('');
    setAdding(true);
  }

  async function savePlace(event: React.FormEvent) {
    event.preventDefault();
    if (!addDraft || saving) return;
    const name = placeName.trim();
    if (name.length < 2) { setAddMsg('Give the place a name (at least 2 letters).'); return; }
    if (communityMissing) { setAddMsg(COMMUNITY_MISSING); return; }
    if (!supabase) { setAddMsg('Sign in to add places.'); return; }
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setSaving(false); setAddMsg('Sign in to add places.'); return; }
    const { data, error } = await supabase.from('community_places')
      .insert({ kind: placeKind, name: name.slice(0, 80), note: placeNote.trim().slice(0, 300) || null, lat: addDraft.lat, lng: addDraft.lng })
      .select(PLACE_COLUMNS).single();
    setSaving(false);
    if (error) {
      if (isMissingTable(error)) { setCommunityMissing(true); setAddMsg(COMMUNITY_MISSING); return; }
      setAddMsg(isRlsError(error) ? 'Verify your email to add places for everyone.' : 'Could not save that place. Please try again.');
      return;
    }
    const spot = data ? rowToSpot(data as PlaceRow) : null;
    if (spot) {
      setCommunity((list) => [spot, ...list.filter((s) => s.id !== spot.id)]);
      setShown((current) => ({ ...current, [spot.kind]: true }));
    }
    setStatus(`Added "${name}" for everyone. Thanks for sharing!`);
    finishAdding();
  }

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
    const communityPromise = loadCommunity();
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
    const shared = await communityPromise;
    const sharedNote = shared.length ? ` Plus ${shared.length} community ${shared.length === 1 ? 'place' : 'places'}.` : '';
    setStatus(merged.length ? `Found ${summarize(merged)} in view.${sharedNote}` : shared.length ? `Found ${shared.length} community ${shared.length === 1 ? 'place' : 'places'} in view.` : 'No mapped dog spots here yet. OpenStreetMap volunteers add more all the time.');
  }, [spotsFromTiles, loadCommunity]);

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
    const q = query.trim();
    if (!q) return;
    // Community places in the current area come first, labelled "Community".
    const shared = await searchCommunity(q);
    try {
      const center = mapRef.current?.getCenter();
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5${center ? `&lat=${center.lat}&lon=${center.lng}` : ''}`);
      const json = await response.json() as { features: { geometry: { coordinates: [number, number] }; properties: { name?: string; city?: string; state?: string } }[] };
      setResults([...shared, ...json.features.map((f) => ({ name: [f.properties.name, f.properties.city, f.properties.state].filter(Boolean).join(', '), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))]);
    } catch {
      setResults(shared);
      setStatus('Search is unavailable right now.');
    }
  }
  async function searchCommunity(q: string): Promise<SearchResult[]> {
    const needle = q.toLowerCase();
    const toResult = (s: Spot): SearchResult => ({ name: s.name, lat: s.lat, lng: s.lng, community: s.community ? PLACE_KINDS[s.community.placeKind].label : 'Community' });
    const local = community.filter((s) => s.name.toLowerCase().includes(needle));
    const map = mapRef.current;
    if (!supabase || communityMissing || !map) return local.slice(0, 5).map(toResult);
    const b = map.getBounds();
    const { data, error } = await supabase.from('community_places').select(PLACE_COLUMNS).eq('status', 'visible')
      .ilike('name', `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
      .gte('lat', b.getSouth()).lte('lat', b.getNorth()).gte('lng', b.getWest()).lte('lng', b.getEast()).limit(5);
    if (error) { if (isMissingTable(error)) setCommunityMissing(true); return local.slice(0, 5).map(toResult); }
    const remote = ((data || []) as PlaceRow[]).map(rowToSpot).filter(Boolean) as Spot[];
    const all = [...remote, ...local.filter((s) => !remote.some((r) => r.id === s.id))];
    return all.slice(0, 5).map(toResult);
  }
  function goTo(result: SearchResult) {
    setResults([]);
    setQuery(result.name);
    mapRef.current?.flyTo({ center: [result.lng, result.lat], zoom: result.community ? 17 : 15.5, pitch: is3d ? 60 : 0, duration: 2200, essential: true });
    window.setTimeout(findSpots, 2400);
  }

  return (
    <div className="map3d">
      <div style={{ position: 'relative' }}>
        <div className="map3dCanvas" ref={containerRef} style={{ height }} />
        {mapDown && <div className="mapStatus"><StatusScreen kind="maps" compact actions={[{ label: 'Try again', onClick: () => window.location.reload(), primary: true }, { label: 'Hide', onClick: () => setMapDown(false) }]} /></div>}
        {addActive && (
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 3, maxWidth: 380, marginInline: 'auto', display: 'grid', gap: 8, padding: 12, borderRadius: 16, background: 'var(--glass)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid var(--line-strong)', boxShadow: 'var(--shadow-lg)' }}>
            {!addDraft ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '.92rem' }} role="status">Tap the map where the place is</strong>
                <button type="button" onClick={finishAdding} style={{ padding: '7px 12px', fontSize: '.84rem' }}>Cancel</button>
                {(addMsg || communityMissing) && <small style={{ flexBasis: '100%', color: 'var(--muted)' }}>{addMsg || COMMUNITY_MISSING}</small>}
              </div>
            ) : (
              <form onSubmit={savePlace} style={{ display: 'grid', gap: 8 }}>
                <strong style={{ fontSize: '.92rem' }}>Share a place with everyone</strong>
                <select value={placeKind} onChange={(e) => setPlaceKind(e.target.value as PlaceKind)} aria-label="Kind of place">
                  {(Object.keys(PLACE_KINDS) as PlaceKind[]).map((kind) => <option key={kind} value={kind}>{PLACE_KINDS[kind].label}</option>)}
                </select>
                <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Name (e.g. Riverside dog run)" aria-label="Place name" minLength={2} maxLength={80} required autoFocus />
                <input value={placeNote} onChange={(e) => setPlaceNote(e.target.value)} placeholder="Note (optional)" aria-label="Place note" maxLength={300} />
                {addMsg && <small role="status" style={{ color: 'var(--muted)' }}>{addMsg}</small>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  <button type="button" onClick={finishAdding}>Cancel</button>
                  <small style={{ color: 'var(--muted)' }}>Tap the map to move it.</small>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
      <form className="mapSearch" onSubmit={search}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a park, trail or town" aria-label="Search places" />
        <button type="submit" className="primary">Go</button>
        {results.length > 0 && <ul className="mapResults">{results.map((r) => (
          <li key={`${r.community ? 'c' : 'p'}${r.lng},${r.lat}`}>
            <button type="button" onClick={() => goTo(r)}>
              {r.name}
              {r.community && <span style={{ marginLeft: 'auto', paddingLeft: 8, flexShrink: 0, fontSize: '.72rem', fontWeight: 800, color: 'var(--brand)' }}>Community · {r.community}</span>}
            </button>
          </li>
        ))}</ul>}
      </form>
      <div className="mapToolbar">
        <button type="button" className={is3d ? 'on' : ''} onClick={toggle3d}>{is3d ? '3D' : '2D'}</button>
        <button type="button" className={orbiting ? 'on' : ''} onClick={toggleOrbit}>{orbiting ? 'Stop scouting' : 'Scope it out'}</button>
        <button type="button" onClick={findSpots}>Find dog spots</button>
        <button type="button" className={addActive ? 'on' : ''} aria-pressed={addActive} onClick={() => { void startAdding(); }}>{addActive ? 'Cancel adding' : 'Add a place'}</button>
      </div>
      <div className="mapLegend">
        {(Object.keys(KINDS) as SpotKind[]).map((kind) => <button key={kind} type="button" className={`mapChip ${kind} ${shown[kind] ? 'on' : ''}`} style={kind === 'other' ? { color: KINDS.other.color } : undefined} onClick={() => setShown({ ...shown, [kind]: !shown[kind] })}><span>{KINDS[kind].glyph}</span>{KINDS[kind].label}</button>)}
        {community.length > 0 && <span className="mapChip on" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 1, cursor: 'default', color: 'var(--muted)', borderColor: 'transparent' }}><i aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: COMMUNITY_DOT }} />Community</span>}
      </div>
      {status && <p className="mapStatus" role="status">{status}</p>}
    </div>
  );
}
