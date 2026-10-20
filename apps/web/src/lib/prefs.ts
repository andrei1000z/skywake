import type { FilterSpec } from '@skywake/shared';
import { useSyncExternalStore } from 'react';
import type { ColorMode } from '../map/colors';
import { load, save } from './storage';
import { DEFAULT_UNITS, type Units } from './units';

export type Theme = 'auto' | 'light' | 'dark';

export interface Preset {
  id: string;
  name: string;
  filter: FilterSpec;
}

export interface Bookmark {
  id: string;
  name: string;
  zoom: number;
  lat: number;
  lon: number;
}

export interface WatchItem {
  /** hex, callsign or registration, upper-case except hex */
  key: string;
  kind: 'hex' | 'callsign' | 'reg';
  label: string;
}

export interface Prefs {
  theme: Theme;
  units: Units;
  labels: boolean;
  airports: boolean;
  trails: boolean;
  colorMode: ColorMode;
  filter: FilterSpec;
  presets: Preset[];
  bookmarks: Bookmark[];
  watch: WatchItem[];
  alertEmergency: boolean;
  alertWatch: boolean;
}

const DEFAULTS: Prefs = {
  theme: 'auto',
  units: DEFAULT_UNITS,
  labels: true,
  airports: true,
  trails: true,
  colorMode: 'altitude',
  filter: {},
  presets: [],
  bookmarks: [],
  watch: [],
  alertEmergency: false,
  alertWatch: true,
};

let state: Prefs = { ...DEFAULTS, ...load<Partial<Prefs>>('prefs', {}) };
state.units = { ...DEFAULT_UNITS, ...state.units };
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  return state;
}

export function setPrefs(patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  save('prefs', state);
  listeners.forEach((f) => f());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => state,
  );
}

export const newId = () => Math.random().toString(36).slice(2, 10);
