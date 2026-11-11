import { CAT_ORDER, NEW_CATS, STARTER_CATS } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { CHAPTER_REWARDS, RECRUIT, STARS, TEAM_SIZE } from '../../config/collection';
import { parseSave } from '../../save/store';
import {
  claimChapterRewards,
  defaultCollection,
  exchangeFragments,
  recruit,
  recruitOdds,
  sanitizeTeam,
  setTeam,
  upgradeStar,
  type CollectionState,
} from '../collection';
import type { CatId } from '../types';

const base = (over: Partial<CollectionState> = {}): CollectionState => ({
  fishCoins: 10000,
  cans: 50,
  canDraws: 1, // past the first (guaranteed) draw unless a test says otherwise
  collection: defaultCollection(),
  team: [...STARTER_CATS],
  recruitStreak: 0,
  recruitDraws: 0,
  chapterRewards: [],
  cleared: {},
  ...over,
});

describe('collection basics', () => {
  it('all ten cats exist; the five starters are owned at 1★', () => {
    expect(CAT_ORDER).toHaveLength(10);
    const c = defaultCollection();
    for (const id of STARTER_CATS) expect(c[id]).toEqual({ stars: 1, fragments: 0 });
    for (const id of NEW_CATS) expect(c[id]).toBeUndefined();
  });
});

/** rand() returning these values in order (then the last one forever). */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)];
};
/** Index fraction that picks `id` out of `list`. */
const at = (list: CatId[], id: CatId) => (list.indexOf(id) + 0.5) / list.length;
// Chapter reward cats are held until their chapter is cleared (this base state has claimed none).
const UNOWNED_ELIGIBLE: CatId[] = ['whiskers', 'mallow', 'pounce'];
const OWNED = [...STARTER_CATS];

describe('recruitment (Cat Food Cans)', () => {
  it('costs 1 Cat Food Can — never fish coins — and a new cat joins the collection', () => {
    const s = base();
    const r = recruit(s, seq(0, at(UNOWNED_ELIGIBLE, 'whiskers'))); // roll "new" (0 < newCatChance), then whiskers
    if (!r.ok) throw new Error();
    expect(r.isNew).toBe(true);
    expect(r.state.collection.whiskers).toEqual({ stars: 1, fragments: 0 });
    expect(r.state.cans).toBe(s.cans - RECRUIT.costCans);
    expect(r.state.fishCoins).toBe(s.fishCoins);
  });

  it('fails without a can (even with plenty of fish coins) and changes nothing', () => {
    expect(recruit(base({ cans: 0, fishCoins: 999999 }), seq(0))).toEqual({ ok: false, reason: 'noCans' });
  });

  it('the very first can draw is a guaranteed new eligible cat', () => {
    for (const roll of [0, 0.5, 0.999]) {
      const r = recruit(base({ canDraws: 0 }), seq(roll, roll));
      if (!r.ok) throw new Error();
      expect(r.isNew).toBe(true);
      expect(r.guaranteed).toBe(true);
      expect(UNOWNED_ELIGIBLE).toContain(r.cat);
    }
  });

  it('a duplicate becomes fragments for exactly that cat', () => {
    const r = recruit(base(), seq(0.99, at(OWNED, 'orange'))); // roll "duplicate", then orange
    if (!r.ok) throw new Error();
    expect(r.isNew).toBe(false);
    expect(r.fragments).toBe(RECRUIT.duplicateFragments);
    expect(r.state.collection.orange!.fragments).toBe(RECRUIT.duplicateFragments);
    expect(r.state.collection.kitten!.fragments).toBe(0);
  });

  it('duplicates of a 5★ cat refund fish coins instead', () => {
    const s = base({ collection: { ...defaultCollection(), black: { stars: 5, fragments: 0 } } });
    const r = recruit(s, seq(0.99, at(OWNED, 'black')));
    if (!r.ok) throw new Error();
    expect(r.fragments).toBe(0);
    expect(r.coins).toBe(RECRUIT.duplicateFragments * RECRUIT.maxedFragmentCoins);
    expect(r.state.fishCoins).toBe(s.fishCoins + r.coins);
  });

  it('Silver Devil (Chapter 2 reward) stays out of the pool until 2-20 is cleared', () => {
    const o = recruitOdds(base());
    expect(o.pool).not.toContain('devil');
    expect(o.pool).not.toContain('sable'); // Chapter 1 reward, not claimed in this state
    expect(o.newChance).toBeCloseTo(RECRUIT.newCatChance);
    expect(o.perNew).toBeCloseTo(RECRUIT.newCatChance / UNOWNED_ELIGIBLE.length);
    expect(o.perOwned).toBeCloseTo((1 - RECRUIT.newCatChance) / 5);
    for (let i = 0; i < 200; i++) {
      const r = recruit(base(), Math.random);
      if (!r.ok) throw new Error();
      expect(r.cat).not.toBe('devil');
    }
    expect(recruitOdds(base({ chapterRewards: ['ch1'] })).pool).toContain('sable');
    expect(recruitOdds(base({ chapterRewards: ['ch1'] })).pool).not.toContain('devil');
    expect(recruitOdds(base({ chapterRewards: ['ch1', 'ch2'] })).pool).toContain('devil');
  });

  it(`guarantees a new cat within ${RECRUIT.guaranteeNewWithin} draws`, () => {
    let s = base();
    for (let i = 0; i < RECRUIT.guaranteeNewWithin - 1; i++) {
      const r = recruit(s, seq(0.99, 0));
      if (!r.ok) throw new Error();
      expect(r.isNew).toBe(false);
      s = r.state;
    }
    expect(recruitOdds(s).guaranteedNext).toBe(true);
    const r = recruit(s, seq(0.99, 0)); // even an unlucky roll can't be a duplicate now
    if (!r.ok) throw new Error();
    expect(r.isNew).toBe(true);
    expect(r.guaranteed).toBe(true);
    expect(r.state.recruitStreak).toBe(0);
  });

  it('a natural new cat resets the guarantee counter', () => {
    const r = recruit(base({ recruitStreak: 3 }), seq(0, at(UNOWNED_ELIGIBLE, 'mallow')));
    if (!r.ok) throw new Error();
    expect(r.state.recruitStreak).toBe(0);
  });

  it('with every eligible cat owned there is no guarantee and draws are all duplicates', () => {
    const all = Object.fromEntries(CAT_ORDER.map((id) => [id, { stars: 1, fragments: 0 }]));
    const s = base({ collection: all, recruitStreak: 50, canDraws: 0 });
    expect(recruitOdds(s).guaranteedNext).toBe(false);
    const r = recruit(s, seq(0, 0.5));
    if (!r.ok) throw new Error();
    expect(r.isNew).toBe(false);
  });
});

