export const EARTH_RADIUS_M = 6_371_008.8;
export const KT_TO_MS = 0.514444;
export const FT_TO_M = 0.3048;
export const NM_TO_M = 1852;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Great-circle destination point. Longitude is normalized to [-180, 180]. */
export function destination(lat: number, lon: number, bearingDeg: number, distM: number): { lat: number; lon: number } {
  const d = distM / EARTH_RADIUS_M;
  const b = toRad(bearingDeg);
  const p1 = toRad(lat);
  const l1 = toRad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  let lonOut = toDeg(l2);
  lonOut = ((((lonOut + 180) % 360) + 360) % 360) - 180;
  return { lat: toDeg(p2), lon: lonOut };
}

/** Web-mercator unit coordinates (0..1), matching MapLibre's MercatorCoordinate. */
export function toMercator(lat: number, lon: number): { x: number; y: number } {
  const clamped = Math.max(-85.051129, Math.min(85.051129, lat));
  const x = (lon + 180) / 360;
  const y = (180 - toDeg(Math.log(Math.tan(Math.PI / 4 + toRad(clamped) / 2)))) / 360;
  return { x, y };
}

/**
 * Velocity in mercator units per second for a ground speed (kt) and track (deg).
 * Valid locally, which is all dead-reckoning over a few seconds needs.
 */
export function mercatorVelocity(lat: number, gsKt: number, trackDeg: number): { vx: number; vy: number } {
  const v = gsKt * KT_TO_MS;
  const circ = 2 * Math.PI * EARTH_RADIUS_M * Math.max(0.01, Math.cos(toRad(lat)));
  const t = toRad(trackDeg);
  return { vx: (v * Math.sin(t)) / circ, vy: -(v * Math.cos(t)) / circ };
}

/**
 * Whether a scheduled route is consistent with where the aircraft is now:
 * the detour via the current position must be modest relative to the direct distance.
 * Multi-leg routes pass if any leg is consistent.
 */
export function routePlausible(airports: { lat?: number; lon?: number }[], lat: number, lon: number): boolean {
  for (let i = 0; i + 1 < airports.length; i++) {
    const a = airports[i]!;
    const b = airports[i + 1]!;
    if (a.lat === undefined || a.lon === undefined || b.lat === undefined || b.lon === undefined) continue;
    const direct = haversineM(a.lat, a.lon, b.lat, b.lon);
    const via = haversineM(a.lat, a.lon, lat, lon) + haversineM(lat, lon, b.lat, b.lon);
    if (via <= direct * 1.25 + 150_000) return true;
  }
  return false;
}
