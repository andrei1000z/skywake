import type { Aircraft, PositionSource } from '@skywake/shared';

export type ColorMode = 'altitude' | 'source';

/** Altitude ramp (ft → sRGB). Hue walks warm→cool as aircraft climb; chosen to read on both light and dark basemaps. */
export const ALT_STOPS: [number, [number, number, number]][] = [
  [0, [232, 129, 40]],
  [2000, [232, 170, 36]],
  [6000, [190, 196, 40]],
  [12000, [72, 186, 98]],
  [20000, [26, 170, 176]],
  [28000, [52, 128, 230]],
  [36000, [112, 92, 232]],
  [44000, [186, 76, 214]],
];
export const GROUND_RGB: [number, number, number] = [138, 144, 156];
export const EMERGENCY_RGB: [number, number, number] = [230, 40, 56];

export const SOURCE_RGB: Record<PositionSource, [number, number, number]> = {
  adsb: [46, 150, 230],
  mlat: [236, 150, 30],
  tisb: [150, 110, 220],
  adsr: [40, 170, 140],
  modes: [140, 146, 160],
  other: [140, 146, 160],
};

export function altitudeRgb(alt: number): [number, number, number] {
  if (alt <= ALT_STOPS[0]![0]) return ALT_STOPS[0]![1];
  for (let i = 1; i < ALT_STOPS.length; i++) {
    const [a1, c1] = ALT_STOPS[i]!;
    if (alt <= a1) {
      const [a0, c0] = ALT_STOPS[i - 1]!;
      const k = (alt - a0) / (a1 - a0);
      return [0, 1, 2].map((j) => Math.round(c0[j]! + (c1[j]! - c0[j]!) * k)) as [number, number, number];
    }
  }
  return ALT_STOPS[ALT_STOPS.length - 1]![1];
}

export function aircraftRgb(ac: Aircraft, mode: ColorMode, emergency: boolean): [number, number, number] {
  if (emergency) return EMERGENCY_RGB;
  if (mode === 'source') return SOURCE_RGB[ac.src];
  if (ac.onGround) return GROUND_RGB;
  if (ac.alt === undefined) return GROUND_RGB;
  return altitudeRgb(ac.alt);
}

export const cssRgb = (c: [number, number, number]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
