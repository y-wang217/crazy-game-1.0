import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { runBot } from '../bot';

// Headless balance report. Run with `npm run sim`.
// "naive" never moves cats; "smart" keeps its strongest cats on the best tiles.
// Both always take the first chest option and never change targeting, so a human
// who positions, merges and targets deliberately should beat these numbers.
describe('balance simulation', () => {
  const chapter = CHAPTERS[0];
  const map = MAPS[chapter.mapId];
  const SEEDS = 10;
  const rows: string[] = [];

  for (const stage of chapter.stages) {
    it(`stage ${stage.id} is winnable`, () => {
      let naive = 0;
      let smart = 0;
      let time = 0;
      let summons = 0;
      let merges = 0;
      let hp = 0;
      let cats = 0;
      let chestsOpened = 0;
      let chestsTotal = 0;
      for (let s = 1; s <= SEEDS; s++) {
        const a = runBot(stage, map, s * 7919);
        const b = runBot(stage, map, s * 7919, { smart: true });
        if (a.win) naive++;
        if (b.win) smart++;
        time += b.time;
        summons += b.summons;
        merges += b.merges;
        hp += b.baseHp;
        cats += b.cats;
        chestsOpened += b.chestsOpened;
        chestsTotal += b.chestsOpened + b.chestsMissed;
      }
      const avg = (x: number) => (x / SEEDS).toFixed(1);
      rows.push(
        `${stage.id.padEnd(5)} naive ${String(naive).padStart(2)}/${SEEDS}  smart ${String(smart).padStart(2)}/${SEEDS}` +
          `  time ${(time / SEEDS / 60).toFixed(1)}m  summons ${avg(summons)}  merges ${avg(merges)}  cats ${avg(cats)}  hp ${avg(hp)}` +
          (chestsTotal ? `  chests ${chestsOpened}/${chestsTotal}` : ''),
      );
      if (stage.number === 1) expect(naive).toBeGreaterThanOrEqual(SEEDS - 1);
      expect(smart).toBeGreaterThan(0);
    });
  }

  afterAll(() => {
    console.log('\n' + rows.join('\n'));
  });
});
