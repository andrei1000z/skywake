// Screenshots the airport panel (METAR) and an aircraft panel (photo) against the real local worker.
import { chromium } from '@playwright/test';
const OUT = process.env.SHOT_DIR ?? '.';
const scheme = process.env.SCHEME ?? 'light';
const cell = await (await fetch('http://localhost:8787/v1/cell/33_51', { headers: { origin: 'http://localhost:5173' } })).json();
const ac = cell.aircraft.find((a) => a.reg && a.type && !a.onGround) ?? cell.aircraft[0];
console.log('aircraft', ac?.hex, ac?.reg, ac?.type);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// Planespotters rejects the HeadlessChrome user agent; a normal desktop UA matches what real visitors send.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: scheme, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/#map=9/44.57/26.10&ap=LROP');
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/detail-airport-${scheme}.png`, clip: { x: 0, y: 0, width: 640, height: 860 } });
await page.goto(`http://localhost:5173/#map=8/${ac.lat}/${ac.lon}&ac=${ac.hex}`);
await page.reload();
await page.waitForTimeout(6000);
console.log('photo:', await page.locator('.ac-photo img').count());
await page.screenshot({ path: `${OUT}/detail-aircraft-${scheme}.png`, clip: { x: 0, y: 0, width: 640, height: 860 } });
console.log('PAGE ERRORS:', errors.join('; ') || 'none');
await browser.close();
