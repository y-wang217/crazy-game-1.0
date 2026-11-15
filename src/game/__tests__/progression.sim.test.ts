import { CHAPTERS, stageMap } from '../../config/chapters';
import { isCanMonsterStage } from '../../config/canRewards';
import { runBeginnerBot, runBot, type BotResult } from '../bot';
import type { StageDef } from '../types';
import { STARTERS, band, developed } from './profileTeams';

// Chapter 2 progression audit (opt-in): PROG=1 npx vitest run progression   (STAGES=2-1,2-10 N=40)
// Unlike profiles.sim (everyone on fresh 1★ starters), each profile here owns what a player of that
// kind would realistically have at that point of Chapter 2 — sized against the coin income measured
// by economy.sim (~1,000 coins at the start of Chapter 2, ~3,000 by 2-10, ~4,700 by 2-16, ~6,300 by
// 2-20) and the can schedule (2 cans at 2-5, 1st draw guaranteed new). Recruits are never assumed to
// be a specific cat: R1/R2 rotate over Mr. Whiskers, Captain Mallow and Shadow Pounce by seed.
//
//   Beginner     — beginner bot, the five 1★ starters (no recruits, no upgrades)
//   Unupgraded   — skilled bot, the five 1★ starters (good play, no progression) — the "wall" check
//   Average      — efficient bot (merges well, never repositions), Sir Sable + recruits, modest stars
//   Experienced  — skilled bot (repositions), same roster, about one star step ahead
// On the four Living Can stages the can monster joins (as on a first attempt).
declare const process: { env: Record<string, string | undefined> };
const on = !!process.env.PROG;
export interface Row {
  stage: string;
  profile: string;
  wins: number;
  n: number;
  heartsOnWin: number;
  bossWaveLosses: number;
  earlyLosses: number;
  spent: number;
  skills: number;
  canKilled: number;
  canRuns: number;
}

export function runProfile(st: StageDef, profile: 'beginner' | 'unupgraded' | 'average' | 'experienced', N: number): Row {
  const ch = CHAPTERS.find((c) => c.stages.includes(st))!;
  const map = stageMap(st, ch);
  const can = isCanMonsterStage(st.id);
  const rs: BotResult[] = [];
  for (let i = 1; i <= N; i++) {
    if (profile === 'beginner') rs.push(runBeginnerBot(st, map, i, { roster: STARTERS, canMonster: can }));
    else if (profile === 'unupgraded') rs.push(runBot(st, map, 3000 + i, { smart: true, roster: STARTERS, canMonster: can }));
    else {
      const d = developed(profile, band(st), i);
      rs.push(runBot(st, map, (profile === 'average' ? 5000 : 7000) + i, { smart: profile === 'experienced', roster: d.roster, stars: d.stars, canMonster: can }));
    }
  }
  const wins = rs.filter((r) => r.win);
  const losses = rs.filter((r) => !r.win);
  const total = st.waves.length;
  return {
    stage: st.id,
    profile,
    wins: wins.length,
    n: N,
    heartsOnWin: wins.length ? wins.reduce((a, r) => a + r.baseHp, 0) / wins.length : 0,
    bossWaveLosses: losses.filter((r) => r.waveReached >= total).length,
    earlyLosses: losses.filter((r) => r.waveReached <= Math.ceil(total / 3)).length,
    spent: rs.reduce((a, r) => a + (r.fishEarned - r.fishLeft), 0) / N,
    skills: rs.reduce((a, r) => a + r.skills, 0) / N,
    canKilled: rs.filter((r) => r.canKilled).length,
    canRuns: can ? N : 0,
  };
}

describe.skipIf(!on)('Chapter 2 progression profiles', () => {
  it('win rates per stage and profile', () => {
    const N = Number(process.env.N ?? 30);
    const only = (process.env.STAGES ?? '').split(',').filter(Boolean);
    const profiles = (process.env.PROFILES_LIST ?? 'beginner,unupgraded,average,experienced').split(',') as Parameters<typeof runProfile>[1][];
    const stages = CHAPTERS.flatMap((c) => c.stages).filter((s) => (only.length ? only.includes(s.id) : s.id.startsWith('2-')));
    const rows: Row[] = [];
    for (const st of stages) for (const p of profiles) rows.push(runProfile(st, p, N));
    console.log('PROG_JSON ' + JSON.stringify(rows));
  }, 7200000);
});
