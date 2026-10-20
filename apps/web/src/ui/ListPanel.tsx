import { matchesFilter } from '@skywake/shared';
import { useState } from 'react';
import { liveStore } from '../data/liveStore';
import { t, useLang } from '../lib/i18n';
import { usePrefs } from '../lib/prefs';
import { fmtAlt, fmtSpeed } from '../lib/units';
import { useLiveTick } from './hooks';
import { Panel } from './Panel';

type SortKey = 'callsign' | 'alt' | 'gs' | 'type';
const LIMIT = 300;

export function ListPanel({ bounds, onClose, onPick }: {
  bounds: () => { west: number; south: number; east: number; north: number } | null;
  onClose: () => void;
  onPick: (hex: string) => void;
}) {
  useLang();
  useLiveTick(2000);
  const prefs = usePrefs();
  const [sort, setSort] = useState<SortKey>('alt');
  const [desc, setDesc] = useState(true);
  const b = bounds();
  const inView = (lat: number, lon: number) => {
    if (!b) return true;
    if (lat < b.south || lat > b.north) return false;
    return b.west <= b.east ? lon >= b.west && lon <= b.east : lon >= b.west || lon <= b.east;
  };
  const rows = [...liveStore.aircraft.values()]
    .map((x) => x.ac)
    .filter((ac) => inView(ac.lat, ac.lon) && matchesFilter(ac, prefs.filter));
  const val = (a: (typeof rows)[number]): string | number => {
    if (sort === 'callsign') return a.callsign ?? '~';
    if (sort === 'type') return a.type ?? '~';
    if (sort === 'alt') return a.onGround ? 0 : (a.alt ?? -1);
    return a.gs ?? -1;
  };
  rows.sort((x, y) => {
    const a = val(x);
    const c = val(y);
    const r = typeof a === 'number' && typeof c === 'number' ? a - c : String(a).localeCompare(String(c));
    return desc ? -r : r;
  });
  const header = (k: SortKey, label: string) => (
    <th scope="col" aria-sort={sort === k ? (desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => (sort === k ? setDesc(!desc) : (setSort(k), setDesc(k === 'alt' || k === 'gs')))}>
        {label}{sort === k ? (desc ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );
  return (
    <Panel id="list" title={`${t('list')} · ${rows.length}`} onClose={onClose}>
      <table className="ac-table">
        <thead>
          <tr>
            {header('callsign', t('callsign'))}
            {header('type', t('type'))}
            {header('alt', t('altitude'))}
            {header('gs', t('speed'))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, LIMIT).map((a) => (
            <tr key={a.hex} onClick={() => onPick(a.hex)}>
              <td>
                <button type="button" className="row-btn mono" onClick={(e) => { e.stopPropagation(); onPick(a.hex); }}>
                  {a.callsign ?? a.reg ?? a.hex.toUpperCase()}
                </button>
              </td>
              <td className="mono">{a.type ?? ''}</td>
              <td className="mono num">{fmtAlt(a.alt, a.onGround, prefs.units.alt, t('ground'))}</td>
              <td className="mono num">{fmtSpeed(a.gs, prefs.units.speed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > LIMIT && <p className="hint">+{rows.length - LIMIT}</p>}
    </Panel>
  );
}
