import { CAT_ORDER, STARTER_CATS } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { CHESTS } from '../../config/enemies';
import { RECRUIT, STARS } from '../../config/collection';
import { MAPS } from '../../config/maps';
import { runBeginnerBot } from '../bot';
import { recruit, type CollectionState } from '../collection';
import { Rng } from '../rng';
import type { CatId } from '../types';

// Fish-coin economy audit (opt-in: ECONOMY=1 npm run sim:economy). Uses the real config and the
// real recruit() logic; income comes from the Beginner profile actually playing each stage.
declare const process: { env: Record<string, string | undefined> };
const STARTERS: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];

describe.skipIf(!process.env.ECONOMY)('economy', () => {
  it('income per stage (Beginner profile, 30 attempts)', () => {
    const rows: string[] = [];
    let cumFirst = 0;
    for (const ch of CHAPTERS)
      for (const st of ch.stages) {
        let wins = 0,
          chest = 0;
        const N = 30;
        for (let s = 1; s <= N; s++) {
          const r = runBeginnerBot(st, MAPS[ch.mapId], 7000 + s, { roster: st.fixedRoster ? undefined : STARTERS });
          if (r.win) wins++;
          chest += r.chestCoins;
        }
        const p = wins / N;
        const chestAvg = chest / N;
        // Expected coins to FIRST-clear (failed attempts still keep their chest coins).
        const attempts = 1 / Math.max(0.05, p);
        const firstPath = st.rewards.firstClear + chestAvg * attempts;
        cumFirst += firstPath;
        const perReplay = p * st.rewards.replay + chestAvg; // per replay attempt
        rows.push(
          `| ${st.id} | ${st.rewards.firstClear} | ${st.rewards.replay} | ${chestAvg.toFixed(0)} | ${Math.round(p * 100)}% | ${Math.round(firstPath)} | ${Math.round(cumFirst)} | ${Math.round(perReplay)} |`,
        );
      }
    console.log(
      'INCOME\n| Stage | First clear | Replay | Avg chest coins / attempt | Win rate | Coins to first-clear (incl. failed tries) | Cumulative | Coins per replay attempt |\n|---|---|---|---|---|---|---|---|\n' +
        rows.join('\n'),
    );
    console.log('CHESTS', JSON.stringify(Object.fromEntries(Object.entries(CHESTS).map(([k, v]) => [k, v.coins]))));
  }, 3600000);

  it('recruitment & star progress (Monte Carlo, real recruit())', () => {
    const owned0 = Object.fromEntries([...STARTER_CATS, 'sable'].map((c) => [c, { stars: 1, fragments: 0 }])) as CollectionState['collection'];
    const base = (): CollectionState =>
      ({
        fishCoins: 1e9,
        collection: structuredClone(owned0),
        team: STARTERS,
        recruitStreak: 0,
        recruitDraws: 0,
        chapterRewards: [],
        cleared: {},
      }) as unknown as CollectionState;
    const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
    const T = 2000;
    // Draws until every cat is owned / until a SPECIFIC owned cat reaches N fragments / until ANY cat does.
    const firstNew: number[] = [],
      allCats: number[] = [];
    const need = [10, 30, 60, 100];
    const specific: number[][] = need.map(() => []),
      anyCat: number[][] = need.map(() => []);
    for (let t = 0; t < T; t++) {
      const rng = new Rng(9000 + t);
      let s = base();
      let d = 0,
        gotNew = -1,
        all = -1;
      const doneS = need.map(() => -1),
        doneA = need.map(() => -1);
      let spent = 0;
      while ((all < 0 || doneS.includes(-1) || doneA.includes(-1)) && d < 2000) {
        const r = recruit(s, () => rng.next());
        if (!r.ok) break;
        s = r.state;
        d++;
        if (r.isNew && gotNew < 0) gotNew = d;
        if (all < 0 && CAT_ORDER.every((c) => s.collection[c])) all = d;
        const fk = s.collection.kitten?.fragments ?? 0; // a specific starter, never spent here
        const fmax = Math.max(...CAT_ORDER.map((c) => s.collection[c]?.fragments ?? 0));
        need.forEach((n, i) => {
          if (doneS[i] < 0 && fk >= n) doneS[i] = d;
          if (doneA[i] < 0 && fmax >= n) doneA[i] = d;
        });
        void spent;
      }
      firstNew.push(gotNew);
      allCats.push(all);
      need.forEach((_, i) => {
        specific[i].push(doneS[i]);
        anyCat[i].push(doneA[i]);
      });
    }
    const lines = [
      `RECRUIT cost ${RECRUIT.costCans} can, duplicate fragments ${RECRUIT.duplicateFragments}, pity after ${RECRUIT.guaranteeNewWithin}, maxed-fragment coins ${RECRUIT.maxedFragmentCoins}`,
      `STARS costs ${JSON.stringify(STARS.costs)}`,
      `draws to first new cat (owning 6/10): median ${pct(firstNew, 0.5)}, p90 ${pct(firstNew, 0.9)}`,
      `draws to own all 10 cats: median ${pct(allCats, 0.5)}, p90 ${pct(allCats, 0.9)}`,
      ...need.map(
        (n, i) =>
          `fragments ${n} (★${i + 2}): SPECIFIC cat draws median ${pct(specific[i], 0.5)} p90 ${pct(specific[i], 0.9)} | ANY cat draws median ${pct(anyCat[i], 0.5)} p90 ${pct(anyCat[i], 0.9)}`,
      ),
    ];
    console.log('RECRUITMC\n' + lines.join('\n'));
  }, 3600000);
});
