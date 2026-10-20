import { useSyncExternalStore } from 'react';
import { de } from './locales/de';
import { type Dict, en, type MsgKey } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { ro } from './locales/ro';
import { load, save } from './storage';

export type { MsgKey };

export type Lang = 'en' | 'ro' | 'de' | 'fr' | 'es' | 'it';
const dicts: Record<Lang, Dict> = { en, ro, de, fr, es, it };

/** Native names, shown in the language picker. */
export const LANGS: [Lang, string][] = [
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['it', 'Italiano'],
  ['ro', 'Română'],
];

const isLang = (v: unknown): v is Lang => typeof v === 'string' && v in dicts;

function detect(): Lang {
  const saved = load<string | null>('lang', null);
  if (isLang(saved)) return saved;
  const prefs = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of prefs) {
    const base = tag?.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

let current: Lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = current;
const listeners = new Set<() => void>();

export function setLang(l: Lang) {
  current = l;
  save('lang', l);
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function t(key: MsgKey): string {
  return dicts[current][key];
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => current,
  );
}
