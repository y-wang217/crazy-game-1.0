import { CATS, CAT_ORDER } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { COSMETICS, SKIN_RULES, findCosmetic, skinBonusesFor, skinKind } from '../../config/cosmetics';
import { MAPS } from '../../config/maps';
import { RECRUIT } from '../../config/collection';
import { parseSave } from '../../save/store';
import { COSTUME_IDS, costumeHasHeadwear, drawCostume } from '../../render/costumes';
import { resolvePalette } from '../../render/renderer';
import { drawCat } from '../../render/sprites';
import { Battle } from '../battle';
import { applySkinBonus, getCatStats } from '../combat';
import type { CatId } from '../types';

const ch2 = CHAPTERS[1];
const map2 = MAPS[ch2.mapId];
const specials = COSMETICS.filter((c) => skinKind(c) === 'special');
const regularSkins = COSMETICS.filter((c) => c.slot === 'skin' && skinKind(c) === 'regular');
const ORIGINAL_SKINS = ['skin_calico', 'skin_silver', 'skin_cream', 'skin_midnight', 'skin_sakura'];

describe('skin catalogue', () => {
  it('every cat has exactly one special skin with one small, exact bonus', () => {
    for (const cat of CAT_ORDER) {
      const mine = specials.filter((c) => c.cat === cat);
      expect(mine.length).toBe(1);
      const s = mine[0];
      expect(s.slot).toBe('skin');
      expect(['damage', 'attackSpeed', 'range']).toContain(s.bonus!.stat);
      expect(s.bonus!.pct).toBeGreaterThan(0);
      expect(s.bonus!.pct).toBeLessThanOrEqual(SKIN_RULES.maxBonusPct);
      expect(s.palette).toBeTruthy();
      expect(s.glint).toMatch(/^#/);
    }
  });

  it('regular skins and hats give nothing; skins sold before stay regular with the same price', () => {
    for (const c of COSMETICS.filter((x) => skinKind(x) === 'regular')) expect(c.bonus).toBeUndefined();
    for (const id of ORIGINAL_SKINS) {
      const c = findCosmetic(id)!;
      expect(skinKind(c)).toBe('regular');
      expect(c.price).toBe(60);
    }
    expect(COSMETICS.filter((c) => c.slot === 'hat').every((c) => skinKind(c) === 'regular' && !c.bonus)).toBe(true);
    // Every cat has a regular (looks-only) option too.
    for (const cat of CAT_ORDER) expect(regularSkins.some((c) => c.cat === cat)).toBe(true);
  });

  it('prices are earnable and leave room for recruiting and stars', () => {
    const firstClears = CHAPTERS.flatMap((ch) => ch.stages).reduce((a, s) => a + s.rewards.firstClear, 0);
    for (const s of specials) {
      expect(s.price).toBeGreaterThan(Math.max(...regularSkins.map((r) => r.price))); // special costs more than regular
      expect(s.price).toBeLessThanOrEqual(3 * RECRUIT.cost); // never more than three recruits
    }
    // A full team of five special skins is well under the coins from first clears alone.
    const team = specials
      .sort((a, b) => b.price - a.price)
      .slice(0, 5)
      .reduce((a, s) => a + s.price, 0);
    expect(team).toBeLessThan(firstClears * 0.75);
    expect(COSMETICS.every((c) => Number.isInteger(c.price) && c.price > 0)).toBe(true);
  });
});

describe('special skin bonuses in battle', () => {
  const loadoutAll = { hat: 'hat_crown', skins: Object.fromEntries(specials.map((c) => [c.cat, c.id])) };

  it('skinBonusesFor reads only equipped special skins, one per species', () => {
    expect(skinBonusesFor({ hat: 'hat_crown', skins: { kitten: 'skin_calico' } })).toEqual({});
    const b = skinBonusesFor(loadoutAll);
    expect(Object.keys(b).sort()).toEqual([...CAT_ORDER].sort());
    expect(b.kitten).toEqual({ stat: 'attackSpeed', pct: 3 });
    // A skin in the wrong slot (corrupted save) gives nothing.
    expect(skinBonusesFor({ hat: null, skins: { tabby: 'skin_kitten_star' } })).toEqual({});
  });

  it('applies exactly: +3% damage (and poison), +3% attack speed, +2% range', () => {
    const st = getCatStats(CATS.devil, 3, undefined, 4);
    const d = applySkinBonus(st, { stat: 'damage', pct: 3 });
    expect(d.damage).toBeCloseTo(st.damage * 1.03, 9);
    expect(d.poisonDps).toBeCloseTo(st.poisonDps * 1.03, 9);
    expect(d.interval).toBe(st.interval);
    const s = applySkinBonus(st, { stat: 'attackSpeed', pct: 3 });
    expect(1 / s.interval).toBeCloseTo((1 / st.interval) * 1.03, 9);
    const r = applySkinBonus(st, { stat: 'range', pct: 2 });
    expect(r.range).toBeCloseTo(st.range * 1.02, 9);
    expect(applySkinBonus(st, undefined)).toBe(st);
  });

  it('works with stars and merging, only for that species, and never stacks', () => {
    const team: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];
    const mk = (skins: boolean) =>
      new Battle(ch2.stages[0], map2, { seed: 1, roster: team, stars: { tabby: 5 }, skinBonus: skins ? skinBonusesFor(loadoutAll) : undefined });
    const a = mk(false);
    const b = mk(true);
    for (const x of [a, b]) {
      const e = x.emptyTiles();
      x.placeCat('tabby', 4, e[0].id);
      x.placeCat('tabby', 4, e[1].id);
      x.placeCat('orange', 2, e[2].id);
      x.placeCat('tabby', 1, e[3].id);
    }
    const ratio = (i: number) => b.unitStats(b.cats[i]).damage / a.unitStats(a.cats[i]).damage;
    expect(ratio(0)).toBeCloseTo(1.03, 9);
    expect(ratio(3)).toBeCloseTo(1.03, 9); // every Tabby, any level — one bonus each, no stacking with the others
    expect(b.unitStats(b.cats[2]).damage / a.unitStats(a.cats[2]).damage).toBeCloseTo(1.03, 9); // Orange's own skin
    // Merge two Lv.4 Tabbies → Lv.5 keeps exactly one +3%.
    for (const x of [a, b]) expect(x.dropCat(x.cats[0].uid, x.cats[1].tileId).result).toBe('merged');
    const ta = a.cats.find((c) => c.type === 'tabby' && c.level === 5)!;
    const tb = b.cats.find((c) => c.type === 'tabby' && c.level === 5)!;
    expect(b.unitStats(tb).damage / a.unitStats(ta).damage).toBeCloseTo(1.03, 9);
    // Kitten's bonus is attack speed, so its damage is untouched.
    const k1 = a.placeCat('kitten', 2, a.emptyTiles()[0].id)!;
    const k2 = b.placeCat('kitten', 2, b.emptyTiles()[0].id)!;
    expect(b.unitStats(k2).damage).toBeCloseTo(a.unitStats(k1).damage, 9);
  });

  it('survives battle recovery; old snapshots without skins still restore', () => {
    const b = new Battle(ch2.stages[0], map2, { seed: 1, skinBonus: skinBonusesFor(loadoutAll) });
    const r = Battle.restore(b.stage, b.map, JSON.parse(JSON.stringify(b.snapshot())))!;
    expect(r.skinBonus).toEqual(b.skinBonus);
    const old = JSON.parse(JSON.stringify(b.snapshot()));
    delete old.opts.skinBonus;
    expect(Battle.restore(b.stage, b.map, old)!.skinBonus).toEqual({});
    const bad = JSON.parse(JSON.stringify(b.snapshot()));
    bad.opts.skinBonus.kitten.pct = 50;
    expect(Battle.restore(b.stage, b.map, bad)).toBeNull();
  });
});

