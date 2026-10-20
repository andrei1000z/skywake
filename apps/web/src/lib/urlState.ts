/** Shareable view state kept in the URL hash: #map=zoom/lat/lon&ac=hex&ap=ICAO */
export interface UrlState {
  zoom?: number;
  lat?: number;
  lon?: number;
  ac?: string;
  ap?: string;
}

export function parseHash(hash: string): UrlState {
  const out: UrlState = {};
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const map = params.get('map');
  if (map) {
    const [z, la, lo] = map.split('/').map(Number);
    if (z !== undefined && la !== undefined && lo !== undefined && [z, la, lo].every(Number.isFinite) && z >= 0 && z <= 22 && Math.abs(la) <= 85.06 && Math.abs(lo) <= 180) {
      out.zoom = z;
      out.lat = la;
      out.lon = lo;
    }
  }
  const ac = params.get('ac')?.toLowerCase();
  if (ac && /^~?[0-9a-f]{6}$/.test(ac)) out.ac = ac;
  const ap = params.get('ap')?.toUpperCase();
  if (ap && /^[A-Z0-9-]{3,8}$/.test(ap)) out.ap = ap;
  return out;
}

export function buildHash(s: UrlState): string {
  const p: string[] = [];
  if (s.zoom !== undefined && s.lat !== undefined && s.lon !== undefined) {
    p.push(`map=${s.zoom.toFixed(2)}/${s.lat.toFixed(4)}/${s.lon.toFixed(4)}`);
  }
  if (s.ac) p.push(`ac=${s.ac}`);
  if (s.ap) p.push(`ap=${s.ap}`);
  return p.length ? `#${p.join('&')}` : '';
}
