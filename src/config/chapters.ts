import type { ChapterDef, ChestTier, EnemyId, SpawnGroup, StageDef, WaveDef } from '../game/types';

// ---------------------------------------------------------------------------
// Wave builder
// ---------------------------------------------------------------------------
// Each stage describes its waves with a few numbers instead of hand-writing 15
// waves. Tweak `count`, `growth`, `interval` and `mix` to rebalance a stage.

type Mix = Partial<Record<Exclude<EnemyId, 'boss'>, number>>;

interface WavePlan {
  /** Number of waves. */
  waves: number;
  /** Enemies in wave 1, and extra enemies per following wave. */
  count: number;
  growth: number;
  /** Seconds between spawns in the first and last wave (interpolated). */
  interval: [number, number];
  /** Enemy composition by wave index (weights). */
  mix: (wave: number) => Mix;
  /** Chests by wave number (1-based) → tier, spawned a few seconds into that wave. */
  chests?: Record<number, ChestTier>;
  /** Extra hand-made groups for specific waves (1-based), e.g. the boss. */
  extra?: Record<number, SpawnGroup[]>;
}

function buildWaves(p: WavePlan): WaveDef[] {
  const out: WaveDef[] = [];
  for (let w = 0; w < p.waves; w++) {
    const t = p.waves > 1 ? w / (p.waves - 1) : 0;
    const total = Math.round(p.count + p.growth * w);
    const interval = p.interval[0] + (p.interval[1] - p.interval[0]) * t;
    const span = total * interval;
    const mix = Object.entries(p.mix(w)).filter(([, v]) => (v ?? 0) > 0) as [EnemyId, number][];
    const weightSum = mix.reduce((a, [, v]) => a + v, 0);
    const groups: SpawnGroup[] = [];
    let assigned = 0;
    mix.forEach(([enemy, weight], i) => {
      const n = i === mix.length - 1 ? total - assigned : Math.max(1, Math.round((total * weight) / weightSum));
      assigned += n;
      if (n <= 0) return;
      // Spread each type across the whole wave so types interleave.
      groups.push({ enemy, count: n, interval: span / n, delay: (i * interval) / Math.max(1, mix.length) });
    });
    const chest = p.chests?.[w + 1];
    if (chest) groups.push({ chest, delay: Math.min(5, span * 0.3) });
    for (const g of p.extra?.[w + 1] ?? []) groups.push(g);
    out.push({ groups });
  }
  return out;
}

// ---- Placement tile sets (ids are "col-row" on the compact map, see maps.ts) ----
// The core eight tiles sit between the road passes, so each covers two stretches of road.
const CORE = ['1-1', '2-1', '1-2', '2-2', '2-4', '3-4', '2-5', '3-5'];

