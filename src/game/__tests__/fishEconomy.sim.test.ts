import { BALANCE } from '../../config/balance';
import { CHAPTERS } from '../../config/chapters';
import { ENEMIES } from '../../config/enemies';
import { MAPS } from '../../config/maps';
import { Battle, isRegularEnemy } from '../battle';
import { runBeginnerBot, runBot, type BotResult } from '../bot';
import type { CatId, StageDef } from '../types';

// Dried-fish (in-battle currency) audit. Opt-in: FISH=1 npx vitest run fishEconomy
//   MULTS=1,0.85,0.8 N=30 STAGES=1-1,1-2,1-4,1-7,1-10,2-2
// For each regular-mouse multiplier it reports, per stage and profile: win rate, fish earned per
// wave, share of income from regular mice, fish left unspent on a win, summons, merges, skills
// bought and the top cat level reached.
declare const process: { env: Record<string, string | undefined> };
const on = !!process.env.FISH;
const STARTERS: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];

// Income by source (patched in for the audit only).
const tally = { regular: 0, other: 0, sell: 0 };
type Patched = { kill(f: { kind: string; defId?: string }): void; sellCat(uid: number): unknown; fish: number };
const proto = Battle.prototype as unknown as Patched;
const origKill = proto.kill;
const origSell = proto.sellCat;
proto.kill = function (this: Patched, f) {
  const before = this.fish;
  origKill.call(this, f);
  const gain = this.fish - before;
  if (f.kind === 'enemy' && f.defId && isRegularEnemy(ENEMIES[f.defId as keyof typeof ENEMIES])) tally.regular += gain;
  else tally.other += gain;
};
proto.sellCat = function (this: Patched, uid) {
  const before = this.fish;
  const r = origSell.call(this, uid);
  tally.sell += this.fish - before;
  return r;
};

const allStages = CHAPTERS.flatMap((c) => c.stages.map((s) => ({ s, map: MAPS[c.mapId] })));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f1 = (x: number) => x.toFixed(1);

/** Exact dried fish for one Forest Mouse at a wave (before the old round-half-up). */
function rewardAt(stage: StageDef, wave: number): string {
  const growth = stage.waveHpGrowth ?? BALANCE.waveHpGrowth;
  const tough = stage.hpScale * (1 + growth * Math.pow(wave, BALANCE.waveHpCurve));
  return (ENEMIES.normal.reward * Math.pow(tough, BALANCE.rewardScaleExponent) * BALANCE.waves.fishMult * BALANCE.waves.regularFishMult).toFixed(2);
}

describe.skipIf(!on)('dried fish economy', () => {
  it('audit table', () => {
    const N = Number(process.env.N ?? 30);
    const mults = (process.env.MULTS ?? '1,0.85,0.8,0.75').split(',').map(Number);
    const ids = (process.env.STAGES ?? '1-1,1-2,1-4,1-7,1-10,2-2').split(',');
    const W = BALANCE.waves as { regularFishMult: number };
    const out: string[] = [];
    for (const m of mults) {
      W.regularFishMult = m;
      out.push(`\n### regular mouse multiplier ×${m}`);
      out.push('| Stage | Waves | Mouse fish (w1→last) | Profile | Wins | Fish/wave | From regular mice | Wave/other | Left on win | Summons | Merges | Skills | Top Lv |');
      out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
      for (const id of ids) {
        const e = allStages.find((x) => x.s.id === id);
        if (!e) continue;
        const { s, map } = e;
        const roster = s.fixedRoster ? undefined : STARTERS;
        const last = s.waves.length - 1;
        const mouse = `${rewardAt(s, 0)}→${rewardAt(s, last)}`;
        for (const prof of ['Beginner', 'Experienced'] as const) {
          const rs: BotResult[] = [];
          tally.regular = tally.other = tally.sell = 0;
          for (let i = 1; i <= N; i++)
            rs.push(prof === 'Beginner' ? runBeginnerBot(s, map, i, { roster }) : runBot(s, map, 2000 + i, { smart: true, roster }));
          const wins = rs.filter((r) => r.win);
          const earned = avg(rs.map((r) => r.fishEarned / Math.max(1, r.waveReached)));
          const total = rs.reduce((a, r) => a + r.fishEarned, 0);
          const waveOther = total - tally.regular - tally.other - tally.sell;
          out.push(
            `| ${id} | ${s.waves.length} | ${mouse} | ${prof} | ${wins.length}/${N} | ${f1(earned)} | ${Math.round((100 * tally.regular) / Math.max(1, total))}% | ${Math.round((100 * waveOther) / Math.max(1, total))}% | ${f1(avg(wins.map((r) => r.fishLeft)))} | ${f1(avg(rs.map((r) => r.summons)))} | ${f1(avg(rs.map((r) => r.merges)))} | ${f1(avg(rs.map((r) => r.skills)))} | ${f1(avg(rs.map((r) => r.topLevel)))} |`,
          );
        }
      }
    }
    W.regularFishMult = 1;
    console.log('FISH_TABLE' + out.join('\n'));
  }, 3600000);
});
