import { type FilterSpec, isFilterActive, type PositionSource } from '@skywake/shared';
import { useState } from 'react';
import { type MsgKey, t, useLang } from '../lib/i18n';
import { newId, setPrefs, usePrefs } from '../lib/prefs';
import { Panel } from './Panel';

const SOURCES: PositionSource[] = ['adsb', 'mlat', 'tisb', 'adsr', 'modes', 'other'];

const list = (s: string) => s.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
const numOrUndef = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? undefined : Number(s));

export function FilterPanel({ onClose }: { onClose: () => void }) {
  useLang();
  const prefs = usePrefs();
  const f = prefs.filter;
  const [presetName, setPresetName] = useState('');
  const set = (patch: Partial<FilterSpec>) => setPrefs({ filter: { ...f, ...patch } });

  return (
    <Panel id="filters" title={t('filters')} onClose={onClose}>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <div className="grid2">
          <NumInput label={t('altMin')} value={f.altMin} onChange={(v) => set({ altMin: v })} />
          <NumInput label={t('altMax')} value={f.altMax} onChange={(v) => set({ altMax: v })} />
          <NumInput label={t('speedMin')} value={f.speedMin} onChange={(v) => set({ speedMin: v })} />
          <NumInput label={t('speedMax')} value={f.speedMax} onChange={(v) => set({ speedMax: v })} />
        </div>
        <TextList label={t('callsignPrefixes')} hint={t('callsignPrefixesHint')} value={f.callsignPrefixes} onChange={(v) => set({ callsignPrefixes: v })} />
        <TextList label={t('types')} hint={t('typesHint')} value={f.types} onChange={(v) => set({ types: v })} />
        <fieldset>
          <legend>{t('sources')}</legend>
          <div className="chips">
            {SOURCES.map((s) => {
              const on = f.sources?.includes(s) ?? false;
              return (
                <label key={s} className={`chip ${on ? 'chip-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => set({ sources: on ? f.sources!.filter((x) => x !== s) : [...(f.sources ?? []), s] })}
                  />
                  {t(s as MsgKey)}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Toggle label={t('hideGround')} checked={!!f.hideGround} onChange={(v) => set({ hideGround: v || undefined })} />
        <Toggle label={t('onlyEmergency')} checked={!!f.onlyEmergency} onChange={(v) => set({ onlyEmergency: v || undefined })} />
        <Toggle label={t('onlyMilitary')} checked={!!f.onlyMilitary} onChange={(v) => set({ onlyMilitary: v || undefined })} />
        <button type="button" className="btn" disabled={!isFilterActive(f)} onClick={() => setPrefs({ filter: {} })}>
          {t('clearFilters')}
        </button>
      </form>

      <section className="sub-section">
        <h3>{t('presets')}</h3>
        <div className="inline-form">
          <input aria-label={t('presetName')} placeholder={t('presetName')} value={presetName} maxLength={40} onChange={(e) => setPresetName(e.target.value)} />
          <button
            type="button"
            className="btn"
            disabled={!presetName.trim() || !isFilterActive(f)}
            onClick={() => {
              setPrefs((p) => ({ presets: [...p.presets, { id: newId(), name: presetName.trim(), filter: f }] }));
              setPresetName('');
            }}
          >
            {t('savePreset')}
          </button>
        </div>
        <ul className="plain-list">
          {prefs.presets.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              <button type="button" className="link-btn" onClick={() => setPrefs({ filter: p.filter })}>{t('apply')}</button>
              <button type="button" className="link-btn danger" onClick={() => setPrefs((s) => ({ presets: s.presets.filter((x) => x.id !== p.id) }))}>{t('delete')}</button>
            </li>
          ))}
        </ul>
      </section>
    </Panel>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <label className="input">
      <span>{label}</span>
      <input type="number" inputMode="numeric" value={value ?? ''} onChange={(e) => onChange(numOrUndef(e.target.value))} />
    </label>
  );
}

function TextList({ label, hint, value, onChange }: { label: string; hint: string; value: string[] | undefined; onChange: (v: string[] | undefined) => void }) {
  const [text, setText] = useState((value ?? []).join(', '));
  return (
    <label className="input">
      <span>{label}</span>
      <input
        value={text}
        placeholder={hint}
        autoCapitalize="characters"
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          const l = list(e.target.value);
          onChange(l.length ? l : undefined);
        }}
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} aria-checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
