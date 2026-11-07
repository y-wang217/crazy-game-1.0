import type { ChapterDef, ChestTier, EnemyId, SpawnGroup, StageDef, WaveDef } from '../game/types';

// ---- Tiny helpers so wave data stays readable ----
/** count enemies, `interval` seconds apart, starting `delay` seconds into the wave */
const g = (enemy: EnemyId, count: number, interval: number, delay = 0): SpawnGroup => ({
  enemy,
  count,
  interval,
  delay,
});
const chest = (tier: ChestTier, delay = 0): SpawnGroup => ({ chest: tier, delay });
const w = (...groups: SpawnGroup[]): WaveDef => ({ groups });

// ---- Placement tile sets (ids are "col-row", see maps.ts) ----
const A_CORE = ['3-2', '4-2', '3-3', '4-3'];
const B_CORE = ['2-5', '3-5', '4-5', '2-6', '3-6', '4-6'];

const STAGES: StageDef[] = [
  {
    id: '1-1',
    number: 1,
    name: 'First Steps',
    intro: ['Tap SUMMON to call a random cat.', 'Cats attack mice on the road automatically!'],
    roster: ['kitten', 'tabby'],
    tiles: [...A_CORE, ...B_CORE],
    startFish: 120,
    baseHp: 10,
    hpScale: 1,
    waves: [w(g('normal', 6, 1.6)), w(g('normal', 8, 1.3)), w(g('normal', 10, 1.1))],
    rewards: { firstClear: 30, replay: 10 },
  },
  {
    id: '1-2',
    number: 2,
    name: 'Better Together',
    intro: ['Drag a cat onto an identical cat (same type & level) to MERGE!', 'Drag to an empty tile to move — it\'s free.'],
    roster: ['kitten', 'tabby'],
    tiles: [...A_CORE, ...B_CORE, '5-5'],
    startFish: 100,
    baseHp: 10,
    hpScale: 1.1,
    waves: [
      w(g('normal', 8, 1.4)),
      w(g('normal', 10, 1.2)),
      w(g('normal', 12, 1.0)),
      w(g('normal', 16, 0.9)),
    ],
    rewards: { firstClear: 35, replay: 12 },
  },
  {
    id: '1-3',
    number: 3,
    name: 'Snack Time',
    intro: ['New cat: Chubby Orange — slow, heavy area slams.', 'Treasure chests walk the road. Break them for skills & coins!'],
    roster: ['kitten', 'tabby', 'orange'],
    tiles: [...A_CORE, ...B_CORE, '5-5', '5-6'],
    startFish: 100,
    baseHp: 10,
    hpScale: 1.2,
    waves: [
      w(g('normal', 10, 1.2)),
      w(g('normal', 10, 1.0), chest('bronze', 4)),
      w(g('normal', 14, 0.9)),
      w(g('normal', 16, 0.8), chest('bronze', 6)),
    ],
    rewards: { firstClear: 40, replay: 14 },
  },
  {
    id: '1-4',
    number: 4,
    name: 'Zoom Zoom',
    intro: ['Zippy Mice are fast! Tap a cat to cycle its targeting.', 'Try "First" to catch runners near the exit.'],
    roster: ['kitten', 'tabby', 'orange'],
    tiles: ['2-2', '3-2', '4-2', '3-3', '4-3', '2-5', '3-5', '4-5', '5-5', '3-6', '2-8', '3-8'],
    startFish: 100,
    baseHp: 10,
    hpScale: 1.55,
    waves: [
      w(g('normal', 10, 1.1)),
      w(g('fast', 6, 1.0)),
      w(g('normal', 10, 1.0), g('fast', 6, 1.2, 3), chest('bronze', 5)),
      w(g('normal', 14, 0.8)),
      w(g('normal', 12, 0.9), g('fast', 10, 0.8, 4), chest('bronze', 8)),
    ],
    rewards: { firstClear: 45, replay: 15 },
  },
  {
    id: '1-5',
    number: 5,
    name: 'The Quiet One',
    intro: ['New cat: Black Cat — long-range sniper.', 'Silver chests hold better skills!'],
    roster: ['kitten', 'tabby', 'orange', 'black'],
    tiles: ['2-2', '3-2', '4-2', '2-3', '3-3', '4-3', '2-5', '3-5', '4-5', '5-5', '3-6', '5-6', '2-8', '3-8'],
    startFish: 100,
    baseHp: 10,
    hpScale: 1.8,
    waves: [
      w(g('normal', 12, 1.0)),
      w(g('fast', 10, 0.8), chest('bronze', 4)),
      w(g('normal', 14, 0.8), g('fast', 6, 1.0, 5)),
      w(g('normal', 16, 0.7), chest('silver', 5)),
      w(g('normal', 14, 0.8), g('fast', 12, 0.6, 6)),
    ],
    rewards: { firstClear: 50, replay: 16 },
  },
  {
    id: '1-6',
    number: 6,
    name: 'Acorn Armor',
    intro: ['Acorn Knights have armor: weak hits barely scratch them.', 'Big hitters (Black, Orange, merged cats) work best.'],
    roster: ['kitten', 'tabby', 'orange', 'black'],
    tiles: [...A_CORE, '2-2', '2-3', ...B_CORE, '5-5', '5-6', '2-8', '3-8', '4-8'],
    startFish: 110,
    baseHp: 10,
    hpScale: 2.05,
    waves: [
      w(g('normal', 12, 1.0)),
      w(g('armored', 4, 2.5)),
      w(g('normal', 12, 0.9), g('armored', 4, 2.5, 3), chest('bronze', 6)),
      w(g('fast', 14, 0.6)),
      w(g('armored', 8, 1.8), g('normal', 10, 1.0, 2), chest('silver', 6)),
      w(g('normal', 16, 0.7), g('armored', 6, 2.0, 4), g('fast', 8, 0.7, 8)),
    ],
    rewards: { firstClear: 55, replay: 18 },
  },
  {
    id: '1-7',
    number: 7,
    name: 'Full Squad',
    intro: ['New cat: Noble White — her beauty slows nearby mice.', 'Place her where your attackers can hit the distracted mice.'],
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...A_CORE, '2-2', '2-3', ...B_CORE, '5-5', '5-6', '2-8', '3-8', '4-8', '3-9'],
    startFish: 110,
    baseHp: 10,
    hpScale: 1.7,
    waves: [
      w(g('normal', 14, 0.9)),
      w(g('fast', 12, 0.7), chest('bronze', 3)),
      w(g('armored', 6, 2.0), g('normal', 10, 1.0, 2)),
      w(g('normal', 18, 0.6), g('fast', 8, 0.8, 4), chest('silver', 6)),
      w(g('armored', 8, 1.6), g('fast', 12, 0.6, 3)),
      w(g('normal', 20, 0.55), g('armored', 8, 1.6, 4), chest('bronze', 10)),
    ],
    rewards: { firstClear: 60, replay: 20 },
  },
  {
    id: '1-8',
    number: 8,
    name: 'Leaf Guards',
    intro: ['Leaf Guards carry a shield that must break before they get hurt.', 'Fast combos and chip damage shred shields.'],
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...A_CORE, '2-2', '2-3', '1-2', ...B_CORE, '5-5', '5-6', '0-5', '2-8', '3-8', '4-8', '3-9'],
    startFish: 110,
    baseHp: 10,
    hpScale: 1.75,
    waves: [
      w(g('normal', 14, 0.9)),
      w(g('shielded', 6, 1.6)),
      w(g('normal', 12, 0.8), g('fast', 10, 0.7, 3), chest('bronze', 5)),
      w(g('shielded', 8, 1.3), g('armored', 4, 2.0, 4)),
      w(g('fast', 16, 0.5), chest('silver', 4)),
      w(g('shielded', 10, 1.1), g('normal', 14, 0.7, 2)),
      w(g('armored', 8, 1.5), g('shielded', 8, 1.3, 3), g('fast', 10, 0.6, 8), chest('silver', 8)),
    ],
    rewards: { firstClear: 70, replay: 22 },
  },
  {
    id: '1-9',
    number: 9,
    name: 'Rush Hour',
    intro: ['The mice are getting serious.', 'Merge smart, aim smart, and grab those chests!'],
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...A_CORE, '2-2', '2-3', '1-2', '1-3', ...B_CORE, '5-5', '5-6', '0-5', '2-8', '3-8', '4-8', '2-9', '3-9'],
    startFish: 120,
    baseHp: 10,
    hpScale: 1.9,
    waves: [
      w(g('normal', 16, 0.8)),
      w(g('fast', 14, 0.55), chest('bronze', 4)),
      w(g('armored', 8, 1.5), g('shielded', 6, 1.5, 3)),
      w(g('normal', 22, 0.5), g('fast', 10, 0.6, 5), chest('silver', 6)),
      w(g('shielded', 12, 1.0), g('armored', 6, 1.6, 4)),
      w(g('fast', 20, 0.45), g('normal', 14, 0.6, 3), chest('bronze', 6)),
      w(g('armored', 10, 1.3), g('shielded', 10, 1.1, 2), g('fast', 12, 0.5, 9), chest('silver', 9)),
    ],
    rewards: { firstClear: 80, replay: 25 },
  },
  {
    id: '1-10',
    number: 10,
    name: 'The Big Cheese',
    intro: ['BOSS STAGE! The Big Cheese King is coming.', 'A Gold chest appears — its skills give +2 levels!'],
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [
      ...A_CORE, '2-2', '2-3', '1-2', '1-3', '6-2',
      ...B_CORE, '5-5', '5-6', '0-5', '0-6',
      '2-8', '3-8', '4-8', '2-9', '3-9',
    ],
    startFish: 130,
    baseHp: 10,
    hpScale: 2.0,
    isBoss: true,
    waves: [
      w(g('normal', 16, 0.8), chest('bronze', 6)),
      w(g('fast', 14, 0.55), g('normal', 8, 0.8, 4)),
      w(g('armored', 8, 1.4), g('shielded', 8, 1.3, 3), chest('silver', 5)),
      w(g('normal', 24, 0.45), g('fast', 12, 0.55, 5)),
      w(g('shielded', 12, 0.9), g('armored', 8, 1.3, 4), chest('gold', 3)),
      w(g('fast', 20, 0.4), g('armored', 8, 1.4, 3), g('normal', 12, 0.6, 6)),
      w(g('boss', 1, 1, 2), g('normal', 14, 1.2, 4), g('shielded', 8, 1.8, 8), chest('silver', 12)),
    ],
    rewards: { firstClear: 150, replay: 40 },
  },
];

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'ch1',
    number: 1,
    name: 'Beginner Forest',
    mapId: 'forest',
    stages: STAGES,
  },
];

export function findStage(stageId: string): { chapter: ChapterDef; stage: StageDef; index: number } | null {
  for (const chapter of CHAPTERS) {
    const index = chapter.stages.findIndex((s) => s.id === stageId);
    if (index >= 0) return { chapter, stage: chapter.stages[index], index };
  }
  return null;
}

/** Linear order of all stages across chapters (for unlock progression). */
export const ALL_STAGE_IDS: string[] = CHAPTERS.flatMap((c) => c.stages.map((s) => s.id));
