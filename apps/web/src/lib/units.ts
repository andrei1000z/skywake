import { FT_TO_M } from '@skywake/shared';

export type AltUnit = 'ft' | 'm';
export type SpeedUnit = 'kt' | 'kmh' | 'mph';
export type VsUnit = 'fpm' | 'ms';

export interface Units {
  alt: AltUnit;
  speed: SpeedUnit;
  vs: VsUnit;
}

export const DEFAULT_UNITS: Units = { alt: 'ft', speed: 'kt', vs: 'fpm' };

const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function fmtAlt(ft: number | undefined, onGround: boolean, u: AltUnit, groundLabel: string): string {
  if (onGround) return groundLabel;
  if (ft === undefined) return '—';
  return u === 'm' ? `${nf0.format(ft * FT_TO_M)} m` : `${nf0.format(ft)} ft`;
}

export function fmtSpeed(kt: number | undefined, u: SpeedUnit): string {
  if (kt === undefined) return '—';
  if (u === 'kmh') return `${nf0.format(kt * 1.852)} km/h`;
  if (u === 'mph') return `${nf0.format(kt * 1.15078)} mph`;
  return `${nf0.format(kt)} kt`;
}

export function fmtVs(fpm: number | undefined, u: VsUnit): string {
  if (fpm === undefined) return '—';
  const sign = fpm > 0 ? '+' : '';
  return u === 'ms' ? `${sign}${nf1.format(fpm * 0.00508)} m/s` : `${sign}${nf0.format(fpm)} fpm`;
}

export function fmtDeg(d: number | undefined): string {
  return d === undefined ? '—' : `${nf0.format(d)}°`;
}

export function fmtAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** METAR visibility (statute miles) in km; "6+" (≥ 6 SM) is the usual "10 km or more". */
export function fmtVisibility(sm: number | undefined, plus?: boolean): string {
  if (sm === undefined) return '—';
  if (plus && sm >= 6) return '≥ 10 km';
  const km = sm * 1.609344;
  return `${km < 5 ? nf1.format(km) : nf0.format(km)} km${plus ? '+' : ''}`;
}
