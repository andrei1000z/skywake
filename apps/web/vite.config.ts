import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// BASE_PATH is "/skywake/" for GitHub Pages project sites, "/" elsewhere (Capacitor, self-host).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    // MapLibre changes rarely: its own chunk stays cached across app deploys.
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'maplibre', test: /node_modules[\\/].*maplibre-gl/ }, { name: 'react', test: /node_modules[\\/].*react(-dom)?[\\/]/ }] } },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