const STAGES: StageDef[] = [
  {
    id: '1-1',
    number: 1,
    roster: ['kitten', 'tabby'],
    tiles: [...CORE],
    startFish: 12,
    baseHp: 10,
    hpScale: 1,
    waveHpGrowth: 0.03,
    waves: buildWaves({ waves: 6, count: 5, growth: 1.2, interval: [1.7, 1.2], mix: () => ({ normal: 1 }) }),
    rewards: { firstClear: 30, replay: 10 },
  },
  {
    id: '1-2',
    number: 2,
    roster: ['kitten', 'tabby'],
    tiles: [...CORE, '4-1', '4-2'],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.4,
    waveHpGrowth: 0.23,
    waves: buildWaves({ waves: 9, count: 7, growth: 1.3, interval: [1.4, 0.95], mix: () => ({ normal: 1 }) }),
    rewards: { firstClear: 35, replay: 12 },
  },
  {
    id: '1-3',
    number: 3,
    roster: ['kitten', 'tabby', 'orange'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5'],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.6,
    waveHpGrowth: 0.25,
    waves: buildWaves({
      waves: 10,
      count: 8,
      growth: 1.4,
      interval: [1.3, 0.85],
      mix: () => ({ normal: 1 }),
      chests: { 3: 'bronze', 6: 'bronze', 9: 'bronze' },
    }),
    rewards: { firstClear: 40, replay: 14 },
  },
  {
    id: '1-4',
    number: 4,
    roster: ['kitten', 'tabby', 'orange'],
    tiles: [...CORE, '4-2', '0-4', '1-7', '2-7'],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.75,
    waveHpGrowth: 0.185,
    waves: buildWaves({
      waves: 14,
      count: 9,
      growth: 1.4,
      interval: [1.2, 0.75],
      mix: (w) => (w < 1 ? { normal: 1 } : w === 1 ? { fast: 1 } : { normal: 3, fast: 1 + w * 0.15 }),
      chests: { 4: 'bronze', 8: 'bronze', 11: 'bronze' },
    }),
    rewards: { firstClear: 45, replay: 15 },
  },
  {
    id: '1-5',
    number: 5,
    roster: ['kitten', 'tabby', 'orange', 'black'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '1-7', '2-7'],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.85,
    waveHpGrowth: 0.18,
    waves: buildWaves({
      waves: 14,
      count: 10,
      growth: 1.5,
      interval: [1.15, 0.7],
      mix: (w) => ({ normal: 3, fast: w > 0 ? 1.5 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'bronze' },
    }),
    rewards: { firstClear: 50, replay: 16 },
  },
  {
    id: '1-6',
    number: 6,
    roster: ['kitten', 'tabby', 'orange', 'black'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7'],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.95,
    waveHpGrowth: 0.1,
    waves: buildWaves({
      waves: 15,
      count: 10,
      growth: 1.5,
      interval: [1.15, 0.7],
      mix: (w) => (w === 1 ? { normal: 3, armored: 1 } : { normal: 3, fast: 1, armored: w > 1 ? 0.6 + w * 0.08 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'bronze' },
    }),
    rewards: { firstClear: 55, replay: 18 },
  },
  {
    id: '1-7',
    number: 7,
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '4-6'],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.7,
    waveHpGrowth: 0.04,
    waves: buildWaves({
      waves: 17,
      count: 11,
      growth: 1.6,
      interval: [1.1, 0.65],
      mix: (w) => ({ normal: 3, fast: 1.2, armored: 0.6 + w * 0.06 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'bronze', 13: 'silver' },
    }),
    rewards: { firstClear: 60, replay: 20 },
  },
  {
    id: '1-8',
    number: 8,
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '4-6', '0-2'],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.7,
    waveHpGrowth: 0.04,
    waves: buildWaves({
      waves: 17,
      count: 11,
      growth: 1.7,
      interval: [1.1, 0.62],
      mix: (w) => (w === 1 ? { normal: 3, shielded: 1 } : { normal: 3, fast: 1, armored: 0.8, shielded: w > 1 ? 1 + w * 0.05 : 0 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'bronze', 13: 'silver' },
    }),
    rewards: { firstClear: 70, replay: 22 },
  },
  {
    id: '1-9',
    number: 9,
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '4-6', '0-2', '4-4'],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.55,
    waveHpGrowth: 0.04,
    waves: buildWaves({
      waves: 18,
      count: 12,
      growth: 1.8,
      interval: [1.05, 0.58],
      mix: (w) => ({ normal: 3, fast: 1.5, armored: 1 + w * 0.05, shielded: 1 + w * 0.05 }),
      chests: { 3: 'bronze', 6: 'silver', 9: 'bronze', 12: 'silver', 14: 'bronze' },
    }),
    rewards: { firstClear: 80, replay: 25 },
  },
  {
    id: '1-10',
    number: 10,
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '4-6', '0-2', '4-4', '0-1', '4-7'],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.6,
    waveHpGrowth: 0.035,
    isBoss: true,
    waves: buildWaves({
      waves: 21,
      count: 12,
      growth: 1.8,
      interval: [1.05, 0.6],
      mix: (w) => (w === 20 ? { normal: 2, shielded: 1 } : { normal: 3, fast: 1.5, armored: 1 + w * 0.05, shielded: 1 + w * 0.05 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 19: 'bronze' },
      extra: { 21: [{ enemy: 'boss', count: 1, interval: 1, delay: 3 }] },
    }),
    rewards: { firstClear: 150, replay: 40 },
  },
];

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'ch1',
    number: 1,
    name: 'Beginner Forest',
    mapId: 'forest_compact',
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
