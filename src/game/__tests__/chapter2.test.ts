import { BALANCE } from '../../config/balance';
import { ALL_STAGE_IDS, CHAPTERS, findStage } from '../../config/chapters';
import { ENEMIES } from '../../config/enemies';
import { MAPS } from '../../config/maps';
import { en } from '../../i18n/en';
import { zh } from '../../i18n/zh';
import { parseSave, saveStore } from '../../save/store';
import { Battle } from '../battle';
import { nextStageId } from '../progression';
import type { StageDef } from '../types';

const ch1 = CHAPTERS[0];
const ch2 = CHAPTERS[1];
const mapOf = (s: StageDef) => MAPS[findStage(s.id)!.chapter.mapId];

/** Total enemy HP a stage throws at the player (HP × toughness for every spawned mouse). */
function hpBudget(stage: StageDef): number {
  const b = new Battle(stage, mapOf(stage), 1);
  let total = 0;
  stage.waves.forEach((w, i) => {
    b.waveIndex = i;
    const tough = b.toughness();
    for (const g of w.groups) if ('enemy' in g) total += g.count * (ENEMIES[g.enemy].hp + ENEMIES[g.enemy].shield) * tough;
  });
  return total;
}

describe('20 stages in two chapters', () => {
  it('has Chapter 1 (1-1…1-10) and Chapter 2 (2-1…2-10) in order', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['ch1', 'ch2']);
    expect(ALL_STAGE_IDS).toEqual([...Array.from({ length: 10 }, (_, i) => `1-${i + 1}`), ...Array.from({ length: 10 }, (_, i) => `2-${i + 1}`)]);
    CHAPTERS.flatMap((c) => c.stages).forEach((s, i) => expect(s.order).toBe(i + 1));
  });

  it('every stage is complete and valid for its map', () => {
    for (const ch of CHAPTERS) {
      const map = MAPS[ch.mapId];
      const ids = new Set(map.tiles.map((t) => t.id));
      for (const s of ch.stages) {
        expect(s.waves.length, s.id).toBeGreaterThanOrEqual(4);
        expect(
          s.waves.every((w) => w.groups.length > 0),
          s.id,
        ).toBe(true);
        for (const t of s.tiles) expect(ids.has(t), `${s.id} tile ${t}`).toBe(true);
        expect(new Set(s.tiles).size).toBe(s.tiles.length);
        expect(en[`stage.${s.id}`], s.id).toBeTruthy();
        expect(zh[`stage.${s.id}`], s.id).toBeTruthy();
        const b = new Battle(s, map, 1);
        expect(b.preparing).toBe(true); // V1.3 prep phase applies everywhere
        expect(b.summonCost).toBe(1);
      }
    }
    expect(zh['chapter.ch2']).toBe('月夜蘑菇森林');
    expect(zh['chapter.ch1']).toBe('新手森林');
  });

  it('Chapter 2 keeps the five cats and all three chest tiers, no new cat types', () => {
    for (const s of ch2.stages) expect([...s.roster].sort()).toEqual(['black', 'kitten', 'orange', 'tabby', 'white']);
    const tiers = new Set(ch2.stages.flatMap((s) => s.waves.flatMap((w) => w.groups.flatMap((g) => ('chest' in g ? [g.chest] : [])))));
    expect([...tiers].sort()).toEqual(['bronze', 'gold', 'silver']);
  });

  it('skills unlock by global order (Chapter 2 has the skill button from 2-1)', () => {
    const b = new Battle(ch2.stages[0], mapOf(ch2.stages[0]), 1);
    expect(b.skillShopUnlocked).toBe(true);
    expect(new Battle(ch1.stages[3], mapOf(ch1.stages[3]), 1).skillShopUnlocked).toBe(false);
    expect(BALANCE.unlocks.skillShopFromStage).toBe(5);
  });
});

