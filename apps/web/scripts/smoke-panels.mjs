// Screenshots each tool panel (desktop) so layout regressions are visible.
import { chromium } from '@playwright/test';
const OUT = process.env.SHOT_DIR ?? '.';
const scheme = process.env.SCHEME ?? 'dark';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.argv[2] ?? 'http://localhost:5173/#map=9/44.57/26.10&ap=LROP');
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/panel-airport-${scheme}.png`, clip: { x: 0, y: 0, width: 640, height: 800 } });
for (const name of ['Filters', 'Map', 'About & data']) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/panel-${name.split(' ')[0].toLowerCase()}-${scheme}.png`, clip: { x: 0, y: 0, width: 640, height: 800 } });
}
console.log('PAGE ERRORS:', errors.join('; ') || 'none');
await browser.close();