describe('star upgrades', () => {
  it('consume exactly the configured fragments and coins, one star at a time to MAX', () => {
    let s = base({ collection: { ...defaultCollection(), kitten: { stars: 1, fragments: 1000 } }, fishCoins: 100000 });
    for (let star = 1; star < STARS.max; star++) {
      const cost = STARS.costs[star - 1];
      const before = s;
      const r = upgradeStar(s, 'kitten');
      if (!r.ok) throw new Error(r.reason);
      expect(r.stars).toBe(star + 1);
      expect(before.fishCoins - r.state.fishCoins).toBe(cost.coins);
      expect(before.collection.kitten!.fragments - r.state.collection.kitten!.fragments).toBe(cost.fragments);
      s = r.state;
    }
    expect(upgradeStar(s, 'kitten')).toEqual({ ok: false, reason: 'maxed' });
  });

  it('never consumes anything when it fails', () => {
    const s1 = base({ collection: { ...defaultCollection(), tabby: { stars: 1, fragments: 9 } } });
    expect(upgradeStar(s1, 'tabby')).toEqual({ ok: false, reason: 'noFragments' });
    const s2 = base({ fishCoins: 99, collection: { ...defaultCollection(), tabby: { stars: 1, fragments: 10 } } });
    expect(upgradeStar(s2, 'tabby')).toEqual({ ok: false, reason: 'noCoins' });
    expect(upgradeStar(base(), 'sable')).toEqual({ ok: false, reason: 'notOwned' });
  });

  it('leftover fragments of a 5★ cat can be exchanged for coins', () => {
    const s = base({ collection: { ...defaultCollection(), white: { stars: 5, fragments: 12 } } });
    const r = exchangeFragments(s, 'white');
    expect(r.coins).toBe(12 * RECRUIT.maxedFragmentCoins);
    expect(r.state.collection.white!.fragments).toBe(0);
    expect(exchangeFragments(base(), 'white').ok).toBe(false);
  });
});

