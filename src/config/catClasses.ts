import type { CatId } from "../game/types";

// Character classification (V1.6.2): one primary combat role, mechanic-based skill tags, and
// habitat affinity. Static data only — it never reads or writes the save. Every tag maps to a
// mechanic that exists in the code (tests check it against CATS / ABILITIES); a tag with `star`
// comes from that cat's 3★ Special or 5★ Ultimate and only counts once the player reaches it.
// Temporary treasure-chest skills are never character tags.

export type Archetype = "attacker" | "controller" | "support" | "specialist";

export type SkillTag =
  | "single"
  | "combo"
  | "short"
  | "area"
  | "long"
  | "slow"
  | "bounce"
  | "pierce"
  | "speedBuff"
  | "damageBuff"
  | "execute"
  | "poison"
  | "vulnerable"
  | "armorPierce"
  | "armorShred"
  | "mark";

/** Habitats (地形). "Neutral" is not a habitat: it just means no favored or disliked ones. */
export type Terrain =
  | "forest"
  | "city"
  | "plains"
  | "desert"
  | "coast"
  | "snow";

export interface CatTag {
  id: SkillTag;
  /** Unlocked by the 3★ Special or the 5★ Ultimate (undefined = from the start). */
  star?: 3 | 5;
}

export interface CatClass {
  archetype: Archetype;
  tags: CatTag[];
  /** Habitat affinity — static data only, NOT active in gameplay yet (see HABITAT_ACTIVE). */
  favoredTerrains: Terrain[];
  dislikedTerrains: Terrain[];
}

export const ARCHETYPES: Archetype[] = [
  "attacker",
  "controller",
  "support",
  "specialist",
];
export const TAG_ORDER: SkillTag[] = [
  "single",
  "area",
  "combo",
  "bounce",
  "pierce",
  "long",
  "short",
  "slow",
  "speedBuff",
  "damageBuff",
  "execute",
  "poison",
  "vulnerable",
  "armorPierce",
  "armorShred",
  "mark",
];
export const TERRAINS: Terrain[] = [
  "forest",
  "city",
  "plains",
  "desert",
  "coast",
  "snow",
];

export const CAT_CLASSES: Record<CatId, CatClass> = {
  kitten: {
    archetype: "attacker",
    tags: [{ id: "single" }],
    favoredTerrains: [],
    dislikedTerrains: [],
  },
  tabby: {
    archetype: "attacker",
    tags: [{ id: "combo" }, { id: "short" }],
    favoredTerrains: ["forest", "city"],
    dislikedTerrains: [],
  },
  orange: {
    archetype: "attacker",
    tags: [{ id: "area" }, { id: "vulnerable", star: 3 }],
    favoredTerrains: [],
    dislikedTerrains: [],
  },
  black: {
    archetype: "attacker",
    tags: [{ id: "long" }, { id: "single" }, { id: "armorPierce", star: 3 }],
    favoredTerrains: ["city", "plains"],
    dislikedTerrains: [],
  },
  white: {
    archetype: "controller",
    tags: [{ id: "slow" }],
    favoredTerrains: [],
    dislikedTerrains: ["city"],
  },
  whiskers: {
    archetype: "attacker",
    tags: [{ id: "bounce" }],
    favoredTerrains: ["city", "coast"],
    dislikedTerrains: [],
  },
  sable: {
    archetype: "attacker",
    tags: [{ id: "pierce" }, { id: "armorShred", star: 3 }],
    favoredTerrains: ["forest", "plains"],
    dislikedTerrains: [],
  },
  mallow: {
    archetype: "support",
    tags: [{ id: "speedBuff" }, { id: "damageBuff", star: 3 }],
    favoredTerrains: [],
    dislikedTerrains: [],
  },
  // Debatable (a damage dealer), but execution is its defining mechanic.
  pounce: {
    archetype: "specialist",
    tags: [{ id: "execute" }],
    favoredTerrains: ["plains", "desert"],
    dislikedTerrains: [],
  },
  devil: {
    archetype: "specialist",
    tags: [{ id: "poison" }, { id: "mark", star: 5 }],
    favoredTerrains: [],
    dislikedTerrains: ["coast", "snow", "desert"],
  },
};

/**
 * Habitat affinity is prepared but dormant: no stat effects, no filter, no profile section.
 * It will be introduced later (Chapter 3/4, not yet decided) with its own short tutorial.
 */
export const HABITAT_ACTIVE = false;

/** The cat's tags with their state at this permanent star rank (base tags are always active). */
export function tagsAt(
  cat: CatId,
  stars: number,
): { id: SkillTag; star?: 3 | 5; active: boolean }[] {
  return CAT_CLASSES[cat].tags.map((t) => ({
    ...t,
    active: !t.star || stars >= t.star,
  }));
}

/** The one tag shown on compact cards: the cat's first base tag. */
export function coreTag(cat: CatId): SkillTag {
  return CAT_CLASSES[cat].tags.find((t) => !t.star)!.id;
}

/** Does the cat match a role / tag filter? Tags only count once unlocked (`stars` = its permanent rank). */
export function matchesFilter(
  cat: CatId,
  stars: number,
  f: { archetype?: Archetype | null; tag?: SkillTag | null },
): boolean {
  if (f.archetype && CAT_CLASSES[cat].archetype !== f.archetype) return false;
  if (f.tag && !tagsAt(cat, stars).some((t) => t.id === f.tag && t.active))
    return false;
  return true;
}
