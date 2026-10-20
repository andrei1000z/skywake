import { type Aircraft, isFilterActive } from '@skywake/shared';
import type { Map as MlMap } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Airport } from './data/airports';
import { liveStore, positionAt } from './data/liveStore';
import { t, useLang } from './lib/i18n';
import { usePrefs } from './lib/prefs';
import { buildHash, parseHash } from './lib/urlState';
import { MapView } from './map/MapView';
import { AboutPanel } from './ui/AboutPanel';
import { AircraftPanel } from './ui/AircraftPanel';
import { AirportPanel } from './ui/AirportPanel';
import { type Toast, AlertEngine } from './ui/alerts';
import { FilterPanel } from './ui/FilterPanel';
import { useMediaQuery } from './ui/hooks';
import { IconFilter, IconInfo, IconLayers, IconList, IconLocate, Logo } from './ui/Icons';
import { ListPanel } from './ui/ListPanel';
import { MapPanel } from './ui/MapPanel';
import { Search } from './ui/Search';
import { Banner, StatusBar } from './ui/StatusBar';
import { onNativeBack, setupNativeChrome } from './native';

type PanelState =
  | { kind: 'aircraft'; hex: string }
  | { kind: 'airport'; icao: string }
  | { kind: 'filters' | 'map' | 'about' | 'list' }
  | null;

const DEFAULT_VIEW = { zoom: 6.2, lat: 47.5, lon: 14.5 };

