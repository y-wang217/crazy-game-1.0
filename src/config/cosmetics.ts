import type { CatId, CosmeticDef, CosmeticLoadout, SkinBonus } from '../game/types';

// Shop items. Hats and REGULAR skins (普通造型) are purely visual. SPECIAL skins (特殊造型)
// also give that one cat species a small, exact combat bonus, read by the battle through
// skinBonusesFor(). Every skin sold before V1.4 is regular — purchases were never converted
// into stat items. Every price and bonus below is a tuning knob.

export const SKIN_RULES = {
  /** Hard cap for any single special-skin bonus (percent). Tests enforce it. */
  maxBonusPct: 5,
  /** Shop intro appears once this stage has been cleared (first time). */
  shopIntroAfterStage: '1-4',
} as const;

export const COSMETICS: CosmeticDef[] = [
  // Hats — one equipped at a time, worn by every cat
  { id: 'hat_bow', name: 'Red Bow', slot: 'hat', price: 30, description: 'A classic ribbon for every cat.' },
  { id: 'hat_flower', name: 'Flower Crown', slot: 'hat', price: 60, description: 'Fresh from the Beginner Forest.' },
  { id: 'hat_party', name: 'Party Hat', slot: 'hat', price: 80, description: 'Every wave is a celebration.' },
  { id: 'hat_crown', name: 'Tiny Crown', slot: 'hat', price: 150, description: 'For cats of royal taste.' },

  // Skins — recolour one specific cat
  // ---- Regular skins: looks only (the five originals keep their ids and prices) ----
  {
    id: 'skin_calico',
    name: 'Calico Kitten',
    slot: 'skin',
    cat: 'kitten',
    price: 60,
    description: 'Patchy, playful and adorable.',
    palette: { body: '#fbf3e6', stripe: '#e08a3c', belly: '#ffffff', outline: '#7a5a42' },
  },
  {
    id: 'skin_silver',
    name: 'Silver Tabby',
    slot: 'skin',
    cat: 'tabby',
    price: 60,
    description: 'Sleek steel-grey stripes.',
    palette: { body: '#b8bcc6', stripe: '#4c5262', belly: '#e8eaf0', outline: '#3e4250' },
  },
  {
    id: 'skin_cream',
    name: 'Cream Puff',
    slot: 'skin',
    cat: 'orange',
    price: 60,
    description: 'Soft like a fresh bun.',
    palette: { body: '#f6dcae', stripe: '#e8bf80', belly: '#fff6e6', outline: '#a0794a' },
  },
  {
    id: 'skin_midnight',
    name: 'Midnight Ninja',
    slot: 'skin',
    cat: 'black',
    price: 60,
    description: 'Deep-blue night camouflage.',
    palette: { body: '#2c3a62', belly: '#3e4e7c', stripe: '#1c2648', eye: '#7cf0ff', outline: '#141a30' },
  },
  {
    id: 'skin_sakura',
    name: 'Sakura Dream',
    slot: 'skin',
    cat: 'white',
    price: 60,
    description: 'Blushing cherry-blossom fur.',
    palette: { body: '#ffe6ef', belly: '#fff5f8', stripe: '#f8c8d8', eye: '#c05080', outline: '#d098b0' },
  },
  {
    id: 'skin_whiskers_snow',
    name: 'Snowy Showman',
    slot: 'skin',
    cat: 'whiskers',
    price: 80,
    description: 'A white tuxedo for winter matinées.',
    palette: { body: '#eef0f6', belly: '#ffffff', stripe: '#c8ccd8', eye: '#4a7ad0', outline: '#8a90a4' },
  },
  {
    id: 'skin_sable_chocolate',
    name: 'Chocolate Point',
    slot: 'skin',
    cat: 'sable',
    price: 80,
    description: 'Warm cocoa ears and paws.',
    palette: { body: '#f2e2cc', belly: '#fbf3e6', stripe: '#6e4630', earInner: '#5a3a28', outline: '#7a5a40' },
  },
  {
    id: 'skin_mallow_peach',
    name: 'Peach Captain',
    slot: 'skin',
    cat: 'mallow',
    price: 80,
    description: 'Soft peach fur, same big heart.',
    palette: { body: '#fbe0cc', belly: '#fff4ec', stripe: '#e8b090', outline: '#b88a70' },
  },
  {
    id: 'skin_pounce_ginger',
    name: 'Ginger Sprinter',
    slot: 'skin',
    cat: 'pounce',
    price: 80,
    description: 'Bright ginger with racing stripes.',
    palette: { body: '#f0a050', belly: '#fde4c4', stripe: '#b85a1a', outline: '#8a4a18' },
  },
  {
    id: 'skin_devil_lilac',
    name: 'Lilac Mischief',
    slot: 'skin',
    cat: 'devil',
    price: 80,
    description: 'Pastel purple, still plotting.',
    palette: { body: '#e2d6f0', belly: '#faf6ff', stripe: '#a48cc4', eye: '#d0609a', outline: '#8a78a8' },
  },

  // ---- Special skins: looks + one small combat bonus for that cat ----
  special('skin_kitten_star', 'kitten', 'Starlight Kitten', 'Twinkles every time it throws.', 220, { stat: 'attackSpeed', pct: 3 }, '#ffe066', {
    body: '#f8e7b0',
    belly: '#fffaf0',
    stripe: '#e8c060',
    eye: '#3a6ad0',
    outline: '#9a7a30',
  }),
  special('skin_tabby_champion', 'tabby', 'Golden Champion', 'Wears the belt it earned.', 220, { stat: 'damage', pct: 3 }, '#ffcf40', {
    body: '#e8b850',
    belly: '#fff2cc',
    stripe: '#a0681a',
    eye: '#2a2a2a',
    outline: '#7a4e10',
  }),
  special('skin_orange_sumo', 'orange', 'Grand Sumo', 'Every slam lands like a championship bout.', 220, { stat: 'damage', pct: 3 }, '#ff8a5a', {
    body: '#f6b07a',
    belly: '#fff0e0',
    stripe: '#d0703a',
    outline: '#8a4a20',
  }),
  special('skin_black_frost', 'black', 'Frost Sniper', 'Ice-blue scope eye, steady paws.', 220, { stat: 'range', pct: 2 }, '#8fe8ff', {
    body: '#3a4a5e',
    belly: '#5a6e86',
    stripe: '#24303e',
    eye: '#9ff4ff',
    outline: '#18202a',
  }),
  special('skin_white_moon', 'white', 'Moonlight Princess', 'Her charm reaches a little further.', 220, { stat: 'range', pct: 2 }, '#d8c8ff', {
    body: '#f2f0ff',
    belly: '#ffffff',
    stripe: '#d8d0f4',
    eye: '#7a5ad0',
    outline: '#a49cc8',
  }),
  special('skin_whiskers_gala', 'whiskers', 'Gala Magician', 'Midnight-blue tails, faster tricks.', 260, { stat: 'attackSpeed', pct: 3 }, '#c8a0ff', {
    body: '#2a2e52',
    belly: '#f0ecff',
    stripe: '#1a1c38',
    eye: '#ffd36a',
    outline: '#12142a',
  }),
  special('skin_sable_crimson', 'sable', 'Crimson Moon', 'A blade-swift ronin under a red moon.', 260, { stat: 'damage', pct: 3 }, '#ff6a7a', {
    body: '#efe0d4',
    belly: '#fbf2ea',
    stripe: '#8a2a34',
    earInner: '#7a2430',
    eye: '#ff8a5a',
    outline: '#6a3a38',
  }),
  special('skin_mallow_bloom', 'mallow', 'Blossom Captain', 'Her bell rings across the whole garden.', 260, { stat: 'range', pct: 2 }, '#ffb3d1', {
    body: '#fde8f0',
    belly: '#ffffff',
    stripe: '#e8a8c0',
    eye: '#5a9a6a',
    outline: '#c08aa0',
  }),
  special('skin_pounce_storm', 'pounce', 'Thunder Pounce', 'Crackles with speed.', 260, { stat: 'attackSpeed', pct: 3 }, '#fff27a', {
    body: '#5a6070',
    belly: '#d8dce6',
    stripe: '#ffd84a',
    eye: '#fff27a',
    outline: '#2a2e38',
  }),
  special('skin_devil_neon', 'devil', 'Neon Imp', 'Glows in the dark; so does the poison.', 260, { stat: 'damage', pct: 3 }, '#7affc0', {
    body: '#3a3448',
    belly: '#5a5070',
    stripe: '#2a2436',
    eye: '#7affc0',
    outline: '#1a1624',
  }),
];

