// Renders Skywake launcher icons and splash screens into the Capacitor Android project.
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const res = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));
const BG = '#0d1420';
const MARK = `<path d="M5 22.5c5.5 0 9-1.6 12.4-5.1S23 11 27 10" stroke="#7cc4ff" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M5 26c4.2 0 7.4-.9 10.4-3" stroke="#7cc4ff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".5"/><circle cx="27" cy="10" r="3" fill="#ffb547"/>`;
const svg = (size, { bg, radius = 0, inset = 0 }) => {
  const s = 32 / (1 - inset * 2);
  const o = -(s - 32) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${o} ${o} ${s} ${s}">${bg ? `<rect x="${o}" y="${o}" width="${s}" height="${s}" rx="${radius * s}" fill="${bg}"/>` : ''}${MARK}</svg>`;
};
const pngSize = (p) => {
  const b = readFileSync(p);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(path, w, h, markup, transparent) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<body style="margin:0;width:${w}px;height:${h}px;display:grid;place-items:center;background:${transparent ? 'transparent' : BG}">${markup}</body>`);
  await page.screenshot({ path, omitBackground: transparent });
}

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  const dir = `${res}mipmap-${d}/`;
  const legacy = Math.round(48 * k);
  const fg = Math.round(108 * k);
  await render(`${dir}ic_launcher.png`, legacy, legacy, svg(legacy, { bg: BG, radius: 0.22, inset: 0.08 }), true);
  await render(`${dir}ic_launcher_round.png`, legacy, legacy, svg(legacy, { bg: BG, radius: 0.5, inset: 0.12 }), true);
  // Adaptive foreground: the mark must sit inside the central 66dp safe zone of 108dp.
  await render(`${dir}ic_launcher_foreground.png`, fg, fg, svg(fg, { inset: 0.27 }), true);
}
for (const dir of readdirSync(res).filter((x) => x.startsWith('drawable'))) {
  const p = `${res}${dir}/splash.png`;
  if (!existsSync(p)) continue;
  const [w, h] = pngSize(p);
  const logo = Math.round(Math.min(w, h) * 0.28);
  await render(p, w, h, svg(logo, { bg: BG }), false);
}
writeFileSync(`${res}values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
await browser.close();
console.log('android icons + splash written');
