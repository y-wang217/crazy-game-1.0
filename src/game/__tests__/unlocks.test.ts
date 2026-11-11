import { CANS, FEATURE_UNLOCKS, featureOfScreen, isFeatureUnlocked } from '../../config/unlocks';
import { CANS_INTRO, parseSave, saveStore } from '../../save/store';

const cleared = (...ids: string[]) => ({ cleared: Object.fromEntries(ids.map((i) => [i, 3])) });

describe('V1.6 feature unlock schedule', () => {
  it('follows the final schedule, from completed-stage records only', () => {
    expect(FEATURE_UNLOCKS).toEqual({ shop: '1-4', encyclopedia: '1-4', team: '1-10', recruit: '2-5' });
    const fresh = cleared();
    for (const f of ['shop', 'encyclopedia', 'team', 'recruit'] as const) expect(isFeatureUnlocked(fresh, f)).toBe(false);
    expect(isFeatureUnlocked(cleared('1-1', '1-2', '1-3'), 'shop')).toBe(false);
    expect(isFeatureUnlocked(cleared('1-4'), 'shop')).toBe(true);
    expect(isFeatureUnlocked(cleared('1-4'), 'encyclopedia')).toBe(true);
    expect(isFeatureUnlocked(cleared('1-4'), 'team')).toBe(false);
    expect(isFeatureUnlocked(cleared('1-10'), 'team')).toBe(true);
    expect(isFeatureUnlocked(cleared('1-10', '2-4'), 'recruit')).toBe(false);
    expect(isFeatureUnlocked(cleared('2-5'), 'recruit')).toBe(true);
    // "Unlocked" stages that were never cleared don't count.
    expect(isFeatureUnlocked({ ...cleared('1-1', '1-2', '1-3'), unlocked: ['1-4', '1-5'] } as never, 'shop')).toBe(false);
  });

  it('every gated screen maps to its feature (the App refuses locked ones)', () => {
    expect(featureOfScreen({ name: 'shop' })).toBe('shop');
    expect(featureOfScreen({ name: 'cats' })).toBe('encyclopedia');
    expect(featureOfScreen({ name: 'catProfile' })).toBe('encyclopedia');
    expect(featureOfScreen({ name: 'team' })).toBe('team');
    expect(featureOfScreen({ name: 'team', practice: true })).toBe('team');
    expect(featureOfScreen({ name: 'recruit' })).toBe('recruit');
    expect(featureOfScreen({ name: 'stages' })).toBeNull();
    expect(featureOfScreen({ name: 'battle' })).toBeNull();
    expect(featureOfScreen({ name: 'practice' })).toBeNull();
  });
});

describe('Cat Food Cans', () => {
  beforeEach(() => saveStore.reset());

  it('the introductory cans are granted once, only after 2-5, and a tutorial reset can never re-grant them', () => {
    expect(saveStore.claimRecruitIntro()).toBe(0); // locked
    expect(saveStore.get().cans).toBe(0);
    saveStore.completeStage('2-5', 10, 10);
    expect(saveStore.claimRecruitIntro()).toBe(CANS.introGift);
    expect(saveStore.get().cans).toBe(2);
    expect(saveStore.claimRecruitIntro()).toBe(0);
    saveStore.resetTutorials();
    expect(saveStore.claimRecruitIntro()).toBe(0);
    expect(saveStore.get().cans).toBe(2);
    expect(saveStore.get().milestones).toContain(CANS_INTRO);
  });

  it('one can = one draw; fish coins are never spent on recruiting', () => {
    saveStore.completeStage('2-5', 10, 10);
    saveStore.claimRecruitIntro();
    const coins = saveStore.get().fishCoins;
    const first = saveStore.recruit(() => 0.5);
    expect(first.ok && first.isNew).toBe(true); // first draw: guaranteed new
    expect(saveStore.get().cans).toBe(1);
    expect(saveStore.get().fishCoins).toBe(coins);
    expect(saveStore.recruit(() => 0.99).ok).toBe(true);
    expect(saveStore.get().cans).toBe(0);
    expect(saveStore.recruit(() => 0.5)).toEqual({ ok: false, reason: 'noCans' });
  });

  it('migrates an existing v3 save: coins, cats, fragments and recruit counters kept; cans start at 0', () => {
    const v3 = {
      version: 3,
      fishCoins: 4321,
      cleared: { '1-1': 3, '1-10': 2, '2-5': 3 },
      unlocked: ['1-1'],
      collection: { kitten: { stars: 3, fragments: 7 }, whiskers: { stars: 1, fragments: 20 }, sable: { stars: 2, fragments: 0 } },
      team: ['kitten', 'tabby', 'orange', 'whiskers', 'sable'],
      recruitStreak: 4,
      recruitDraws: 12,
      chapterRewards: ['ch1'],
      seen: ['tut:shop', 'tut:team'],
    };
    const s = parseSave(JSON.stringify(v3));
    expect(s.version).toBe(4);
    expect(s.fishCoins).toBe(4321);
    expect(s.collection.whiskers).toEqual({ stars: 1, fragments: 20 });
    expect(s.collection.sable).toEqual({ stars: 2, fragments: 0 });
    expect(s.team).toEqual(['kitten', 'tabby', 'orange', 'whiskers', 'sable']);
    expect([s.recruitStreak, s.recruitDraws, s.cans, s.canDraws, s.milestones]).toEqual([4, 12, 0, 0, []]);
    expect(s.chapterRewards).toEqual(['ch1']);
    // Round trip keeps the new fields.
    const again = parseSave(JSON.stringify({ ...s, cans: 3, canDraws: 2, milestones: [CANS_INTRO] }));
    expect([again.cans, again.canDraws, again.milestones]).toEqual([3, 2, [CANS_INTRO]]);
  });

  it('Sir Sable is granted exactly once for clearing 1-10 (also for older saves that lack it)', () => {
    saveStore.completeStage('1-10', 10, 10);
    const g = saveStore.claimChapterRewards();
    expect(g.map((x) => x.cat)).toEqual(['sable']);
    expect(saveStore.get().collection.sable).toEqual({ stars: 1, fragments: 0 });
    expect(saveStore.claimChapterRewards()).toEqual([]);
    expect(isFeatureUnlocked(saveStore.get(), 'team')).toBe(true);
  });
});
