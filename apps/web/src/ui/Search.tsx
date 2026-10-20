import { type Aircraft, matchesQuery } from '@skywake/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { type Airport, loadAirports, searchAirports } from '../data/airports';
import { api } from '../data/api';
import { liveStore } from '../data/liveStore';
import { t, useLang } from '../lib/i18n';
import { IconSearch } from './Icons';

type Result = { kind: 'ac'; ac: Aircraft; local: boolean } | { kind: 'ap'; ap: Airport };

/** Searches loaded aircraft and airports instantly, then the network (debounced) for anything not in view. */
export function Search({ onPickAircraft, onPickAirport }: { onPickAircraft: (ac: Aircraft) => void; onPickAirport: (ap: Airport) => void }) {
  useLang();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [remote, setRemote] = useState<'idle' | 'loading' | 'done'>('idle');
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setRemote('idle');
      return;
    }
    const local: Result[] = [];
    for (const tr of liveStore.aircraft.values()) {
      if (matchesQuery(tr.ac, query)) local.push({ kind: 'ac', ac: tr.ac, local: true });
      if (local.length >= 8) break;
    }
    let cancelled = false;
    loadAirports()
      .then((aps) => {
        if (cancelled) return;
        setResults([...local, ...searchAirports(aps, query).map((ap): Result => ({ kind: 'ap', ap }))]);
      })
      .catch(() => setResults(local));
    setResults(local);
    setActive(0);

    // Network lookup for identifiers (callsign / registration / hex) not already on screen.
    const ctrl = new AbortController();
    const looksLikeId = /^[A-Za-z0-9-]{3,10}$/.test(query);
    if (!looksLikeId) {
      setRemote('idle');
      return () => { cancelled = true; };
    }
    setRemote('loading');
    const timer = setTimeout(() => {
      api
        .search(query, ctrl.signal)
        .then((r) => {
          if (cancelled) return;
          setResults((prev) => {
            const have = new Set(prev.filter((x) => x.kind === 'ac').map((x) => (x as { ac: Aircraft }).ac.hex));
            const extra = r.aircraft.filter((a) => !have.has(a.hex)).map((ac): Result => ({ kind: 'ac', ac, local: false }));
            return [...prev, ...extra];
          });
          setRemote('done');
        })
        .catch(() => !cancelled && setRemote('done'));
    }, 450);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [q]);

  const choose = (r: Result) => {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    if (r.kind === 'ac') onPickAircraft(r.ac);
    else onPickAirport(r.ap);
  };

  const showList = open && q.trim().length >= 2;
  return (
    <div className="search" role="search">
      <IconSearch />
      <input
        ref={inputRef}
        type="search"
        value={q}
        placeholder={t('search')}
        aria-label={t('search')}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]!); }
          else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
        }}
      />
      {showList && (
        <ul className="search-results" id={listId} role="listbox">
          {results.map((r, i) => (
            <li
              key={r.kind === 'ac' ? `ac-${r.ac.hex}` : `ap-${r.ap.icao}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => { e.preventDefault(); choose(r); }}
            >
              {r.kind === 'ac' ? (
                <>
                  <span className="res-kind">✈</span>
                  <span className="mono strong">{r.ac.callsign ?? r.ac.reg ?? r.ac.hex.toUpperCase()}</span>
                  <span className="muted">{[r.ac.reg, r.ac.type].filter(Boolean).join(' · ')}</span>
                </>
              ) : (
                <>
                  <span className="res-kind">⌖</span>
                  <span className="mono strong">{r.ap.iata || r.ap.icao}</span>
                  <span className="muted">{r.ap.name}</span>
                </>
              )}
            </li>
          ))}
          {remote === 'loading' && <li className="muted" role="presentation">{t('searchUpstream')}</li>}
          {remote !== 'loading' && results.length === 0 && <li className="muted" role="presentation">{t('searchNoResults')}</li>}
        </ul>
      )}
    </div>
  );
}
