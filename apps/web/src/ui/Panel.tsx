import { type ReactNode, useEffect, useRef } from 'react';
import { t } from '../lib/i18n';
import { IconClose } from './Icons';

/**
 * Responsive container: a floating side card on wide screens, a bottom sheet on phones.
 * Escape closes it; focus moves into it when opened so keyboard users land in context.
 */
export function Panel({ title, subtitle, onClose, children, actions, id }: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  id: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <section className="panel" ref={ref} tabIndex={-1} aria-labelledby={`${id}-title`} data-panel={id}>
      <div className="panel-grip" aria-hidden="true" />
      <header className="panel-head">
        <div className="panel-titles">
          <h2 id={`${id}-title`}>{title}</h2>
          {subtitle && <div className="panel-sub">{subtitle}</div>}
        </div>
        {actions}
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('close')}>
          <IconClose />
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{children}</dd>
    </div>
  );
}
