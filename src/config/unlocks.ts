// Progressive feature unlocks (V1.6). Every gate is decided ONLY by real completed-stage
// records (`save.cleared`), never by the current screen or by how many stages are unlocked.
//
//   New game        → core combat only (Start Game is always available)
//   clear 1-4       → Shop + Cat Encyclopedia (one combined unlock card)
//   clear 1-10      → Sir Sable (chapter reward) + Edit Team (its tutorial starts at once)
//   clear 2-5       → Recruitment + Cat Food Cans (2 introductory cans, once)
//   clear 2-20      → Silver Devil (chapter reward, unchanged)
//
// Locked features keep their menu button (dimmed, lock icon, "Clear 1-4"); App.go() refuses
// to open a locked screen, so no button or alternate path can bypass a lock.

export type FeatureId = 'shop' | 'encyclopedia' | 'team' | 'recruit';

/** The stage whose first clear unlocks each feature. */
export const FEATURE_UNLOCKS: Record<FeatureId, string> = {
  shop: '1-4',
  encyclopedia: '1-4',
  team: '1-10',
  recruit: '2-5',
};

export function isFeatureUnlocked(save: { cleared: Record<string, number> }, f: FeatureId): boolean {
  return FEATURE_UNLOCKS[f] in save.cleared;
}

/** Which feature (if any) a screen belongs to. Practice screens are never locked, except Edit Team practice. */
export function featureOfScreen(screen: { name: string; practice?: boolean }): FeatureId | null {
  switch (screen.name) {
    case 'shop':
      return 'shop';
    case 'cats':
    case 'catProfile':
      return 'encyclopedia';
    case 'team':
      return 'team';
    case 'recruit':
      return 'recruit';
    default:
      return null;
  }
}

/** One-time unlock introductions (seen ids). */
export const UNLOCK_INTRO = {
  /** Combined Shop + Encyclopedia card after 1-4. */
  shopCats: 'unlock:shopCats',
  /** Recruitment + Cat Food Can card after 2-5 (also grants the introductory cans). */
  recruit: 'unlock:recruit',
} as const;

/** Cat Food Cans (貓罐頭): permanent currency used only for recruiting. */
export const CANS = {
  /** One-time gift when Recruitment unlocks. */
  introGift: 2,
} as const;
