import { useSyncExternalStore } from 'react';
import { ALL_STAGE_IDS, findStage } from '../config/chapters';
import { findCosmetic } from '../config/cosmetics';
import { computeStars, nextStageId, stageClearCoins } from '../game/progression';
import {
  claimChapterRewards,
  exchangeFragments,
  topUpFragments,
  recruit,
  sanitizeCollection,
  sanitizeTeam,
  setTeam,
  upgradeStar,
  type ChapterGrant,
  type CollectionState,
  type OwnedCat,
  type RecruitResult,
  type UpgradeResult,
} from '../game/collection';
import type { CatId, CosmeticLoadout } from '../game/types';
import { CANS, isFeatureUnlocked } from '../config/unlocks';

/** Milestone id of the one-time introductory Cat Food Can gift. */
export const CANS_INTRO = 'cans:intro';

// Persistent progression only. Battle cats/skills/dried fish are never saved.
//
// Save format history (the storage key stays the same so old saves keep working):
//   v1 — coins, unlocks, stars, cosmetics.
//   v2 — adds `seen`: ids of tutorials and first-time introductions already shown
//        (e.g. "cat:kitten", "enemy:fast", "chest:bronze", "tut:summon").
//   v3 — adds the permanent cat collection: owned cats with star rank + fragments,
//        the 5-species battle team, recruitment guarantee counter and claimed
//        chapter-completion rewards. Older saves get the five starter cats at 1★.
//   v4 — (V1.6) Cat Food Cans: `cans` (recruitment currency), `canDraws` and
//        `milestones` (one-time grants such as the introductory cans, kept separate from
//        `seen` so "show first-time tips again" can never re-grant anything). Older saves
//        start with 0 cans; their coins, cats, fragments and recruit counters are kept.
// parseSave() accepts any older version and fills new fields with safe defaults.

const KEY = 'catdefense.save.v1';
export const SAVE_VERSION = 4;

export interface SaveData {
  version: 4;
  fishCoins: number;
  /** Cat Food Cans (貓罐頭): recruitment currency. */
  cans: number;
  /** Draws paid with cans (the first one is a guaranteed new cat). */
  canDraws: number;
  /** One-time grants already given (e.g. 'cans:intro'). Never cleared by tutorial resets. */
  milestones: string[];
  /** Stage ids the player may enter. */
  unlocked: string[];
  /** Best stars per cleared stage. */
  cleared: Record<string, number>;
  owned: string[];
  equipped: CosmeticLoadout;
  /** Tutorial steps and introductions the player has already completed. */
  seen: string[];
  /** Owned cats: permanent star rank (1–5) and unspent fragments. */
  collection: Partial<Record<CatId, OwnedCat>>;
  /** Species random summons pick from (TEAM_SIZE). */
  team: CatId[];
  recruitStreak: number;
  recruitDraws: number;
  /** Chapters whose completion cat was granted. */
  chapterRewards: string[];
}

export function defaultSave(): SaveData {
  return {
    version: 4,
    fishCoins: 0,
    cans: 0,
    canDraws: 0,
    milestones: [],
    unlocked: [ALL_STAGE_IDS[0]],
    cleared: {},
    owned: [],
    equipped: { hat: null, skins: {} },
    seen: [],
    collection: sanitizeCollection(null),
    team: sanitizeTeam(null, sanitizeCollection(null)),
    recruitStreak: 0,
    recruitDraws: 0,
    chapterRewards: [],
  };
}

/** Defensive parse: anything malformed falls back to defaults. */
/**
 * Every cleared stage unlocks the one after it (also across chapters). Older saves
 * that cleared 1-10 before Chapter 2 existed therefore get 2-1 unlocked on load —
 * nothing is ever locked or reset.
 */
export function withProgressUnlocks(unlocked: string[], cleared: Record<string, number>): string[] {
  const set = new Set(unlocked);
  for (const id of Object.keys(cleared)) {
    set.add(id);
    const i = ALL_STAGE_IDS.indexOf(id);
    if (i >= 0 && i < ALL_STAGE_IDS.length - 1) set.add(ALL_STAGE_IDS[i + 1]);
  }
  return ALL_STAGE_IDS.filter((x) => set.has(x));
}