describe('battle team', () => {
  it('has 4–5 owned species (5 by default); swaps keep it valid', () => {
    expect(TEAM_SIZE).toBe(5);
    expect(sanitizeTeam(['kitten', 'tabby', 'orange', 'black'], defaultCollection())).toEqual(['kitten', 'tabby', 'orange', 'black']); // a 4-team is kept
    const s = base({ collection: { ...defaultCollection(), whiskers: { stars: 1, fragments: 0 } } });
    const ok = setTeam(s, ['whiskers', 'tabby', 'orange', 'black', 'white']);
    expect(ok.ok).toBe(true);
    expect(setTeam(s, ['whiskers', 'tabby', 'orange', 'black']).ok).toBe(true); // 4 species: allowed (optional)
    expect(setTeam(s, ['whiskers', 'tabby', 'orange']).ok).toBe(false); // too few
    expect(setTeam(s, ['kitten', 'whiskers', 'tabby', 'orange', 'black', 'white']).ok).toBe(false); // too many
    expect(setTeam(s, ['sable', 'tabby', 'orange', 'black', 'white']).ok).toBe(false); // not owned
    expect(setTeam(s, ['tabby', 'tabby', 'orange', 'black', 'white']).ok).toBe(false); // duplicate
  });

  it('existing players get the starter team without doing anything', () => {
    expect(sanitizeTeam(undefined, defaultCollection())).toEqual(STARTER_CATS);
    expect(sanitizeTeam(['kitten', 'nope', 'kitten'], defaultCollection())).toEqual(STARTER_CATS);
  });
});

describe('chapter-completion cats', () => {
  const ch1Boss = CHAPTERS[0].stages[9].id;
  // Chapter 2 now ends at 2-20 (2-10 is a mid-chapter milestone boss).
  const ch2Boss = CHAPTERS[1].stages[CHAPTERS[1].stages.length - 1].id;

  it('Chapter 1 grants Sir Sable, Chapter 2 grants Silver Devil — once each', () => {
    expect(CHAPTER_REWARDS.ch1.cat).toBe('sable');
    expect(CHAPTER_REWARDS.ch2.cat).toBe('devil');
    let s = base({ cleared: { [ch1Boss]: 3 } });
    let r = claimChapterRewards(s);
    expect(r.grants.map((g) => [g.chapterId, g.cat, g.kind])).toEqual([['ch1', 'sable', 'cat']]);
    s = r.state;
    expect(claimChapterRewards(s).grants).toEqual([]); // never twice
    s = { ...s, cleared: { ...s.cleared, [ch2Boss]: 1 } };
    r = claimChapterRewards(s);
    expect(r.grants.map((g) => g.cat)).toEqual(['devil']);
    expect(claimChapterRewards(r.state).grants).toEqual([]);
  });

  it('works retroactively for players who finished both chapters before this update', () => {
    const r = claimChapterRewards(base({ cleared: { [ch1Boss]: 2, [ch2Boss]: 1 } }));
    expect(r.grants.map((g) => g.cat)).toEqual(['sable', 'devil']);
  });

  it('nothing is granted before the chapter is cleared', () => {
    expect(claimChapterRewards(base({ cleared: { '1-9': 3 } })).grants).toEqual([]);
  });

  it('Chapter 2 now completes at 2-20: clearing the 2-10 milestone alone grants nothing', () => {
    expect(ch2Boss).toBe('2-20');
    const r = claimChapterRewards(base({ cleared: { [ch1Boss]: 3, '2-10': 3 } }));
    expect(r.grants.map((g) => g.chapterId)).toEqual(['ch1']);
  });

  it('players who already received the Chapter 2 cat (at the old 2-10 ending) keep it and never get it twice', () => {
    const owned = { ...defaultCollection(), sable: { stars: 1, fragments: 0 }, devil: { stars: 1, fragments: 0 } };
    const s = base({ collection: owned, chapterRewards: ['ch1', 'ch2'], cleared: { [ch1Boss]: 3, '2-10': 3, [ch2Boss]: 3 } });
    expect(claimChapterRewards(s).grants).toEqual([]);
  });

  it('if the reward cat is already owned, an unowned new cat is given; otherwise fragments', () => {
    const owned = { ...defaultCollection(), sable: { stars: 2, fragments: 0 } };
    const r = claimChapterRewards(base({ collection: owned, cleared: { [ch1Boss]: 3 } }));
    expect(r.grants[0].kind).toBe('cat');
    expect(r.grants[0].substituted).toBe(true);
    expect(r.grants[0].cat).not.toBe('sable');
    const all = Object.fromEntries(CAT_ORDER.map((id) => [id, { stars: 1, fragments: 0 }]));
    const r2 = claimChapterRewards(base({ collection: all, cleared: { [ch1Boss]: 3 } }));
    expect(r2.grants[0]).toMatchObject({ kind: 'fragments', cat: 'sable', fragments: CHAPTER_REWARDS.ch1.fallbackFragments });
    expect(r2.state.collection.sable!.fragments).toBe(CHAPTER_REWARDS.ch1.fallbackFragments);
  });
});

