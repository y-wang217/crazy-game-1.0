import {
  ARCHETYPES,
  CAT_CLASSES,
  HABITAT_ACTIVE,
  TAG_ORDER,
  TERRAINS,
  coreTag,
  matchesFilter,
  tagsAt,
  type SkillTag,
} from "../../config/catClasses";
import { CATS, CAT_ORDER } from "../../config/cats";
import { ABILITIES, STARS } from "../../config/collection";
import { en } from "../../i18n/en";
import { zh } from "../../i18n/zh";
import type { CatId } from "../types";

// V1.6.2 character classification: static data that must describe mechanics that really exist.
const tagIds = (cat: CatId) => CAT_CLASSES[cat].tags.map((t) => t.id);
const baseTags = (cat: CatId) =>
  CAT_CLASSES[cat].tags.filter((t) => !t.star).map((t) => t.id);

describe("cat classes: one role, mechanic-backed tags", () => {
  it("every cat has exactly one archetype and at least one base tag; no duplicates", () => {
    for (const id of CAT_ORDER) {
      const c = CAT_CLASSES[id];
      expect(ARCHETYPES).toContain(c.archetype);
      expect(baseTags(id).length).toBeGreaterThan(0);
      expect(new Set(tagIds(id)).size).toBe(tagIds(id).length);
      for (const t of c.tags) expect(TAG_ORDER).toContain(t.id);
    }
  });

  it("roles match the approved list", () => {
    const roles = Object.fromEntries(
      CAT_ORDER.map((id) => [id, CAT_CLASSES[id].archetype]),
    );
    expect(roles).toEqual({
      kitten: "attacker",
      tabby: "attacker",
      orange: "attacker",
      black: "attacker",
      white: "controller",
      whiskers: "attacker",
      sable: "attacker",
      mallow: "support",
      pounce: "specialist",
      devil: "specialist",
    });
  });

  it("base tags come from the cat’s real attack type", () => {
    const byAttack: Record<string, SkillTag> = {
      projectile: "single",
      combo: "combo",
      slam: "area",
      snipe: "long",
      aura: "slow",
      ricochet: "bounce",
      pierce: "pierce",
      support: "speedBuff",
      execute: "execute",
      poison: "poison",
    };
    for (const id of CAT_ORDER)
      expect(baseTags(id)).toContain(byAttack[CATS[id].attack]);
    // Each mechanic tag only on cats that actually have that attack.
    for (const [attack, tag] of Object.entries(byAttack)) {
      if (tag === "single") continue; // projectile and snipe are both single-target
      for (const id of CAT_ORDER)
        if (baseTags(id).includes(tag)) expect(CATS[id].attack).toBe(attack);
    }
    // Range tags: the longest and the shortest reach.
    const ranges = CAT_ORDER.map((id) => CATS[id].range);
    for (const id of CAT_ORDER) {
      if (tagIds(id).includes("long"))
        expect(CATS[id].range).toBe(Math.max(...ranges));
      if (tagIds(id).includes("short"))
        expect(CATS[id].range).toBe(Math.min(...ranges));
    }
  });

  it("star tags exist in that cat’s 3★ Special / 5★ Ultimate", () => {
    expect(STARS.specialAt).toBe(3);
    expect(STARS.ultimateAt).toBe(5);
    const star = (id: CatId, tag: SkillTag) =>
      CAT_CLASSES[id].tags.find((t) => t.id === tag)?.star;
    expect(star("orange", "vulnerable")).toBe(3);
    expect(ABILITIES.orange.special.vulnerable).toBeGreaterThan(0);
    expect(star("black", "armorPierce")).toBe(3);
    expect(ABILITIES.black.special.armorIgnore).toBeGreaterThan(0);
    expect(star("sable", "armorShred")).toBe(3);
    expect(ABILITIES.sable.special.armorShred).toBeGreaterThan(0);
    expect(star("mallow", "damageBuff")).toBe(3);
    expect(ABILITIES.mallow.special.dmgBuff).toBeGreaterThan(0);
    expect(star("devil", "mark")).toBe(5);
    expect(ABILITIES.devil.ultimate.allyBonus).toBeGreaterThan(0);
    const starred = CAT_ORDER.flatMap((id) =>
      CAT_CLASSES[id].tags.filter((t) => t.star).map((t) => `${id}:${t.id}`),
    );
    expect(starred.sort()).toEqual([
      "black:armorPierce",
      "devil:mark",
      "mallow:damageBuff",
      "orange:vulnerable",
      "sable:armorShred",
    ]);
  });
});

