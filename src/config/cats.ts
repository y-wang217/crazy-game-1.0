import type { CatDef, CatId, TargetMode } from '../game/types';

// Base stats are Lv.1 values. Level scaling lives in balance.ts (×2 damage per merge).
// The Kitten is the baseline; every other cat is deliberately specialised:
//
//            hit dmg  attacks/s  range(tiles)  targets            notes
//   Kitten     10       1.43        1.76       1                  steady, no big weakness (baseline)
//   Tabby   3.5×3       2.0         1.12       1 (3 timed hits)   6 hits/s, short reach, poor vs armor
//   Orange     28       0.45        1.40       area (1.16 tiles)  0.7s wind-up; slam lands where the
//                                                                target WAS → fast mice can slip away
//   Black      46       0.33        3.2        1                  0.6s aim, overkill on small mice
//   White       0       0.45        1.64       area               45% slow for 2s (+15% on her focus)
//
// Rough Lv.1 single-target DPS: kitten 14, tabby 21, orange 13 (×mice hit), black 15, white 0.
// Range matters a lot (longer range = more time hitting each mouse), so long-range cats get
// lower single-target DPS. `npm test` prints a Lv.1 comparison table (catIdentity.test.ts).

export const CATS: Record<CatId, CatDef> = {
  kitten: {
    id: 'kitten',
    name: 'Kitten',
    title: 'Little Adventurer',
    personality: 'Curious, brave and always eager to help.',
    role: 'Balanced all-rounder',
    attack: 'projectile',
    damage: 10,
    range: 88,
    interval: 0.7,
    projectileSpeed: 380,
    scale: 0.88,
    palette: {
      body: '#f4c98f',
      belly: '#fff3dd',
      earInner: '#f6a5a5',
      stripe: '#e0a868',
      eye: '#3a2a20',
      outline: '#8a5a32',
    },
  },
  tabby: {
    id: 'tabby',
    name: 'Tabby Warrior',
    title: 'Born Fighter',
    personality: 'Competitive, confident, always ready to scrap.',
    role: 'Rapid combo striker',
    attack: 'combo',
    damage: 3.5,
    comboHits: 3,
    range: 56,
    interval: 0.5,
    comboGap: 0.08,
    scale: 0.95,
    palette: {
      body: '#c9a27a',
      belly: '#efe0c8',
      earInner: '#e89a9a',
      stripe: '#7a5a3a',
      eye: '#2c3a1e',
      outline: '#5e4128',
    },
  },
  orange: {
    id: 'orange',
    name: 'Chubby Orange',
    title: 'Lazy Heavyweight',
    personality: 'Loves food and naps. Hits like a falling sofa.',
    role: 'Slow area slam',
    attack: 'slam',
    damage: 28,
    splashRadius: 58,
    splashRatio: 0.85,
    range: 70,
    interval: 2.2,
    windup: 0.7,
    scale: 1.08,
    palette: {
      body: '#f29b4b',
      belly: '#ffe2bf',
      earInner: '#f7b0a0',
      stripe: '#d77a2c',
      eye: '#3a2a20',
      outline: '#9a5420',
    },
  },
  black: {
    id: 'black',
    name: 'Black Cat',
    title: 'Silent Hunter',
    personality: 'Quiet, patient, and terrifyingly focused.',
    role: 'Long-range sniper',
    attack: 'snipe',
    damage: 46,
    range: 160,
    interval: 3.0,
    projectileSpeed: 950,
    windup: 0.6,
    scale: 0.95,
    palette: {
      body: '#3c3b4a',
      belly: '#55546a',
      earInner: '#8a6a8a',
      stripe: '#2c2b38',
      eye: '#ffd84a',
      outline: '#1e1d28',
    },
  },
  white: {
    id: 'white',
    name: 'Noble White',
    title: 'Noble Beauty',
    personality: 'Elegant, proud, and knows exactly how cute she is.',
    role: 'Distracting slow aura',
    attack: 'aura',
    damage: 0,
    range: 82,
    interval: 2.2,
    slowStrength: 0.45,
    slowDuration: 2.0,
    focusBonus: 0.15,
    scale: 1.0,
    palette: {
      body: '#fbfbff',
      belly: '#ffffff',
      earInner: '#f8b8cc',
      stripe: '#e6e6f2',
      eye: '#4a8ad8',
      outline: '#a8a8c0',
    },
  },
};

export const CAT_ORDER: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];

export const TARGET_MODES: TargetMode[] = ['first', 'nearest', 'strongest', 'weakest', 'treasure'];

export const TARGET_MODE_INFO: Record<TargetMode, { label: string; short: string; color: string }> = {
  first: { label: 'First', short: '»', color: '#4a7fd8' },
  nearest: { label: 'Nearest', short: 'N', color: '#3aa36a' },
  strongest: { label: 'Strongest', short: 'S', color: '#d8504a' },
  weakest: { label: 'Weakest', short: 'W', color: '#9a62c8' },
  treasure: { label: 'Treasure', short: '$', color: '#e0a020' },
};
