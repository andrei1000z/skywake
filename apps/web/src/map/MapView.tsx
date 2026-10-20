import type { FilterSpec } from '@skywake/shared';
import * as maplibregl from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef } from 'react';
import { type Airport, airportsGeoJson, loadAirports } from '../data/airports';
import { liveStore, positionAt } from '../data/liveStore';
import { AircraftLayer } from './aircraftLayer';
import type { ColorMode } from './colors';
import { LabelOverlay } from './labels';

// MapLibre resolves its worker relative to its own module, which bundling breaks; point it at the emitted asset.
maplibregl.setWorkerUrl(workerUrl);

/** OpenFreeMap: free vector tiles, no key; attribution to OpenFreeMap, OpenMapTiles and OSM is required and kept. */
const STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

export interface MapViewProps {
  dark: boolean;
  filter: FilterSpec;
  colorMode: ColorMode;
  labels: boolean;
  airports: boolean;
  trails: boolean;
  initial: { zoom: number; lat: number; lon: number };
  onReady: (map: MlMap) => void;
  onMove: (view: { zoom: number; lat: number; lon: number }) => void;
  onPickAircraft: (hex: string | null) => void;
  onPickAirport: (icao: string) => void;
  onVisibleCount: (n: number) => void;
  onError: (msg: string) => void;
}

export function MapView(props: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const layerRef = useRef<AircraftLayer | null>(null);
  const labelsRef = useRef<LabelOverlay | null>(null);
  const airportsRef = useRef<Airport[] | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const { initial } = propsRef.current;
    const map = new maplibregl.Map({
      container: el.current,
      style: props.dark ? STYLE.dark : STYLE.light,
      center: [initial.lon, initial.lat],
      zoom: initial.zoom,
      maxPitch: 70,
      // ADSB.lol data is ODbL: credit it visibly, next to the basemap credits.
      attributionControl: { compact: true, customAttribution: '<a href="https://adsb.lol" target="_blank" rel="noopener">Flight data ADSB.lol (ODbL)</a> · <a href="https://ourairports.com" target="_blank" rel="noopener">OurAirports</a>' },
      canvasContextAttributes: { antialias: false, powerPreference: 'high-performance' },
      fadeDuration: 0,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.on('error', (e: maplibregl.ErrorEvent) => {
      const msg = e.error?.message ?? 'map error';
      // Tile hiccups are routine; only surface failures to load the style itself.
      if (/style/i.test(msg)) propsRef.current.onError(msg);
    });

    const layer = new AircraftLayer(liveStore, { filter: props.filter, colorMode: props.colorMode, dark: props.dark });
    layerRef.current = layer;

    const addOverlays = () => {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
      if (!map.getSource('trail')) {
        map.addSource('trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer(
          {
            id: 'trail',
            type: 'line',
            source: 'trail',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2, 10, 3.5], 'line-opacity': 0.9 },
          },
          layer.id,
        );
      }
      if (airportsRef.current && !map.getSource('airports')) addAirportLayers(map, airportsRef.current, propsRef.current.dark);
      setAirportVisibility(map, propsRef.current.airports);
      updateTrail();
    };
    map.on('style.load', addOverlays);

    const labels = new LabelOverlay(map, liveStore, () => layer.visible);
    labels.enabled = props.labels;
    labels.dark = props.dark;
    labelsRef.current = labels;

    let disposed = false;
    loadAirports()
      .then((list) => {
        airportsRef.current = list;
        if (!disposed && map.isStyleLoaded() && !map.getSource('airports')) {
          addAirportLayers(map, list, propsRef.current.dark);
          setAirportVisibility(map, propsRef.current.airports);
        }
      })
      .catch(() => {
        /* airports are an enhancement; the map works without them */
      });

    const pushViewport = () => {
      const b = map.getBounds();
      // Pad the request area so panning reveals already-loaded traffic.
      const padLon = (b.getEast() - b.getWest()) * 0.1;
      const padLat = (b.getNorth() - b.getSouth()) * 0.1;
      liveStore.setViewport({ west: b.getWest() - padLon, east: b.getEast() + padLon, south: b.getSouth() - padLat, north: b.getNorth() + padLat });
      const c = map.getCenter();
      propsRef.current.onMove({ zoom: map.getZoom(), lat: c.lat, lon: c.wrap().lng });
    };
    map.on('moveend', pushViewport);
    map.once('load', () => {
      pushViewport();
      propsRef.current.onReady(map);
    });

    // Picking: nearest drawn aircraft within 22 px, else airports, else clear.
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      const hex = pickAircraft(map, layer.visible, e.point.x, e.point.y);
      if (hex) return propsRef.current.onPickAircraft(hex);
      if (map.getLayer('airports-dot')) {
        const f = map.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers: ['airports-dot', 'airports-label'] })[0];
        if (f?.properties?.icao) return propsRef.current.onPickAirport(String(f.properties.icao));
      }
      propsRef.current.onPickAircraft(null);
    });
    map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
      const hit = pickAircraft(map, layer.visible, e.point.x, e.point.y, 16);
      map.getCanvas().style.cursor = hit ? 'pointer' : '';
    });

    let lastCount = -1;
    function updateTrail() {
      const src = map.getSource('trail') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      const sel = liveStore.selected ? liveStore.aircraft.get(liveStore.selected) : undefined;
      if (!sel || !propsRef.current.trails || sel.trail.length < 2) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      for (let i = 1; i < sel.trail.length; i++) {
        const a = sel.trail[i - 1]!;
        const b = sel.trail[i]!;
        // Split segments at the antimeridian instead of drawing across the world.
        if (Math.abs(a[0] - b[0]) > 180) continue;
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[a[0], a[1]], [b[0], b[1]]] }, properties: { color: trailColor(b[2]) } });
      }
      src.setData({ type: 'FeatureCollection', features });
    }
    // Loaded cells reach past the screen edges; count only what is actually on screen.
    const countOnScreen = () => {
      const b = map.getBounds();
      const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
      const wide = e - w >= 360;
      let count = 0;
      for (const hex of layer.visible) {
        const ac = liveStore.aircraft.get(hex)?.ac;
        if (!ac || ac.lat < s || ac.lat > n) continue;
        if (wide || ((((ac.lon - w) % 360) + 360) % 360) <= e - w) count++;
      }
      if (count !== lastCount) {
        lastCount = count;
        propsRef.current.onVisibleCount(count);
      }
    };
    const unsub = liveStore.subscribe(() => {
      updateTrail();
      countOnScreen();
    });
    map.on('moveend', countOnScreen);

    return () => {
      disposed = true;
      unsub();
      labels.destroy();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme switch: swap basemap, keep overlays (re-added on style.load).
  const styleDark = useRef(props.dark);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleDark.current === props.dark) return;
    styleDark.current = props.dark;
    layerRef.current?.setOptions({ dark: props.dark });
    if (labelsRef.current) labelsRef.current.dark = props.dark;
    // setStyle drops our sources; the style.load handler re-adds them with the new theme colours.
    map.setStyle(props.dark ? STYLE.dark : STYLE.light);
  }, [props.dark]);

  useEffect(() => {
    layerRef.current?.setOptions({ filter: props.filter, colorMode: props.colorMode });
  }, [props.filter, props.colorMode]);

  useEffect(() => {
    if (labelsRef.current) labelsRef.current.enabled = props.labels;
    mapRef.current?.triggerRepaint();
  }, [props.labels]);

  // On mount the style.load handler applies this; only react to later toggles.
  const airportsMounted = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!airportsMounted.current) {
      airportsMounted.current = true;
      return;
    }
    if (map?.isStyleLoaded()) setAirportVisibility(map, props.airports);
  }, [props.airports]);

  return <div ref={el} className="map" role="application" aria-label="Live flight map" />;
}