describe("star gating", () => {
  it("star tags are inactive below their star and active at/after it; base tags always active", () => {
    for (const s of [1, 2, 3, 4, 5]) {
      const orange = tagsAt("orange", s);
      expect(orange.find((t) => t.id === "area")!.active).toBe(true);
      expect(orange.find((t) => t.id === "vulnerable")!.active).toBe(s >= 3);
      expect(tagsAt("devil", s).find((t) => t.id === "mark")!.active).toBe(
        s >= 5,
      );
    }
  });

  it("the core (card) tag is always a base tag", () => {
    for (const id of CAT_ORDER) expect(baseTags(id)).toContain(coreTag(id));
    expect(coreTag("black")).toBe("long");
  });

  it("filters match role, and tags only once unlocked", () => {
    expect(matchesFilter("white", 1, { archetype: "controller" })).toBe(true);
    expect(matchesFilter("white", 1, { archetype: "attacker" })).toBe(false);
    expect(matchesFilter("orange", 2, { tag: "vulnerable" })).toBe(false);
    expect(matchesFilter("orange", 3, { tag: "vulnerable" })).toBe(true);
    expect(matchesFilter("devil", 4, { tag: "mark" })).toBe(false);
    expect(
      matchesFilter("devil", 5, { tag: "mark", archetype: "specialist" }),
    ).toBe(true);
    expect(matchesFilter("kitten", 1, {})).toBe(true);
    const singles = CAT_ORDER.filter((id) =>
      matchesFilter(id, 1, { tag: "single" }),
    );
    expect(singles).toEqual(["kitten", "black"]);
  });
});

describe("habitat affinity (dormant)", () => {
  it("is static data only, uses known terrains, and never favors and dislikes the same one", () => {
    expect(HABITAT_ACTIVE).toBe(false);
    for (const id of CAT_ORDER) {
      const c = CAT_CLASSES[id];
      for (const t of [...c.favoredTerrains, ...c.dislikedTerrains])
        expect(TERRAINS).toContain(t);
      expect(
        c.favoredTerrains.filter((t) => c.dislikedTerrains.includes(t)),
      ).toEqual([]);
    }
    expect(CAT_CLASSES.devil.dislikedTerrains).toEqual([
      "coast",
      "snow",
      "desert",
    ]);
    expect(CAT_CLASSES.white.dislikedTerrains).toEqual(["city"]);
    expect(CAT_CLASSES.kitten.favoredTerrains).toEqual([]);
  });
});

describe("labels and lore text", () => {
  it("every role, tag, terrain and cat intro/story has en + zh text", () => {
    const keys = [
      ...ARCHETYPES.map((a) => `archetype.${a}`),
      ...TAG_ORDER.map((t) => `ctag.${t}`),
      ...TERRAINS.map((t) => `terrain.${t}`),
      "terrain.neutral",
      ...CAT_ORDER.flatMap((id) => [
        `cat.${id}.name`,
        `cat.${id}.intro`,
        `cat.${id}.story`,
      ]),
      ...["intro", "battle", "growth", "story"].map((k) => `profile.tab.${k}`),
    ];
    for (const k of keys) {
      expect(en[k]?.length ?? 0).toBeGreaterThan(0);
      expect(zh[k]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("approved names and wording", () => {
    const z = zh;
    expect(z["cat.whiskers.name"]).toBe("黑白鬍鬚先生");
    expect(z["cat.mallow.name"]).toBe("棉花糖隊長");
    expect(en["cat.orange.name"]).toBe("Chubby Orange");
    const all = Object.values(z).join("\n");
    for (const bad of ["燕尾服魔術師", "溫柔隊長", "威士忌"])
      expect(all).not.toContain(bad);
    expect(z["cat.devil.story"]).not.toMatch(/超有效|抓到/);
    expect(z["cat.sable.story"]).not.toContain("蘑菇森林長大");
  });
});
