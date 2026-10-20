import { isEmergency, routePlausible, type RouteInfo } from '@skywake/shared';
import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { liveStore } from '../data/liveStore';
import { type MsgKey, t, useLang } from '../lib/i18n';
import { getPrefs, setPrefs, usePrefs, type WatchItem } from '../lib/prefs';
import { fmtAge, fmtAlt, fmtDeg, fmtSpeed, fmtVs } from '../lib/units';
import { aircraftRgb, cssRgb } from '../map/colors';
import { useClock, useLiveTick } from './hooks';
import { IconBell, IconLink, IconTarget } from './Icons';
import { Field, Panel } from './Panel';

type RouteState = { status: 'loading' } | { status: 'none' } | { status: 'implausible' } | { status: 'ok'; route: RouteInfo } | { status: 'error' };

export function AircraftPanel({ hex, following, onFollow, onClose, onShare }: {
  hex: string;
  following: boolean;
  onFollow: (on: boolean) => void;
  onClose: () => void;
  onShare: () => void;
}) {
  useLang();
  useLiveTick(1000);
  const now = useClock(1000);
  const prefs = usePrefs();
  const tracked = liveStore.aircraft.get(hex);
  const ac = tracked?.ac;
  const callsign = ac?.callsign;
  const [route, setRoute] = useState<RouteState>({ status: 'none' });

  useEffect(() => {
    if (!callsign) {
      setRoute({ status: 'none' });
      return;
    }
    const ctrl = new AbortController();
    setRoute({ status: 'loading' });
    api
      .route(callsign, ctrl.signal)
      .then((r) => {
        if (!r.route) return setRoute({ status: 'none' });
        const cur = liveStore.aircraft.get(hex)?.ac;
        if (cur && !routePlausible(r.route.airports, cur.lat, cur.lon)) return setRoute({ status: 'implausible' });
        setRoute({ status: 'ok', route: r.route });
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setRoute({ status: 'error' });
      });
    return () => ctrl.abort();
  }, [callsign, hex]);

  const watched = prefs.watch.some((w) => w.kind === 'hex' && w.key === hex);
  const toggleWatch = () => {
    const item: WatchItem = { key: hex, kind: 'hex', label: callsign ?? ac?.reg ?? hex.toUpperCase() };
    setPrefs((p) => ({ watch: watched ? p.watch.filter((w) => !(w.kind === 'hex' && w.key === hex)) : [...p.watch, item] }));
  };

  if (!ac) {
    return (
      <Panel id="aircraft" title={hex.toUpperCase()} onClose={onClose}>
        <p className="muted">{t('selectedOutOfCoverage')}</p>
      </Panel>
    );
  }

  const u = getPrefs().units;
  const emergency = isEmergency(ac);
  const age = now - ac.posTs;
  const color = cssRgb(aircraftRgb(ac, 'altitude', emergency));

  return (
    <Panel
      id="aircraft"
      title={
        <span className="ac-title">
          <span className="ac-swatch" style={{ background: color }} aria-hidden="true" />
          {ac.callsign ?? <span className="muted">{t('noCallsign')}</span>}
        </span>
      }
      subtitle={
        <>
          {[ac.reg, ac.type].filter(Boolean).join(' · ') || ac.hex.toUpperCase()}
          {emergency && <span className="badge badge-danger">{t('emergency')} {ac.squawk}</span>}
          {ac.mil && <span className="badge">{t('military')}</span>}
        </>
      }
      onClose={onClose}
    >
      <div className="ac-hero">
        <div>
          <div className="hero-label">{t('altitude')}</div>
          <div className="hero-value">{fmtAlt(ac.alt, ac.onGround, u.alt, t('ground'))}</div>
        </div>
        <div>
          <div className="hero-label">{t('speed')}</div>
          <div className="hero-value">{fmtSpeed(ac.gs, u.speed)}</div>
        </div>
        <div>
          <div className="hero-label">{t('vs')}</div>
          <div className="hero-value">{fmtVs(ac.vr, u.vs)}</div>
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className={`btn ${following ? 'btn-on' : ''}`} aria-pressed={following} onClick={() => onFollow(!following)}>
          <IconTarget /> {following ? t('unfollow') : t('follow')}
        </button>
        <button type="button" className={`btn ${watched ? 'btn-on' : ''}`} aria-pressed={watched} onClick={toggleWatch}>
          <IconBell /> {watched ? t('watching') : t('watchlist')}
        </button>
        <button type="button" className="btn" onClick={onShare}>
          <IconLink /> {t('share')}
        </button>
      </div>

      <section className="sub-section" aria-label={t('route')}>
        <h3>{t('route')}</h3>
        {route.status === 'ok' ? (
          <>
            <ol className="route">
              {route.route.airports.map((a) => (
                <li key={a.icao}>
                  <strong className="mono">{a.iata ?? a.icao}</strong>
                  <span>{a.city ?? a.name}</span>
                </li>
              ))}
            </ol>
            <p className="hint">{t('routeNote')}</p>
          </>
        ) : route.status === 'loading' ? (
          <p className="muted">…</p>
        ) : route.status === 'implausible' ? (
          <p className="hint">{t('routeImplausible')}</p>
        ) : (
          <p className="hint">{t('routeUnknown')}</p>
        )}
      </section>

      <dl className="fields">
        <Field label={t('track')}>{fmtDeg(ac.track)}</Field>
        <Field label={t('squawk')} mono>{ac.squawk ?? '—'}</Field>
        <Field label={t('geoAltitude')}>{fmtAlt(ac.altGeom, false, u.alt, '')}</Field>
        <Field label={t('registration')} mono>{ac.reg ?? '—'}</Field>
        <Field label={t('type')} mono>{ac.type ?? '—'}</Field>
        <Field label={t('category')} mono>{ac.cat ?? '—'}</Field>
        <Field label={t('hex')} mono>{ac.hex.toUpperCase()}</Field>
        <Field label={t('source')}>{t(ac.src as MsgKey)}</Field>
        <Field label={t('positionAge')}>
          <span className={age > 15000 ? 'warn' : undefined}>{fmtAge(age)}</span>
        </Field>
        <Field label={t('provider')}>ADSB.lol</Field>
      </dl>
      {prefs.trails && <p className="hint">{t('trail')}</p>}
    </Panel>
  );
}
