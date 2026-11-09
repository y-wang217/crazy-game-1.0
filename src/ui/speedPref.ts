import { BALANCE } from '../config/balance';

// The player's chosen battle speed is remembered between battles (a per-device preference,
// like theme and language). Anything unknown falls back to the default 1×.
const KEY = 'catdefense.speed';

export function loadSpeed(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    if (BALANCE.speed.options.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return BALANCE.speed.default;
}

export function saveSpeed(v: number): void {
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    /* ignore */
  }
}
