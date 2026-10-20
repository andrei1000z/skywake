import type { Aircraft } from '@skywake/shared';
import { describe, expect, it } from 'vitest';
import { type Airport, searchAirports } from '../src/data/airports';
import { CORRECTION_S, MAX_EXTRAPOLATION_S, type Tracked, positionAt, velocityFor } from '../src/data/liveStore';
import { fmtAge, fmtAlt, fmtSpeed, fmtVs } from '../src/lib/units';
import { buildHash, parseHash } from '../src/lib/urlState';
import { aircraftRgb, altitudeRgb, EMERGENCY_RGB, GROUND_RGB } from '../src/map/colors';
import { Icon, iconFor } from '../src/map/icons';

const ac = (o: Partial<Aircraft> = {}): Aircraft => ({
  hex: '4b1812', lat: 44, lon: 26, onGround: false, src: 'adsb', posTs: 0, provider: 'adsblol', ...o,
});

describe('urlState', () => {
  it('round-trips view, aircraft and airport', () => {
    const h = buildHash({ zoom: 7.5, lat: 44.43, lon: 26.1, ac: '4b1812', ap: 'LROP' });
    expect(parseHash(h)).toEqual({ zoom: 7.5, lat: 44.43, lon: 26.1, ac: '4b1812', ap: 'LROP' });
  });
  it('rejects out-of-range and malformed values', () => {
    expect(parseHash('#map=30/44/26')).toEqual({});
    expect(parseHash('#map=5/91/26')).toEqual({});
    expect(parseHash('#map=a/b/c&ac=zzzzzz&ap=<x>')).toEqual({});
  });
  it('accepts non-ICAO (~) hex ids', () => {
    expect(parseHash('#ac=~12ABCD').ac).toBe('~12abcd');
  });
});

describe('units', () => {
  it('formats altitude, speed and vertical rate', () => {
    expect(fmtAlt(35000, false, 'ft', 'Ground')).toBe('35,000 ft');
    expect(fmtAlt(1000, false, 'm', 'Ground')).toBe('305 m');
    expect(fmtAlt(500, true, 'ft', 'Ground')).toBe('Ground');
    expect(fmtAlt(undefined, false, 'ft', 'Ground')).toBe('—');
    expect(fmtSpeed(100, 'kmh')).toBe('185 km/h');
    expect(fmtVs(1200, 'fpm')).toBe('+1,200 fpm');
    expect(fmtVs(-1000, 'ms')).toBe('-5.1 m/s');
    expect(fmtAge(75_000)).toBe('1m 15s');
  });
});

describe('dead reckoning', () => {
  const base: Tracked = { ac: ac(), mx: 0.5, my: 0.5, vx: 1e-6, vy: 0, baseT: 100, corrX: 0, corrY: 0, corrT: 0, lastSeen: 0, trail: [] };
  it('extrapolates linearly and caps at MAX_EXTRAPOLATION_S', () => {
    expect(positionAt(base, 110).x).toBeCloseTo(0.5 + 10e-6, 12);
    expect(positionAt(base, 100 + MAX_EXTRAPOLATION_S + 60).x).toBeCloseTo(0.5 + MAX_EXTRAPOLATION_S * 1e-6, 12);
  });
  it('never extrapolates backwards in time', () => {
    expect(positionAt(base, 50).x).toBe(0.5);
  });
  it('blends a correction offset to zero over CORRECTION_S', () => {
    const t = { ...base, vx: 0, corrX: 0.001, corrT: 100 };
    expect(positionAt(t, 100).x).toBeCloseTo(0.501, 9);
    expect(positionAt(t, 100 + CORRECTION_S / 2).x).toBeCloseTo(0.5005, 9);
    expect(positionAt(t, 100 + CORRECTION_S).x).toBeCloseTo(0.5, 9);
  });
  it('keeps ground and speedless aircraft still', () => {
    expect(velocityFor(ac({ onGround: true, gs: 15, track: 90 }))).toEqual({ vx: 0, vy: 0 });
    expect(velocityFor(ac({ track: 90 }))).toEqual({ vx: 0, vy: 0 });
    const v = velocityFor(ac({ gs: 450, track: 90 }));
    expect(v.vx).toBeGreaterThan(0);
    expect(Math.abs(v.vy)).toBeLessThan(1e-12);
  });
});

describe('icons and colours', () => {
  it('picks icons by category, then by type designator', () => {
    expect(iconFor(ac({ cat: 'A5' }))).toBe(Icon.Heavy);
    expect(iconFor(ac({ cat: 'A7' }))).toBe(Icon.Rotor);
    expect(iconFor(ac({ type: 'B77W' }))).toBe(Icon.Heavy);
    expect(iconFor(ac({ type: 'C172' }))).toBe(Icon.Light);
    expect(iconFor(ac({ type: 'EC35' }))).toBe(Icon.Rotor);
    // Citations must not be mistaken for the C-5 Galaxy.
    expect(iconFor(ac({ type: 'C560' }))).toBe(Icon.Jet);
    expect(iconFor(ac({ type: 'C5M' }))).toBe(Icon.Heavy);
  });
  it('colours emergencies and ground traffic distinctly', () => {
    expect(aircraftRgb(ac({ alt: 30000 }), 'altitude', true)).toEqual(EMERGENCY_RGB);
    expect(aircraftRgb(ac({ onGround: true }), 'altitude', false)).toEqual(GROUND_RGB);
    expect(altitudeRgb(1000)).not.toEqual(altitudeRgb(38000));
  });
});

describe('airport search', () => {
  const mk = (icao: string, iata: string, name: string, city: string, rank: number): Airport => ({
    icao, iata, name, city, country: 'RO', lat: 0, lon: 0, elev: 0, rank, sched: true,
  });
  const list = [
    mk('LROP', 'OTP', 'Henri Coandă International Airport', 'Bucharest', 3),
    mk('LRBS', 'BBU', 'Aurel Vlaicu International Airport', 'Bucharest', 2),
    mk('LRCL', 'CLJ', 'Avram Iancu Cluj International Airport', 'Cluj-Napoca', 2),
  ];
  it('ranks exact codes first', () => {
    expect(searchAirports(list, 'otp')[0]?.icao).toBe('LROP');
    expect(searchAirports(list, 'LRBS')[0]?.icao).toBe('LRBS');
  });
  it('matches city and name, larger airports first', () => {
    expect(searchAirports(list, 'buchar').map((a) => a.icao)).toEqual(['LROP', 'LRBS']);
    expect(searchAirports(list, 'iancu').map((a) => a.icao)).toEqual(['LRCL']);
    expect(searchAirports(list, 'x')).toEqual([]);
  });
});
