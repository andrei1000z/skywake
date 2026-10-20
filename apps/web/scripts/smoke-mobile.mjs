// Phone-size, dark-mode pass: search an airport, open its panel, screenshot.
import { chromium } from '@playwright/test';
const OUT = process.env.SHOT_DIR ?? '.';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.argv[2] ?? 'http://localhost:5173/#map=8/44.5/26.1');
await page.waitForTimeout(6000);
await page.getByRole('combobox').fill('OTP');
await page.waitForTimeout(1200);
const opts = await page.getByRole('option').allInnerTexts();
console.log('SEARCH OTP:', opts.slice(0, 4).join(' || ').replace(/\n/g, ' '));
await page.getByRole('option').first().click();
await page.waitForTimeout(3000);
console.log('PANEL:', (await page.locator('.panel').innerText()).slice(0, 250).replace(/\n/g, ' | '));
await page.screenshot({ path: `${OUT}/shot-mobile.png` });
console.log('PAGE ERRORS:', errors.join('; ') || 'none');
await browser.close();
