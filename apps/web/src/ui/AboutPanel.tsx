import { useEffect, useState } from 'react';
import type { HealthResponse } from '@skywake/shared';
import { api, API_BASE } from '../data/api';
import { t, useLang } from '../lib/i18n';
import { Panel } from './Panel';

const REPO = 'https://github.com/andrei1000z/skywake';

export function AboutPanel({ onClose }: { onClose: () => void }) {
  useLang();
  const [health, setHealth] = useState<HealthResponse | null | 'error'>(null);
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth('error'));
  }, []);
  return (
    <Panel id="about" title={t('about')} onClose={onClose}>
      <p>{t('aboutBody')}</p>
      <h3>{t('providerStatus')}</h3>
      {health === null ? (
        <p className="muted">…</p>
      ) : health === 'error' ? (
        <p className="warn">{t('errorData')}</p>
      ) : (
        <ul className="plain-list">
          {health.providers.map((p) => (
            <li key={p.provider}>
              <span className={`dot ${p.ok ? 'dot-ok' : 'dot-warn'}`} aria-hidden="true" />
              <span>{p.provider === 'adsblol' ? 'ADSB.lol' : p.provider}</span>
              <span className="muted">{p.ok ? t('ok') : `${t('degraded')}: ${p.lastError ?? ''}`}</span>
            </li>
          ))}
        </ul>
      )}
      <h3>{t('limitations')}</h3>
      <ul className="bullets">
        {t('limitationsList').split('|').map((l) => <li key={l}>{l}</li>)}
      </ul>
      <h3>Data</h3>
      <ul className="bullets">
        <li><a href="https://adsb.lol" target="_blank" rel="noopener noreferrer">ADSB.lol</a>: live positions, <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL 1.0</a></li>
        <li><a href="https://github.com/vradarserver/standing-data" target="_blank" rel="noopener noreferrer">VRS standing data</a>: callsign routes, CC0</li>
        <li><a href="https://ourairports.com/data/" target="_blank" rel="noopener noreferrer">OurAirports</a>: airports, public domain</li>
        <li><a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>: basemap</li>
      </ul>
      <p className="btn-row">
        <a className="btn" href={REPO} target="_blank" rel="noopener noreferrer">{t('sourceCode')}</a>
        <a className="btn" href="https://adsb.lol/feed" target="_blank" rel="noopener noreferrer">{t('feedData')}</a>
      </p>
      <p className="hint mono">{t('version')} {__APP_VERSION__} · API {API_BASE.replace(/^https?:\/\//, '')}</p>
    </Panel>
  );
}
