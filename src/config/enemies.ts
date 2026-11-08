import type { ChestDef, ChestTier, EnemyDef, EnemyId } from '../game/types';

// HP / shield are Stage 1 values; each stage applies its own hpScale.
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  normal: {
    id: 'normal',
    name: 'Forest Mouse',
    hp: 40,
    shield: 0,
    armor: 0,
    speed: 38,
    reward: 2,
    baseDamage: 1,
    radius: 11,
  },
  fast: {
    id: 'fast',
    name: 'Zippy Mouse',
    hp: 24,
    shield: 0,
    armor: 0,
    speed: 74,
    reward: 2,
    baseDamage: 1,
    radius: 9,
  },
  armored: {
    id: 'armored',
    name: 'Acorn Knight',
    hp: 80,
    shield: 0,
    armor: 6,
    speed: 26,
    reward: 4,
    baseDamage: 2,
    radius: 12,
  },
  shielded: {
    id: 'shielded',
    name: 'Leaf Guard',
    hp: 55,
    shield: 55,
    armor: 1,
    speed: 33,
    reward: 4,
    baseDamage: 2,
    radius: 11,
  },
  boss: {
    id: 'boss',
    name: 'Big Cheese King',
    hp: 1800,
    shield: 0,
    armor: 4,
    speed: 15,
    reward: 40,
    baseDamage: 8,
    radius: 22,
    isBoss: true,
  },
};

// Treasure chests trade durability for speed: the tougher the chest, the slower it walks.
// Chest HP grows a little per stage (BALANCE.chest.hpPerStage) but does NOT follow the
// per-wave enemy HP ramp, so late chests stay breakable with sensible targeting.
export const CHESTS: Record<ChestTier, ChestDef> = {
  bronze: {
    tier: 'bronze',
    name: 'Bronze Chest',
    hp: 60,
    speed: 24,
    coins: [5, 10],
    levelsPerPick: 1,
    tierWeights: { basic: 3, improved: 1 },
    radius: 13,
  },
  silver: {
    tier: 'silver',
    name: 'Silver Chest',
    hp: 190,
    speed: 20,
    coins: [15, 25],
    levelsPerPick: 1,
    tierWeights: { basic: 1, improved: 2 },
    radius: 14,
  },
  gold: {
    tier: 'gold',
    name: 'Gold Chest',
    hp: 360,
    speed: 16,
    coins: [40, 60],
    levelsPerPick: 2,
    tierWeights: { basic: 1, improved: 3 },
    radius: 15,
  },
};
