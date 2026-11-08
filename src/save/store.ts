import { useSyncExternalStore } from 'react';
import { ALL_STAGE_IDS, findStage } from '../config/chapters';
import { findCosmetic } from '../config/cosmetics';
import { computeStars, nextStageId, stageClearCoins } from '../game/progression';
import type { CatId, CosmeticLoadout } from '../game/types';

// Persistent progression only. Battle cats/skills/dried fish are never saved.
//
// Save format history (the storage key stays the same so old saves keep working):
//   v1 — coins, unlocks, stars, cosmetics.
//   v2 — adds `seen`: ids of tutorials and first-time introductions already shown
//        (e.g. "cat:kitten", "enemy:fast", "chest:bronze", "tut:summon").
// parseSave() accepts any older version and fills new fields with safe defaults.

const KEY = 'catdefense.save.v1';
export const SAVE_VERSION = 2;

export interface SaveData {
  version: 2;
  fishCoins: number;
  /** Stage ids the player may enter. */
  unlocked: string[];
  /** Best stars per cleared stage. */
  cleared: Record<string, number>;
  owned: string[];
  equipped: CosmeticLoadout;
  /** Tutorial steps and introductions the player has already completed. */
  seen: string[];
}

export function defaultSave(): SaveData {
  return {
    version: 2,
    fishCoins: 0,
    unlocked: [ALL_STAGE_IDS[0]],
    cleared: {},
    owned: [],
    equipped: { hat: null, skins: {} },
    seen: [],
  };
}

/** Defensive parse: anything malformed falls back to defaults. */
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
    return {
      version: 2,
      fishCoins: typeof o.fishCoins === 'number' && o.fishCoins >= 0 ? Math.floor(o.fishCoins) : 0,
      unlocked: unlocked.length ? Array.from(new Set([ALL_STAGE_IDS[0], ...unlocked])) : d.unlocked,
      cleared,
      owned,
      equipped: { hat, skins },
      seen,
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

  /** Show every tutorial and introduction again (keeps coins, unlocks and cosmetics). */
  resetTutorials(): void {
    commit({ ...state, seen: [] });
  },

  reset(): void {
    commit(defaultSave());
  },
};

export function useSave(): SaveData {
  return useSyncExternalStore(saveStore.subscribe, saveStore.get, saveStore.get);
}
