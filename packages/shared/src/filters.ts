import type { Aircraft, PositionSource } from './types.js';

/** All conditions are ANDed. Empty/undefined fields are ignored. */
export interface FilterSpec {
  altMin?: number;
  altMax?: number;
  speedMin?: number;
  speedMax?: number;
  /** Callsign prefixes, e.g. ["RYR", "WZZ"] (airline ICAO codes). */
  callsignPrefixes?: string[];
  /** ICAO type designators or prefixes with trailing *, e.g. ["A20N", "B73*"]. */
  types?: string[];
  /** Emitter categories, e.g. ["A3", "A5"]. */
  categories?: string[];
  sources?: PositionSource[];
  hideGround?: boolean;
  hideAirborne?: boolean;
  onlyEmergency?: boolean;
  onlyMilitary?: boolean;
  squawks?: string[];
}

export const EMERGENCY_SQUAWKS = ['7500', '7600', '7700'] as const;

export function isEmergency(ac: Aircraft): boolean {
  return Boolean(ac.emergency) || (ac.squawk !== undefined && (EMERGENCY_SQUAWKS as readonly string[]).includes(ac.squawk));
}

function matchesPattern(value: string | undefined, patterns: string[]): boolean {
  if (!value) return false;
  const v = value.toUpperCase();
  return patterns.some((p) => {
    const q = p.trim().toUpperCase();
    if (!q) return false;
    return q.endsWith('*') ? v.startsWith(q.slice(0, -1)) : v === q;
  });
}

export function isFilterActive(f: FilterSpec): boolean {
  return Object.values(f).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== false));
}

export function matchesFilter(ac: Aircraft, f: FilterSpec): boolean {
  if (f.hideGround && ac.onGround) return false;
  if (f.hideAirborne && !ac.onGround) return false;
  if (f.altMin !== undefined || f.altMax !== undefined) {
    const alt = ac.onGround ? 0 : ac.alt;
    if (alt === undefined) return false;
    if (f.altMin !== undefined && alt < f.altMin) return false;
    if (f.altMax !== undefined && alt > f.altMax) return false;
  }
  if (f.speedMin !== undefined || f.speedMax !== undefined) {
    if (ac.gs === undefined) return false;
    if (f.speedMin !== undefined && ac.gs < f.speedMin) return false;
    if (f.speedMax !== undefined && ac.gs > f.speedMax) return false;
  }
  if (f.callsignPrefixes?.length) {
    const cs = ac.callsign?.toUpperCase();
    if (!cs || !f.callsignPrefixes.some((p) => p.trim() && cs.startsWith(p.trim().toUpperCase()))) return false;
  }
  if (f.types?.length && !matchesPattern(ac.type, f.types)) return false;
  if (f.categories?.length && !matchesPattern(ac.cat, f.categories)) return false;
  if (f.sources?.length && !f.sources.includes(ac.src)) return false;
  if (f.squawks?.length && !matchesPattern(ac.squawk, f.squawks)) return false;
  if (f.onlyEmergency && !isEmergency(ac)) return false;
  if (f.onlyMilitary && !ac.mil) return false;
  return true;
}

/** Free-text search across identifiers. */
export function matchesQuery(ac: Aircraft, q: string): boolean {
  const s = q.trim().toUpperCase();
  if (!s) return true;
  return (
    ac.hex.toUpperCase().includes(s) ||
    (ac.callsign?.includes(s) ?? false) ||
    (ac.reg?.replace(/-/g, '').includes(s.replace(/-/g, '')) ?? false) ||
    (ac.type?.startsWith(s) ?? false) ||
    ac.squawk === s
  );
}
