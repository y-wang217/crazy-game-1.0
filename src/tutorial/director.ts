// Tutorial director: decides WHEN to show a tutorial step or first-time
// introduction, freezes the battle while it is shown, and checks whether the
// player performed the required action. It never changes combat rules.

import type { Battle } from '../game/battle';
import type { CatId, ChestTier, EnemyId } from '../game/types';
import { GLOBAL_STEPS, STAGE_STEPS, type StepDef } from './steps';

export type TutAction = 'summon' | 'skill' | 'tap' | 'moved' | 'swapped' | 'merged' | 'speed' | 'pause' | 'resume';

export type ButtonId = 'summon' | 'skill' | 'speed' | 'start' | 'tpause' | 'resume';

export type Focus =
  | { kind: 'button'; id: ButtonId }
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
  /** Interactive steps wait for `expect` (any of them, if a list); passive steps wait for Continue. */
  expect?: TutAction | TutAction[];
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
/**
 * After an interactive step succeeds, the battle stays frozen this long (visual seconds) while
 * the "Nice!" confirmation shows, before the next lesson may appear.
 */
export const SUCCESS_HOLD = 1.0;

export const expects = (e: StepView['expect'], action: TutAction): boolean => (Array.isArray(e) ? e.includes(action) : e === action);

/** Every scripted lesson id (all stages + global lessons). Used by "Skip tutorial". */
export const ALL_LESSON_IDS: string[] = [...new Set([...Object.values(STAGE_STEPS).flat(), ...GLOBAL_STEPS].map((s) => s.id))];

export class TutorialDirector {
  active: ActiveStep | null = null;
  /** Increments every time an interactive step is completed by the player (drives "Nice!"). */
  successCount = 0;
  private steps: StepDef[];
  private holdUntil = -1;

  constructor(
    stageId: string,
    private seen: SeenStore,
  ) {
    // Stage lessons first, then lessons that apply to any stage (each still only once ever).
    this.steps = [...(STAGE_STEPS[stageId] ?? []), ...GLOBAL_STEPS];
  }

  /** Is the short success beat after a completed action still running? (battle stays frozen) */
  holding(b: Battle): boolean {
    return b.vtime < this.holdUntil;
  }

  /** Call once per frame. Returns the active step (if any). */
  update(b: Battle): ActiveStep | null {
    if (this.active?.doneWhen?.(b)) this.complete(b, true);
    if (this.active) {
      b.frozen = true;
      return this.active;
    }
    if (this.holding(b) && (b.status === 'playing' || b.status === 'paused')) {
      b.frozen = true; // timers stay stopped during the confirmation beat
      return null;
    }
    b.frozen = false;
    // Tactical Pause: only lessons written for the paused state may appear (no intros).
    if (b.status === 'paused') {
      const next = this.findScripted(b, true);
      if (next) this.active = { ...next, key: activationCounter++ };
      return this.active;
    }
    if (b.status !== 'playing') return null;

    const next = this.findIntro(b) ?? this.findScripted(b, false);
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
    return expects(a.expect, action);
  }

  /** Report a successful player action. Completes an interactive step that expected it. Returns true if it did. */
  onAction(action: TutAction, b: Battle): boolean {
    const a = this.active;
    if (!a || !expects(a.expect, action)) return false;
    if (a.doneWhen && !a.doneWhen(b)) return false;
    this.complete(b, true);
    return true;
  }

  /** Finish the current step (Continue button, or the expected action). */
  complete(b: Battle, bySuccess = false): void {
    if (!this.active) return;
    this.seen.mark(this.active.id);
    if (bySuccess && this.active.expect) {
      this.successCount++;
      this.holdUntil = b.vtime + SUCCESS_HOLD;
    }
    this.active = null;
    b.frozen = false;
  }

  /**
   * "Skip tutorial": closes the current step and marks every scripted lesson as seen (this
   * stage and all later ones). First-time cat / enemy / chest introductions are kept — they
   * are one-tap info cards. "Replay tutorials" on the home screen brings everything back.
   */
  skipAll(b: Battle): void {
    for (const id of ALL_LESSON_IDS) this.seen.mark(id);
    if (this.active) this.seen.mark(this.active.id);
    this.active = null;
    this.holdUntil = -1;
    b.frozen = false;
  }

  /** Is the active step a scripted lesson (skippable) rather than a first-time intro? */
  get isLesson(): boolean {
    return !!this.active && this.active.panel.kind === 'text';
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
  private findScripted(b: Battle, paused: boolean): Omit<ActiveStep, 'key'> | null {
    let step = this.steps.find((s) => !this.seen.has(s.id));
    // Lessons a returning player has effectively covered are marked done silently.
    while (step && (step.skip?.(this.seen) || step.doneIf?.(b))) {
      this.seen.mark(step.id);
      step = this.steps.find((s) => !this.seen.has(s.id));
    }
    if (!step) return null;
    if (paused !== !!step.whilePaused) return null;
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
