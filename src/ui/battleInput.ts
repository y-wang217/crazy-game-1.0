import type { DragView } from '../render/renderer';
import type { TutAction } from '../tutorial/director';

// Board press / drag state for the battle screen, kept separate from React so it can be tested.
//
// V1.6.2 fix: a press used to be cleared only by the canvas receiving THAT finger's pointerup /
// pointercancel, and every new touch was ignored while a press was recorded. When a popup or a
// system interruption (tutorial, enemy intro, reward choice, an iOS banner, app switch…) swallowed
// the release, the press was never cleared: the cat stayed drawn "in the air" and no cat could be
// touched again. Now every way a gesture can end safely cancels it, and a stale press can never
// block a new one. Cancelling never moves, swaps, merges or sells anything.

export interface Press {
  uid: number;
  pointerId: number;
  sx: number;
  sy: number;
  dragging: boolean;
  long: boolean;
  timer: number | null;
}

/** What a finished press asks the battle to do. */
export type PressEnd = { kind: 'none' } | { kind: 'tap'; uid: number } | { kind: 'drop'; uid: number; target: string | null };

export interface DragHooks {
  /** Stop a pending long-press timer. */
  clearTimer?: (id: number) => void;
  /** Release pointer capture for this pointer (ignore failures). */
  release?: (pointerId: number) => void;
}

export class DragController {
  press: Press | null = null;
  /** The cat being dragged, as drawn by the renderer (null when nothing is held). */
  drag: DragView | null = null;

  constructor(private hooks: DragHooks = {}) {}

  get busy(): boolean {
    return this.press !== null;
  }

  /** Start pressing a cat. A leftover press (its release was lost) is cancelled first, never acted on. */
  begin(uid: number, pointerId: number, x: number, y: number): Press {
    if (this.press) this.cancel();
    this.press = { uid, pointerId, sx: x, sy: y, dragging: false, long: false, timer: null };
    return this.press;
  }

  /** Pointer moved. Starts the drag past `threshold` px; `view` builds the drawn drag (world coords + tile). */
  move(pointerId: number, x: number, y: number, threshold: number, view: () => DragView): void {
    const p = this.press;
    if (!p || p.pointerId !== pointerId || p.long) return;
    if (!p.dragging && Math.hypot(x - p.sx, y - p.sy) > threshold) {
      p.dragging = true;
      this.clearTimer();
    }
    if (p.dragging) this.drag = view();
  }

  /** The press ended normally (`cancelled` = pointercancel). Returns what the battle should do. */
  end(pointerId: number, cancelled: boolean): PressEnd {
    const p = this.press;
    if (!p || p.pointerId !== pointerId) return { kind: 'none' };
    const target = this.drag?.overTileId ?? null;
    const wasDragging = p.dragging && this.drag !== null;
    this.cancel();
    if (cancelled || p.long) return { kind: 'none' };
    return wasDragging ? { kind: 'drop', uid: p.uid, target } : p.dragging ? { kind: 'none' } : { kind: 'tap', uid: p.uid };
  }

  /** Drop everything without acting: held cat, drag preview, long-press timer, pointer capture. */
  cancel(): void {
    const p = this.press;
    this.clearTimer();
    this.press = null;
    this.drag = null;
    if (p) {
      try {
        this.hooks.release?.(p.pointerId);
      } catch {
        /* capture already gone */
      }
    }
  }

  private clearTimer(): void {
    const p = this.press;
    if (p?.timer != null) this.hooks.clearTimer?.(p.timer);
    if (p) p.timer = null;
  }
}

/** Tutorial actions done ON the board: a step expecting one of these keeps board input alive. */
const BOARD_ACTIONS: TutAction[] = ['tap', 'moved', 'swapped', 'merged'];

/**
 * Is a popup or interruption covering the board right now? Then any press in progress is cancelled.
 * Passive tutorial panels (intros of cats / enemies / chests, tips) and button lessons block the
 * board; lessons that ask for a drag or tap on the board do not.
 */
export function boardBlocked(s: {
  step: { expect?: TutAction | TutAction[] } | null;
  status: string;
  inspecting: boolean;
  menuOpen: boolean;
  result: boolean;
  hidden: boolean;
}): boolean {
  if (s.hidden || s.inspecting || s.menuOpen || s.result) return true;
  if (s.status !== 'playing' && s.status !== 'paused') return true; // reward choice, victory, defeat
  if (s.step) {
    const e = s.step.expect;
    const list = e === undefined ? [] : Array.isArray(e) ? e : [e];
    if (!list.some((a) => BOARD_ACTIONS.includes(a))) return true;
  }
  return false;
}
