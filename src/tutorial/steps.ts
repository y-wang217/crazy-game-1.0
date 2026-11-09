// Scripted tutorial lessons per stage. First-time cat / enemy / chest
// introductions are automatic (see director.ts) and need no entry here.
//
// Each step runs once per player (its id is saved). Steps in a stage run in
// order; a step with `when` waits until that condition is true.
//
// V1.2: every basic control is taught in Stage 1. Stage 2 lists the same
// move/swap/merge lessons (same ids) only as a catch-up for players who
// finished Stage 1 before V1.2 — new players have already seen them.

import { canMerge, type Battle, type CatUnit } from '../game/battle';
import type { CatId } from '../game/types';
import type { SeenStore, StepView } from './director';

export interface StepDef {
  id: string;
  when?: (b: Battle, seen: SeenStore) => boolean;
  /** If true, the step is marked as seen without being shown. */
  skip?: (seen: SeenStore) => boolean;
  /** Runtime version of `skip`: the player already did this on their own, so mark it done silently. */
  doneIf?: (b: Battle) => boolean;
  /** Shown only during Tactical Pause (all other lessons only while the battle is playing). */
  whilePaused?: boolean;
  /** Controlled setup so the lesson can't get stuck on bad luck. Must be idempotent. */
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

/** Two cats that can merge right now (prefers Lv.1 pairs). */
function mergePair(b: Battle): [CatUnit, CatUnit] | null {
  const cats = [...b.cats].sort((x, y) => x.level - y.level);
  for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) if (canMerge(cats[i], cats[j])) return [cats[i], cats[j]];
  return null;
}

/** Two cats that would swap (different type or level). */
function swapPair(b: Battle): [CatUnit, CatUnit] | null {
  for (const a of b.cats) for (const c of b.cats) if (a !== c && b.previewDrop(a.uid, c.tileId).result === 'swapped') return [a, c];
  return null;
}

function placeOnEmpty(b: Battle, type: CatId): void {
  const t = b.emptyTiles()[0];
  if (t) b.placeCat(type, 1, t.id);
}

/** Make sure there are at least two cats that would swap. */
function ensureSwapPair(b: Battle): void {
  if (swapPair(b)) return;
  const have = b.cats[0]?.type;
  const other = b.stage.roster.find((c) => c !== have) ?? 'tabby';
  if (!b.cats.length) placeOnEmpty(b, b.stage.roster[0]);
  placeOnEmpty(b, other);
}

/** Make sure two identical Lv.1 cats exist for the merge lesson. */
function ensureMergePair(b: Battle): void {
  if (mergePair(b)) return;
  const lv1 = b.cats.find((c) => c.level === 1);
  const type = lv1?.type ?? b.stage.roster[0];
  if (!lv1) placeOnEmpty(b, type);
  placeOnEmpty(b, type);
}

