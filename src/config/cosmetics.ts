import type { CosmeticDef } from '../game/types';

// Purely visual. Nothing here is read by the combat simulation.
export const COSMETICS: CosmeticDef[] = [
  // Hats — one equipped at a time, worn by every cat
  { id: 'hat_bow', name: 'Red Bow', slot: 'hat', price: 30, description: 'A classic ribbon for every cat.' },
  { id: 'hat_flower', name: 'Flower Crown', slot: 'hat', price: 60, description: 'Fresh from the Beginner Forest.' },
  { id: 'hat_party', name: 'Party Hat', slot: 'hat', price: 80, description: 'Every wave is a celebration.' },
  { id: 'hat_crown', name: 'Tiny Crown', slot: 'hat', price: 150, description: 'For cats of royal taste.' },

  // Skins — recolour one specific cat
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
];

export function findCosmetic(id: string | null | undefined): CosmeticDef | undefined {
  if (!id) return undefined;
  return COSMETICS.find((c) => c.id === id);
}
