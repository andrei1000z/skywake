import { describe, expect, it } from 'vitest';
import { legProgress } from '../src/geo.js';

const OTP = { lat: 44.5711, lon: 26.085 };
const LHR = { lat: 51.47, lon: -0.4543 };
const JFK = { lat: 40.6398, lon: -73.7789 };

describe('legProgress', () => {
  it('is about halfway at the great-circle midpoint and gives an ETA from ground speed', () => {
    // Roughly the OTP–LHR midpoint (over southern Germany).
    const p = legProgress([OTP, LHR], 48.6, 12.4, 450)!;
    expect(p.leg).toBe(0);
    expect(p.fraction).toBeGreaterThan(0.4);
    expect(p.fraction).toBeLessThan(0.6);
    expect(p.flownM + p.remainingM).toBeGreaterThan(2_000_000);
    // ~1050 km at 450 kt ≈ 75 min.
    expect(p.etaMs! / 60_000).toBeGreaterThan(60);
    expect(p.etaMs! / 60_000).toBeLessThan(90);
  });

  it('picks the leg the aircraft is actually on for multi-leg routes', () => {
    const p = legProgress([OTP, LHR, JFK], 53, -30, 480)!;
    expect(p.leg).toBe(1);
  });

  it('gives no ETA when slow or speed is unknown, and null without coordinates', () => {
    expect(legProgress([OTP, LHR], 44.57, 26.08, 15)!.etaMs).toBeUndefined();
    expect(legProgress([OTP, LHR], 44.57, 26.08)!.etaMs).toBeUndefined();
    expect(legProgress([{}, {}], 44, 26, 400)).toBeNull();
  });
});
