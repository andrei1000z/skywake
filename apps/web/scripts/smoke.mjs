// Smoke test against the real app + local worker: real aircraft render, selection opens panel.
import { chromium } from '@playwright/test';

const OUT = 'C:/Users/Andrei/AppData/Local/Temp/claude/C--Users-Andrei/0712b789-5140-42f1-9b6d-4ac99b47a851/scratchpad/';
const url = process.argv[2] ?? 'http://localhost:5173/#map=7/44.4/26.1';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const api = [];
page.on('response', (r) => { if (r.url().includes(':8787/')) api.push(`${r.status()} ${r.url().replace('http://localhost:8787', '')}`); });
await page.goto(url);
await page.waitForTimeout(9000);
const status = await page.locator('.status').innerText().catch(() => 'no status');
console.log('STATUS:', status.replace(/\n/g, ' | '));
await page.screenshot({ path: OUT + 'shot-map.png' });
// Open list, click first aircraft
await page.getByRole('button', { name: /list|listă/i }).click();
await page.waitForTimeout(800);
const rows = await page.locator('.ac-table tbody tr').count();
console.log('LIST ROWS:', rows);
if (rows) {
  await page.locator('.ac-table tbody tr').first().click();
  await page.waitForTimeout(2500);
  console.log('PANEL:', (await page.locator('.panel').innerText()).slice(0, 300).replace(/\n/g, ' | '));
  console.log('HASH:', await page.evaluate(() => location.hash));
}
await page.screenshot({ path: OUT + 'shot-aircraft.png' });
console.log('API:', [...new Set(api)].slice(0, 12).join('\n  '));
console.log('ERRORS:', errors.slice(0, 15).join('\n  ') || 'none');
await browser.close();
