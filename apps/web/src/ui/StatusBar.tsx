import { t, useLang } from '../lib/i18n';
import { fmtAge } from '../lib/units';
import { useClock, useFeedStatus } from './hooks';

export function StatusBar({ visible, filtered }: { visible: number; filtered: boolean }) {
  useLang();
  const s = useFeedStatus();
  const now = useClock(1000);
  const age = s.oldestSnapshot ? now - s.oldestSnapshot : null;
  const dot = s.state === 'live' ? 'dot-ok' : s.state === 'loading' ? 'dot-idle' : 'dot-warn';
  return (
    <div className="status" role="status" aria-live="polite">
      <span className={`dot ${dot}`} aria-hidden="true" />
      <span className="mono strong">{visible.toLocaleString()}</span>
      <span className="muted">{t('aircraft').toLowerCase()} {filtered ? `(${t('filtered')})` : t('inView')}</span>
      {age !== null && (
        <span className="muted" title={t('dataAge')}>
          · <span className="mono">{fmtAge(age)}</span>
        </span>
      )}
    </div>
  );
}

export function Banner() {
  useLang();
  const s = useFeedStatus();
  let msg: string | null = null;
  let tone = 'info';
  if (s.state === 'offline') { msg = t('offline'); tone = 'warn'; }
  else if (s.state === 'error') { msg = t(s.lastError === 'api_not_configured' ? 'apiNotConfigured' : 'errorData'); tone = 'warn'; }
  else if (s.state === 'stale') { msg = t('stale'); tone = 'warn'; }
  else if (s.state === 'loading') msg = t('loading');
  else if (s.truncated) msg = t('zoomIn');
  if (!msg) return null;
  return <div className={`banner banner-${tone}`} role={tone === 'warn' ? 'alert' : 'status'}>{msg}</div>;
}
