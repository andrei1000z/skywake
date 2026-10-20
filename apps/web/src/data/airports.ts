export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  elev: number | null;
  /** 3 large, 2 medium, 1 small */
  rank: number;
  sched: boolean;
}

type Row = [string, string, string, string, string, number, number, number | null, number, number];

let cache: Promise<Airport[]> | null = null;

export function loadAirports(): Promise<Airport[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/airports.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`airports ${r.status}`);
      return r.json() as Promise<{ airports: Row[] }>;
    })
    .then((d) =>
      d.airports.map(([icao, iata, name, city, country, lat, lon, elev, rank, sched]) => ({
        icao, iata, name, city, country, lat, lon, elev, rank, sched: sched === 1,
      })),
    )
    .catch((e: unknown) => {
      cache = null;
      throw e;
    });
  return cache;
}

export function airportsGeoJson(list: Airport[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: list.map((a) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
      properties: { icao: a.icao, code: a.iata || a.icao, rank: a.rank },
    })),
  };
}

export function searchAirports(list: Airport[], q: string, limit = 6): Airport[] {
  const s = q.trim().toUpperCase();
  if (s.length < 2) return [];
  const scored: [number, Airport][] = [];
  for (const a of list) {
    let score = 0;
    if (a.iata === s || a.icao === s) score = 100;
    else if (s.length >= 3 && a.name.toUpperCase().includes(s)) score = 20;
    else if (s.length >= 3 && a.city.toUpperCase().startsWith(s)) score = 30;
    if (score) scored.push([score + a.rank * 5, a]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map((x) => x[1]);
}
