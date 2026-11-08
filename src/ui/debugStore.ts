import { useSyncExternalStore } from 'react';
import { NEUTRAL_TUNING, type Tuning } from '../config/debug';

// Developer-only settings, kept separate from the player's save.
// Enable with ?debug in the URL (persists), disable with ?debug=0, or tap the version label 5×.

const KEY = 'catdefense.debug';

interface DebugState {
  enabled: boolean;
  tuning: Tuning;
}

function load(): DebugState {
  const d: DebugState = { enabled: false, tuning: { ...NEUTRAL_TUNING } };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      d.enabled = !!o.enabled;
      d.tuning = { ...NEUTRAL_TUNING, ...(o.tuning ?? {}) };
    }
    const q = new URLSearchParams(window.location.search).get('debug');
    if (q !== null) d.enabled = q !== '0';
  } catch {
    /* ignore */
  }
  return d;
}

let state = load();
const listeners = new Set<() => void>();

function commit(next: DebugState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const debugStore = {
  get: () => state,
  setEnabled: (enabled: boolean) => commit({ ...state, enabled }),
  setTuning: (patch: Partial<Tuning>) => commit({ ...state, tuning: { ...state.tuning, ...patch } }),
  resetTuning: () => commit({ ...state, tuning: { ...NEUTRAL_TUNING } }),
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useDebug(): DebugState {
  return useSyncExternalStore(debugStore.subscribe, debugStore.get, debugStore.get);
}
