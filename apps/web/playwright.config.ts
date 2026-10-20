import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build. API calls are served from a captured real ADSB.lol
// snapshot (see e2e/fixtures.ts) so CI never puts load on the volunteer upstream.
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  // The map renders with software WebGL (SwiftShader); several parallel browsers starve the CPU and
  // make data-timing assertions fail. Two workers on CI runners, one locally (16 tests ≈ 1 min).
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // The mocked API lives at the dev default; production builds require VITE_API_BASE explicitly.
    command: 'pnpm build && pnpm preview --strictPort',
    env: { VITE_API_BASE: 'http://localhost:8787' },
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