describe('saves and purchases', () => {
  it('existing purchases and equipped skins load unchanged', () => {
    const s = parseSave(
      JSON.stringify({
        version: 3,
        fishCoins: 500,
        unlocked: ['1-1'],
        cleared: {},
        owned: ['hat_bow', 'skin_calico', 'skin_midnight'],
        equipped: { hat: 'hat_bow', skins: { kitten: 'skin_calico', black: 'skin_midnight' } },
        seen: [],
      }),
    );
    expect(s.owned).toEqual(['hat_bow', 'skin_calico', 'skin_midnight']);
    expect(s.equipped).toEqual({ hat: 'hat_bow', skins: { kitten: 'skin_calico', black: 'skin_midnight' } });
    expect(skinBonusesFor(s.equipped)).toEqual({}); // nothing converted into stats
  });
});

describe('skin costumes (real outfits, not just recolours)', () => {
  /** A fake 2D context that counts drawing calls, so the art can be checked without a browser. */
  function countingCtx() {
    let ops = 0;
    const ctx: Record<string, unknown> = {};
    const handler: ProxyHandler<Record<string, unknown>> = {
      get: (target, key) => {
        if (key === 'ops') return ops;
        if (key in target) return target[key as string];
        return (..._args: unknown[]) => {
          if (key === 'fill' || key === 'stroke' || key === 'fillRect' || key === 'fillText') ops++;
        };
      },
      set: (target, key, v) => ((target[key as string] = v), true),
    };
    return new Proxy(ctx, handler) as unknown as CanvasRenderingContext2D & { ops: number };
  }

  it('every shop skin has costume art, and it puts something on the head', () => {
    for (const s of COSMETICS.filter((c) => c.slot === 'skin')) {
      expect(COSTUME_IDS, s.id).toContain(s.id);
      expect(costumeHasHeadwear(s.id), s.id).toBe(true);
    }
    expect(costumeHasHeadwear(undefined)).toBe(false);
    expect(costumeHasHeadwear('hat_crown')).toBe(false);
  });

  it('a skin draws extra outfit pieces on the cat (body and head), on top of its colours', () => {
    for (const s of COSMETICS.filter((c) => c.slot === 'skin')) {
      const draw = (costume?: string) => {
        const ctx = countingCtx();
        drawCat(ctx, {
          type: s.cat!,
          level: 1,
          palette: resolvePalette(s.cat!, { hat: null, skins: {} }),
          hat: null,
          costume,
          t: 0,
          attackAge: 9,
          aim: 0,
        });
        return ctx.ops;
      };
      expect(draw(s.id), s.id).toBeGreaterThan(draw(undefined) + 3);
      for (const layer of ['body', 'head'] as const) {
        const ctx = countingCtx();
        drawCostume(ctx, s.id, layer, { r: 12, fat: 1, t: 0 });
        expect(ctx.ops, `${s.id} ${layer}`).toBeGreaterThan(0);
      }
    }
  });

  it('costumes are looks only: the stat rules are unchanged', () => {
    for (const s of regularSkins) expect(skinBonusesFor({ hat: null, skins: { [s.cat!]: s.id } })).toEqual({});
    expect(Object.keys(skinBonusesFor({ hat: null, skins: Object.fromEntries(specials.map((c) => [c.cat, c.id])) })).length).toBe(CAT_ORDER.length);
  });
});
