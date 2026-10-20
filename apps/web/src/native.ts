/**
 * Thin bridge to Capacitor plugins. On the web these are no-ops, and the plugin code is only
 * loaded inside the Android app, so the website bundle doesn't pay for it.
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export function isNative(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

type BackHandler = () => boolean;
const handlers: BackHandler[] = [];
let installed = false;

/** Register a back handler; return true from it when you consumed the press. */
export function onNativeBack(h: BackHandler): () => void {
  handlers.push(h);
  if (isNative() && !installed) {
    installed = true;
    void import('@capacitor/app').then(({ App }) => {
      void App.addListener('backButton', () => {
        for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i]!()) return;
        void App.minimizeApp();
      });
    });
  }
  return () => {
    const i = handlers.indexOf(h);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export async function setupNativeChrome(dark: boolean) {
  if (!isNative()) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
}
