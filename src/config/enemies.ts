import type { ChestDef, ChestTier, EnemyDef, EnemyId } from '../game/types';

// HP / shield are Stage 1 values; each stage applies its own hpScale.
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  normal: { id: 'normal', name: 'Forest Mouse', hp: 40, shield: 0, armor: 0, speed: 38, reward: 2, baseDamage: 1, radius: 11 },
  fast: { id: 'fast', name: 'Zippy Mouse', hp: 24, shield: 0, armor: 0, speed: 74, reward: 2, baseDamage: 1, radius: 9 },
  armored: { id: 'armored', name: 'Acorn Knight', hp: 80, shield: 0, armor: 6, speed: 26, reward: 4, baseDamage: 2, radius: 12 },
  shielded: { id: 'shielded', name: 'Leaf Guard', hp: 55, shield: 55, armor: 1, speed: 33, reward: 4, baseDamage: 2, radius: 11 },
  boss: { id: 'boss', name: 'Big Cheese King', hp: 1800, shield: 0, armor: 4, speed: 15, reward: 40, baseDamage: 8, radius: 22, isBoss: true },
  // ---- Elite enemies (rare, crowned): focused threats that create decision moments ----
  // HP elite: a slow wall of HP — needs concentrated damage (Strongest targeting).
  brute: { id: 'brute', name: 'Chonky Cheese Guard', hp: 320, shield: 0, armor: 2, speed: 22, reward: 10, baseDamage: 3, radius: 15, elite: 'hp' },
  // Armor elite: shrugs off small hits — answer with armor piercing (Black Cat, Armor Break,
  // Orange's slam) or poison, not with more Lv.1 cats.
  ironclad: {
    id: 'ironclad',
    name: 'Iron Helm Mouse',
    hp: 150,
    shield: 0,
    armor: 12,
    speed: 22,
    reward: 10,
    baseDamage: 3,
    radius: 14,
    elite: 'armor',
  },
  // Fast elite: sprints for the house and steals 3 hearts if it escapes — First targeting.
  thief: { id: 'thief', name: 'Cheese Thief', hp: 70, shield: 0, armor: 0, speed: 92, reward: 8, baseDamage: 3, radius: 10, elite: 'fast' },
  // Escort elite: arrives with an escort; nearby mice take less damage while it lives
  // (BALANCE.elite.guard*). Kill the Captain first — or poison the pack (poison ignores it).
  captain: { id: 'captain', name: 'Mouse Captain', hp: 200, shield: 0, armor: 3, speed: 30, reward: 12, baseDamage: 3, radius: 14, elite: 'escort' },
  // Secret (V1.6): 罐頭怪 / Living Cat Food Can — a walking tin, not a mouse. Only on 2-6, 2-9,
  // 2-15 and 2-18 (config/canMonster.ts), in the same wave as a mid-stage elite. Huge HP, no armor,
  // very fast (beats every elite to the house), immune to all slows. Each time it reaches the house
  // it takes 1 heart and runs the road again with the HP it has left, until it is defeated.
  canMonster: {
    id: 'canMonster',
    name: 'Living Cat Food Can',
    // Tuned with the bots: ~1,800–2,300 HP on its stages (several times a mouse), fast enough to
    // beat even the Cheese Thief home, and Beginner win rates on 2-6/2-9/2-15/2-18 stay the same.
    hp: 220,
    shield: 0,
    armor: 0,
    speed: 122,
    reward: 12,
    baseDamage: 1,
    radius: 13,
    slowImmune: true,
    loops: true,
  },
  // Chapter 2 final boss (2-20): a moonlight veil (shield) that regrows ONCE when its HP falls
  // to half (BALANCE.boss), calling a few guards — the fight has a real second phase.
  moonEmperor: {
    id: 'moonEmperor',
    name: 'Moonshadow Emperor',
    hp: 2600,
    shield: 1300,
    armor: 6,
    speed: 12,
    reward: 80,
    baseDamage: 8,
    radius: 24,
    isBoss: true,
  },
  // Chapter 2 mid-chapter boss (2-10): the huge mushroom cap is a regenerating-free shield (existing mechanic),
  // the body underneath is armored. Break the cap first, then burn through the HP.
  mushroomKing: {
    id: 'mushroomKing',
    name: 'Mushroom King',
    hp: 2200,
    shield: 1100,
    armor: 6,
    speed: 13,
    reward: 60,
    baseDamage: 8,
    radius: 23,
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
