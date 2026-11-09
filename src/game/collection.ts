import { CAT_ORDER, NEW_CATS, STARTER_CATS } from '../config/cats';
import { CHAPTERS } from '../config/chapters';
import { CHAPTER_REWARDS, RECRUIT, STARS, TEAM_MIN, TEAM_SIZE, starCost, FRAGMENT_TOPUP } from '../config/collection';
import type { CatId } from './types';

// Pure functions for the permanent cat collection (recruitment, fragments, stars,
// team, chapter rewards). The save store wraps them; tests call them directly.

export interface OwnedCat {
  /** Permanent star rank 1–5. */
  stars: number;
  /** Character-specific fragments not yet spent. */
  fragments: number;
}

export interface CollectionState {
  fishCoins: number;
  collection: Partial<Record<CatId, OwnedCat>>;
  team: CatId[];
  /** Draws in a row that were duplicates (for the new-cat guarantee). */
  recruitStreak: number;
  recruitDraws: number;
  /** Chapter ids whose completion cat has been granted. */
  chapterRewards: string[];
  cleared: Record<string, number>;
}

export const isOwned = (s: Pick<CollectionState, 'collection'>, id: CatId) => !!s.collection[id];
export const starOf = (s: Pick<CollectionState, 'collection'>, id: CatId) => s.collection[id]?.stars ?? 0;

export function defaultCollection(): Partial<Record<CatId, OwnedCat>> {
  return Object.fromEntries(STARTER_CATS.map((id) => [id, { stars: 1, fragments: 0 }]));
}

/** Clean up anything stored: starters are always owned; stars/fragments clamped. */
export function sanitizeCollection(raw: unknown): Partial<Record<CatId, OwnedCat>> {
  const out = defaultCollection();
  if (raw && typeof raw === 'object') {
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!CAT_ORDER.includes(id as CatId) || !v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      out[id as CatId] = {
        stars: Math.max(1, Math.min(STARS.max, Math.round(Number(o.stars) || 1))),
        fragments: Math.max(0, Math.floor(Number(o.fragments) || 0)),
      };
    }
  }
  return out;
}

/**
 * A valid team: owned, unique, TEAM_MIN–TEAM_SIZE species. A missing or too-small team
 * is filled up to TEAM_SIZE (the starter five first).
 */
export function sanitizeTeam(raw: unknown, collection: Partial<Record<CatId, OwnedCat>>): CatId[] {
  const owned = CAT_ORDER.filter((id) => collection[id]);
  const team: CatId[] = [];
  if (Array.isArray(raw)) for (const id of raw) if (owned.includes(id) && !team.includes(id)) team.push(id);
  // A deliberate 4–5 species team is kept; anything smaller (missing/corrupt) becomes the default five.
  const want = Math.min(team.length >= TEAM_MIN ? team.length : TEAM_SIZE, TEAM_SIZE, owned.length);
  for (const id of [...STARTER_CATS, ...owned]) {
    if (team.length >= want) break;
    if (owned.includes(id) && !team.includes(id)) team.push(id);
  }
  return team.slice(0, TEAM_SIZE);
}

// ---------------- Recruitment ----------------

/** Probability of each cat per draw (equal odds), and whether the next draw is guaranteed new. */
export function recruitOdds(s: CollectionState): { perCat: number; newChance: number; guaranteedNext: boolean; drawsToGuarantee: number } {
  const unowned = CAT_ORDER.filter((id) => !isOwned(s, id));
  const guaranteedNext = unowned.length > 0 && s.recruitStreak >= RECRUIT.guaranteeNewWithin - 1;
  return {
    perCat: 1 / CAT_ORDER.length,
    newChance: guaranteedNext ? 1 : unowned.length / CAT_ORDER.length,
    guaranteedNext,
    drawsToGuarantee: unowned.length ? Math.max(1, RECRUIT.guaranteeNewWithin - s.recruitStreak) : 0,
  };
}