function trailColor(alt: number | null): string {
  if (alt === null) return '#8a909c';
  // Same ramp as the icons, coarser.
  if (alt <= 0) return '#8a909c';
  if (alt < 6000) return '#e8a824';
  if (alt < 12000) return '#9ec43a';
  if (alt < 20000) return '#30b778';
  if (alt < 28000) return '#1aaab0';
  if (alt < 36000) return '#3480e6';
  return '#7a5ce8';
}

export function pickAircraft(map: MlMap, visible: string[], x: number, y: number, radius = 22): string | null {
  const nowS = performance.now() / 1000;
  let best: string | null = null;
  let bestD = radius * radius;
  const b = map.getBounds();
  for (const hex of visible) {
    const t = liveStore.aircraft.get(hex);
    if (!t) continue;
    if (t.ac.lat < b.getSouth() - 1 || t.ac.lat > b.getNorth() + 1) continue;
    const p = positionAt(t, nowS);
    const lng = p.x * 360 - 180;
    const lat = (360 / Math.PI) * Math.atan(Math.exp(Math.PI - p.y * 2 * Math.PI)) - 90;
    const s = map.project([lng, lat]);
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = hex;
    }
  }
  return best;
}

function addAirportLayers(map: MlMap, list: Airport[], dark: boolean) {
  map.addSource('airports', { type: 'geojson', data: airportsGeoJson(list) });
  const before = map.getLayer('trail') ? 'trail' : undefined;
  const filterByZoom: maplibregl.FilterSpecification = [
    'any',
    ['==', ['get', 'rank'], 3],
    ['all', ['==', ['get', 'rank'], 2], ['>=', ['zoom'], 6.5]],
    ['>=', ['zoom'], 8.5],
  ];
  map.addLayer(
    {
      id: 'airports-dot',
      type: 'circle',
      source: 'airports',
      minzoom: 3.5,
      filter: filterByZoom,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, ['match', ['get', 'rank'], 3, 2.5, 1.5], 10, ['match', ['get', 'rank'], 3, 6, 4]],
        'circle-color': dark ? '#0d1420' : '#ffffff',
        'circle-stroke-color': dark ? '#9fb3cc' : '#4a5568',
        'circle-stroke-width': 1.5,
      },
    },
    before,
  );
  map.addLayer(
    {
      id: 'airports-label',
      type: 'symbol',
      source: 'airports',
      minzoom: 5,
      filter: filterByZoom,
      layout: {
        'text-field': ['get', 'code'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11,
        'text-offset': [0, 0.9],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': dark ? '#c4d0e0' : '#2d3748',
        'text-halo-color': dark ? '#0d1420' : '#ffffff',
        'text-halo-width': 1.2,
      },
    },
    before,
  );
}

function setAirportVisibility(map: MlMap, on: boolean) {
  for (const id of ['airports-dot', 'airports-label']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  }
}
