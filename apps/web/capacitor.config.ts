import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.andrei1000z.skywake',
  appName: 'Skywake',
  webDir: 'dist',
  android: {
    // Served from https://localhost inside the WebView; the API allowlists that origin.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    StatusBar: { overlaysWebView: true },
  },
};

export default config;