const MOVE: StepDef = {
  id: 'tut:move',
  build: (b) => {
    const cat = b.cats[0];
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
};

const SWAP: StepDef = {
  id: 'tut:swap',
  setup: ensureSwapPair,
  build: (b) => {
    const pair = swapPair(b);
    if (!pair) return null;
    const [a, c] = pair;
    return {
      panel: text('swap'),
      expect: 'swapped',
      hintKey: 'tut.hint.swap',
      focus: [
        { kind: 'cat', uid: a.uid },
        { kind: 'cat', uid: c.uid },
      ],
      pointer: { type: 'drag', from: { kind: 'cat', uid: a.uid }, to: { kind: 'cat', uid: c.uid } },
    };
  },
};

const MERGE: StepDef = {
  id: 'tut:merge',
  setup: ensureMergePair,
  build: (b) => {
    const pair = mergePair(b);
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
};

const MERGE_INFO: StepDef = {
  id: 'tut:mergeInfo',
  build: (b) => {
    const top = [...b.cats].sort((p, q) => q.level - p.level)[0];
    return { panel: text('mergeInfo'), focus: top ? [{ kind: 'cat', uid: top.uid }] : [] };
  },
};

const SPEED_TIP: StepDef = {
  id: 'tut:speed',
  when: (b) => !b.preparing && b.foes.some((f) => f.alive && f.kind === 'enemy' && f.dist > 60),
  build: () => ({
    panel: text('speed'),
    expect: 'speed',
    hintKey: 'tut.hint.speed',
    focus: [{ kind: 'button', id: 'speed' }],
    pointer: { type: 'tap', at: { kind: 'button', id: 'speed' } },
  }),
};

// ---- Tactical Pause (any stage from 1-3 on, once ever; new and existing players) ----
const tacticalEligible = (b: Battle) => (b.stage.order ?? b.stage.number) >= 3 && !b.sandbox;

/** Drag lesson used while paused: move to an empty tile if there is one, otherwise swap/merge. */
function pausedDrag(b: Battle): StepView | null {
  const m = mergePair(b);
  const cat = b.cats.find((c) => nearestEmpty(b, c));
  let from: CatUnit | undefined;
  let to: { kind: 'tile'; id: string } | { kind: 'cat'; uid: number } | undefined;
  if (cat) {
    from = cat;
    to = { kind: 'tile', id: nearestEmpty(b, cat).id };
  } else if (m) {
    from = m[0];
    to = { kind: 'cat', uid: m[1].uid };
  } else {
    const s = swapPair(b);
    if (!s) return null;
    from = s[0];
    to = { kind: 'cat', uid: s[1].uid };
  }
  return {
    panel: text('tpauseMove'),
    expect: ['moved', 'swapped', 'merged'],
    hintKey: 'tut.hint.tpauseMove',
    focus: [{ kind: 'cat', uid: from.uid }, to],
    pointer: { type: 'drag', from: { kind: 'cat', uid: from.uid }, to },
  };
}

export const GLOBAL_STEPS: StepDef[] = [
  {
    id: 'tut:tpause',
    // Already used it on their own → no need to teach the button.
    doneIf: (b) => tacticalEligible(b) && b.stats.tacticalPauses > 0,
    when: (b) => tacticalEligible(b) && !b.preparing && b.cats.length >= 2 && b.foes.some((f) => f.alive && f.kind === 'enemy' && f.dist > 80),
    build: () => ({
      panel: text('tpause'),
      expect: 'pause',
      hintKey: 'tut.hint.tpause',
      focus: [{ kind: 'button', id: 'tpause' }],
      pointer: { type: 'tap', at: { kind: 'button', id: 'tpause' } },
    }),
  },
  {
    id: 'tut:tpauseMove',
    whilePaused: true,
    // Resumed before we got here (e.g. from the menu): don't trap them in a paused lesson later.
    doneIf: (b) => b.status === 'playing' && !b.preparing,
    when: (b) => b.cats.length >= 2,
    build: pausedDrag,
  },
  {
    id: 'tut:tpauseResume',
    whilePaused: true,
    doneIf: (b) => b.status === 'playing' && !b.preparing,
    build: () => ({
      panel: text('tpauseResume'),
      expect: 'resume',
      hintKey: 'tut.hint.tpauseResume',
      focus: [{ kind: 'button', id: 'resume' }],
      pointer: { type: 'tap', at: { kind: 'button', id: 'resume' } },
    }),
  },
];

export const STAGE_STEPS: Record<string, StepDef[]> = {
  // Stage 1: every basic control, one lesson at a time.
  '1-1': [
    {
      id: 'tut:welcome',
      build: (b) => {
        const start = b.path.pointAt(30);
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
    {
      id: 'tut:summonMore',
      // Players who learned moving in V1.1 don't need this warm-up.
      skip: (seen) => seen.has('tut:move'),
      setup: (b) => {
        const need = b.summonCost * 3; // tiered costs: covers the next two summons
        if (b.fish < need) b.fish = need;
      },
      build: () => ({
        panel: text('summonMore'),
        expect: 'summon',
        hintKey: 'tut.hint.summonMore',
        focus: [{ kind: 'button', id: 'summon' }],
        pointer: { type: 'tap', at: { kind: 'button', id: 'summon' } },
        doneWhen: (b) => b.cats.length >= 3,
      }),
    },
    MOVE,
    SWAP,
    MERGE,
    MERGE_INFO,
    { id: 'tut:ready', build: () => ({ panel: text('ready'), focus: [{ kind: 'button', id: 'start' }] }) },
  ],

  // Stage 2 is practice. These only appear for players who never saw them (pre-V1.2 saves).
  // V1.3: once mice are walking, suggest the speed button.
  '1-2': [MOVE, SWAP, MERGE, MERGE_INFO, SPEED_TIP],

  // Chapter 2 opener: the spiral road and the central cat house.
  '2-1': [
    {
      id: 'tut:ch2',
      build: (b) => {
        const start = b.path.pointAt(30);
        const end = b.path.pointAt(b.path.length);
        return {
          panel: text('ch2'),
          focus: [
            { kind: 'point', x: start.x, y: start.y, r: 30 },
            { kind: 'point', x: end.x, y: end.y + 10, r: 34 },
          ],
        };
      },
    },
  ],

  // Stage 4: targeting in practice, right after meeting Zippy Mice.
  '1-4': [
    { id: 'tut:targetTips', when: (_b, seen) => seen.has('enemy:fast'), build: () => ({ panel: text('targetTips', 'targetTips'), focus: [] }) },
  ],

  // Stage 5: the Random Skill button unlocks.
  '1-5': [
    {
      id: 'tut:skillShop',
      when: (b) => b.waveIndex >= 1,
      // "This first one is on us": top up exactly the cost.
      setup: (b) => {
        if (b.fish < b.skillCost * 2) b.fish += b.skillCost;
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
