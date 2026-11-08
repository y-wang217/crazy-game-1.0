// Tutorial director: decides WHEN to show a tutorial step or first-time
// introduction, freezes the battle while it is shown, and checks whether the
// player performed the required action. It never changes combat rules.

import type { Battle } from '../game/battle';
import type { CatId, ChestTier, EnemyId } from '../game/types';
import { STAGE_STEPS, type StepDef } from './steps';

export type TutAction = 'summon' | 'skill' | 'tap' | 'moved' | 'swapped' | 'merged';

export type Focus =
  | { kind: 'button'; id: 'summon' | 'skill' }
  | { kind: 'cat'; uid: number }
  | { kind: 'tile'; id: string }
  | { kind: 'foe'; uid: number }
  /** A world-space circle (cell units are world px). */
  | { kind: 'point'; x: number; y: number; r: number };

export type Pointer = { type: 'tap'; at: Focus } | { type: 'drag'; from: Focus; to: Focus };

export type Panel =
  | { kind: 'text'; titleKey: string; bodyKey: string; extra?: 'modes' | 'targetTips' }
  | { kind: 'cat'; cat: CatId }
  | { kind: 'enemy'; enemy: EnemyId }
  | { kind: 'chest'; tier: ChestTier };

export interface StepView {
  panel: Panel;
  /** Interactive steps wait for `expect`; passive steps wait for Continue. */
  expect?: TutAction;
  hintKey?: string;
  focus: Focus[];
  pointer?: Pointer;
  /**
   * Optional completion condition for interactive steps that need the action
   * more than once (e.g. "summon two more cats"). Checked every frame.
   */
  doneWhen?: (b: Battle) => boolean;
}

export interface ActiveStep extends StepView {
  id: string;
  /** Unique per activation, for React keys. */
  key: number;
}

export interface SeenStore {
  has(id: string): boolean;
  mark(id: string): void;
}

let activationCounter = 1;
/** Foes are introduced once they have walked this far onto the visible road (world px). */
const INTRO_MIN_DIST = 45;

export class TutorialDirector {
  active: ActiveStep | null = null;
  private steps: StepDef[];

  constructor(
    stageId: string,
    private seen: SeenStore,
  ) {
    this.steps = STAGE_STEPS[stageId] ?? [];
  }

  /** Call once per frame. Returns the active step (if any). */
  update(b: Battle): ActiveStep | null {
    if (this.active?.doneWhen?.(b)) this.complete(b);
    if (this.active) {
      b.frozen = true;
      return this.active;
    }
    b.frozen = false;
    if (b.status !== 'playing') return null;

    const next = this.findIntro(b) ?? this.findScripted(b);
    if (next) {
      this.active = { ...next, key: activationCounter++ };
      b.frozen = true;
    }
    return this.active;
  }

  /** May the player perform this action right now? (Gates input during interactive steps.) */
  allows(action: TutAction): boolean {
    const a = this.active;
    if (!a) return true;
    if (!a.expect) return false; // passive: only the Continue button
    return a.expect === action;
  }

  /** Report a successful player action. Completes an interactive step that expected it. */
  onAction(action: TutAction, b: Battle): void {
    const a = this.active;
    if (!a || a.expect !== action) return;
    if (a.doneWhen) {
      if (a.doneWhen(b)) this.complete(b);
    } else this.complete(b);
  }

  /** Finish the current step (Continue button, or the expected action). */
  complete(b: Battle): void {
    if (!this.active) return;
    this.seen.mark(this.active.id);
    this.active = null;
    b.frozen = false;
  }

  // ---- First-time introductions (global, saved across stages) ----
  private findIntro(b: Battle): Omit<ActiveStep, 'key'> | null {
    for (const cat of b.cats) {
      const id = `cat:${cat.type}`;
      if (!this.seen.has(id)) return { id, panel: { kind: 'cat', cat: cat.type }, focus: [{ kind: 'cat', uid: cat.uid }] };
    }
    for (const f of b.foes) {
      // Wait until it has walked out of the burrow so the spotlight shows it.
      if (!f.alive || f.dist < INTRO_MIN_DIST) continue;
      if (f.kind === 'enemy') {
        const id = `enemy:${f.defId}`;
        if (!this.seen.has(id)) return { id, panel: { kind: 'enemy', enemy: f.defId as EnemyId }, focus: [{ kind: 'foe', uid: f.uid }] };
      } else {
        const id = `chest:${f.defId}`;
        if (!this.seen.has(id)) return { id, panel: { kind: 'chest', tier: f.defId as ChestTier }, focus: [{ kind: 'foe', uid: f.uid }] };
      }
    }
    return null;
  }

  // ---- Scripted per-stage lessons (run in order; each only once ever) ----
  private findScripted(b: Battle): Omit<ActiveStep, 'key'> | null {
    let step = this.steps.find((s) => !this.seen.has(s.id));
    // Lessons a returning player has effectively covered are marked done silently.
    while (step?.skip?.(this.seen)) {
      this.seen.mark(step.id);
      step = this.steps.find((s) => !this.seen.has(s.id));
    }
    if (!step) return null;
    if (step.when && !step.when(b, this.seen)) return null;
    step.setup?.(b);
    // A setup may place a cat the player has never met: introduce it first.
    const intro = this.findIntro(b);
    if (intro) return intro;
    const view = step.build(b);
    if (!view) return null;
    return { id: step.id, ...view };
  }
}
