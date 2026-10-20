// Builds apps/web/public/data/airports.json from OurAirports (public domain, https://ourairports.com/data/).
// Keeps airports useful on a flight map: large/medium airports, and small ones with scheduled service or an IATA code.
import { mkdir, writeFile } from 'node:fs/promises';

const SRC = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const OUT = new URL('../apps/web/public/data/airports.json', import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const res = await fetch(SRC, { headers: { 'user-agent': 'Skywake build (+https://github.com/andrei1000z/skywake)' } });
if (!res.ok) throw new Error(`OurAirports download failed: ${res.status}`);
const [header, ...rows] = parseCsv(await res.text());
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const RANK = { large_airport: 3, medium_airport: 2, small_airport: 1 };

const out = [];
for (const r of rows) {
  const type = r[col.type];
  const rank = RANK[type];
  if (!rank) continue;
  const iata = r[col.iata_code] || '';
  const icao = r[col.icao_code] || r[col.gps_code] || r[col.ident];
  const scheduled = r[col.scheduled_service] === 'yes';
  if (rank === 1 && !scheduled && !iata) continue;
  const lat = Number(r[col.latitude_deg]);
  const lon = Number(r[col.longitude_deg]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  // Compact tuple: [icao, iata, name, city, country, lat, lon, elevation_ft, rank, scheduled]
  out.push([icao, iata, r[col.name], r[col.municipality] || '', r[col.iso_country], +lat.toFixed(4), +lon.toFixed(4), r[col.elevation_ft] ? Number(r[col.elevation_ft]) : null, rank, scheduled ? 1 : 0]);
}
out.sort((a, b) => b[8] - a[8] || b[9] - a[9]);
await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ source: 'OurAirports (public domain)', generated: new Date().toISOString().slice(0, 10), fields: ['icao', 'iata', 'name', 'city', 'country', 'lat', 'lon', 'elev', 'rank', 'sched'], airports: out }));
console.log(`airports.json: ${out.length} airports`);
