import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { runBeginnerBot, runBot } from '../bot';
import type { CatId } from '../types';

// Three player profiles, N attempts each per stage (default 40), fresh save: only the five
// original cats at 1★, no skins, no permanent upgrades, normal speed. Random summons per
// seed (unlucky runs included). Opt-in: PROFILES=1 npm run sim:profiles  (STAGES=1-1,2-5 N=80)
//   Beginner     — runBeginnerBot: summons, merges sometimes (random pair), simple placement.
//   Struggling   — runBeginnerBot struggling: slower, misses more merges, no repositioning.
//   Experienced  — runBot smart: merges efficiently, moves strong cats to the best tiles.
declare const process: { env: Record<string, string | undefined> };
const STARTERS: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];
const on = !!process.env.PROFILES;

describe.skipIf(!on)('player profiles', () => {
  it('win rates per stage', () => {
    const N = Number(process.env.N ?? 40);
    const only = (process.env.STAGES ?? '').split(',').filter(Boolean);
    const rows: string[] = [];
    for (const ch of CHAPTERS)
      for (const st of ch.stages) {
        if (only.length && !only.includes(st.id)) continue;
        const map = MAPS[ch.mapId];
        const roster = st.fixedRoster ? undefined : STARTERS;
        let b = 0,
          s = 0,
          e = 0;
        let bh = 0,
          early = 0,
          lost = 0;
        for (let i = 1; i <= N; i++) {
          const r = runBeginnerBot(st, map, i, { roster });
          if (r.win) {
            b++;
            bh += r.baseHp;
          } else {
            lost++;
            if (r.waveReached <= Math.ceil(st.waves.length / 3)) early++;
          }
          if (runBeginnerBot(st, map, 1000 + i, { roster, struggling: true }).win) s++;
          if (runBot(st, map, 2000 + i, { smart: true, roster }).win) e++;
        }
        rows.push(
          `| ${st.id} | ${st.waves.length} | ${st.tiles.length} | ${b}/${N} | ${s}/${N} | ${e}/${N} | ${b ? (bh / b).toFixed(1) : '-'} | ${early}/${lost} |`,
        );
      }
    console.log(
      'PROFILE_TABLE\n| Stage | Waves | Tiles | Beginner | Struggling | Experienced | Beg. hearts left | Beg. early losses |\n|---|---|---|---|---|---|---|---|\n' +
        rows.join('\n'),
    );
  }, 7200000);
});
