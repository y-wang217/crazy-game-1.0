import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { runBot } from '../bot';

// Headless balance report. Run with `npm run sim`.
// The bot is naive, so these are lower bounds on what a human achieves.
describe('balance simulation (naive bot)', () => {
  const chapter = CHAPTERS[0];
  const map = MAPS[chapter.mapId];
  const SEEDS = 12;
  const rows: string[] = [];

  for (const stage of chapter.stages) {
    it(`stage ${stage.id} is playable`, () => {
      let wins = 0;
      let smartWins = 0;
      let hp = 0;
      let time = 0;
      for (let s = 1; s <= SEEDS; s++) {
        const r = runBot(stage, map, s * 7919);
        const r2 = runBot(stage, map, s * 7919, { smartPlacement: true });
        if (r.win) wins++;
        if (r2.win) smartWins++;
        hp += r2.baseHp;
        time += r2.time;
      }
      rows.push(
        `${stage.id.padEnd(5)} naive ${String(wins).padStart(2)}/${SEEDS}  placed ${String(smartWins).padStart(2)}/${SEEDS}  avgHP ${(hp / SEEDS).toFixed(1)}  avgTime ${(time / SEEDS).toFixed(0)}s`,
      );
      // Early stages must be beatable even by the naive bot.
      if (stage.number <= 3) expect(wins).toBeGreaterThan(SEEDS * 0.8);
      // Every stage must be beatable by a bot that places cats sensibly at least sometimes.
      expect(smartWins).toBeGreaterThan(0);
    });
  }

  afterAll(() => {
    console.log('\n' + rows.join('\n'));
  });
});
