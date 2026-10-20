import { describe, expect, it } from 'vitest';
import { type Aircraft, destination, haversineM, isEmergency, isFilterActive, matchesFilter, matchesQuery, mercatorVelocity, routePlausible, toMercator } from '../src/index.js';

const ac = (o: Partial<Aircraft> = {}): Aircraft => ({
  hex: '4bb195', lat: 44, lon: 26, onGround: false, src: 'adsb', posTs: 0, provider: 'x',
  callsign: 'THY2XD', reg: 'TC-LLU', type: 'B789', cat: 'A5', alt: 36000, gs: 400, squawk: '1000', ...o,
});

describe('filters', () => {
  it('empty filter matches everything and is inactive', () => {
    expect(matchesFilter(ac(), {})).toBe(true);
    expect(isFilterActive({})).toBe(false);
    expect(isFilterActive({ types: [] })).toBe(false);
    expect(isFilterActive({ hideGround: true })).toBe(true);
  });

  it('combines conditions with AND', () => {
    expect(matchesFilter(ac(), { altMin: 30000, types: ['B78*'], callsignPrefixes: ['THY'] })).toBe(true);
    expect(matchesFilter(ac(), { altMin: 30000, types: ['A3*'] })).toBe(false);
  });

  it('altitude: ground counts as 0, unknown altitude never matches a range', () => {
    expect(matchesFilter(ac({ onGround: true, alt: undefined }), { altMax: 1000 })).toBe(true);
    expect(matchesFilter(ac({ alt: undefined }), { altMin: 0 })).toBe(false);
  });

  it('ground / airborne toggles', () => {
    expect(matchesFilter(ac({ onGround: true }), { hideGround: true })).toBe(false);
    expect(matchesFilter(ac(), { hideAirborne: true })).toBe(false);
  });

  it('emergencies', () => {
    expect(isEmergency(ac({ squawk: '7700' }))).toBe(true);
    expect(isEmergency(ac({ emergency: 'general' }))).toBe(true);
    expect(matchesFilter(ac(), { onlyEmergency: true })).toBe(false);
  });

  it('source and military', () => {
    expect(matchesFilter(ac({ src: 'mlat' }), { sources: ['adsb'] })).toBe(false);
    expect(matchesFilter(ac({ mil: true }), { onlyMilitary: true })).toBe(true);
  });

  it('free-text query across identifiers', () => {
    expect(matchesQuery(ac(), 'thy2')).toBe(true);
    expect(matchesQuery(ac(), 'TCLLU')).toBe(true);
    expect(matchesQuery(ac(), '4BB1')).toBe(true);
    expect(matchesQuery(ac(), 'B78')).toBe(true);
    expect(matchesQuery(ac(), 'RYR')).toBe(false);
  });
});

describe('geo', () => {
  it('haversine: Bucharest OTP → London LHR ≈ 2100 km', () => {
    const d = haversineM(44.5711, 26.085, 51.47, -0.4543) / 1000;
    expect(d).toBeGreaterThan(2050);
    expect(d).toBeLessThan(2150);
  });

  it('destination wraps across the antimeridian', () => {
    const p = destination(0, 179.9, 90, 50_000);
    expect(p.lon).toBeLessThan(-179);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
  });

  it('mercator velocity agrees with destination over 10 s', () => {
    const lat = 50, lon = 10, gs = 450, track = 60;
    const v = mercatorVelocity(lat, gs, track);
    const m0 = toMercator(lat, lon);
    const dst = destination(lat, lon, track, gs * 0.514444 * 10);
    const m1 = toMercator(dst.lat, dst.lon);
    expect(m0.x + v.vx * 10).toBeCloseTo(m1.x, 7);
    expect(m0.y + v.vy * 10).toBeCloseTo(m1.y, 7);
  });
});

describe('routePlausible', () => {
  const lhr = { lat: 51.47, lon: -0.46 };
  const bos = { lat: 42.36, lon: -71.01 };
  it('accepts a position on the corridor', () => {
    expect(routePlausible([lhr, bos], 51.5, -1.22)).toBe(true);
    expect(routePlausible([lhr, bos], 54, -30)).toBe(true);
  });
  it('rejects a position far off the corridor', () => {
    expect(routePlausible([lhr, bos], 44.4, 26.1)).toBe(false);
  });
  it('rejects routes without coordinates', () => {
    expect(routePlausible([{}, {}], 0, 0)).toBe(false);
  });
});