describe('save migration (v2 → v3)', () => {
  it('keeps every existing field and adds a safe collection', () => {
    const v2 = {
      version: 2,
      fishCoins: 432,
      unlocked: ['1-1', '1-2', '1-3'],
      cleared: { '1-1': 3, '1-2': 2 },
      owned: ['hat_bow'],
      equipped: { hat: 'hat_bow', skins: {} },
      seen: ['tut:welcome', 'cat:kitten', 'enemy:fast'],
    };
    const s = parseSave(JSON.stringify(v2));
    expect(s.version).toBe(4);
    expect(s.fishCoins).toBe(432);
    expect(s.unlocked).toEqual(['1-1', '1-2', '1-3']);
    expect(s.cleared).toEqual({ '1-1': 3, '1-2': 2 });
    expect(s.owned).toEqual(['hat_bow']);
    expect(s.equipped.hat).toBe('hat_bow');
    expect(s.seen).toEqual(['tut:welcome', 'cat:kitten', 'enemy:fast']);
    expect(Object.keys(s.collection).sort()).toEqual([...STARTER_CATS].sort());
    expect(s.team).toEqual(STARTER_CATS);
    expect(s.chapterRewards).toEqual([]);
  });

  it('round-trips v3 data and repairs bad values', () => {
    const v3 = {
      version: 3,
      fishCoins: 50,
      unlocked: ['1-1'],
      cleared: {},
      collection: { kitten: { stars: 9, fragments: -3 }, sable: { stars: 2, fragments: 14 }, bogus: { stars: 1 } },
      team: ['sable', 'kitten', 'tabby', 'orange', 'black'],
      recruitStreak: 2,
      chapterRewards: ['ch1'],
    };
    const s = parseSave(JSON.stringify(v3));
    expect(s.collection.kitten).toEqual({ stars: 5, fragments: 0 });
    expect(s.collection.sable).toEqual({ stars: 2, fragments: 14 });
    expect((s.collection as Record<string, unknown>).bogus).toBeUndefined();
    expect(s.team).toEqual(['sable', 'kitten', 'tabby', 'orange', 'black']);
    expect(s.recruitStreak).toBe(2);
    expect(s.chapterRewards).toEqual(['ch1']);
  });
});

describe('fragment top-up (economy audit)', () => {
  it('buys exactly the missing fragments for the next star, never for a 5★ cat, never on credit', async () => {
    const { topUpFragments, topUpQuote, upgradeStar, exchangeFragments } = await import('../collection');
    const { FRAGMENT_TOPUP, STARS, RECRUIT } = await import('../../config/collection');
    const base = {
      fishCoins: 1000,
      collection: { kitten: { stars: 2, fragments: 5 } },
      team: ['kitten'],
      recruitStreak: 0,
      recruitDraws: 0,
      chapterRewards: [],
      cleared: {},
    } as never;
    const q = topUpQuote(base, 'kitten')!;
    expect(q.missing).toBe(STARS.costs[1].fragments - 5);
    expect(q.coins).toBe(q.missing * FRAGMENT_TOPUP.coinsPerFragment);
    const r = topUpFragments(base, 'kitten');
    expect(r.ok).toBe(true);
    expect(r.state.collection.kitten!.fragments).toBe(STARS.costs[1].fragments);
    expect(r.state.fishCoins).toBe(1000 - q.coins);
    // Nothing left to buy until the star is actually upgraded.
    expect(topUpFragments(r.state, 'kitten').reason).toBe('nothingMissing');
    const up = upgradeStar(r.state, 'kitten');
    expect(up.ok).toBe(true);
    // Not owned / not enough coins / 5★: refused, state untouched.
    expect(topUpFragments(base, 'devil').ok).toBe(false);
    expect(topUpFragments({ ...(base as object), fishCoins: 0 } as never, 'kitten').reason).toBe('noCoins');
    const maxed = { ...(base as object), collection: { kitten: { stars: 5, fragments: 0 } } } as never;
    expect(topUpFragments(maxed, 'kitten').reason).toBe('maxed');
    // No profitable loop: buying costs far more than maxed fragments convert back to.
    expect(FRAGMENT_TOPUP.coinsPerFragment).toBeGreaterThan(RECRUIT.maxedFragmentCoins * 3);
    expect(exchangeFragments(base, 'kitten').ok).toBe(false); // conversion only exists at 5★
  });

  it('caps the cost of upgrading one chosen cat to 5★', async () => {
    const { FRAGMENT_TOPUP, STARS } = await import('../../config/collection');
    const frag = STARS.costs.reduce((a, c) => a + c.fragments, 0);
    const coins = STARS.costs.reduce((a, c) => a + c.coins, 0);
    expect(frag * FRAGMENT_TOPUP.coinsPerFragment + coins).toBeLessThanOrEqual(5000);
  });
});
