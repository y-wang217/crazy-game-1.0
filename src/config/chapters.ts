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
    fixedRoster: true,
    tiles: [...CORE],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.6,
    waveHpGrowth: 0.03,
    waves: buildWaves({ waves: 6, count: 5, growth: 1.2, interval: [1.7, 1.2], mix: () => ({ normal: 1 }) }),
    rewards: { firstClear: 30, replay: 10 },
  },
  {
    id: '1-2',
    number: 2,
    roster: ['kitten', 'tabby'],
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2'],
    startFish: 12,
    baseHp: 10,
    hpScale: 3.7,
    waveHpGrowth: 0.23,
    waves: buildWaves({ waves: 9, count: 7, growth: 1.3, interval: [1.4, 0.95], mix: () => ({ normal: 1 }) }),
    rewards: { firstClear: 35, replay: 12 },
  },
  {
    id: '1-3',
    number: 3,
    roster: ['kitten', 'tabby', 'orange'],
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7'],
    startFish: 12,
    baseHp: 10,
    hpScale: 5.0,
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
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2'],
    startFish: 12,
    baseHp: 10,
    hpScale: 5.42,
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
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6'],
    startFish: 12,
    baseHp: 10,
    hpScale: 4.94,
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
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4'],
    startFish: 12,
    baseHp: 10,
    hpScale: 5.51,
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
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4', '0-1'],
    startFish: 12,
    baseHp: 10,
    hpScale: 4.95,
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
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4', '0-1', '4-7'],
    startFish: 12,
    baseHp: 10,
    hpScale: 3.6,
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
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4', '0-1', '4-7', '0-3'],
    startFish: 12,
    baseHp: 10,
    hpScale: 3.5,
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
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4', '0-1', '4-7', '0-3', '4-5'],
    startFish: 12,
    baseHp: 10,
    hpScale: 3.45,
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

// ---------------------------------------------------------------------------
// Chapter 2 — Moonlit Mushroom Forest (spiral road, cat house in the middle)
// ---------------------------------------------------------------------------
// Same enemies and systems as Chapter 1; difficulty comes from bigger, mixed waves,
// tougher HP/armor, more speed variety and fewer (but better-covering) tiles, so
// positioning and merging matter more. Tile ids refer to MUSHROOM_MAP.
const ALL_CATS: StageDef['roster'] = ['kitten', 'tabby', 'orange', 'black', 'white'];
const RING = ['1-1', '1-2', '1-3', '1-4', '1-5', '3-2', '3-3', '3-4', '3-5', '2-5'];
/** Extra tiles in the order they open across Chapter 2. */
const RING_EXTRA = ['2-0', '2-7', '1-0', '3-7', '3-0', '1-7'];
const ring = (extra: number) => [...RING, ...RING_EXTRA.slice(0, extra)];

const CH2_STAGES: StageDef[] = [
  {
    id: '2-1',
    number: 1,
    roster: ALL_CATS,
    tiles: ring(1),
    startFish: 16,
    baseHp: 10,
    hpScale: 4.6,
    waveHpGrowth: 0.062,
    waves: buildWaves({
      waves: 12,
      count: 10,
      growth: 1.4,
      interval: [1.1, 0.7],
      mix: (w) => ({ normal: 3, fast: 1, armored: w > 2 ? 0.6 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 10: 'bronze' },
    }),
    rewards: { firstClear: 90, replay: 28 },
  },
  {
    id: '2-2',
    number: 2,
    roster: ALL_CATS,
    tiles: ring(1),
    startFish: 16,
    baseHp: 10,
    hpScale: 4.4,
    waveHpGrowth: 0.061,
    waves: buildWaves({
      waves: 13,
      count: 11,
      growth: 1.5,
      interval: [1.05, 0.68],
      mix: (w) => ({ normal: 3, fast: 1, shielded: w > 1 ? 1 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'bronze' },
    }),
    rewards: { firstClear: 95, replay: 30 },
  },
  {
    id: '2-3',
    number: 3,
    roster: ALL_CATS,
    tiles: ring(2),
    startFish: 16,
    baseHp: 10,
    hpScale: 5.5,
    waveHpGrowth: 0.06,
    waves: buildWaves({
      waves: 14,
      count: 12,
      growth: 1.5,
      interval: [1.0, 0.62],
      // "Rush hour": many Zippy Mice mixed with slow knights — speed variety.
      mix: (w) => ({ normal: 2, fast: 2 + w * 0.1, armored: w > 2 ? 0.8 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'silver' },
    }),
    rewards: { firstClear: 100, replay: 32 },
  },
  {
    id: '2-4',
    number: 4,
    roster: ALL_CATS,
    tiles: ring(2),
    startFish: 16,
    baseHp: 10,
    hpScale: 4.67,
    waveHpGrowth: 0.06,
    armorBonus: 1,
    waves: buildWaves({
      waves: 15,
      count: 12,
      growth: 1.6,
      interval: [1.0, 0.6],
      mix: (w) => ({ normal: 3, fast: 1, armored: 1 + w * 0.08, shielded: w > 3 ? 0.8 : 0 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'bronze', 13: 'silver' },
    }),
    rewards: { firstClear: 105, replay: 34 },
  },
  {
    id: '2-5',
    number: 5,
    roster: ALL_CATS,
    tiles: ring(3),
    startFish: 16,
    baseHp: 10,
    hpScale: 4.25,
    waveHpGrowth: 0.059,
    armorBonus: 1,
    waves: buildWaves({
      waves: 16,
      count: 12,
      growth: 1.7,
      interval: [0.98, 0.58],
      mix: (w) => ({ normal: 3, fast: 1.2, armored: 1 + w * 0.06, shielded: 1 + w * 0.06 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 14: 'bronze' },
    }),
    rewards: { firstClear: 110, replay: 36 },
  },
  {
    id: '2-6',
    number: 6,
    roster: ALL_CATS,
    tiles: ring(4),
    startFish: 16,
    baseHp: 10,
    hpScale: 5.6,
    waveHpGrowth: 0.059,
    armorBonus: 1,
    waves: buildWaves({
      waves: 16,
      count: 14,
      growth: 1.9,
      interval: [0.92, 0.52],
      // Swarm stage: lots of light mice — splash (Orange) and range (Black) shine.
      mix: (w) => ({ normal: 4, fast: 2, shielded: w > 2 ? 0.8 : 0 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'silver', 14: 'bronze' },
    }),
    rewards: { firstClear: 115, replay: 38 },
  },
  {
    id: '2-7',
    number: 7,
    roster: ALL_CATS,
    tiles: ring(4),
    startFish: 16,
    baseHp: 10,
    hpScale: 3.7,
    waveHpGrowth: 0.059,
    armorBonus: 2,
    waves: buildWaves({
      waves: 17,
      count: 13,
      growth: 1.8,
      interval: [0.95, 0.55],
      // Iron march: knights and guards — Black Cat's piercing shots and Noble White's charm matter.
      mix: (w) => ({ normal: 2, fast: 1, armored: 1.5 + w * 0.08, shielded: 1.2 + w * 0.06 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'bronze' },
    }),
    rewards: { firstClear: 120, replay: 40 },
  },
  {
    id: '2-8',
    number: 8,
    roster: ALL_CATS,
    tiles: ring(5),
    startFish: 16,
    baseHp: 10,
    hpScale: 4.03,
    waveHpGrowth: 0.058,
    armorBonus: 2,
    waves: buildWaves({
      waves: 18,
      count: 14,
      growth: 1.9,
      interval: [0.92, 0.52],
      mix: (w) => ({ normal: 3, fast: 1.5 + w * 0.05, armored: 1.2 + w * 0.06, shielded: 1.2 + w * 0.06 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'silver', 14: 'gold', 17: 'bronze' },
    }),
    rewards: { firstClear: 130, replay: 42 },
  },
  {
    id: '2-9',
    number: 9,
    roster: ALL_CATS,
    tiles: ring(6),
    startFish: 16,
    baseHp: 10,
    hpScale: 4.0,
    waveHpGrowth: 0.058,
    armorBonus: 2,
    waves: buildWaves({
      waves: 19,
      count: 15,
      growth: 2.0,
      interval: [0.9, 0.5],
      mix: (w) => ({ normal: 3, fast: 1.8, armored: 1.4 + w * 0.06, shielded: 1.4 + w * 0.06 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 18: 'bronze' },
    }),
    rewards: { firstClear: 140, replay: 45 },
  },
  {
    id: '2-10',
    number: 10,
    roster: ALL_CATS,
    tiles: ring(6),
    startFish: 16,
    baseHp: 10,
    hpScale: 4.25,
    waveHpGrowth: 0.05,
    armorBonus: 2,
    isBoss: true,
    waves: buildWaves({
      waves: 21,
      count: 15,
      growth: 1.9,
      interval: [0.9, 0.52],
      // The final wave is lighter so the Mushroom King gets the spotlight.
      mix: (w) => (w === 20 ? { normal: 2, shielded: 1 } : { normal: 3, fast: 1.6, armored: 1.3 + w * 0.05, shielded: 1.3 + w * 0.05 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 19: 'gold' },
      extra: { 21: [{ enemy: 'mushroomKing', count: 1, interval: 1, delay: 3 }] },
    }),
    rewards: { firstClear: 250, replay: 60 },
  },
];

// To add a chapter: give it a map in maps.ts, a stage list built like the ones above,
// names in the i18n files (`chapter.<id>`, `stage.<id>`), and append it here.
// Unlocking is linear across ALL_STAGE_IDS, so the new chapter opens after the previous boss.
export const CHAPTERS: ChapterDef[] = [
  { id: 'ch1', number: 1, name: 'Beginner Forest', mapId: 'forest_compact', stages: STAGES },
  { id: 'ch2', number: 2, name: 'Moonlit Mushroom Forest', mapId: 'mushroom', stages: CH2_STAGES },
];

// Global 1-based order (skill-shop unlock, chest scaling) — chapter-local `number` is for display.
CHAPTERS.flatMap((c) => c.stages).forEach((s, i) => {
  s.order = i + 1;
});

export function findStage(stageId: string): { chapter: ChapterDef; stage: StageDef; index: number } | null {
  for (const chapter of CHAPTERS) {
    const index = chapter.stages.findIndex((s) => s.id === stageId);
    if (index >= 0) return { chapter, stage: chapter.stages[index], index };
  }
  return null;
}

/** Linear order of all stages across chapters (for unlock progression). */
export const ALL_STAGE_IDS: string[] = CHAPTERS.flatMap((c) => c.stages.map((s) => s.id));
