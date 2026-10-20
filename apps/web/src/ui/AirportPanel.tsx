import { haversineM } from '@skywake/shared';
import { useEffect, useState } from 'react';
import { type Airport, loadAirports } from '../data/airports';
import { liveStore } from '../data/liveStore';
import { t, useLang } from '../lib/i18n';
import { usePrefs } from '../lib/prefs';
import { fmtAlt } from '../lib/units';
import { useLiveTick } from './hooks';
import { Field, Panel } from './Panel';

export function AirportPanel({ icao, onClose, onPickAircraft }: { icao: string; onClose: () => void; onPickAircraft: (hex: string) => void }) {
  useLang();
  useLiveTick(2000);
  const prefs = usePrefs();
  const [ap, setAp] = useState<Airport | null | undefined>(undefined);
  useEffect(() => {
    loadAirports().then((l) => setAp(l.find((a) => a.icao === icao) ?? null)).catch(() => setAp(null));
  }, [icao]);

  if (ap === undefined) return <Panel id="airport" title={icao} onClose={onClose}><p className="muted">…</p></Panel>;
  if (ap === null) return <Panel id="airport" title={icao} onClose={onClose}><p className="muted">—</p></Panel>;

  // Nearby = within 30 km and below 10,000 ft (arrivals, departures, ground movements).
  const nearby = [...liveStore.aircraft.values()]
    .map((tr) => ({ tr, d: haversineM(ap.lat, ap.lon, tr.ac.lat, tr.ac.lon) }))
    .filter(({ tr, d }) => d < 30_000 && (tr.ac.onGround || (tr.ac.alt ?? 99999) < 10_000))
    .sort((a, b) => a.d - b.d)
    .slice(0, 30);

  return (
    <Panel id="airport" title={ap.name} subtitle={<span className="mono">{[ap.iata, ap.icao].filter(Boolean).join(' / ')} · {ap.city}{ap.city ? ', ' : ''}{ap.country}</span>} onClose={onClose}>
      <dl className="fields">
        <Field label={t('elevation')}>{ap.elev === null ? '—' : fmtAlt(ap.elev, false, prefs.units.alt, '')}</Field>
        <Field label="Lat / Lon" mono>{ap.lat.toFixed(4)}, {ap.lon.toFixed(4)}</Field>
      </dl>
      <section className="sub-section">
        <h3>{t('nearbyTraffic')} ({nearby.length})</h3>
        {nearby.length === 0 ? (
          <p className="hint">{t('noNearby')}</p>
        ) : (
          <ul className="nearby">
            {nearby.map(({ tr, d }) => (
              <li key={tr.ac.hex}>
                <button type="button" className="row-btn" onClick={() => onPickAircraft(tr.ac.hex)}>
                  <span className="mono strong">{tr.ac.callsign ?? tr.ac.reg ?? tr.ac.hex.toUpperCase()}</span>
                  <span className="mono muted">{tr.ac.type ?? ''}</span>
                  <span className="mono">{fmtAlt(tr.ac.alt, tr.ac.onGround, prefs.units.alt, t('ground'))}</span>
                  <span className="mono muted">{(d / 1000).toFixed(1)} km</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="hint">
        <a href={`https://ourairports.com/airports/${encodeURIComponent(ap.icao)}/`} target="_blank" rel="noopener noreferrer">{t('viewOnOurAirports')} ↗</a>
      </p>
    </Panel>
  );
}
