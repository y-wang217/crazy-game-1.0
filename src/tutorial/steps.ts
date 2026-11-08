// Scripted tutorial lessons per stage. First-time cat / enemy / chest
// introductions are automatic (see director.ts) and need no entry here.
//
// Each step runs once per player (its id is saved). Steps in a stage run in
// order; a step with `when` waits until that condition is true.

import { canMerge, type Battle, type CatUnit } from '../game/battle';
import type { SeenStore, StepView } from './director';

export interface StepDef {
  id: string;
  when?: (b: Battle, seen: SeenStore) => boolean;
  /** Controlled setup so the lesson can't get stuck on bad luck. */
  setup?: (b: Battle) => void;
  build: (b: Battle) => StepView | null;
}

const text = (name: string, extra?: 'modes' | 'targetTips') => ({
  kind: 'text' as const,
  titleKey: `tut.${name}.title`,
  bodyKey: `tut.${name}.body`,
  extra,
});

function nearestEmpty(b: Battle, cat: CatUnit) {
  const empty = b.emptyTiles();
  empty.sort((x, y) => Math.hypot(x.x - cat.x, x.y - cat.y) - Math.hypot(y.x - cat.x, y.y - cat.y));
  return empty[0];
}

function kittenPair(b: Battle): [CatUnit, CatUnit] | null {
  const ks = b.cats.filter((c) => c.type === 'kitten');
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (canMerge(ks[i], ks[j])) return [ks[i], ks[j]];
  return null;
}

export const STAGE_STEPS: Record<string, StepDef[]> = {
  // Stage 1: summoning, automatic combat, tap-to-target.
  '1-1': [
    {
      id: 'tut:welcome',
      build: (b) => {
        const start = b.path.pointAt(18);
        const end = b.path.pointAt(b.path.length);
        return {
          panel: text('welcome'),
          focus: [
            { kind: 'point', x: start.x, y: start.y, r: 30 },
            { kind: 'point', x: end.x, y: end.y + 10, r: 34 },
          ],
        };
      },
    },
    {
      id: 'tut:summon',
      setup: (b) => {
        if (b.fish < b.summonCost) b.fish = b.summonCost;
      },
      build: () => ({
        panel: text('summon'),
        expect: 'summon',
        hintKey: 'tut.hint.summon',
        focus: [{ kind: 'button', id: 'summon' }],
        pointer: { type: 'tap', at: { kind: 'button', id: 'summon' } },
      }),
    },
    {
      id: 'tut:autoAttack',
      when: (b) => b.cats.length > 0,
      build: (b) => ({ panel: text('autoAttack'), focus: [{ kind: 'cat', uid: b.cats[0].uid }] }),
    },
    {
      id: 'tut:target',
      when: (b) => b.cats.length > 0,
      build: (b) => {
        const cat = b.cats[0];
        return {
          panel: text('target'),
          expect: 'tap',
          hintKey: 'tut.hint.tap',
          focus: [{ kind: 'cat', uid: cat.uid }],
          pointer: { type: 'tap', at: { kind: 'cat', uid: cat.uid } },
        };
      },
    },
    { id: 'tut:modes', build: () => ({ panel: text('modes', 'modes'), focus: [] }) },
    { id: 'tut:ready', build: () => ({ panel: text('ready'), focus: [{ kind: 'button', id: 'summon' }] }) },
  ],

  // Stage 2: move, swap, merge — with guaranteed cats (see stage startCats).
  '1-2': [
    {
      id: 'tut:move',
      build: (b) => {
        const cat = b.cats.find((c) => c.type === 'tabby') ?? b.cats[0];
        if (!cat) return null;
        const dest = nearestEmpty(b, cat);
        if (!dest) return null;
        return {
          panel: text('move'),
          expect: 'moved',
          hintKey: 'tut.hint.move',
          focus: [
            { kind: 'cat', uid: cat.uid },
            { kind: 'tile', id: dest.id },
          ],
          pointer: { type: 'drag', from: { kind: 'cat', uid: cat.uid }, to: { kind: 'tile', id: dest.id } },
        };
      },
    },
    {
      id: 'tut:swap',
      setup: (b) => ensureDifferentPair(b),
      build: (b) => {
        const a = b.cats.find((c) => c.type === 'tabby');
        const k = b.cats.find((c) => c.type !== a?.type);
        if (!a || !k) return null;
        return {
          panel: text('swap'),
          expect: 'swapped',
          hintKey: 'tut.hint.swap',
          focus: [
            { kind: 'cat', uid: a.uid },
            { kind: 'cat', uid: k.uid },
          ],
          pointer: { type: 'drag', from: { kind: 'cat', uid: a.uid }, to: { kind: 'cat', uid: k.uid } },
        };
      },
    },
    {
      id: 'tut:merge',
      setup: (b) => ensureKittenPair(b),
      build: (b) => {
        const pair = kittenPair(b);
        if (!pair) return null;
        const [x, y] = pair;
        return {
          panel: text('merge'),
          expect: 'merged',
          hintKey: 'tut.hint.merge',
          focus: [
            { kind: 'cat', uid: x.uid },
            { kind: 'cat', uid: y.uid },
          ],
          pointer: { type: 'drag', from: { kind: 'cat', uid: x.uid }, to: { kind: 'cat', uid: y.uid } },
        };
      },
    },
    {
      id: 'tut:mergeInfo',
      build: (b) => {
        const top = [...b.cats].sort((p, q) => q.level - p.level)[0];
        return { panel: text('mergeInfo'), focus: top ? [{ kind: 'cat', uid: top.uid }] : [] };
      },
    },
  ],

  // Stage 4: targeting in practice, right after meeting Zippy Mice.
  '1-4': [
    {
      id: 'tut:targetTips',
      when: (_b, seen) => seen.has('enemy:fast'),
      build: () => ({ panel: text('targetTips', 'targetTips'), focus: [] }),
    },
  ],

  // Stage 5: the Random Skill button unlocks.
  '1-5': [
    {
      id: 'tut:skillShop',
      when: (b) => b.waveIndex >= 1,
      // "This first one is on us": top up exactly the cost.
      setup: (b) => {
        b.fish += b.skillCost;
      },
      build: () => ({
        panel: text('skillShop'),
        expect: 'skill',
        hintKey: 'tut.hint.skill',
        focus: [{ kind: 'button', id: 'skill' }],
        pointer: { type: 'tap', at: { kind: 'button', id: 'skill' } },
      }),
    },
    { id: 'tut:skillDup', build: () => ({ panel: text('skillDup'), focus: [] }) },
  ],
};

/** Make sure a Tabby and a non-Tabby exist for the swap lesson. */
function ensureDifferentPair(b: Battle): void {
  if (!b.cats.some((c) => c.type === 'tabby')) placeOnEmpty(b, 'tabby');
  if (!b.cats.some((c) => c.type !== 'tabby')) placeOnEmpty(b, 'kitten');
}

/** Make sure two Lv.1 Kittens exist for the merge lesson. */
function ensureKittenPair(b: Battle): void {
  while (!kittenPair(b) && b.emptyTiles().length) placeOnEmpty(b, 'kitten');
}

function placeOnEmpty(b: Battle, type: 'kitten' | 'tabby'): void {
  const t = b.emptyTiles()[0];
  if (t) b.placeCat(type, 1, t.id);
}
