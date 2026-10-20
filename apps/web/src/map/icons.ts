import type { Aircraft } from '@skywake/shared';

/** Icon slots in the atlas. Silhouettes are original drawings, nose up, on a 64×64 grid. */
export const Icon = { Jet: 0, Heavy: 1, Light: 2, Rotor: 3, Fast: 4, Other: 5 } as const;
export type Icon = (typeof Icon)[keyof typeof Icon];
export const ICON_COUNT = 6;
export const ICON_PX = 64;

/** Half-size in CSS pixels per icon, before zoom scaling. */
export const ICON_SIZE: Record<Icon, number> = {
  [Icon.Jet]: 13,
  [Icon.Heavy]: 16,
  [Icon.Light]: 10,
  [Icon.Rotor]: 11,
  [Icon.Fast]: 12,
  [Icon.Other]: 8,
};

export function iconFor(ac: Aircraft): Icon {
  const c = ac.cat ?? '';
  if (c === 'A5') return Icon.Heavy;
  if (c === 'A1' || c === 'B1' || c === 'B4') return Icon.Light;
  if (c === 'A7') return Icon.Rotor;
  if (c === 'A6') return Icon.Fast;
  if (c.startsWith('C') || c === 'B6' || c === 'B2') return Icon.Other;
  if (c === 'A2' || c === 'A3' || c === 'A4') return Icon.Jet;
  // No category: guess from type designator conventions.
  const t = ac.type ?? '';
  if (/^(A3[3-5]\d|A38|A34|B7[4-8]\d|B77|B78|IL96|A124|A225|MD11)/.test(t) || /^(C17|C5|C5M)$/.test(t)) return Icon.Heavy;
  if (/^(EC|AS3|AS5|H1|H6|R44|R66|B06|B407|B412|S76|S92|A109|A139|A169|NH90|UH|AW)/.test(t)) return Icon.Rotor;
  if (/^(C1[5-9]\d|C2\d\d|PA\d|SR2|DA[24]|P28|BE\d|M20|TBM|PC12)/.test(t)) return Icon.Light;
  return Icon.Jet;
}

type Draw = (ctx: CanvasRenderingContext2D) => void;