export type RecruitResult =
  | { ok: false; reason: 'noCoins' }
  | {
      ok: true;
      cat: CatId;
      isNew: boolean;
      /** Fragments added (duplicates of cats below 5★). */
      fragments: number;
      /** Fish coins refunded instead (duplicates of 5★ cats). */
      coins: number;
      totalFragments: number;
      guaranteed: boolean;
      state: CollectionState;
    };

/** One draw for RECRUIT.cost fish coins. `rand` is injectable for tests. */
export function recruit(s: CollectionState, rand: () => number = Math.random): RecruitResult {
  if (s.fishCoins < RECRUIT.cost) return { ok: false, reason: 'noCoins' };
  const unowned = CAT_ORDER.filter((id) => !isOwned(s, id));
  const guaranteed = unowned.length > 0 && s.recruitStreak >= RECRUIT.guaranteeNewWithin - 1;
  const pool = guaranteed ? unowned : CAT_ORDER;
  const cat = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
  const isNew = !isOwned(s, cat);
  const collection = { ...s.collection };
  let fragments = 0;
  let coins = 0;
  if (isNew) collection[cat] = { stars: 1, fragments: 0 };
  else {
    const cur = collection[cat]!;
    if (cur.stars >= STARS.max) coins = RECRUIT.duplicateFragments * RECRUIT.maxedFragmentCoins;
    else {
      fragments = RECRUIT.duplicateFragments;
      collection[cat] = { ...cur, fragments: cur.fragments + fragments };
    }
  }
  const state: CollectionState = {
    ...s,
    fishCoins: s.fishCoins - RECRUIT.cost + coins,
    collection,
    recruitStreak: isNew ? 0 : s.recruitStreak + 1,
    recruitDraws: s.recruitDraws + 1,
  };
  return { ok: true, cat, isNew, fragments, coins, totalFragments: collection[cat]!.fragments, guaranteed, state };
}

// ---------------- Star upgrades ----------------

export type UpgradeResult =
  | { ok: false; reason: 'notOwned' | 'maxed' | 'noFragments' | 'noCoins' }
  | { ok: true; stars: number; state: CollectionState };

/** Spend fragments + coins for the next star. Nothing is consumed if it fails. */
export function upgradeStar(s: CollectionState, id: CatId): UpgradeResult {
  const cur = s.collection[id];
  if (!cur) return { ok: false, reason: 'notOwned' };
  const cost = starCost(cur.stars);
  if (!cost) return { ok: false, reason: 'maxed' };
  if (cur.fragments < cost.fragments) return { ok: false, reason: 'noFragments' };
  if (s.fishCoins < cost.coins) return { ok: false, reason: 'noCoins' };
  const stars = cur.stars + 1;
  return {
    ok: true,
    stars,
    state: { ...s, fishCoins: s.fishCoins - cost.coins, collection: { ...s.collection, [id]: { stars, fragments: cur.fragments - cost.fragments } } },
  };
}

/** Leftover fragments of a 5★ cat → fish coins. */
/** Fragments still missing for this cat's next star, and what topping them up would cost. */
export function topUpQuote(s: CollectionState, id: CatId): { missing: number; coins: number } | null {
  const cur = s.collection[id];
  if (!FRAGMENT_TOPUP.enabled || !cur) return null;
  const cost = starCost(cur.stars);
  if (!cost) return null;
  const missing = Math.max(0, cost.fragments - cur.fragments);
  return { missing, coins: missing * FRAGMENT_TOPUP.coinsPerFragment };
}

