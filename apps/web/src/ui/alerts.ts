import { type Aircraft, isEmergency } from '@skywake/shared';
import { liveStore } from '../data/liveStore';
import { t } from '../lib/i18n';
import { getPrefs, type WatchItem } from '../lib/prefs';

export interface Toast {
  id: number;
  title: string;
  body: string;
  hex: string;
}

/**
 * In-app alert engine. Delivery: system notification when permitted, always an in-app toast.
 * Runs only while Skywake is open (there is no push server); documented as such.
 */
export class AlertEngine {
  private seenEmergency = new Map<string, number>();
  private seenWatch = new Set<string>();
  private nextId = 1;
  private unsub: (() => void) | null = null;

  constructor(private onToast: (t: Toast) => void) {}

  start() {
    this.unsub = liveStore.subscribe(() => this.check());
  }

  stop() {
    this.unsub?.();
  }

  static matchesWatch(ac: Aircraft, w: WatchItem): boolean {
    if (w.kind === 'hex') return ac.hex === w.key;
    if (w.kind === 'callsign') return ac.callsign === w.key;
    return (ac.reg ?? '').replace(/-/g, '') === w.key.replace(/-/g, '');
  }

  private check() {
    const p = getPrefs();
    const now = Date.now();
    for (const tr of liveStore.aircraft.values()) {
      const ac = tr.ac;
      if (p.alertEmergency && isEmergency(ac)) {
        const last = this.seenEmergency.get(ac.hex);
        // Re-alert at most every 30 minutes per aircraft.
        if (!last || now - last > 30 * 60_000) {
          this.seenEmergency.set(ac.hex, now);
          this.fire(t('emergencyAlert'), `${ac.callsign ?? ac.hex.toUpperCase()} · ${ac.squawk ?? ac.emergency ?? ''}`, ac.hex);
        }
      }
      if (p.alertWatch && p.watch.length) {
        for (const w of p.watch) {
          const key = `${w.kind}:${w.key}`;
          if (AlertEngine.matchesWatch(ac, w) && !this.seenWatch.has(key)) {
            this.seenWatch.add(key);
            this.fire(t('watchAlert'), `${w.label}${ac.callsign && ac.callsign !== w.label ? ` (${ac.callsign})` : ''}`, ac.hex);
          }
        }
      }
    }
  }

  private fire(title: string, body: string, hex: string) {
    const toast = { id: this.nextId++, title, body, hex };
    this.onToast(toast);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        void new Notification(`Skywake · ${title}`, { body, tag: `${title}-${hex}`, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` });
      }
    } catch {
      /* some WebViews expose Notification but forbid the constructor */
    }
  }
}
