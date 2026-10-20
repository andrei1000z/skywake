import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeReadsb, normalizeReadsbResponse, validLatLon } from '../src/index.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/adsblol-point-44.43-26.10-100nm.captured-2026-10-20.json', import.meta.url), 'utf8'),
);

describe('normalizeReadsbResponse (real captured fixture)', () => {
  const { ts, aircraft } = normalizeReadsbResponse(fixture, 'adsblol', fixture.now);

  it('keeps every record with a valid recent position', () => {
    expect(ts).toBe(fixture.now);
    expect(aircraft.length).toBeGreaterThan(30);
    expect(aircraft.length).toBeLessThanOrEqual(fixture.ac.length);
  });

  it('produces well-formed aircraft', () => {
    for (const ac of aircraft) {
      expect(ac.hex).toMatch(/^~?[0-9a-f]{6}$/);
      expect(validLatLon(ac.lat, ac.lon)).toBe(true);
      expect(ac.posTs).toBeLessThanOrEqual(fixture.now);
      expect(ac.provider).toBe('adsblol');
      expect(ac.track ?? 0).toBeGreaterThanOrEqual(0);
      expect(ac.track ?? 0).toBeLessThan(360);
    }
  });

  it('maps a known record', () => {
    const thy = aircraft.find((a) => a.hex === '4bb195');
    expect(thy).toMatchObject({ callsign: 'THY2XD', reg: 'TC-LLU', type: 'B789', alt: 36000, onGround: false, src: 'adsb', cat: 'A5' });
  });

  it('marks ground traffic', () => {
    const groundHex = new Set(fixture.ac.filter((a: { alt_baro: unknown }) => a.alt_baro === 'ground').map((a: { hex: string }) => a.hex));
    const normalized = aircraft.filter((a) => groundHex.has(a.hex));
    expect(normalized.length).toBeGreaterThan(0);
    expect(normalized.every((a) => a.onGround)).toBe(true);
  });
});

describe('normalizeReadsb edge cases', () => {
  const now = 1_800_000_000_000;
  const base = { hex: 'ABC123', lat: 44, lon: 26, seen_pos: 1 };

  it.each([
    ['null lat', { ...base, lat: null }],
    ['NaN lon', { ...base, lon: Number.NaN }],
    ['lat > 90', { ...base, lat: 91 }],
    ['lon < -180', { ...base, lon: -181 }],
    ['null island', { ...base, lat: 0, lon: 0 }],
    ['string coords', { ...base, lat: '44' }],
    ['bad hex', { ...base, hex: 'zzzzzz' }],
    ['stale position', { ...base, seen_pos: 120 }],
    ['negative age', { ...base, seen_pos: -5 }],
  ])('drops %s', (_name, raw) => {
    expect(normalizeReadsb(raw, now, 'x')).toBeNull();
  });

  it('accepts boundary coordinates', () => {
    expect(normalizeReadsb({ ...base, lat: 90, lon: 180 }, now, 'x')).not.toBeNull();
    expect(normalizeReadsb({ ...base, lat: -90, lon: -180 }, now, 'x')).not.toBeNull();
  });

  it('lowercases hex, trims callsign, computes position timestamp', () => {
    const ac = normalizeReadsb({ ...base, flight: 'rot123  ', seen_pos: 2.5 }, now, 'x');
    expect(ac?.hex).toBe('abc123');
    expect(ac?.callsign).toBe('ROT123');
    expect(ac?.posTs).toBe(now - 2500);
  });

  it('rejects implausible numbers', () => {
    const ac = normalizeReadsb({ ...base, alt_baro: 250000, gs: -3, squawk: '9999', baro_rate: 1e9 }, now, 'x');
    expect(ac?.alt).toBeUndefined();
    expect(ac?.gs).toBeUndefined();
    expect(ac?.squawk).toBeUndefined();
    expect(ac?.vr).toBeUndefined();
  });

  it('normalizes track into [0,360)', () => {
    expect(normalizeReadsb({ ...base, track: 360 }, now, 'x')?.track).toBe(0);
    expect(normalizeReadsb({ ...base, track: -90 }, now, 'x')?.track).toBe(270);
  });

  it('survives garbage responses', () => {
    expect(normalizeReadsbResponse(null, 'x', now).aircraft).toEqual([]);
    expect(normalizeReadsbResponse({ ac: 'nope' }, 'x', now).aircraft).toEqual([]);
    expect(normalizeReadsbResponse({ ac: [null, 1, 'a', {}] }, 'x', now).aircraft).toEqual([]);
  });

  it('ignores an upstream clock that is far off', () => {
    expect(normalizeReadsbResponse({ now: now + 3_600_000, ac: [] }, 'x', now).ts).toBe(now);
  });

  it('dedupes repeated hex codes', () => {
    const r = normalizeReadsbResponse({ now, ac: [base, base] }, 'x', now);
    expect(r.aircraft).toHaveLength(1);
  });
});