describe('Chapter 2 map', () => {
  const m1 = MAPS[ch1.mapId];
  const m2 = MAPS[ch2.mapId];

  it('uses its own map, environment, route and tiles, with the same portrait grid', () => {
    expect(ch2.mapId).toBe('mushroom');
    expect(m2.environment).toBe('mushroom');
    // Same cell size and number of rows (on portrait phones the board is height-limited,
    // so tiles stay the same size); one extra column for placement space.
    expect([m2.rows, m2.cell]).toEqual([m1.rows, m1.cell]);
    expect(m2.cols).toBe(m1.cols + 1);
    expect(JSON.stringify(m2.path)).not.toBe(JSON.stringify(m1.path));
    expect(m2.base).not.toEqual(m1.base);
    const shared = m2.tiles.filter((t) => m1.tiles.some((u) => u.id === t.id)).length;
    expect(shared / m2.tiles.length).toBeLessThan(0.7);
  });

  it('the road enters from the top and spirals to a cat house in the middle', () => {
    const [x0, y0] = m2.path[0];
    expect(y0).toBeLessThan(0);
    expect(x0).toBeGreaterThanOrEqual(0);
    const [bc, br] = m2.base;
    expect(bc).toBe(Math.floor(m2.cols / 2));
    expect(br).toBeGreaterThan(1);
    expect(br).toBeLessThan(m2.rows - 2);
    const b = new Battle(ch2.stages[0], m2, 1);
    expect(b.path.length).toBeGreaterThan(new Battle(ch1.stages[9], m1, 1).path.length);
  });

  it('no tile sits on the road, and inner tiles cover more road than edge tiles', () => {
    const b = new Battle(ch2.stages[9], m2, 1);
    for (const t of b.tiles) expect(b.path.distanceTo(t.x, t.y), t.id).toBeGreaterThanOrEqual(m2.cell * 0.9);
    const cover = (id: string) => {
      const t = b.tiles.find((x) => x.id === id)!;
      let n = 0;
      for (let d = 0; d < b.path.length; d += 5) {
        const p = b.path.pointAt(d);
        if (Math.hypot(p.x - t.x, p.y - t.y) < 90) n++;
      }
      return n;
    };
    expect(cover('1-3')).toBeGreaterThan(cover('2-0'));
    expect(cover('4-3')).toBeGreaterThan(cover('2-7'));
  });

  it('every stage in Chapter 2 shares the map; available tiles only grow', () => {
    const counts = ch2.stages.map((s) => s.tiles.length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
  });
});

describe('Chapter 2 difficulty', () => {
  it('enemy HP budget rises through the chapter without sudden spikes', () => {
    const budgets = ch2.stages.map(hpBudget);
    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i] / budgets[i - 1], ch2.stages[i].id).toBeGreaterThan(0.95);
      expect(budgets[i] / budgets[i - 1], ch2.stages[i].id).toBeLessThan(1.6);
    }
    expect(budgets[9]).toBeGreaterThan(budgets[0] * 2);
    // Chapter 2 asks for more than the end of Chapter 1.
    expect(budgets[9]).toBeGreaterThan(hpBudget(ch1.stages[9]));
  });

  it('waves get bigger, mixed and faster to spawn, with tougher armor later', () => {
    const size = (s: StageDef) => s.waves.reduce((a, w) => a + w.groups.reduce((x, g) => x + ('enemy' in g ? g.count : 0), 0), 0) / s.waves.length;
    expect(size(ch2.stages[9])).toBeGreaterThan(size(ch2.stages[0]));
    expect(size(ch2.stages[0])).toBeGreaterThan(size(ch1.stages[0]));
    const types = (s: StageDef) => new Set(s.waves.flatMap((w) => w.groups.flatMap((g) => ('enemy' in g ? [g.enemy] : []))));
    expect(types(ch2.stages[7]).size).toBeGreaterThanOrEqual(4);
    expect(ch2.stages[9].armorBonus ?? 0).toBeGreaterThan(ch2.stages[0].armorBonus ?? 0);
    const b = new Battle(ch2.stages[9], mapOf(ch2.stages[9]), 1);
    b.startBattle();
    expect(b.spawn({ enemy: 'armored', count: 1, interval: 1 }).armor).toBe(ENEMIES.armored.armor + (ch2.stages[9].armorBonus ?? 0));
    expect(b.spawn({ enemy: 'normal', count: 1, interval: 1 }).armor).toBe(0); // bonus only toughens armored mice
  });
});