function special(
  id: string,
  cat: CatId,
  name: string,
  description: string,
  price: number,
  bonus: SkinBonus,
  glint: string,
  palette: CosmeticDef['palette'],
): CosmeticDef {
  return { id, name, slot: 'skin', kind: 'special', cat, price, description, bonus, glint, palette };
}

/** Regular or special (hats and pre-V1.4 skins are regular). */
export function skinKind(c: CosmeticDef): 'regular' | 'special' {
  return c.kind === 'special' ? 'special' : 'regular';
}

/**
 * Combat bonuses from the player's EQUIPPED special skins: at most one per species (the
 * loadout holds one skin per cat), so nothing can stack. Regular skins and hats give nothing.
 */
export function skinBonusesFor(loadout: CosmeticLoadout | null | undefined): Partial<Record<CatId, SkinBonus>> {
  const out: Partial<Record<CatId, SkinBonus>> = {};
  for (const [cat, id] of Object.entries(loadout?.skins ?? {})) {
    const c = findCosmetic(id);
    if (c && c.slot === 'skin' && c.cat === cat && skinKind(c) === 'special' && c.bonus) {
      out[cat as CatId] = { stat: c.bonus.stat, pct: Math.min(SKIN_RULES.maxBonusPct, Math.max(0, c.bonus.pct)) };
    }
  }
  return out;
}

/** Sparkle colour for a cat's equipped special skin (visual only). */
export function skinGlint(type: CatId, loadout: CosmeticLoadout | null | undefined): string | undefined {
  const c = findCosmetic(loadout?.skins?.[type]);
  return c && skinKind(c) === 'special' ? c.glint : undefined;
}

export function findCosmetic(id: string | null | undefined): CosmeticDef | undefined {
  if (!id) return undefined;
  return COSMETICS.find((c) => c.id === id);
}