const shapes: Record<Icon, Draw> = {
  [Icon.Jet]: (c) => {
    c.beginPath();
    c.moveTo(32, 4);
    c.bezierCurveTo(35, 6, 35.5, 12, 35.5, 18);
    c.lineTo(35.5, 25);
    c.lineTo(58, 37);
    c.lineTo(58, 41);
    c.lineTo(35.5, 35);
    c.lineTo(35, 50);
    c.lineTo(43, 56);
    c.lineTo(43, 59);
    c.lineTo(32, 56.5);
    c.lineTo(21, 59);
    c.lineTo(21, 56);
    c.lineTo(29, 50);
    c.lineTo(28.5, 35);
    c.lineTo(6, 41);
    c.lineTo(6, 37);
    c.lineTo(28.5, 25);
    c.lineTo(28.5, 18);
    c.bezierCurveTo(28.5, 12, 29, 6, 32, 4);
    c.closePath();
  },
  [Icon.Heavy]: (c) => {
    c.beginPath();
    c.moveTo(32, 2);
    c.bezierCurveTo(36, 4, 36.5, 10, 36.5, 16);
    c.lineTo(36.5, 23);
    c.lineTo(61, 38);
    c.lineTo(61, 42);
    c.lineTo(36.5, 34);
    c.lineTo(36, 50);
    c.lineTo(46, 57);
    c.lineTo(46, 60);
    c.lineTo(32, 57);
    c.lineTo(18, 60);
    c.lineTo(18, 57);
    c.lineTo(28, 50);
    c.lineTo(27.5, 34);
    c.lineTo(3, 42);
    c.lineTo(3, 38);
    c.lineTo(27.5, 23);
    c.lineTo(27.5, 16);
    c.bezierCurveTo(27.5, 10, 28, 4, 32, 2);
    c.closePath();
    // Engine pods
    for (const x of [14, 22, 42, 50]) {
      const y = x < 32 ? 33 - (x - 14) * 0.45 : 33 - (50 - x) * 0.45;
      c.rect(x - 2, y, 4, 7);
    }
  },
  [Icon.Light]: (c) => {
    c.beginPath();
    c.moveTo(32, 8);
    c.bezierCurveTo(35, 9, 35, 14, 35, 20);
    c.lineTo(60, 22);
    c.lineTo(60, 28);
    c.lineTo(35, 29);
    c.lineTo(34, 48);
    c.lineTo(44, 50);
    c.lineTo(44, 55);
    c.lineTo(32, 55);
    c.lineTo(20, 55);
    c.lineTo(20, 50);
    c.lineTo(30, 48);
    c.lineTo(29, 29);
    c.lineTo(4, 28);
    c.lineTo(4, 22);
    c.lineTo(29, 20);
    c.bezierCurveTo(29, 14, 29, 9, 32, 8);
    c.closePath();
    c.rect(24, 5, 16, 2.5); // propeller
  },
  [Icon.Rotor]: (c) => {
    c.beginPath();
    c.ellipse(32, 26, 9, 13, 0, 0, Math.PI * 2);
    c.rect(30, 36, 4, 22);
    c.rect(24, 54, 16, 4);
    c.moveTo(32 + 27, 26);
    c.arc(32, 26, 27, 0, Math.PI * 2);
    c.moveTo(32 + 24.5, 26);
    c.arc(32, 26, 24.5, 0, Math.PI * 2, true);
  },
  [Icon.Fast]: (c) => {
    c.beginPath();
    c.moveTo(32, 2);
    c.lineTo(36, 18);
    c.lineTo(36, 26);
    c.lineTo(58, 46);
    c.lineTo(58, 50);
    c.lineTo(37, 46);
    c.lineTo(38, 54);
    c.lineTo(46, 60);
    c.lineTo(32, 58);
    c.lineTo(18, 60);
    c.lineTo(26, 54);
    c.lineTo(27, 46);
    c.lineTo(6, 50);
    c.lineTo(6, 46);
    c.lineTo(28, 26);
    c.lineTo(28, 18);
    c.closePath();
  },
  [Icon.Other]: (c) => {
    c.beginPath();
    c.moveTo(32, 8);
    c.lineTo(54, 50);
    c.lineTo(32, 42);
    c.lineTo(10, 50);
    c.closePath();
  },
};

/**
 * Builds an RGBA atlas: R = fill coverage, G = outline coverage. The shader tints
 * the fill per aircraft and the outline per theme, so one texture serves every colour.
 */
export function buildAtlas(dpr: number): { data: Uint8Array; width: number; height: number } {
  const px = Math.round(ICON_PX * Math.min(2, Math.max(1, dpr)));
  const scale = px / ICON_PX;
  const w = px * ICON_COUNT;
  const fill = document.createElement('canvas');
  const line = document.createElement('canvas');
  fill.width = line.width = w;
  fill.height = line.height = px;
  const fc = fill.getContext('2d')!;
  const lc = line.getContext('2d')!;
  for (let i = 0; i < ICON_COUNT; i++) {
    for (const [ctx, stroke] of [[fc, false], [lc, true]] as const) {
      ctx.save();
      ctx.translate(i * px, 0);
      ctx.scale(scale, scale);
      // Shrink slightly so the outline never clips at the cell edge.
      ctx.translate(32, 32);
      ctx.scale(0.86, 0.86);
      ctx.translate(-32, -32);
      shapes[i as Icon](ctx);
      if (stroke) {
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.fill('nonzero');
      ctx.restore();
    }
  }
  const f = fc.getImageData(0, 0, w, px).data;
  const l = lc.getImageData(0, 0, w, px).data;
  const out = new Uint8Array(w * px * 4);
  for (let i = 0; i < w * px; i++) {
    out[i * 4] = f[i * 4 + 3]!;
    out[i * 4 + 1] = l[i * 4 + 3]!;
    out[i * 4 + 3] = 255;
  }
  return { data: out, width: w, height: px };
}
