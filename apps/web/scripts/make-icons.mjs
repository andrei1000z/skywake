// Renders public/icon.svg to the PNG sizes the PWA manifest and Android need (uses Playwright's Chromium).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const out = (p) => new URL(`../public/icons/${p}`, import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['maskable-512.png', 512, 0.2]]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  // Maskable icons need a full-bleed background with the mark inside the safe zone.
  const svgSquare = pad ? svg.replace('rx="8"', 'rx="0"') : svg;
  await page.setContent(`<body style="margin:0;background:${pad ? '#0d1420' : 'transparent'};display:grid;place-items:center;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svgSquare.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`);
  await page.screenshot({ path: out(name).pathname.replace(/^\/([A-Z]:)/, '$1'), omitBackground: !pad });
}
await browser.close();
console.log('icons written');
