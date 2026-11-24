// Save-data number validation (audit C12). Every stored count (fish coins, cans, fragments,
// draw counters…) goes through here when a save is loaded, so a malformed or hand-edited value can
// never create currency: it becomes a finite, non-negative whole number within a safe limit.

/** Far above anything reachable in play; keeps arithmetic exact and JSON round-trips safe. */
export const MAX_SAVED_COUNT = 999_999_999;

/** Plain decimal text such as "12" or " 7 " (older or hand-edited saves). Not "1e400", "0x10", "". */
const NUMERIC_TEXT = /^\s*\d+(\.\d+)?\s*$/;

/**
 * A stored count: finite, ≥ 0, whole, capped. Plain numeric text is accepted (unambiguous);
 * anything else (NaN, Infinity, negatives, objects, "abc") becomes `fallback`.
 */
export function toCount(v: unknown, fallback = 0): number {
  const n = typeof v === "string" && NUMERIC_TEXT.test(v) ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return fallback;
  return Math.min(MAX_SAVED_COUNT, Math.floor(n));
}
