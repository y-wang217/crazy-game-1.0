// Feature flags for experimental or optional systems.
//
// Each flag has a shipped default here. A local override (developer tools, QA, or the
// debug panel) can be stored in localStorage under `catdefense.feature.<name>` as
// "1" / "0". Core progression never depends on an experimental flag.

export interface FeatureFlags {
  /**
   * EXPERIMENTAL — tap a mouse or chest to make every cat that can reach it attack it first
   * (gold crosshair). Off ⇒ taps on foes do nothing, no crosshair, no hint text; cats use
   * their own targeting modes only. The sim (Battle.setFocus / focusUid) stays inert unless
   * the UI calls it, so disabling it needs no balance or save changes.
   */
  focusTargeting: boolean;
}

export const FEATURE_DEFAULTS: FeatureFlags = { focusTargeting: true };

const KEY = (name: keyof FeatureFlags) => `catdefense.feature.${name}`;

/** Is this feature on? (local override if present, otherwise the shipped default) */
export function feature(name: keyof FeatureFlags): boolean {
  try {
    const v = globalThis.localStorage?.getItem(KEY(name));
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* storage unavailable (private mode, tests) */
  }
  return FEATURE_DEFAULTS[name];
}

/** Set (true/false) or clear (null) a local override. */
export function setFeatureOverride(name: keyof FeatureFlags, on: boolean | null): void {
  try {
    if (on === null) globalThis.localStorage?.removeItem(KEY(name));
    else globalThis.localStorage?.setItem(KEY(name), on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
