import { CATS, CAT_ORDER } from "../../config/cats";
import { en } from "../../i18n/en";
import { zh } from "../../i18n/zh";
import { getCatStats } from "../combat";
import { TILE_PX, introStats } from "../introStats";

// The Intro tab shows real engine numbers (V1.6.4), never invented ratings.
const get = (cat: (typeof CAT_ORDER)[number], key: string, star = 1) =>
  introStats(cat, star).find((s) => s.key === key);

describe("Intro tab base stats", () => {
  it("match the engine at the cat’s star rank and battle Lv.1", () => {
    for (const c of CAT_ORDER) {
      for (const star of [1, 3, 5]) {
        const st = getCatStats(CATS[c], 1, undefined, star);
        const dmg = get(c, "damage", star)!;
        if (CATS[c].damage === 0) expect(dmg.params.v).toBe(0);
        else
          expect(Math.abs(Number(dmg.params.v) - st.damage)).toBeLessThan(
            0.051,
          );
        const range =
          get(c, "range", star) ??
          get(c, "auraRadius", star) ??
          get(c, "supportRange", star);
        expect(
          Math.abs(Number(range!.params.v) - st.range / TILE_PX),
        ).toBeLessThan(0.006);
      }
    }
    // Kitten at 1★: the reference values from the playtest notes.
    expect(get("kitten", "damage")!.params.v).toBe(10);
    expect(get("kitten", "attackSpeed")!.params.v).toBe(1.43);
    expect(get("kitten", "range")!.params.v).toBe(1.76);
    expect(get("tabby", "damage")!.params.hits).toBe(3);
  });

  it("support and control cats show zero damage plus their real effect", () => {
    const white = getCatStats(CATS.white, 1);
    expect(get("white", "damage")!.params.v).toBe(0);
    expect(get("white", "slow")).toMatchObject({
      signature: true,
      params: {
        p: Math.round(white.slowStrength * 100),
        s: white.slowDuration,
      },
    });
    const mallow = getCatStats(CATS.mallow, 1);
    expect(get("mallow", "damage")!.params.v).toBe(0);
    expect(get("mallow", "buff")).toMatchObject({
      signature: true,
      params: { p: Math.round(mallow.buffSpeed * 100), s: mallow.buffDuration },
    });
    expect(get("mallow", "supportRange")).toBeTruthy();
  });

  it("every cat has its defining number where it has one, and all labels exist in both languages", () => {
    expect(get("orange", "area")?.signature).toBe(true);
    expect(get("sable", "line")?.signature).toBe(true);
    expect(get("whiskers", "bounce")?.signature).toBe(true);
    expect(get("pounce", "execute")?.signature).toBe(true);
    expect(get("devil", "poison")?.signature).toBe(true);
    for (const c of CAT_ORDER)
      for (const s of introStats(c, 1))
        for (const k of [
          `introStat.${s.key}.label`,
          `introStat.${s.key}.value`,
        ])
          expect([k, !!en[k], !!zh[k]]).toEqual([k, true, true]);
  });
});
