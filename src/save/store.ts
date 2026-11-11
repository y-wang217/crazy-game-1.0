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
import { CANS, TUTORIALS, TUTORIAL_UNLOCK_STAGE, isFeatureUnlocked } from '../config/unlocks';
import { CAN_MONSTER, GOLD_CHEST_CAN, MILESTONE_CANS, isCanMonsterStage, milestoneId } from '../config/canRewards';

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
//   v5 — `attempts` (battles started per stage: the secret Living Cat Food Can always appears on
//        a stage's first attempt) and `tutorials` (completed / skipped state per tutorial).
//        Saves from before v5 have their already-passed unlock tours marked "legacy" so old
//        tutorials never interrupt an advanced player (they stay in the replay menu).
// parseSave() accepts any older version and fills new fields with safe defaults.

const KEY = 'catdefense.save.v1';
export const SAVE_VERSION = 5;

export type TutorialState = 'done' | 'skipped' | 'legacy';

export interface SaveData {
  version: 5;
  /** Battles started per stage id (first attempt ≠ first victory). */
  attempts: Record<string, number>;
  /** Unlock tutorials: completed, deliberately skipped, or passed before they existed (legacy). */
  tutorials: Record<string, TutorialState>;
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
    version: 5,
    attempts: {},
    tutorials: {},
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
      version: 5,
      attempts: cleanAttempts(o.attempts),
      tutorials: migrateTutorials(o, cleared, seen),
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

function cleanAttempts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object')
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (ALL_STAGE_IDS.includes(k) && typeof v === 'number' && v > 0) out[k] = Math.floor(v);
  return out;
}

/**
 * Tutorial states. Saves from before v5: every unlock tour whose stage was already cleared is
 * marked 'legacy' (never auto-started again: no interruptions for advanced players; still in
 * the replay menu), unless an older flag already shows how it ended.
 */
function migrateTutorials(o: Record<string, unknown>, cleared: Record<string, number>, seen: string[]): Record<string, TutorialState> {
  const out: Record<string, TutorialState> = {};
  if (o.tutorials && typeof o.tutorials === 'object')
    for (const [k, v] of Object.entries(o.tutorials as Record<string, unknown>)) if (v === 'done' || v === 'skipped' || v === 'legacy') out[k] = v;
  if (typeof o.version === 'number' && o.version >= 5) return out;
  for (const [id, stage] of Object.entries(TUTORIAL_UNLOCK_STAGE) as [string, string][]) {
    if (out[id] || !(stage in cleared)) continue;
    // The Edit Team lesson already tracked its own completion before v5.
    out[id] = id === TUTORIALS.team && seen.includes('tut:team') ? 'done' : 'legacy';
  }
  return out;
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
  completeStage(stageId: string, baseHp: number, maxBaseHp: number): { coins: number; firstClear: boolean; stars: number; cans: number } {
    const found = findStage(stageId);
    if (!found) return { coins: 0, firstClear: false, stars: 0, cans: 0 };
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
    // One-time first-clear Cat Food Cans (2-8, 2-10, …), never twice.
    const cans = this.claimMilestoneCans(stageId);
    return { coins, firstClear, stars, cans };
  },

  /**
   * Grant the one-time first-clear Cat Food Cans for cleared milestone stages not yet paid
   * (one stage, or all of them for older saves). Returns how many cans were added.
   */
  claimMilestoneCans(only?: string): number {
    let add = 0;
    const got: string[] = [];
    for (const [stage, n] of Object.entries(MILESTONE_CANS)) {
      if (only && stage !== only) continue;
      const id = milestoneId.clear(stage);
      if (!(stage in state.cleared) || state.milestones.includes(id)) continue;
      add += n;
      got.push(id);
    }
    if (add) commit({ ...state, cans: state.cans + add, milestones: [...state.milestones, ...got] });
    return add;
  },

  /** A battle on this stage starts. Returns how many attempts came before it. */
  recordAttempt(stageId: string): number {
    const before = state.attempts[stageId] ?? 0;
    commit({ ...state, attempts: { ...state.attempts, [stageId]: before + 1 } });
    return before;
  },

  /** The Living Cat Food Can was defeated: 1 can the first time on this stage, coins after that. */
  claimCanMonster(stageId: string): { cans: number; coins: number } {
    if (!isCanMonsterStage(stageId)) return { cans: 0, coins: 0 };
    const id = milestoneId.canMonster(stageId);
    if (!state.milestones.includes(id)) {
      commit({ ...state, cans: state.cans + CAN_MONSTER.rewardCans, milestones: [...state.milestones, id] });
      return { cans: CAN_MONSTER.rewardCans, coins: 0 };
    }
    commit({ ...state, fishCoins: state.fishCoins + CAN_MONSTER.repeatCoins });
    return { cans: 0, coins: CAN_MONSTER.repeatCoins };
  },

  /**
   * A Gold Chest broke: after 2-5 it has a 4% chance of +1 can, at most once per stage per save
   * (never on the four can-monster stages, which have their own once-per-stage can).
   */
  rollGoldChestCan(stageId: string, rand: () => number = Math.random): number {
    if (!isFeatureUnlocked(state, 'recruit') || isCanMonsterStage(stageId)) return 0;
    const id = milestoneId.goldChest(stageId);
    if (state.milestones.includes(id) || !(rand() < GOLD_CHEST_CAN.chance)) return 0;
    commit({ ...state, cans: state.cans + GOLD_CHEST_CAN.cans, milestones: [...state.milestones, id] });
    return GOLD_CHEST_CAN.cans;
  },

  /** Record how an unlock tutorial ended ('done' | 'skipped'). Replays never call this. */
  setTutorial(id: string, outcome: TutorialState): void {
    if (state.tutorials[id] === outcome) return;
    commit({ ...state, tutorials: { ...state.tutorials, [id]: outcome } });
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