/** Buy exactly the missing fragments for the next star (owned, below 5★, enough coins). */
export function topUpFragments(
  s: CollectionState,
  id: CatId,
): { ok: boolean; reason?: 'notOwned' | 'maxed' | 'nothingMissing' | 'noCoins'; bought: number; coins: number; state: CollectionState } {
  const cur = s.collection[id];
  if (!cur) return { ok: false, reason: 'notOwned', bought: 0, coins: 0, state: s };
  const q = topUpQuote(s, id);
  if (!q) return { ok: false, reason: 'maxed', bought: 0, coins: 0, state: s };
  if (q.missing <= 0) return { ok: false, reason: 'nothingMissing', bought: 0, coins: 0, state: s };
  if (s.fishCoins < q.coins) return { ok: false, reason: 'noCoins', bought: 0, coins: 0, state: s };
  return {
    ok: true,
    bought: q.missing,
    coins: q.coins,
    state: { ...s, fishCoins: s.fishCoins - q.coins, collection: { ...s.collection, [id]: { ...cur, fragments: cur.fragments + q.missing } } },
  };
}

export function exchangeFragments(s: CollectionState, id: CatId): { ok: boolean; coins: number; state: CollectionState } {
  const cur = s.collection[id];
  if (!cur || cur.stars < STARS.max || cur.fragments <= 0) return { ok: false, coins: 0, state: s };
  const coins = cur.fragments * RECRUIT.maxedFragmentCoins;
  return { ok: true, coins, state: { ...s, fishCoins: s.fishCoins + coins, collection: { ...s.collection, [id]: { ...cur, fragments: 0 } } } };
}

// ---------------- Team ----------------

export function setTeam(s: CollectionState, team: CatId[]): { ok: boolean; state: CollectionState } {
  const owned = CAT_ORDER.filter((id) => isOwned(s, id)).length;
  const valid =
    team.length >= Math.min(TEAM_MIN, owned) &&
    team.length <= Math.min(TEAM_SIZE, owned) &&
    new Set(team).size === team.length &&
    team.every((id) => isOwned(s, id));
  if (!valid) return { ok: false, state: s };
  return { ok: true, state: { ...s, team: [...team] } };
}

// ---------------- Chapter rewards ----------------

export interface ChapterGrant {
  chapterId: string;
  chapterNumber: number;
  cat: CatId;
  /** 'cat' = the cat joined; 'fragments' = already owned everything, got fragments instead. */
  kind: 'cat' | 'fragments';
  fragments: number;
  /** True when the listed cat was already owned and a different new cat was given. */
  substituted: boolean;
}

/**
 * Grant every chapter-completion cat the player has earned but not yet received
 * (also for chapters cleared before this feature existed). Each chapter pays out once.
 */
export function claimChapterRewards(s: CollectionState): { grants: ChapterGrant[]; state: CollectionState } {
  let state = s;
  const grants: ChapterGrant[] = [];
  for (const ch of CHAPTERS) {
    const reward = CHAPTER_REWARDS[ch.id];
    if (!reward || state.chapterRewards.includes(ch.id)) continue;
    const boss = ch.stages[ch.stages.length - 1];
    if (!(boss.id in state.cleared)) continue;
    const collection = { ...state.collection };
    let grant: ChapterGrant;
    if (!collection[reward.cat]) {
      collection[reward.cat] = { stars: 1, fragments: 0 };
      grant = { chapterId: ch.id, chapterNumber: ch.number, cat: reward.cat, kind: 'cat', fragments: 0, substituted: false };
    } else {
      const alt = NEW_CATS.find((id) => !collection[id]);
      if (alt) {
        collection[alt] = { stars: 1, fragments: 0 };
        grant = { chapterId: ch.id, chapterNumber: ch.number, cat: alt, kind: 'cat', fragments: 0, substituted: true };
      } else {
        const cur = collection[reward.cat]!;
        collection[reward.cat] = { ...cur, fragments: cur.fragments + reward.fallbackFragments };
        grant = {
          chapterId: ch.id,
          chapterNumber: ch.number,
          cat: reward.cat,
          kind: 'fragments',
          fragments: reward.fallbackFragments,
          substituted: false,
        };
      }
    }
    grants.push(grant);
    state = { ...state, collection, chapterRewards: [...state.chapterRewards, ch.id] };
  }
  return { grants, state };
}
