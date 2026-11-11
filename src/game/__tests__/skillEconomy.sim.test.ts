import { BALANCE, skillRollCost } from '../../config/balance';
import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { SKILLS } from '../../config/skills';
import { Battle, canMerge } from '../battle';
import type { CatId, MapDef, SkillId, StageDef } from '../types';

// Random Skill economy: four spending strategies on the same stages and seeds.
// Opt-in: SKILLSIM=1 npx vitest run src/game/__tests__/skillEconomy.sim.test.ts  (N=30 STAGES=1-10,2-20 HP=1,1.4)
//   summon   — summons & merges first; buys a skill only when the board is full and nothing can merge.
//   skill    — keeps half the board filled, then pours every fish into Random Skills.
//   balanced — the standard experienced bot (summons when a tile is free, skills with spare fish).
//   late     — plays "balanced" for the first half of the waves, then puts spare fish into skills
//              before summons (the late-wave skill-spam pattern seen in playtesting).
//   lucky    — like "skill", but every bought skill is the best one for its board.
// Every bot takes the best chest skill, as a thoughtful player would.
// All bots merge the lowest pair when the board fills and move their strongest cats onto the
// tiles that cover the most road, so only the spending decision differs.
declare const process: { env: Record<string, string | undefined> };
const STARTERS: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];
const on = !!process.env.SKILLSIM;

type Strategy = 'summon' | 'skill' | 'balanced' | 'late' | 'lucky';
const STRATEGIES: Strategy[] = ['summon', 'balanced', 'late', 'skill', 'lucky'];

interface Run {
  win: boolean;
  hearts: number;
  skills: number;
  skillFish: number;
  summonFish: number;
  lastCost: number;
  /** Highest damage multiplier any cat type got from skills (general × own). */
  topDmg: number;
}

/** Value of one more level of a skill for this board (higher = better). */
function luckyScore(b: Battle, id: SkillId): number {
  const def = SKILLS[id];
  const p = def.per;
  const counts = new Map<CatId, number>();
  for (const c of b.cats) counts.set(c.type, (counts.get(c.type) ?? 0) + 2 ** (c.level - 1));
  const weight = def.cat ? (counts.get(def.cat) ?? 0) : b.cats.reduce((a, c) => a + 2 ** (c.level - 1), 0);
  const v = (p.dmg ?? 0) + (p.speed ?? 0) + (p.poison ?? 0) * 0.8 + (p.combo ?? 0) * 0.3 + (p.bounce ?? 0) * 0.3 + (p.armor ?? 0) * 0.05;
  return weight * (v || 0.03);
}

function bestSkill(b: Battle, ids: SkillId[]): number {
  let best = 0;
  ids.forEach((id, i) => {
    if (luckyScore(b, id) > luckyScore(b, ids[best])) best = i;
  });
  return best;
}

function mergeLowest(b: Battle): boolean {
  const cats = [...b.cats].sort((x, y) => x.level - y.level);
  for (let i = 0; i < cats.length; i++)
    for (let j = i + 1; j < cats.length; j++)
      if (canMerge(cats[i], cats[j])) {
        b.dropCat(cats[i].uid, cats[j].tileId);
        return true;
      }
  return false;
}

function coverage(b: Battle): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of b.tiles) {
    let n = 0;
    for (let d = 0; d < b.path.length; d += 5) {
      const p = b.path.pointAt(d);
      if (Math.hypot(p.x - t.x, p.y - t.y) < 80) n += 5;
    }
    m.set(t.id, n);
  }
  return m;
}

function relocate(b: Battle, cov: Map<string, number>): void {
  const tiles = b.tiles.filter((t) => t.unlocked).sort((x, y) => (cov.get(y.id) ?? 0) - (cov.get(x.id) ?? 0));
  const cats = [...b.cats].sort((x, y) => y.level - x.level || (x.type === 'white' ? 1 : -1));
  for (let i = 0; i < Math.min(cats.length, tiles.length); i++) {
    const c = cats[i];
    const want = tiles[i];
    if (c.tileId === want.id) continue;
    const occ = b.catAt(want.id);
    if (occ && occ.level >= c.level) continue;
    b.dropCat(c.uid, want.id);
    return;
  }
}

function canMergeAny(b: Battle): boolean {
  return b.cats.some((x) => b.cats.some((y) => canMerge(x, y)));
}

