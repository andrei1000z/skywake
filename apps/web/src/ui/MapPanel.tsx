import { type Lang, setLang, t, useLang } from '../lib/i18n';
import { newId, setPrefs, type Theme, usePrefs } from '../lib/prefs';
import type { AltUnit, SpeedUnit, VsUnit } from '../lib/units';
import { ALT_STOPS, cssRgb, GROUND_RGB } from '../map/colors';
import { Toggle } from './FilterPanel';
import { IconStar } from './Icons';
import { Panel } from './Panel';

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      <div role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <label key={v} className={value === v ? 'seg-on' : ''}>
            <input type="radio" name={label} value={v} checked={value === v} onChange={() => onChange(v)} />
            {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function MapPanel({ onClose, getView, onGoTo, notificationState, onRequestNotifications }: {
  onClose: () => void;
  getView: () => { zoom: number; lat: number; lon: number };
  onGoTo: (v: { zoom: number; lat: number; lon: number }) => void;
  notificationState: NotificationPermission | 'unsupported';
  onRequestNotifications: () => void;
}) {
  const lang = useLang();
  const p = usePrefs();
  return (
    <Panel id="map" title={t('layers')} onClose={onClose}>
      <div className="form">
        <Segmented<Theme> label={t('theme')} value={p.theme} options={[['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]]} onChange={(v) => setPrefs({ theme: v })} />
        <Segmented<'altitude' | 'source'> label={t('colorBy')} value={p.colorMode} options={[['altitude', t('colorAlt')], ['source', t('colorSource')]]} onChange={(v) => setPrefs({ colorMode: v })} />
        {p.colorMode === 'altitude' && (
          <div className="legend" aria-label={t('colorAlt')}>
            <span className="legend-swatch" style={{ background: cssRgb(GROUND_RGB) }} />
            <span className="legend-ramp" style={{ background: `linear-gradient(90deg, ${ALT_STOPS.map(([, c]) => cssRgb(c)).join(',')})` }} />
            <div className="legend-labels mono"><span>{t('ground')}</span><span>0</span><span>20k</span><span>44k ft</span></div>
          </div>
        )}
        <Toggle label={t('labels')} checked={p.labels} onChange={(v) => setPrefs({ labels: v })} />
        <Toggle label={t('airports')} checked={p.airports} onChange={(v) => setPrefs({ airports: v })} />
        <Toggle label={t('trails')} checked={p.trails} onChange={(v) => setPrefs({ trails: v })} />

        <h3>{t('units')}</h3>
        <Segmented<AltUnit> label={t('altitude')} value={p.units.alt} options={[['ft', 'ft'], ['m', 'm']]} onChange={(v) => setPrefs({ units: { ...p.units, alt: v } })} />
        <Segmented<SpeedUnit> label={t('speed')} value={p.units.speed} options={[['kt', 'kt'], ['kmh', 'km/h'], ['mph', 'mph']]} onChange={(v) => setPrefs({ units: { ...p.units, speed: v } })} />
        <Segmented<VsUnit> label={t('vs')} value={p.units.vs} options={[['fpm', 'ft/min'], ['ms', 'm/s']]} onChange={(v) => setPrefs({ units: { ...p.units, vs: v } })} />
        <Segmented<Lang> label={t('language')} value={lang} options={[['en', 'English'], ['ro', 'Română']]} onChange={setLang} />

        <h3>{t('alerts')}</h3>
        <Toggle label={t('alertsEmergency')} checked={p.alertEmergency} onChange={(v) => { setPrefs({ alertEmergency: v }); if (v) onRequestNotifications(); }} />
        <Toggle label={t('alertsWatch')} checked={p.alertWatch} onChange={(v) => { setPrefs({ alertWatch: v }); if (v) onRequestNotifications(); }} />
        {notificationState === 'denied' && <p className="hint">{t('alertsPermissionDenied')}</p>}
        {p.watch.length > 0 && (
          <ul className="plain-list">
            {p.watch.map((w) => (
              <li key={w.kind + w.key}>
                <span className="mono">{w.label}</span>
                <button type="button" className="link-btn danger" onClick={() => setPrefs((s) => ({ watch: s.watch.filter((x) => x !== w) }))}>{t('delete')}</button>
              </li>
            ))}
          </ul>
        )}

        <h3>{t('bookmarks')}</h3>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const v = getView();
            const name = `${v.lat.toFixed(2)}, ${v.lon.toFixed(2)} · z${v.zoom.toFixed(1)}`;
            setPrefs((s) => ({ bookmarks: [...s.bookmarks, { id: newId(), name, ...v }] }));
          }}
        >
          <IconStar /> {t('bookmarkView')}
        </button>
        <ul className="plain-list">
          {p.bookmarks.map((b) => (
            <li key={b.id}>
              <button type="button" className="link-btn" onClick={() => onGoTo(b)}>{b.name}</button>
              <button type="button" className="link-btn danger" onClick={() => setPrefs((s) => ({ bookmarks: s.bookmarks.filter((x) => x.id !== b.id) }))}>{t('delete')}</button>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