export function parseSave(raw: string | null): SaveData {
  const d = defaultSave();
  if (!raw) return d;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return d;
    const unlocked = Array.isArray(o.unlocked) ? o.unlocked.filter((s: unknown) => typeof s === 'string' && ALL_STAGE_IDS.includes(s as string)) : [];
    const owned = Array.isArray(o.owned) ? o.owned.filter((s: unknown) => typeof s === 'string' && findCosmetic(s as string)) : [];
    const cleared: Record<string, number> = {};
    if (o.cleared && typeof o.cleared === 'object') {
      for (const [k, v] of Object.entries(o.cleared)) {
        if (ALL_STAGE_IDS.includes(k) && typeof v === 'number') cleared[k] = Math.max(1, Math.min(3, Math.round(v)));
      }
    }
    const eq = o.equipped ?? {};
    const hat = typeof eq.hat === 'string' && owned.includes(eq.hat) ? eq.hat : null;
    const skins: Partial<Record<CatId, string>> = {};
    if (eq.skins && typeof eq.skins === 'object') {
      for (const [cat, id] of Object.entries(eq.skins)) {
        const c = findCosmetic(id as string);
        if (c && c.slot === 'skin' && c.cat === cat && owned.includes(c.id)) skins[cat as CatId] = c.id;
      }
    }
    const seen = Array.isArray(o.seen) ? Array.from(new Set(o.seen.filter((x: unknown) => typeof x === 'string'))) as string[] : [];
    const collection = sanitizeCollection(o.collection);
    const int = (v: unknown) => (typeof v === 'number' && v >= 0 ? Math.floor(v) : 0);
    return {
      version: 4,
      fishCoins: int(o.fishCoins),
      cans: int(o.cans),
      canDraws: int(o.canDraws),
      milestones: Array.isArray(o.milestones) ? Array.from(new Set(o.milestones.filter((x: unknown) => typeof x === 'string'))) as string[] : [],
      unlocked: withProgressUnlocks(unlocked.length ? [ALL_STAGE_IDS[0], ...unlocked] : d.unlocked, cleared),
      cleared,
      owned,
      equipped: { hat, skins },
      seen,
      collection,
      team: sanitizeTeam(o.team, collection),
      recruitStreak: int(o.recruitStreak),
      recruitDraws: int(o.recruitDraws),
      chapterRewards: Array.isArray(o.chapterRewards) ? o.chapterRewards.filter((x: unknown) => typeof x === 'string') : [],
    };
  } catch {
    return d;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

let state: SaveData = parseSave(safeStorage()?.getItem(KEY) ?? null);
const listeners = new Set<() => void>();

function commit(next: SaveData): void {
  state = next;
  try {
    safeStorage()?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode: keep in memory */
  }
  listeners.forEach((l) => l());
}

export const saveStore = {
  get: (): SaveData => state,
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  addCoins(amount: number): void {
    if (amount <= 0) return;
    commit({ ...state, fishCoins: state.fishCoins + Math.floor(amount) });
  },

  /** Record a victory. Returns coins awarded and whether it was the first clear. */
  completeStage(stageId: string, baseHp: number, maxBaseHp: number): { coins: number; firstClear: boolean; stars: number } {
    const found = findStage(stageId);
    if (!found) return { coins: 0, firstClear: false, stars: 0 };
    const stars = computeStars(baseHp, maxBaseHp);
    const firstClear = !(stageId in state.cleared);
    const coins = stageClearCoins(found.stage, firstClear);
    const next = nextStageId(stageId);
    const unlocked = next && !state.unlocked.includes(next) ? [...state.unlocked, next] : state.unlocked;
    commit({
      ...state,
      fishCoins: state.fishCoins + coins,
      unlocked,
      cleared: { ...state.cleared, [stageId]: Math.max(state.cleared[stageId] ?? 0, stars) },
    });
    return { coins, firstClear, stars };
  },

  buyCosmetic(id: string): { ok: boolean; reason?: string } {
    const c = findCosmetic(id);
    if (!c) return { ok: false, reason: 'Unknown item' };
    if (state.owned.includes(id)) return { ok: false, reason: 'Already owned' };
    // A skin is for one cat: recruit the cat first (hats fit everyone).
    if (c.slot === 'skin' && c.cat && !state.collection[c.cat]) return { ok: false, reason: 'locked' };
    if (state.fishCoins < c.price) return { ok: false, reason: 'Not enough fish coins' };
    commit({ ...state, fishCoins: state.fishCoins - c.price, owned: [...state.owned, id] });
    return { ok: true };
  },

  /** Toggle equip; equipping an owned item replaces the current one in that slot. */
  toggleEquip(id: string): void {
    const c = findCosmetic(id);
    if (!c || !state.owned.includes(id)) return;
    const eq = { hat: state.equipped.hat, skins: { ...state.equipped.skins } };
    if (c.slot === 'hat') {
      eq.hat = eq.hat === id ? null : id;
    } else if (c.cat) {
      if (eq.skins[c.cat] === id) delete eq.skins[c.cat];
      else eq.skins[c.cat] = id;
    }
    commit({ ...state, equipped: eq });
  },

  hasSeen(id: string): boolean {
    return state.seen.includes(id);
  },

  markSeen(id: string): void {
    if (state.seen.includes(id)) return;
    commit({ ...state, seen: [...state.seen, id] });
  },

  // ---------------- Cat collection ----------------

  recruit(rand?: () => number): RecruitResult {
    const r = recruit(collectionOf(state), rand);
    if (r.ok) commit({ ...state, ...r.state });
    return r;
  },

  upgradeStar(id: CatId): UpgradeResult {
    const r = upgradeStar(collectionOf(state), id);
    if (r.ok) commit({ ...state, ...r.state });
    return r;
  },

  /** Buy the fragments still missing for this cat's next star. Returns how many were bought. */
  topUpFragments(id: CatId): number {
    const r = topUpFragments(collectionOf(state), id);
    if (r.ok) commit({ ...state, ...r.state });
    return r.bought;
  },

  exchangeFragments(id: CatId): number {
    const r = exchangeFragments(collectionOf(state), id);
    if (r.ok) commit({ ...state, ...r.state });
    return r.coins;
  },

  setTeam(team: CatId[]): boolean {
    const r = setTeam(collectionOf(state), team);
    if (r.ok) commit({ ...state, ...r.state });
    return r.ok;
  },

  /** Grant any chapter-completion cats not yet received (safe to call any time). */
  claimChapterRewards(): ChapterGrant[] {
    const r = claimChapterRewards(collectionOf(state));
    if (r.grants.length) commit({ ...state, ...r.state });
    return r.grants;
  },

  /**
   * Recruitment unlock (first clear of 2-5): give the introductory Cat Food Cans exactly once
   * (also retroactively for players already past 2-5). Returns how many were given now.
   */
  claimRecruitIntro(): number {
    if (!isFeatureUnlocked(state, 'recruit') || state.milestones.includes(CANS_INTRO)) return 0;
    commit({ ...state, cans: state.cans + CANS.introGift, milestones: [...state.milestones, CANS_INTRO] });
    return CANS.introGift;
  },

  /** Show every tutorial and introduction again (keeps coins, unlocks and cosmetics). */
  resetTutorials(): void {
    commit({ ...state, seen: [] });
  },

  reset(): void {
    commit(defaultSave());
  },
};

function collectionOf(s: SaveData): CollectionState {
  return {
    fishCoins: s.fishCoins,
    cans: s.cans,
    canDraws: s.canDraws,
    collection: s.collection,
    team: s.team,
    recruitStreak: s.recruitStreak,
    recruitDraws: s.recruitDraws,
    chapterRewards: s.chapterRewards,
    cleared: s.cleared,
  };
}

export function useSave(): SaveData {
  return useSyncExternalStore(saveStore.subscribe, saveStore.get, saveStore.get);
}