export function runStrategy(stage: StageDef, map: MapDef, seed: number, strat: Strategy, roster?: CatId[], hpMult = 1): Run {
  const b = new Battle(stage, map, { seed, roster, tuning: { enemyHpMult: hpMult } as never });
  const cov = coverage(b);
  let skillFish = 0;
  let summonFish = 0;
  const summon = () => {
    const c = b.summonCost;
    if (b.summon().ok) summonFish += c;
  };
  const buy = () => {
    const c = b.skillCost;
    if (strat === 'lucky') {
      const pool = b.availableSkills();
      if (!pool.length || b.fish < c || !b.skillShopUnlocked) return;
      const bb = b as unknown as { spend(n: number): void; grantSkill(id: SkillId, lv: number, src: string): void; skillRolls: number };
      bb.spend(c);
      bb.skillRolls++;
      bb.grantSkill(pool[bestSkill(b, pool)], 1, 'shop');
      skillFish += c;
      return;
    }
    if (b.buySkill().ok) skillFish += c;
  };
  const tiles = b.tiles.filter((t) => t.unlocked).length;
  const keep = Math.max(3, Math.ceil(tiles / 2));
  while (b.emptyTiles().length && b.fish >= b.summonCost && (strat === 'summon' || strat === 'balanced' || strat === 'late' || b.cats.length < keep)) summon();
  b.startBattle();
  let guard = 0;
  while ((b.status === 'playing' || b.status === 'reward') && guard++ < 40000) {
    if (b.status === 'reward') {
      const ch = b.currentReward?.choices ?? [];
      b.chooseReward(ch.length ? bestSkill(b, ch.map((x) => x.skillId)) : 0);
      continue;
    }
    const late = strat === 'late' && b.waveIndex >= Math.floor(b.totalWaves / 2);
    if (b.emptyTiles().length <= (strat === 'balanced' || strat === 'late' ? 2 : 0)) mergeLowest(b);
    const shop = b.skillShopUnlocked && b.availableSkills().length > 0;
    if (strat === 'summon') {
      if (b.emptyTiles().length && b.fish >= b.summonCost) summon();
      else if (shop && !b.emptyTiles().length && !canMergeAny(b) && b.fish >= b.skillCost) buy();
    } else if (late) {
      if (shop && b.fish >= b.skillCost) buy();
      else if (b.emptyTiles().length && b.fish >= b.summonCost) summon();
    } else if (strat === 'balanced' || strat === 'late') {
      if (b.emptyTiles().length && b.fish >= b.summonCost) summon();
      else if (shop && b.fish >= b.skillCost && (!b.emptyTiles().length || b.fish >= b.skillCost + b.summonCost)) buy();
    } else {
      // Skill-first: a minimal board, everything else into skills (summons only with leftovers it can't use).
      if (b.cats.length < keep && b.emptyTiles().length && b.fish >= b.summonCost) summon();
      else if (shop && b.fish >= b.skillCost) buy();
      else if (!shop && b.emptyTiles().length && b.fish >= b.summonCost) summon();
      else if (b.cats.length >= keep && b.emptyTiles().length && b.fish >= b.summonCost && b.fish < b.summonCost * 2 && b.skillCost > 3 * b.fish) summon();
    }
    relocate(b, cov);
    b.update(0.25);
  }
  const mods = b.mods;
  const topDmg = Math.max(...(roster ?? stage.roster).map((id) => mods.all.dmg * mods.cat[id].dmg));
  return {
    win: b.status === 'victory',
    hearts: b.baseHp,
    skills: Object.values(b.skills).reduce((a, v) => a + (v ?? 0), 0),
    skillFish,
    summonFish,
    lastCost: b.skillCost,
    topDmg,
  };
}

describe.skipIf(!on)('random skill economy', () => {
  it('strategy comparison', () => {
    // OLD=1 reproduces the V1.5 price (flat 60 after the 8th purchase) for before/after tables.
    if (process.env.OLD) (BALANCE.skillRoll as { growthAfterSoftCap: number }).growthAfterSoftCap = 1;
    const N = Number(process.env.N ?? 20);
    const hps = (process.env.HP ?? '1,1.4').split(',').map(Number);
    const only = (process.env.STAGES ?? '1-5,1-7,1-9,1-10,2-5,2-10,2-15,2-18,2-20').split(',').filter(Boolean);
    console.log('COSTS', Array.from({ length: 20 }, (_, i) => skillRollCost(i)).join(','));
    const rows: string[] = [];
    for (const ch of CHAPTERS)
      for (const st of ch.stages) {
        if (!only.includes(st.id)) continue;
        const map = MAPS[ch.mapId];
        const roster = st.fixedRoster ? undefined : STARTERS;
        for (const hp of hps) {
          const cells: string[] = [];
          for (const s of STRATEGIES) {
            let w = 0,
              h = 0,
              sk = 0,
              sf = 0,
              mf = 0,
              lc = 0,
              td = 0;
            for (let i = 1; i <= N; i++) {
              const r = runStrategy(st, map, 5000 + i, s, roster, hp);
              w += r.win ? 1 : 0;
              h += r.hearts;
              sk += r.skills;
              sf += r.skillFish;
              mf += r.summonFish;
              lc += r.lastCost;
              td += r.topDmg;
            }
            cells.push(`${Math.round((100 * w) / N)}% ♥${(h / N).toFixed(1)} sk${(sk / N).toFixed(1)} ${Math.round(sf / N)}/${Math.round(mf / N)}🐟 c${Math.round(lc / N)} ×${(td / N).toFixed(2)}`);
          }
          rows.push(`| ${st.id} | ×${hp} | ${cells.join(' | ')} |`);
        }
      }
    console.log(
      'SKILL_TABLE (win% · hearts · skill levels bought+chest · fish on skills/summons · next skill cost · top skill dmg mult)\n| Stage | Enemy HP | Summon-focus | Balanced | Late skill spam | Skill-focus | Lucky skills |\n|---|---|---|---|---|---|---|\n' +
        rows.join('\n'),
    );
  }, 7200000);
});