describe('Stage 2-10 boss', () => {
  const s = ch2.stages[9];
  it('is a boss stage whose final wave brings the Mushroom King', () => {
    expect(s.isBoss).toBe(true);
    const last = s.waves[s.waves.length - 1];
    expect(last.groups.some((g) => 'enemy' in g && g.enemy === 'mushroomKing')).toBe(true);
    expect(ENEMIES.mushroomKing.isBoss).toBe(true);
    expect(ENEMIES.mushroomKing.shield).toBeGreaterThan(0);
    expect(en['enemy.mushroomKing.name']).toBe('Mushroom King');
    expect(zh['enemy.mushroomKing.name']).toBe('蘑菇鼠王');
  });

  it('the boss fight works: spawns with shield + armor, announces itself, and must be beaten to win', () => {
    const b = new Battle(s, mapOf(s), 1);
    b.startBattle();
    b.waveIndex = s.waves.length - 1;
    const king = b.spawn({ enemy: 'mushroomKing', count: 1, interval: 1 });
    expect(king.isBoss).toBe(true);
    expect(king.shield).toBeGreaterThan(0);
    expect(king.armor).toBe(ENEMIES.mushroomKing.armor + (s.armorBonus ?? 0));
    expect(b.events.some((e) => e.type === 'bossAppeared' && e.enemy === 'mushroomKing')).toBe(true);
    // Escaping costs a lot of hearts.
    expect(ENEMIES.mushroomKing.baseDamage).toBeGreaterThanOrEqual(8);
  });

  it('a real (bot) playthrough of 2-10 defeats the boss and wins', async () => {
    const { runBot } = await import('../bot');
    let wins = 0;
    for (let k = 1; k <= 3; k++) if (runBot(s, mapOf(s), k * 7919, { smart: true }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(2);
  }, 120000);
});

describe('progression & saves', () => {
  it('1-10 leads to 2-1; 2-10 is the last stage', () => {
    expect(nextStageId('1-10')).toBe('2-1');
    expect(nextStageId('2-9')).toBe('2-10');
    expect(nextStageId('2-10')).toBeNull();
  });

  it('clearing 1-10 unlocks Chapter 2 and keeps replays available', () => {
    saveStore.reset();
    const all1 = ch1.stages.map((s) => s.id);
    for (const id of all1) saveStore.completeStage(id, 10, 10);
    const st = saveStore.get();
    expect(st.unlocked).toContain('2-1');
    expect(st.unlocked).not.toContain('2-2');
    for (const id of all1) expect(st.cleared[id]).toBe(3);
    // Replaying an old stage keeps stars and unlocks.
    const before = st.fishCoins;
    const r = saveStore.completeStage('1-3', 3, 10);
    expect(r.firstClear).toBe(false);
    expect(saveStore.get().cleared['1-3']).toBe(3);
    expect(saveStore.get().fishCoins).toBe(before + r.coins);
    saveStore.completeStage('2-1', 10, 10);
    expect(saveStore.get().unlocked).toContain('2-2');
    saveStore.reset();
  });

  it('existing Chapter 1 saves load intact, and finished players get 2-1 unlocked', () => {
    const legacy = JSON.stringify({
      version: 2,
      fishCoins: 777,
      unlocked: ch1.stages.map((s) => s.id),
      cleared: Object.fromEntries(ch1.stages.map((s, i) => [s.id, (i % 3) + 1])),
      owned: [],
      equipped: { hat: null, skins: {} },
      seen: ['tut:welcome', 'enemy:boss'],
    });
    const save = parseSave(legacy);
    expect(save.fishCoins).toBe(777);
    expect(save.seen).toEqual(['tut:welcome', 'enemy:boss']);
    for (const [i, s] of ch1.stages.entries()) {
      expect(save.unlocked).toContain(s.id);
      expect(save.cleared[s.id]).toBe((i % 3) + 1);
    }
    expect(save.unlocked).toContain('2-1');
    // A player mid-way through Chapter 1 is not given Chapter 2.
    const mid = parseSave(JSON.stringify({ version: 2, fishCoins: 5, unlocked: ['1-1', '1-2', '1-3'], cleared: { '1-1': 2, '1-2': 1 } }));
    expect(mid.unlocked).toEqual(['1-1', '1-2', '1-3']);
  });

  it('temporary skills never carry over between stages', () => {
    const a = new Battle(ch1.stages[9], mapOf(ch1.stages[9]), 1);
    a.fish = 999;
    a.startBattle();
    a.buySkill();
    expect(Object.keys(a.skills).length).toBeGreaterThan(0);
    const b = new Battle(ch2.stages[0], mapOf(ch2.stages[0]), 1);
    expect(Object.keys(b.skills).length).toBe(0);
  });
});

describe('shorter stages (~30% fewer waves)', () => {
  it('plays round(plan × 0.7) waves: e.g. 1-10 21 → 15, 1-3 10 → 7', () => {
    expect(BALANCE.waves.countScale).toBeCloseTo(0.7);
    expect(ch1.stages.map((s) => s.waves.length)).toEqual([4, 6, 7, 10, 10, 11, 12, 12, 13, 15]);
    expect(ch2.stages.map((s) => s.waves.length)).toEqual([8, 9, 10, 11, 11, 11, 12, 13, 13, 15]);
  });

  it('keeps every chest and puts each boss in the final wave', () => {
    // chest counts per stage from the original plans
    const chestCount = (s: StageDef) => s.waves.flatMap((w) => w.groups).filter((g) => 'chest' in g).length;
    expect(ch1.stages.map(chestCount)).toEqual([0, 0, 3, 3, 3, 3, 4, 4, 5, 5]);
    expect(ch2.stages.map(chestCount)).toEqual([3, 3, 3, 4, 4, 4, 4, 5, 5, 5]);
    for (const s of [ch1.stages[9], ch2.stages[9]]) {
      const last = s.waves[s.waves.length - 1].groups;
      expect(last.some((g) => 'enemy' in g && ENEMIES[g.enemy].isBoss)).toBe(true);
    }
  });

  it('does not cram the removed mice into the remaining waves', () => {
    for (const s of [...ch1.stages, ...ch2.stages]) {
      const sizes = s.waves.map((w) => w.groups.reduce((a, g) => a + ('enemy' in g ? g.count : 0), 0));
      // biggest wave is no bigger than the original plan's last wave would be (count + growth × (plan−1))
      expect(Math.max(...sizes), s.id).toBeLessThanOrEqual(60);
      for (let i = 1; i < sizes.length; i++) expect(sizes[i], s.id).toBeGreaterThanOrEqual(sizes[i - 1] - 3);
    }
    // total mice ≈ 70% of before: 1-10 used to send ~630
    const total = (s: StageDef) => s.waves.flatMap((w) => w.groups).reduce((a, g) => a + ('enemy' in g ? g.count : 0), 0);
    expect(total(ch1.stages[9])).toBeLessThan(500);
  });

  it('wave indicator total follows the shorter stage', () => {
    const b = new Battle(ch1.stages[9], mapOf(ch1.stages[9]), 1);
    expect(b.totalWaves).toBe(15);
  });
});

describe('Chapter 2 placement capacity', () => {
  it('opens plenty of tiles from 2-1 (17) up to 23, never fewer than Chapter 1 at the same point', () => {
    const counts = ch2.stages.map((s) => s.tiles.length);
    expect(counts).toEqual([17, 18, 19, 19, 20, 21, 21, 22, 23, 23]);
    expect(counts[0]).toBeGreaterThan(ch1.stages[3].tiles.length); // 2-1 > 1-4
    expect(counts[9]).toBeGreaterThan(ch1.stages[9].tiles.length); // 2-10 > 1-10
  });

  it('every tile is off the road, unique and inside the map', () => {
    const m = MAPS[ch2.mapId];
    const b = new Battle(ch2.stages[9], m, 1);
    const ids = new Set(m.tiles.map((t) => t.id));
    expect(ids.size).toBe(m.tiles.length);
    for (const t of b.tiles) {
      expect(t.c).toBeGreaterThanOrEqual(0);
      expect(t.c).toBeLessThan(m.cols);
      expect(t.r).toBeLessThan(m.rows);
      expect(b.path.distanceTo(t.x, t.y)).toBeGreaterThanOrEqual(m.cell * 0.9);
      const [bc, br] = m.base;
      expect(t.c === bc && t.r === br).toBe(false);
    }
  });

  it('a full board with no merge pair is never a deadlock: swap and sell work, summon fills only the freed tile', () => {
    const s = ch2.stages[0];
    const b = new Battle(s, mapOf(s), 3);
    b.fish = 999;
    // Fill every tile with cats that can never merge with each other (all different type+level).
    const types = ['kitten', 'tabby', 'orange', 'black', 'white'] as const;
    b.tiles.filter((t) => t.unlocked).forEach((t, i) => b.placeCat(types[i % 5], 1 + Math.floor(i / 5), t.id));
    const before = b.cats.map((c) => `${c.uid}@${c.tileId}`).sort();
    expect(b.emptyTiles()).toHaveLength(0);
    const r = b.summon();
    expect(r).toEqual({ ok: false, reason: 'boardFull' });
    expect(b.cats.map((c) => `${c.uid}@${c.tileId}`).sort()).toEqual(before); // nothing overwritten
    // swapping still works on a full board
    const [x, y] = b.cats;
    expect(b.dropCat(x.uid, y.tileId).result).toBe('swapped');
    // selling frees exactly one tile; the next summon goes there
    const victim = b.cats[2];
    const freed = victim.tileId;
    expect(b.sellCat(victim.uid).ok).toBe(true);
    expect(b.emptyTiles().map((t) => t.id)).toEqual([freed]);
    const again = b.summon();
    expect(again.ok).toBe(true);
    expect(b.catByUid(again.uid!)!.tileId).toBe(freed);
    expect(b.emptyTiles()).toHaveLength(0);
  });

  it('a full board with a matching pair can merge (which also frees a tile)', () => {
    const s = ch2.stages[0];
    const b = new Battle(s, mapOf(s), 3);
    for (const t of b.tiles.filter((x) => x.unlocked)) b.placeCat('kitten', 1, t.id);
    const [p, q] = b.cats;
    expect(b.dropCat(p.uid, q.tileId).result).toBe('merged');
    expect(b.emptyTiles()).toHaveLength(1);
  });
});