function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function App() {
  useLang();
  const prefs = usePrefs();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const dark = prefs.theme === 'dark' || (prefs.theme === 'auto' && systemDark);
  const initialHash = useMemo(() => parseHash(location.hash), []);
  const initialView = useMemo(
    () => (initialHash.zoom !== undefined ? { zoom: initialHash.zoom, lat: initialHash.lat!, lon: initialHash.lon! } : DEFAULT_VIEW),
    [initialHash],
  );
  const [panel, setPanel] = useState<PanelState>(
    initialHash.ac ? { kind: 'aircraft', hex: initialHash.ac } : initialHash.ap ? { kind: 'airport', icao: initialHash.ap } : null,
  );
  const [followWanted, setFollowing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notif, setNotif] = useState<NotificationPermission | 'unsupported'>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const mapRef = useRef<MlMap | null>(null);
  const viewRef = useRef(initialView);
  const webgl = useMemo(() => hasWebGL2(), []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    void setupNativeChrome(dark);
  }, [dark]);

  useEffect(() => {
    liveStore.start();
    if (initialHash.ac) liveStore.select(initialHash.ac);
    const engine = new AlertEngine((toast) => {
      setToasts((ts) => [...ts.slice(-2), toast]);
      setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== toast.id)), 9000);
    });
    engine.start();
    return () => {
      liveStore.stop();
      engine.stop();
    };
  }, [initialHash.ac]);

  const selectedHex = panel?.kind === 'aircraft' ? panel.hex : null;
  const following = followWanted && !!selectedHex;
  useEffect(() => {
    liveStore.select(selectedHex);
  }, [selectedHex]);

  const writeHash = useCallback(() => {
    const v = viewRef.current;
    const hash = buildHash({ ...v, ac: panel?.kind === 'aircraft' ? panel.hex : undefined, ap: panel?.kind === 'airport' ? panel.icao : undefined });
    history.replaceState(null, '', hash || location.pathname + location.search);
  }, [panel]);
  useEffect(writeHash, [writeHash]);

  // Follow mode: keep the selected aircraft centred, gliding with it.
  useEffect(() => {
    if (!following || !selectedHex) return;
    const tick = () => {
      const tr = liveStore.aircraft.get(selectedHex);
      const map = mapRef.current;
      if (!tr || !map) return;
      const p = positionAt(tr, performance.now() / 1000 + 1);
      const lng = p.x * 360 - 180;
      const lat = (360 / Math.PI) * Math.atan(Math.exp(Math.PI - p.y * 2 * Math.PI)) - 90;
      map.easeTo({ center: [lng, lat], duration: 1000, easing: (x) => x, essential: true });
    };
    tick();
    const i = setInterval(tick, 1000);
    const stop = () => setFollowing(false);
    mapRef.current?.on('dragstart', stop);
    return () => {
      clearInterval(i);
      mapRef.current?.off('dragstart', stop);
    };
  }, [following, selectedHex]);

  const closePanel = useCallback(() => {
    setPanel(null);
    setFollowing(false);
  }, []);

  // Android back button closes the open panel first, then leaves the app.
  useEffect(() => onNativeBack(() => {
    if (panel) {
      setPanel(null);
      return true;
    }
    return false;
  }), [panel]);

  const pickAircraft = useCallback((hex: string | null) => {
    setPanel(hex ? { kind: 'aircraft', hex } : null);
    setFollowing(false);
  }, []);
  const pickAirport = useCallback((icao: string) => setPanel({ kind: 'airport', icao }), []);

  const flyTo = (lon: number, lat: number, zoom?: number) => {
    mapRef.current?.flyTo({ center: [lon, lat], zoom: zoom ?? Math.max(mapRef.current.getZoom(), 8), essential: true });
  };

  const onSearchAircraft = (ac: Aircraft) => {
    liveStore.ingest([ac]);
    setPanel({ kind: 'aircraft', hex: ac.hex });
    flyTo(ac.lon, ac.lat);
  };
  const onSearchAirport = (ap: Airport) => {
    setPanel({ kind: 'airport', icao: ap.icao });
    flyTo(ap.lon, ap.lat, 10.5);
  };

  const share = async () => {
    writeHash();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ url: location.href, title: 'Skywake' });
      else await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled share sheet */
    }
  };

  const requestNotifications = () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    void Notification.requestPermission().then(setNotif);
  };

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => flyTo(pos.coords.longitude, pos.coords.latitude, 9),
      () => undefined,
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  const toolBtn = (kind: 'filters' | 'map' | 'list' | 'about', label: string, icon: React.ReactNode, active = false) => (
    <button
      type="button"
      className={`tool-btn ${panel?.kind === kind ? 'tool-on' : ''} ${active ? 'tool-flag' : ''}`}
      aria-pressed={panel?.kind === kind}
      onClick={() => setPanel(panel?.kind === kind ? null : { kind })}
      title={label}
    >
      {icon}
      <span className="tool-label">{label}</span>
    </button>
  );

  if (!webgl) {
    return (
      <main className="fatal">
        <Logo size={48} />
        <h1>Skywake</h1>
        <p>{t('webglMissing')}</p>
      </main>
    );
  }

  const filtered = isFilterActive(prefs.filter);
  return (
    <div className="app">
      <MapView
        dark={dark}
        filter={prefs.filter}
        colorMode={prefs.colorMode}
        labels={prefs.labels}
        airports={prefs.airports}
        trails={prefs.trails}
        initial={initialView}
        onReady={(m) => {
          mapRef.current = m;
          if (initialHash.ac && initialHash.zoom === undefined) {
            // Deep link to an aircraft without a view: centre once it's found.
            const unsub = liveStore.subscribe(() => {
              const tr = liveStore.aircraft.get(initialHash.ac!);
              if (tr) {
                unsub();
                flyTo(tr.ac.lon, tr.ac.lat, 8);
              }
            });
          }
        }}
        onMove={(v) => {
          viewRef.current = v;
          writeHash();
        }}
        onPickAircraft={pickAircraft}
        onPickAirport={pickAirport}
        onVisibleCount={setVisibleCount}
        onError={setMapError}
      />

      <header className="topbar">
        <a className="brand" href="./" aria-label="Skywake">
          <Logo />
          <span className="brand-name">Skywake</span>
        </a>
        <Search onPickAircraft={onSearchAircraft} onPickAirport={onSearchAirport} />
        <nav className="tools" aria-label="Tools">
          {toolBtn('filters', t('filters'), <IconFilter />, filtered)}
          {toolBtn('list', t('list'), <IconList />)}
          {toolBtn('map', t('layers'), <IconLayers />)}
          {toolBtn('about', t('about'), <IconInfo />)}
        </nav>
      </header>

      <Banner />
      {mapError && <div className="banner banner-warn" role="alert">{mapError}</div>}

      <aside className="side" aria-live="off">
        {panel?.kind === 'aircraft' && (
          <AircraftPanel hex={panel.hex} following={following} onFollow={setFollowing} onClose={closePanel} onShare={share} />
        )}
        {panel?.kind === 'airport' && <AirportPanel icao={panel.icao} onClose={closePanel} onPickAircraft={(h) => setPanel({ kind: 'aircraft', hex: h })} />}
        {panel?.kind === 'filters' && <FilterPanel onClose={closePanel} />}
        {panel?.kind === 'list' && (
          <ListPanel
            onClose={closePanel}
            onPick={(h) => setPanel({ kind: 'aircraft', hex: h })}
            bounds={() => {
              const b = mapRef.current?.getBounds();
              return b ? { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() } : null;
            }}
          />
        )}
        {panel?.kind === 'map' && (
          <MapPanel
            onClose={closePanel}
            getView={() => viewRef.current}
            onGoTo={(v) => mapRef.current?.flyTo({ center: [v.lon, v.lat], zoom: v.zoom })}
            notificationState={notif}
            onRequestNotifications={requestNotifications}
          />
        )}
        {panel?.kind === 'about' && <AboutPanel onClose={closePanel} />}
      </aside>

      <footer className="bottombar">
        <StatusBar visible={visibleCount} filtered={filtered} />
        <button type="button" className="icon-btn floating" onClick={locate} aria-label={t('locate')} title={t('locate')}>
          <IconLocate />
        </button>
      </footer>

      <div className="toasts" aria-live="assertive">
        {copied && <div className="toast">{t('copied')}</div>}
        {toasts.map((x) => (
          <button type="button" key={x.id} className="toast toast-alert" onClick={() => setPanel({ kind: 'aircraft', hex: x.hex })}>
            <strong>{x.title}</strong>
            <span>{x.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
