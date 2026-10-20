import { describe, expect, it } from 'vitest';
import {
  CELL_DEG,
  cellBounds,
  cellCenter,
  cellForPoint,
  cellRadiusNm,
  cellsForBBox,
  haversineM,
  NM_TO_M,
  parseCell,
  wrapLon,
} from '../src/index.js';

describe('grid', () => {
  it('maps points to cells including boundaries', () => {
    expect(cellForPoint(-90, -180).id).toBe('0_0');
    expect(cellForPoint(90, 180).id).toBe('44_0'); // +180 wraps to the -180 column
    expect(cellForPoint(89.999, 179.999).id).toBe('44_89');
    expect(cellForPoint(44.43, 26.1).id).toBe('33_51');
  });

  it('wraps longitudes', () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
    expect(wrapLon(540)).toBe(180);
    expect(wrapLon(0)).toBe(0);
  });

  it('parses only valid cell ids', () => {
    expect(parseCell('33_51')).toEqual({ id: '33_51', latIdx: 33, lonIdx: 51 });
    expect(parseCell('45_0')).toBeNull();
    expect(parseCell('0_90')).toBeNull();
    expect(parseCell('../etc')).toBeNull();
    expect(parseCell('1_2_3')).toBeNull();
  });

  it('radius circle covers every cell corner and stays within the 250 NM upstream limit', () => {
    for (let la = 0; la < 45; la++) {
      for (const lo of [0, 45, 89]) {
        const c = { id: `${la}_${lo}`, latIdx: la, lonIdx: lo };
        const r = cellRadiusNm(c);
        expect(r).toBeLessThanOrEqual(250);
        const ctr = cellCenter(c);
        const b = cellBounds(c);
        for (const [lat, lon] of [[b.south, b.west], [b.south, b.east], [b.north, b.west], [b.north, b.east]] as const) {
          expect(haversineM(ctr.lat, ctr.lon, lat, lon) / NM_TO_M).toBeLessThanOrEqual(r);
        }
      }
    }
  });

  it('covers a normal viewport', () => {
    const { cells, truncated } = cellsForBBox({ west: 20, south: 43, east: 30, north: 48 });
    expect(truncated).toBe(false);
    // lon 20..30 → cols 50..52, lat 43..48 → rows 33..34
    expect(cells.map((c) => c.id).sort()).toEqual(['33_50', '33_51', '33_52', '34_50', '34_51', '34_52'].sort());
  });

  it('handles viewports crossing the antimeridian', () => {
    const { cells } = cellsForBBox({ west: 175, south: -40, east: -175, north: -36 });
    const lons = new Set(cells.map((c) => c.lonIdx));
    expect(lons).toEqual(new Set([88, 89, 0, 1]));
  });

  it('handles MapLibre-style unwrapped longitudes', () => {
    const a = cellsForBBox({ west: 355, south: 10, east: 365, north: 12 }).cells.map((c) => c.id).sort();
    const b = cellsForBBox({ west: -5, south: 10, east: 5, north: 12 }).cells.map((c) => c.id).sort();
    expect(a).toEqual(b);
  });

  it('caps whole-world viewports and prefers the centre', () => {
    const { cells, truncated } = cellsForBBox({ west: -540, south: -85, east: 540, north: 85 }, 10);
    expect(truncated).toBe(true);
    expect(cells).toHaveLength(10);
    for (const c of cells) expect(Math.abs(cellCenter(c).lat)).toBeLessThan(CELL_DEG * 3);
  });

  it('clamps latitude and tolerates inverted bounds', () => {
    const { cells } = cellsForBBox({ west: 0, south: 95, east: 3, north: 80 });
    expect(cells.every((c) => c.latIdx >= 42 && c.latIdx <= 44)).toBe(true);
  });
});
