// Battle recovery: the in-progress battle is checkpointed to localStorage so it survives
// an accidental Back gesture, refresh, app switch or closed tab.
//
// Storage keys (separate from the progression save so a bad battle record can never hurt it):
//   catdefense.battle.v1    — the current RecoveryRecord (at most one battle).
//   catdefense.battle.done  — ids of the last finished runs. A run that is listed here never
//                             grants its victory again, even if an old copy is resumed in
//                             another tab — this is what prevents duplicate rewards.
//
// Record versioning: RECOVERY_VERSION covers this wrapper, Battle's SNAPSHOT_VERSION the
// battle state inside it. Either mismatch → the record is discarded (never misread).

import { findStage } from '../config/chapters';
import { MAPS } from '../config/maps';
import { validateSnapshot, type BattleSnapshot } from '../game/battle';

const KEY = 'catdefense.battle.v1';
const DONE_KEY = 'catdefense.battle.done';
export const RECOVERY_VERSION = 1;
const DONE_KEEP = 40;

export interface RecoveryRecord {
  version: typeof RECOVERY_VERSION;
  /** Unique per battle attempt (a restart is a new run). */
  runId: string;
  /** The browser tab currently playing this run (another tab resuming it takes over). */
  owner: string;
  stageId: string;
  savedAt: number;
  /** Game speed setting at the time of saving. */
  speed: number;
  /** Summary for the "Resume previous battle?" prompt. */
  wave: number;
  totalWaves: number;
  baseHp: number;
  maxHp: number;
  preparing: boolean;
  snapshot: BattleSnapshot;
}

const storage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function newRunId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const recovery = {
  /** Write the checkpoint. Returns false if storage is unavailable or full. */
  save(rec: RecoveryRecord): boolean {
    const s = storage();
    if (!s) return false;
    try {
      s.setItem(KEY, JSON.stringify(rec));
      return true;
    } catch {
      return false;
    }
  },

  /** The stored battle, if it is well-formed and still fits the current game data. */
  load(): RecoveryRecord | null {
    const s = storage();
    if (!s) return null;
    let rec: RecoveryRecord;
    try {
      const raw = s.getItem(KEY);
      if (!raw) return null;
      rec = JSON.parse(raw) as RecoveryRecord;
    } catch {
      this.clear();
      return null;
    }
    const found = rec && rec.version === RECOVERY_VERSION && typeof rec.runId === 'string' ? findStage(rec.stageId) : undefined;
    const ok = !!found && !this.isFinished(rec.runId) && validateSnapshot(rec.snapshot, found.stage, MAPS[found.chapter.mapId]);
    if (!ok) {
      this.clear(); // corrupted, outdated or already finished: never offer it
      return null;
    }
    return rec;
  },

  /** Raw peek at who owns the stored run (no validation; cheap, used every checkpoint). */
  storedOwner(): { runId: string; owner: string } | null {
    try {
      const raw = storage()?.getItem(KEY);
      if (!raw) return null;
      const r = JSON.parse(raw) as Partial<RecoveryRecord>;
      return typeof r.runId === 'string' && typeof r.owner === 'string' ? { runId: r.runId, owner: r.owner } : null;
    } catch {
      return null;
    }
  },

  /** Remove the checkpoint (battle finished, or deliberately abandoned). Only if it is this run, when given. */
  clear(runId?: string): void {
    const s = storage();
    if (!s) return;
    try {
      if (runId) {
        const cur = this.storedOwner();
        if (cur && cur.runId !== runId) return; // a newer battle's checkpoint: leave it alone
      }
      s.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },

  /** Record that a run has ended (victory or defeat). Its rewards can't be granted again. */
  markFinished(runId: string): void {
    const s = storage();
    if (!s) return;
    try {
      const done = this.finished().filter((id) => id !== runId);
      done.push(runId);
      s.setItem(DONE_KEY, JSON.stringify(done.slice(-DONE_KEEP)));
    } catch {
      /* ignore */
    }
  },

  isFinished(runId: string): boolean {
    return this.finished().includes(runId);
  },

  finished(): string[] {
    try {
      const v = JSON.parse(storage()?.getItem(DONE_KEY) ?? '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  },
};
