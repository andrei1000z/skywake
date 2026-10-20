import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

const BUCHAREST = '/#map=8/44.43/26.10';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('shows live aircraft from the feed and counts them', async ({ page }) => {
  await page.goto(BUCHAREST);
  await expect(page.locator('.status')).toContainText(/\d+\s*aircraft in view/);
  await expect.poll(async () => Number((await page.locator('.status .strong').innerText()).replace(/\D/g, '')), { timeout: 15_000 }).toBeGreaterThan(5);
});

test('list → aircraft panel → deep link round-trip', async ({ page }) => {
  await page.goto(BUCHAREST);
  await expect.poll(() => page.locator('.status .strong').innerText(), { timeout: 15_000 }).not.toBe('0');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const first = page.locator('.ac-table tbody tr').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.locator('[data-panel="aircraft"]')).toBeVisible();
  await expect(page.locator('[data-panel="aircraft"]')).toContainText('Altitude');
  const hash = await page.evaluate(() => location.hash);
  expect(hash).toMatch(/ac=[0-9a-f]{6}/);

  // Reloading the shared link reopens the same aircraft.
  await page.reload();
  await expect(page.locator('[data-panel="aircraft"]')).toContainText('Altitude', { timeout: 15_000 });
});

test('search finds a live flight and an airport', async ({ page }) => {
  await page.goto(BUCHAREST);
  await expect.poll(() => page.locator('.status .strong').innerText(), { timeout: 15_000 }).not.toBe('0');
  const box = page.getByRole('combobox');
  await box.fill('THY2XD');
  await expect(page.getByRole('option').first()).toContainText('THY2XD');
  await box.fill('OTP');
  await expect(page.getByRole('option').first()).toContainText('Henri Coand');
  await page.getByRole('option').first().click();
  await expect(page.locator('[data-panel="airport"]')).toContainText('LROP');
});

test('filters hide traffic and flag the toolbar', async ({ page }) => {
  await page.goto(BUCHAREST);
  await expect.poll(() => page.locator('.status .strong').innerText(), { timeout: 15_000 }).not.toBe('0');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('switch', { name: /only military/i }).check({ force: true });
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveClass(/tool-flag/);
  await expect(page.locator('.status')).toContainText(/filter/i);
});

test('theme and language switch', async ({ page }) => {
  await page.goto(BUCHAREST);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark' }).check({ force: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Language').selectOption('ro');
  await expect(page.getByRole('button', { name: 'Filtre', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  await page.getByLabel('Limbă').selectOption('de');
  await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeVisible();
});

test('airport panel shows METAR weather', async ({ page }) => {
  await page.goto(`${BUCHAREST}&ap=LROP`);
  const panel = page.locator('[data-panel="airport"]');
  await expect(panel.getByText('METAR LROP 201630Z')).toBeVisible();
  await expect(panel.locator('.fltcat-vfr')).toHaveText('VFR');
  await expect(panel).toContainText('≥ 10 km');
});

test('aircraft panel shows a credited photo', async ({ page }) => {
  await page.goto(BUCHAREST);
  await expect.poll(() => page.locator('.status .strong').innerText(), { timeout: 15_000 }).not.toBe('0');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.locator('.ac-table tbody tr').first().click();
  const fig = page.locator('.ac-photo');
  await expect(fig).toBeVisible();
  await expect(fig.locator('figcaption')).toContainText('Test Photographer');
  const link = fig.locator('figcaption a');
  await expect(link).toHaveAttribute('href', 'https://www.planespotters.net/photo/1/test');
  expect(await link.getAttribute('rel')).not.toContain('nofollow');
});

test('no serious accessibility violations in the main views', async ({ page }) => {
  await page.goto(BUCHAREST);
  await expect.poll(() => page.locator('.status .strong').innerText(), { timeout: 15_000 }).not.toBe('0');
  const scan = async () =>
    (await new AxeBuilder({ page }).exclude('.maplibregl-canvas').exclude('.label-canvas').analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
  expect(await scan()).toEqual([]);
  for (const name of ['Filters', 'Map', 'About & data']) {
    await page.getByRole('button', { name, exact: true }).click();
    expect(await scan(), name).toEqual([]);
  }
});
