/**
 * Fixed global grid used to share upstream queries between all users.
 * Every viewport maps onto the same set of cells, so N users looking at Europe
 * cost the upstream the same as one user.
 */
export const CELL_DEG = 4;
export const LAT_CELLS = 180 / CELL_DEG; // 45
export const LON_CELLS = 360 / CELL_DEG; // 90
/** Hard cap so a zoomed-out viewport cannot fan out into hundreds of upstream calls. */
export const MAX_CELLS_PER_VIEW = 24;

const CELL_RE = /^(\d{1,2})_(\d{1,2})$/;

export interface Cell {
  id: string;
  latIdx: number;
  lonIdx: number;
}

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function cellId(latIdx: number, lonIdx: number): string {
  return `${latIdx}_${lonIdx}`;
}

export function parseCell(id: string): Cell | null {
  const m = CELL_RE.exec(id);
  if (!m) return null;
  const latIdx = Number(m[1]);
  const lonIdx = Number(m[2]);
  if (latIdx >= LAT_CELLS || lonIdx >= LON_CELLS) return null;
  return { id, latIdx, lonIdx };
}

export function wrapLon(lon: number): number {
  const w = ((((lon + 180) % 360) + 360) % 360) - 180;
  // Keep +180 as +180 rather than -180 only when the input was exactly 180.
  return w === -180 && lon > 0 ? 180 : w;
}

export function cellForPoint(lat: number, lon: number): Cell {
  const latIdx = Math.min(LAT_CELLS - 1, Math.max(0, Math.floor((lat + 90) / CELL_DEG)));
  const lonIdx = ((Math.floor((wrapLon(lon) + 180) / CELL_DEG) % LON_CELLS) + LON_CELLS) % LON_CELLS;
  return { id: cellId(latIdx, lonIdx), latIdx, lonIdx };
}

export function cellBounds(c: Cell): BBox {
  const south = -90 + c.latIdx * CELL_DEG;
  const west = -180 + c.lonIdx * CELL_DEG;
  return { west, south, east: west + CELL_DEG, north: south + CELL_DEG };
}

export function cellCenter(c: Cell): { lat: number; lon: number } {
  const b = cellBounds(c);
  return { lat: (b.south + b.north) / 2, lon: (b.west + b.east) / 2 };
}

/**
 * Radius (nautical miles) of the circle around the cell centre that covers the whole cell.
 * The widest edge is the one closest to the equator.
 */
export function cellRadiusNm(c: Cell): number {
  const b = cellBounds(c);
  const minAbsLat = b.south <= 0 && b.north >= 0 ? 0 : Math.min(Math.abs(b.south), Math.abs(b.north));
  const halfH = (CELL_DEG / 2) * 60;
  const halfW = (CELL_DEG / 2) * 60 * Math.cos((minAbsLat * Math.PI) / 180);
  return Math.ceil(Math.hypot(halfH, halfW)) + 2;
}

/**
 * Cells intersecting a viewport, ordered by distance from the viewport centre so that
 * the cap drops the edges first. Handles viewports crossing the antimeridian (west > east)
 * and viewports wider than the world.
 */
export function cellsForBBox(bbox: BBox, max = MAX_CELLS_PER_VIEW): { cells: Cell[]; truncated: boolean } {
  const south = Math.max(-90, Math.min(bbox.south, bbox.north));
  const north = Math.min(90, Math.max(bbox.south, bbox.north));
  let west = bbox.west;
  let east = bbox.east;
  if (east - west >= 360) {
    west = -180;
    east = 180;
  }
  west = wrapLon(west);
  east = wrapLon(east);
  const lonRanges: [number, number][] = west <= east ? [[west, east]] : [[west, 180], [-180, east]];

  const latStart = cellForPoint(south, 0).latIdx;
  const latEnd = cellForPoint(north - 1e-9, 0).latIdx;
  const ids = new Map<string, Cell>();
  for (const [w, e] of lonRanges) {
    const lonStart = Math.floor((w + 180) / CELL_DEG);
    const lonEnd = Math.min(LON_CELLS - 1, Math.floor((e + 180 - 1e-9) / CELL_DEG));
    for (let la = latStart; la <= latEnd; la++) {
      for (let lo = Math.max(0, lonStart); lo <= lonEnd; lo++) {
        const id = cellId(la, lo);
        ids.set(id, { id, latIdx: la, lonIdx: lo });
      }
    }
  }

  const cLat = (south + north) / 2;
  let cLon: number;
  if (bbox.east - bbox.west >= 360) cLon = 0;
  else cLon = wrapLon(bbox.west + (((bbox.east - bbox.west) % 360) + 360) % 360 / 2);
  const all = [...ids.values()];
  all.sort((a, b) => cellDist(a, cLat, cLon) - cellDist(b, cLat, cLon));
  return { cells: all.slice(0, max), truncated: all.length > max };
}

function cellDist(c: Cell, lat: number, lon: number): number {
  const cc = cellCenter(c);
  let dLon = Math.abs(cc.lon - lon);
  if (dLon > 180) dLon = 360 - dLon;
  return Math.hypot(cc.lat - lat, dLon * Math.cos((lat * Math.PI) / 180));
}
