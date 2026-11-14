// Skin costumes: real outfit pieces drawn on top of the cat (hats, capes, aprons, belts…),
// not just a recolour. Every skin in the shop has one, and every outfit EVOLVES with the cat's
// in-battle level (Lv.1–5) in its own theme — a princess gets a grander tiara and cape, a sumo
// gets a ceremonial rope and apron — instead of borrowing the default cat's unrelated gear.
//
// Equipment slots: the default cat's level gear lives in slots (see sprites.ts). An outfit lists
// the slots it COVERS; default gear in those slots is skipped and the outfit draws its own
// themed upgrade there. Gear in slots the outfit leaves free still appears (e.g. Kitten's
// satchel on the Calico farm kid), optionally recoloured with `tint`.
//
// Layers, in drawing order:
//   tail  — on the tail tip
//   back  — behind the body (capes, wings, parasols, hats slung on the back)
//   body  — over the body and level gear (aprons, belts, vests), under the paws/head
//   paws  — on the paws (gloves, mittens, wraps)
//   head  — on the head (hats, masks, headbands); replaces the shared cosmetic hat
//   front — just under the chin, in front of the head (collars, scarves, bow ties, pendants)
//   hand  — held items (wands, snacks)
// Coordinates follow drawCat: body centred on (0,7) (≈12×10, ×fat for Chubby Orange), head drawn in
// its own frame centred on (0,0) with radius r, eyes at y≈-1, top of the head at -r.

import { TAU, circle, drawHeart, drawStar, ellipse, poly, roundRect, type Ctx } from './shapes';

export type CostumeLayer = 'tail' | 'back' | 'body' | 'paws' | 'head' | 'front' | 'hand';

/** Equipment slots for in-battle level gear. */
export type Slot = 'crown' | 'brow' | 'side' | 'neck' | 'shoulder' | 'chest' | 'waist' | 'cape' | 'paws' | 'tail' | 'hand';

interface Pt {
  x: number;
  y: number;
}

export interface CostumeGeom {
  /** Head radius (head layer). */
  r: number;
  /** Body width factor (Chubby Orange is 1.25). */
  fat: number;
  /** Time for small cloth sway. */
  t: number;
  /** In-battle level 1–5 (default 1). */
  level?: number;
  /** y just under the chin (front layer). */
  ny?: number;
  pawL?: Pt;
  pawR?: Pt;
  /** Tail tip. */
  tail?: Pt;
  aim?: number;
  attackAge?: number;
}

/** Recolours for default level gear that an outfit leaves visible. */
export interface GearTint {
  cape?: string;
  scarf?: string;
  scarfEdge?: string;
  band?: string;
  guard?: string;
  aura?: string;
  rifle?: string;
  rifleTrim?: string;
  pouch?: string;
  vial?: string;
}

type Painter = (ctx: Ctx, g: CostumeGeom) => void;
interface Costume extends Partial<Record<CostumeLayer, Painter>> {
  covers?: Slot[];
  tint?: GearTint;
}

const GOLD = '#ffd36a';
const GOLD_EDGE = '#a07a10';

const lv = (g: CostumeGeom) => g.level ?? 1;
const NY = (g: CostumeGeom) => g.ny ?? 4.5;
const paws = (g: CostumeGeom): Pt[] => [g.pawL ?? { x: -6 * g.fat, y: 15 }, g.pawR ?? { x: 6 * g.fat, y: 15 }];
const sway = (g: CostumeGeom, k = 1) => Math.sin(g.t * 2.4) * 0.8 * k;

/** A cape hanging from the shoulders, peeking out on both sides of the body (sx/sy: wider/longer). */
function cape(ctx: Ctx, g: CostumeGeom, fill: string, edge: string, lining?: string, sx = 1, sy = 1) {
  const w = 15 * g.fat * sx;
  const b = 18 * sy;
  const s = sway(g);
  poly(ctx, [-9 * g.fat, -2, 9 * g.fat, -2, w + s, b, 0, b - 2, -w + s, b], fill, edge, 1.3);
  if (lining) {
    poly(ctx, [w - 2.5 + s, b - 1.5, w + s, b, 10 * g.fat, 4], lining);
    poly(ctx, [-w + 2.5 + s, b - 1.5, -w + s, b, -10 * g.fat, 4], lining);
  }
}

/** A V-shaped neckerchief tied under the chin. */
function kerchief(ctx: Ctx, y: number, fill: string, edge: string, depth = 8) {
  poly(ctx, [-8, y - 1.5, 8, y - 1.5, 0, y + depth], fill, edge, 1.1);
}

/** Headband across the forehead with two tails flying out on one side. */
function headband(ctx: Ctx, g: CostumeGeom, fill: string, edge: string, tailSide = 1) {
  const r = g.r;
  roundRect(ctx, -r * 0.98, -r * 0.62, r * 1.96, 3.6, 1.6, fill, edge, 0.9);
  const x = tailSide * r * 0.95;
  const s = sway(g, 1.5);
  poly(ctx, [x, -r * 0.5, x + tailSide * 7, -r * 0.85 + s, x + tailSide * 6, -r * 0.45 + s], fill, edge, 0.9);
  poly(ctx, [x, -r * 0.42, x + tailSide * 7, -r * 0.2 + s, x + tailSide * 4.5, -r * 0.05 + s], fill, edge, 0.9);
}

function flower(ctx: Ctx, x: number, y: number, s: number, petal: string, heart = '#ffd84a') {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU - Math.PI / 2;
    circle(ctx, x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.85, petal);
  }
  circle(ctx, x, y, s * 0.6, heart);
}

function leaf(ctx: Ctx, x: number, y: number, ang: number, len: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ellipse(ctx, len / 2, 0, len / 2, len / 4.5, fill, 'rgba(20,60,20,0.6)', 0.7);
  ctx.restore();
}

function crescent(ctx: Ctx, x: number, y: number, R: number, fill: string, edge?: string) {
  ctx.beginPath();
  ctx.arc(x, y, R, Math.PI * 0.2, Math.PI * 1.8);
  ctx.arc(x + R * 0.4, y, R * 0.8, Math.PI * 1.75, Math.PI * 0.25, true);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

/** Big boxing glove / mitten over a paw, with a white cuff. */
function glove(ctx: Ctx, p: Pt, fill: string, edge: string, cuff = '#ffffff') {
  circle(ctx, p.x, p.y + 0.3, 5, fill, edge, 1.1);
  roundRect(ctx, p.x - 4.4, p.y - 5.4, 8.8, 2.8, 1.2, cuff, edge, 0.8);
}

/** Wraps across the top of a paw. */
function wraps(ctx: Ctx, p: Pt, color: string) {
  circle(ctx, p.x, p.y, 3.9, '#ffffff', 'rgba(0,0,0,0.35)', 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(p.x - 3.6, p.y - 1.4);
  ctx.lineTo(p.x + 3.6, p.y - 1.4);
  ctx.moveTo(p.x - 3.4, p.y + 1.6);
  ctx.lineTo(p.x + 3.4, p.y + 1.6);
  ctx.stroke();
}

/** Where a cat holds a snack (left side, low). */
function held(ctx: Ctx, g: CostumeGeom, draw: () => void) {
  ctx.save();
  ctx.translate(-10 * g.fat, 11);
  ctx.rotate(-0.4);
  draw();
  ctx.restore();
}

const COSTUMES: Record<string, Costume> = {
  // ================================================================== regular
  // Calico Kitten — farm kid: straw hat + red bandana → sunflower → satchel → cape → golden
  skin_calico: {
    covers: ['crown', 'side', 'neck'],
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      ellipse(ctx, 0, -r * 0.82, r * 1.18, 3.4, '#ecc86e', '#9a7a2a', 1.1);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.86, r * 0.62, r * 0.55, 0, Math.PI, TAU);
      ctx.fillStyle = '#f2d483';
      ctx.fill();
      ctx.strokeStyle = '#9a7a2a';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      roundRect(ctx, -r * 0.62, -r * 0.98, r * 1.24, 2.6, 1, L >= 5 ? GOLD : '#e04848');
      if (L >= 2) flower(ctx, r * 0.6, -r * 1.08, 2.8, '#ffd84a', '#7a4a1a');
      if (L >= 5) flower(ctx, -r * 0.55, -r * 1.05, 2.2, '#ffffff', GOLD);
    },
    front: (ctx, g) => {
      const y = NY(g);
      kerchief(ctx, y, '#e04848', '#9a2a2a', 8);
      for (const [x, dy] of [
        [-3, 0.5],
        [3, 0.5],
        [0, 4],
      ])
        circle(ctx, x, y + dy, 0.9, '#ffffff');
      if (lv(g) >= 5) circle(ctx, 0, y + 1, 2.8, GOLD, GOLD_EDGE, 1);
    },
  },
  // Silver Tabby — boxer in training: track jacket + sweatband → towel → wraps → gloves → gold
  skin_silver: {
    covers: ['brow', 'waist', 'neck', 'paws', 'chest'],
    body: (ctx, g) => {
      const L = lv(g);
      const stripe = L >= 5 ? GOLD : '#ffffff';
      poly(ctx, [-9, -1.5, -1, -1.5, -1, 12, -10, 9], '#2f4f9a', '#18284f', 1.1);
      poly(ctx, [9, -1.5, 1, -1.5, 1, 12, 10, 9], '#2f4f9a', '#18284f', 1.1);
      ctx.strokeStyle = stripe;
      ctx.lineWidth = L >= 5 ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.moveTo(-7.5, -1);
      ctx.lineTo(-8.6, 8.4);
      ctx.moveTo(7.5, -1);
      ctx.lineTo(8.6, 8.4);
      ctx.stroke();
      roundRect(ctx, -0.8, 1, 1.6, 10, 0.6, L >= 5 ? GOLD : '#d0d4dc');
    },
    paws: (ctx, g) => {
      const L = lv(g);
      for (const p of paws(g)) {
        if (L >= 4) glove(ctx, p, L >= 5 ? GOLD : '#3a6ad8', L >= 5 ? GOLD_EDGE : '#1a3a8a');
        else if (L >= 3) wraps(ctx, p, '#3a6ad8');
      }
    },
    head: (ctx, g) => {
      headband(ctx, g, '#3a6ad8', '#1a3a8a', 1);
      roundRect(ctx, -g.r * 0.98, -g.r * 0.5, g.r * 1.96, 1.1, 0.5, lv(g) >= 5 ? GOLD : '#ffffff');
    },
    front: (ctx, g) => {
      const L = lv(g);
      if (L < 2) return;
      const y = NY(g);
      // training towel round the neck, ends hanging down the jacket
      roundRect(ctx, -9, y - 2, 18, 4, 2, '#ffffff', '#9aa0b0', 1);
      roundRect(ctx, -8, y, 4, 6.5, 1.4, '#ffffff', '#9aa0b0', 0.9);
      roundRect(ctx, 4, y, 4, 6.5, 1.4, '#ffffff', '#9aa0b0', 0.9);
      if (L >= 5) {
        poly(ctx, [-2, y, 2, y, 1, y + 6, -1, y + 6], '#3a6ad8');
        circle(ctx, 0, y + 8, 3.4, GOLD, GOLD_EDGE, 1);
        drawStar(ctx, 0, y + 8, 1.8, '#ffffff');
      }
    },
  },
  // Cream Puff — baker: toque, apron, kerchief → oven mitt → croissant → tall toque → gold
  skin_cream: {
    covers: ['chest', 'neck', 'crown', 'cape', 'hand', 'paws'],
    body: (ctx, g) => {
      const L = lv(g);
      const w = 8.5 * g.fat;
      roundRect(ctx, -w, 2, w * 2, 14, 3, '#ffffff', '#b0a090', 1.1);
      if (L >= 4) roundRect(ctx, -w, 13, w * 2, 3, 1.5, L >= 5 ? GOLD : '#e84a4a');
      roundRect(ctx, -w * 0.45, 8, w * 0.9, 4.5, 1.2, '#f4ece0', '#b0a090', 0.9);
      if (L >= 4) {
        // strawberry on the pocket
        poly(ctx, [-2.2, 8.6, 2.2, 8.6, 0, 12.6], '#e83a4a', '#8a1a2a', 0.7);
        poly(ctx, [-1.6, 8.6, 1.6, 8.6, 0, 7.2], '#4a9a50');
      }
      ctx.strokeStyle = '#b0a090';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w, 4);
      ctx.lineTo(-12 * g.fat, 5);
      ctx.moveTo(w, 4);
      ctx.lineTo(12 * g.fat, 5);
      ctx.stroke();
    },
    paws: (ctx, g) => {
      if (lv(g) < 2) return;
      const p = paws(g)[1];
      // pink quilted oven mitt
      ellipse(ctx, p.x + 0.5, p.y - 0.5, 5, 5.6, '#ff9ab8', '#b04a6a', 1.1);
      ellipse(ctx, p.x - 3.6, p.y - 1.5, 1.8, 2.6, '#ff9ab8', '#b04a6a', 0.9);
      roundRect(ctx, p.x - 4, p.y - 6.6, 9, 2.6, 1.2, '#ffffff', '#b04a6a', 0.8);
    },
    hand: (ctx, g) => {
      if (lv(g) < 3) return;
      held(ctx, g, () => {
        // a fresh croissant
        ellipse(ctx, 0, 0, 6, 3, '#e8a850', '#9a5e22', 1);
        ellipse(ctx, -4.5, 1.4, 2.6, 2, '#e8a850', '#9a5e22', 0.9);
        ellipse(ctx, 4.5, 1.4, 2.6, 2, '#e8a850', '#9a5e22', 0.9);
        ctx.strokeStyle = '#9a5e22';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const x of [-2, 1.5]) {
          ctx.moveTo(x, -2.6);
          ctx.lineTo(x + 0.8, 2.6);
        }
        ctx.stroke();
      });
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      const y = -r * 0.95;
      const lift = L >= 4 ? 5 : 0;
      roundRect(ctx, -r * 0.62, y - 4 - lift, r * 1.24, 5 + lift, 1.5, '#ffffff', '#a8a098', 1);
      for (const [x, dy, rr] of [
        [-r * 0.42, -6.5, 4.6],
        [r * 0.42, -6.5, 4.6],
        [0, -8.5, 5.2],
      ] as const)
        circle(ctx, x, y + dy - lift, rr, '#ffffff', '#a8a098', 1);
      roundRect(ctx, -r * 0.6, y - 4.5 - lift, r * 1.2, 3, 1, '#ffffff');
      if (L >= 5) {
        roundRect(ctx, -r * 0.62, y - 1, r * 1.24, 2.4, 1, GOLD);
        circle(ctx, 1.5, y - 15 - lift, 2.6, '#e83a4a', '#8a1a2a', 0.8);
        ctx.strokeStyle = '#4a9a50';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(1.5, y - 17.5 - lift);
        ctx.lineTo(3.5, y - 20 - lift);
        ctx.stroke();
      }
    },
    front: (ctx, g) => {
      const y = NY(g);
      const L = lv(g);
      kerchief(ctx, y, L >= 5 ? GOLD : '#e84a4a', L >= 5 ? GOLD_EDGE : '#9a2a2a', 6);
      circle(ctx, -2.5, y + 0.5, 0.8, '#ffffff');
      circle(ctx, 2.5, y + 0.5, 0.8, '#ffffff');
    },
  },
  // Midnight Ninja — hood, mask, sash → red scarf → night cloak → gold rifle → gold plate & stars
  skin_midnight: {
    covers: ['crown', 'neck', 'cape', 'chest'],
    back: (ctx, g) => {
      const L = lv(g);
      if (L >= 3) cape(ctx, g, '#1a2242', '#0c1020', L >= 5 ? '#d83a4a' : '#3a4a80', 1.1, 1.05);
    },
    body: (ctx, g) => {
      const L = lv(g);
      ctx.strokeStyle = '#141a30';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-9, 1);
      ctx.lineTo(8, 13);
      ctx.stroke();
      ctx.strokeStyle = '#3a4a80';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const star = L >= 5 ? GOLD : '#c8d0e0';
      drawStar(ctx, -5, 10, L >= 5 ? 4 : 3.2, star, 4, 0.35);
      circle(ctx, -5, 10, 0.8, '#141a30');
      if (L >= 5) drawStar(ctx, 5, 12.5, 3.2, star, 4, 0.35);
    },
    head: (ctx, g) => {
      const r = g.r;
      // hood over the crown
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r * 1.02, Math.PI * 1.08, Math.PI * 1.92);
      ctx.lineTo(r * 0.98, -r * 0.42);
      ctx.lineTo(-r * 0.98, -r * 0.42);
      ctx.closePath();
      ctx.fillStyle = '#1a2242';
      ctx.fill();
      ctx.strokeStyle = '#0c1020';
      ctx.lineWidth = 1;
      ctx.stroke();
      roundRect(ctx, -4.5, -r * 0.84, 9, 4, 1, lv(g) >= 5 ? GOLD : '#b8c0d0', lv(g) >= 5 ? GOLD_EDGE : '#5a6478', 0.8);
      // lower face mask
      ctx.beginPath();
      ctx.moveTo(-r * 0.92, r * 0.15);
      ctx.quadraticCurveTo(0, r * 0.05, r * 0.92, r * 0.15);
      ctx.quadraticCurveTo(r * 0.7, r * 0.95, 0, r * 0.95);
      ctx.quadraticCurveTo(-r * 0.7, r * 0.95, -r * 0.92, r * 0.15);
      ctx.fillStyle = '#1a2242';
      ctx.fill();
      ctx.stroke();
      const s = sway(g, 1.5);
      poly(ctx, [r * 0.9, -r * 0.5, r * 1.5, -r * 0.8 + s, r * 1.45, -r * 0.35 + s], '#1a2242', '#0c1020', 0.8);
    },
    front: (ctx, g) => {
      if (lv(g) < 2) return;
      const y = NY(g);
      const s = sway(g, 1.6);
      // red ninja scarf with long tails
      roundRect(ctx, -8.5, y - 2, 17, 4, 2, '#d83a4a', '#7a1020', 1);
      poly(ctx, [6, y, 17, y + 3 + s, 16, y + 7 + s, 7.5, y + 2.5], '#d83a4a', '#7a1020', 1);
    },
  },
  // Sakura Dream — kimono, obi, hairpin → obi blossom → tail ribbon → paper parasol → gold
  skin_sakura: {
    covers: ['neck', 'chest', 'crown', 'cape'],
    back: (ctx, g) => {
      const L = lv(g);
      if (L < 4) return;
      // wagasa (paper parasol) resting behind the shoulder
      ctx.save();
      ctx.translate(-8, -12);
      ctx.rotate(-0.35);
      ctx.strokeStyle = '#7a4a2a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(4, 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 15, Math.PI, TAU);
      ctx.closePath();
      ctx.fillStyle = '#ff9ac0';
      ctx.fill();
      ctx.strokeStyle = L >= 5 ? GOLD : '#c04a7a';
      ctx.lineWidth = L >= 5 ? 2 : 1.2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(192,74,122,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 1; k < 6; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
      }
      ctx.stroke();
      flower(ctx, 6, -8, 1.8, '#ffffff', L >= 5 ? GOLD : '#ffd84a');
      ctx.restore();
    },
    body: (ctx, g) => {
      const L = lv(g);
      poly(ctx, [-10, -1.5, 2, 9, -2, 12, -11, 6], '#ff9ac0', '#c04a7a', 1);
      poly(ctx, [10, -1.5, -2, 9, 2, 12, 11, 6], '#ffffff', '#c04a7a', 1);
      roundRect(ctx, -12, 8, 24, 5.5, 1.5, '#c0305a', '#7a1a3a', 1);
      roundRect(ctx, -12, 9.8, 24, L >= 5 ? 2 : 1.2, 0.5, GOLD);
      if (L >= 2) {
        // big blossom tied on the obi with a cord
        ctx.strokeStyle = '#ffd36a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-1, 10.8);
        ctx.lineTo(-3, 16);
        ctx.moveTo(1, 10.8);
        ctx.lineTo(3, 16);
        ctx.stroke();
        flower(ctx, 0, 10.6, 2.6, '#ffffff', '#ff6fa8');
      }
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      ctx.strokeStyle = L >= 5 ? GOLD : '#7a4a2a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.95);
      ctx.lineTo(-r * 1.0, -r * 0.35);
      ctx.stroke();
      flower(ctx, -r * 0.62, -r * 0.88, L >= 5 ? 3 : 2.4, '#ff8ab4', L >= 5 ? GOLD : '#ffd84a');
      flower(ctx, -r * 0.2, -r * 1.02, 1.8, '#ffc8dc');
      ctx.strokeStyle = L >= 5 ? GOLD : '#d0a040';
      ctx.lineWidth = L >= 5 ? 1.1 : 0.8;
      ctx.beginPath();
      for (const dx of L >= 5 ? [-0.1, 0.1, 0.25] : [0]) {
        ctx.moveTo(-r * (0.95 - dx), -r * 0.4);
        ctx.lineTo(-r * (1.0 - dx), r * 0.2);
      }
      ctx.stroke();
      circle(ctx, -r * 1.0, r * 0.25, 1.4, L >= 5 ? GOLD : '#ff8ab4');
    },
  },
  // Snowy Showman — beanie + striped scarf → red mittens → red winter cape → candy-cane wand → gold
  skin_whiskers_snow: {
    covers: ['crown', 'neck', 'cape', 'paws', 'hand'],
    back: (ctx, g) => {
      const L = lv(g);
      if (L < 3) return;
      cape(ctx, g, '#c83a4a', L >= 5 ? GOLD : '#7a1a24', '#ffffff', 1.05);
      for (const x of [-12, -6, 0, 6, 12]) circle(ctx, x + sway(g) * 0.5, 16.5 - Math.abs(x) * 0.05, 1.8, '#ffffff');
    },
    paws: (ctx, g) => {
      if (lv(g) < 2) return;
      for (const p of paws(g)) glove(ctx, p, '#d84a5a', '#8a2a34');
    },
    hand: (ctx, g) => {
      const L = lv(g);
      if (L < 4) return;
      const a = g.attackAge ?? 9;
      ctx.save();
      ctx.translate(-9, 10);
      ctx.rotate(-0.6 + (a < 0.25 ? -0.6 * Math.sin((a / 0.25) * Math.PI) : 0));
      // candy-cane wand
      roundRect(ctx, -1.3, -13, 2.6, 13, 1.2, '#ffffff', '#a02a3a', 0.8);
      ctx.fillStyle = '#d83a4a';
      for (let y = -12; y < 0; y += 3) ctx.fillRect(-1.3, y, 2.6, 1.3);
      ctx.strokeStyle = '#d83a4a';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(2.4, -13, 2.4, Math.PI, TAU);
      ctx.stroke();
      if (L >= 5) drawStar(ctx, 4.8, -14, 3.6, GOLD);
      ctx.restore();
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.6, r * 0.95, r * 0.75, 0, Math.PI, TAU);
      ctx.fillStyle = '#d84a5a';
      ctx.fill();
      ctx.strokeStyle = '#8a2a34';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r, -r * 1.05, r * 2, 2);
      ctx.restore();
      roundRect(ctx, -r * 0.98, -r * 0.7, r * 1.96, 4, 2, '#ffffff', '#a0a4b4', 0.9);
      if (L >= 5) drawStar(ctx, 0, -r * 1.45, 4.6, GOLD);
      else circle(ctx, 0, -r * 1.42, 3.2, '#ffffff', '#a0a4b4', 0.9);
    },
    front: (ctx, g) => {
      const y = NY(g);
      const stripe = lv(g) >= 5 ? GOLD : '#ffffff';
      roundRect(ctx, -10, y - 2.5, 20, 5, 2.4, '#d84a5a', '#8a2a34', 1);
      const s = sway(g, 1.5);
      poly(ctx, [4, y, 9, y, 11 + s, y + 12, 6 + s, y + 12], '#d84a5a', '#8a2a34', 1);
      ctx.fillStyle = stripe;
      for (const dy of [4, 8]) ctx.fillRect(6.6 + s * (dy / 12), y + dy, 4, 1.5);
      for (const x of [-6, 0]) ctx.fillRect(x, y - 2.5, 2, 5);
    },
  },
  // Chocolate Point — musketeer: plumed hat, lace collar → brooch → tabard → bigger plume → gold
  skin_sable_chocolate: {
    covers: ['crown', 'side', 'neck', 'chest'],
    body: (ctx, g) => {
      const L = lv(g);
      if (L < 3) return;
      // musketeer's blue tabard with a white cross
      roundRect(ctx, -7, 2, 14, 13, 2, '#3a5ab0', L >= 5 ? GOLD : '#1a2a60', L >= 5 ? 1.6 : 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, 4, 2, 9.5);
      ctx.fillRect(-4.6, 7.2, 9.2, 2);
      if (L >= 5) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-7, 3);
        ctx.lineTo(7, 14);
        ctx.stroke();
      }
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      ctx.save();
      ctx.rotate(-0.12);
      ellipse(ctx, 0, -r * 0.85, r * 1.25, 3.4, '#5a3a28', '#2a1a10', 1.1);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.88, r * 0.62, r * 0.55, 0, Math.PI, TAU);
      ctx.fillStyle = '#6e4630';
      ctx.fill();
      ctx.strokeStyle = '#2a1a10';
      ctx.stroke();
      roundRect(ctx, -r * 0.62, -r * 1.0, r * 1.24, 2.2, 1, L >= 5 ? GOLD : '#8a2a2a');
      // plume: one white feather, two big feathers from Lv.4, golden at Lv.5
      const plume = (w: number, col: string, inner: string, tipX: number, tipY: number) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(r * 0.4, -r * 1.05);
        ctx.quadraticCurveTo(r * 1.2, -r * 1.75, tipX, tipY + sway(g));
        ctx.stroke();
        ctx.strokeStyle = inner;
        ctx.lineWidth = w * 0.4;
        ctx.stroke();
      };
      if (L >= 4) plume(4.2, L >= 5 ? GOLD : '#3a6ad8', '#ffffff', r * 1.75, -r * 0.55);
      plume(L >= 4 ? 4 : 3, L >= 5 ? '#fff4c8' : '#ffffff', L >= 5 ? GOLD : '#c03a3a', r * 1.55, -r * 0.95);
      ctx.restore();
    },
    front: (ctx, g) => {
      const y = NY(g);
      const L = lv(g);
      for (let i = -3; i <= 3; i++) circle(ctx, i * 2.6, y - 1 + (3 - Math.abs(i)) * 0.7, 2.2, '#ffffff', '#b8a890', 0.7);
      if (L >= 2) {
        // lace jabot cascading below the collar, pinned with a sapphire brooch
        for (const [dy, w] of [
          [8.5, 2.6],
          [6, 3.4],
        ] as const)
          ellipse(ctx, 0, y + dy, w, 2.2, '#ffffff', '#b8a890', 0.8);
        circle(ctx, 0, y + 2, 2.8, L >= 5 ? GOLD : '#dfe6ee', '#5a6a80', 1);
        circle(ctx, 0, y + 2, 1.4, '#3a6ad8');
      } else circle(ctx, 0, y + 2, 1.4, '#c03a3a', '#6a1a1a', 0.7);
    },
  },
  // Peach Captain — sailor cap + collar → bell → cap ribbons & bigger bell → epaulettes → gold cord & star
  skin_mallow_peach: {
    covers: ['crown', 'neck', 'shoulder'],
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      if (L >= 3) {
        // sailor-cap ribbon tails
        const s = sway(g, 1.4);
        for (const sg of [-1, 1]) poly(ctx, [sg * r * 0.7, -r * 0.9, sg * (r * 1.05 + 1), -r * 0.2 + s, sg * (r * 0.85 + 1), -r * 0.1 + s, sg * r * 0.55, -r * 0.85], '#2a3a7a', '#141c44', 0.8);
      }
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.86, r * 0.88, r * 0.45, 0, Math.PI, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#8a90a4';
      ctx.lineWidth = 1;
      ctx.stroke();
      roundRect(ctx, -r * 0.88, -r * 0.92, r * 1.76, 3.4, 1, L >= 5 ? GOLD : '#2a3a7a');
      if (L >= 5) drawStar(ctx, 0, -r * 1.12, 3.2, GOLD);
      else circle(ctx, 0, -r * 1.34, 1.8, '#e04848');
    },
    front: (ctx, g) => {
      const y = NY(g);
      const L = lv(g);
      // navy sailor collar with white piping
      poly(ctx, [-12, y - 3, 12, y - 3, 10, y + 3.5, 0, y + 6.5, -10, y + 3.5], '#2a3a7a', '#141c44', 1.1);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-10, y - 1.5);
      ctx.lineTo(-8.6, y + 2.4);
      ctx.lineTo(0, y + 4.8);
      ctx.lineTo(8.6, y + 2.4);
      ctx.lineTo(10, y - 1.5);
      ctx.stroke();
      if (L >= 2) {
        const br = L >= 3 ? 4.4 : 3.4;
        circle(ctx, 0, y + 6 + br * 0.5, br, GOLD, GOLD_EDGE, 1);
        roundRect(ctx, -br * 0.7, y + 6 + br * 0.65, br * 1.4, 0.8, 0.4, GOLD_EDGE);
      }
      poly(ctx, [-3, y + 3.5, 3, y + 3.5, 0, y + 7], '#e04848', '#8a2a2a', 0.8);
      if (L >= 4)
        for (const sx of [-1, 1]) {
          roundRect(ctx, sx * 12.5 - 4, y - 4, 8, 3.8, 1.8, GOLD, GOLD_EDGE, 0.9);
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (const k of [-2.5, 0, 2.5]) {
            ctx.moveTo(sx * 12.5 + k, y - 0.2);
            ctx.lineTo(sx * 12.5 + k, y + 2.6);
          }
          ctx.stroke();
        }
      if (L >= 5) {
        // captain's golden aiguillette
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-11, y - 1);
        ctx.quadraticCurveTo(-8, y + 9, -1.5, y + 5);
        ctx.moveTo(-11, y - 1);
        ctx.quadraticCurveTo(-6, y + 12, 0, y + 7);
        ctx.stroke();
      }
    },
  },
  // Ginger Sprinter — sweatband + race bib → wristbands → long scarf → claw guards → gold winner's bib
  skin_pounce_ginger: {
    covers: ['brow', 'chest'],
    tint: { band: '#2fa860' },
    body: (ctx, g) => {
      const L = lv(g);
      roundRect(ctx, -6.5, 2.5, 13, 10, 1.2, L >= 5 ? '#ffe58a' : '#ffffff', L >= 5 ? GOLD_EDGE : '#5a5a5a', L >= 5 ? 1.4 : 1);
      circle(ctx, -5, 4, 0.7, '#5a5a5a');
      circle(ctx, 5, 4, 0.7, '#5a5a5a');
      ctx.fillStyle = '#d84a3a';
      ctx.font = '900 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(L >= 5 ? '1' : '7', 0, 8.2);
      if (L >= 5) drawStar(ctx, 4, 10.5, 1.8, '#d84a3a');
    },
    head: (ctx, g) => {
      const L = lv(g);
      headband(ctx, g, L >= 5 ? GOLD : '#ffffff', L >= 5 ? GOLD_EDGE : '#8a8a8a', -1);
      roundRect(ctx, -g.r * 0.98, -g.r * 0.55, g.r * 1.96, 1.4, 0.6, '#2fa860');
    },
  },
  // Lilac Mischief — witch hat + bow collar (+ default pouch, vial, cape, heart tail) → gold moon charm
  skin_devil_lilac: {
    covers: ['crown', 'side', 'neck'],
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      ellipse(ctx, 0, -r * 0.82, r * 1.15, 3, '#5a3a8a', L >= 5 ? GOLD : '#2a1a48', L >= 5 ? 1.5 : 1);
      poly(ctx, [-r * 0.58, -r * 0.85, r * 0.58, -r * 0.85, r * 0.3, -r * 1.7, r * 0.75, -r * 2.05], '#6a4a9a', '#2a1a48', 1);
      roundRect(ctx, -r * 0.55, -r * 1.1, r * 1.05, 2.6, 0.8, '#b080e0');
      roundRect(ctx, -1.8, -r * 1.12, 3.6, 3, 0.6, L >= 5 ? GOLD : '#d0d4dc', L >= 5 ? GOLD_EDGE : '#7a7e8a', 0.6);
      if (L >= 5) {
        crescent(ctx, r * 0.85, -r * 1.75, 3.4, GOLD, GOLD_EDGE);
        drawStar(ctx, r * 0.1, -r * 1.4, 2, GOLD);
      }
    },
    front: (ctx, g) => {
      const y = NY(g);
      const L = lv(g);
      poly(ctx, [0, y, -7, y - 3.5, -7, y + 3.5], '#b080e0', L >= 5 ? GOLD_EDGE : '#5a3a8a', 1);
      poly(ctx, [0, y, 7, y - 3.5, 7, y + 3.5], '#b080e0', L >= 5 ? GOLD_EDGE : '#5a3a8a', 1);
      circle(ctx, 0, y, 2, L >= 5 ? GOLD : '#d0a8f8', '#5a3a8a', 0.9);
    },
  },

  // ================================================================== special
  // Starlight Kitten — little wizard: hat + star cape → moon pendant → spellbook → grand cape → gold
  skin_kitten_star: {
    covers: ['crown', 'side', 'neck', 'cape', 'waist'],
    back: (ctx, g) => {
      const L = lv(g);
      const big = L >= 4;
      cape(ctx, g, '#2a3a8a', '#141c48', big ? GOLD : '#ffd36a', big ? 1.3 : 1, big ? 1.15 : 1);
      const stars: [number, number, number][] = big
        ? [
            [-15, 14, 2.4],
            [15.5, 12, 2],
            [-11, 6, 1.6],
            [12, 4, 1.6],
          ]
        : [
            [-12, 12, 2],
            [12.5, 10, 1.6],
          ];
      for (const [x, y, s] of stars) drawStar(ctx, x, y, s, '#ffe066');
    },
    body: (ctx, g) => {
      if (lv(g) < 3) return;
      // spellbook on a strap
      ctx.strokeStyle = '#5a3a8a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 1);
      ctx.lineTo(7, 13);
      ctx.stroke();
      roundRect(ctx, 3.5, 8.5, 8.5, 7.5, 1.2, '#7a4ab8', '#2a1a48', 1);
      roundRect(ctx, 4.2, 9.2, 1.4, 6, 0.5, '#fff6dc');
      drawStar(ctx, 8.4, 12.2, 2.2, GOLD);
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      ellipse(ctx, 0, -r * 0.82, r * 1.05, 3, '#2a3a8a', L >= 5 ? GOLD : '#141c48', L >= 5 ? 1.6 : 1);
      poly(ctx, [-r * 0.6, -r * 0.85, r * 0.6, -r * 0.85, r * 0.2, -r * 1.75, -r * 0.35, -r * 2.05], '#3a4aa8', '#141c48', 1);
      if (L >= 5) roundRect(ctx, -r * 0.55, -r * 1.08, r * 1.1, 2.6, 1, GOLD);
      drawStar(ctx, -r * 0.35, -r * 2.05, L >= 5 ? 4.6 : 3, '#ffe066');
      drawStar(ctx, r * 0.05, -r * 1.25, 2, '#ffe066');
      drawStar(ctx, -r * 0.3, -r * 1.5, 1.4, '#ffffff');
    },
    front: (ctx, g) => {
      const L = lv(g);
      if (L < 2) return;
      const y = NY(g);
      // gold chain with a crescent-moon pendant
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-7, y - 1.5);
      ctx.quadraticCurveTo(0, y + 3, 7, y - 1.5);
      ctx.stroke();
      crescent(ctx, -0.5, y + 4.6, L >= 5 ? 5 : 4.2, L >= 5 ? GOLD : '#ffe680', '#7a5a10');
      if (L >= 5) drawStar(ctx, 2.2, y + 4.6, 1.8, '#ffffff');
    },
  },
  // Golden Champion — robe, laurel, sash → title belt → wraps → gloves & longer robe → golden laurel
  skin_tabby_champion: {
    covers: ['brow', 'waist', 'cape', 'chest', 'paws'],
    back: (ctx, g) => {
      const L = lv(g);
      cape(ctx, g, '#c8303a', '#6a1018', GOLD, L >= 4 ? 1.25 : 1, L >= 4 ? 1.15 : 1);
    },
    body: (ctx, g) => {
      const L = lv(g);
      roundRect(ctx, -12.5, 8, 25, 4.5, 1.5, '#b02a30', '#5a1018', 1);
      if (L >= 2) {
        const s = L >= 5 ? 1.35 : 1;
        ellipse(ctx, 0, 10.2, 5.5 * s, 4 * s, GOLD, GOLD_EDGE, 1.1);
        drawStar(ctx, 0, 10.2, 2.4 * s, '#e04848');
        if (L >= 5) for (const x of [-5.5, 5.5]) circle(ctx, x, 10.2, 1.2, '#4a8ae0');
      }
      poly(ctx, [-9, -1.5, -2, -1.5, -5, 7], '#c8303a', '#6a1018', 1);
      poly(ctx, [9, -1.5, 2, -1.5, 5, 7], '#c8303a', '#6a1018', 1);
    },
    paws: (ctx, g) => {
      const L = lv(g);
      for (const p of paws(g)) {
        if (L >= 4) glove(ctx, p, L >= 5 ? GOLD : '#d83040', L >= 5 ? GOLD_EDGE : '#7a1018');
        else if (L >= 3) wraps(ctx, p, '#d84a4a');
      }
    },
    head: (ctx, g) => {
      const r = g.r;
      const gold = lv(g) >= 5;
      for (const s of [-1, 1])
        for (let i = 0; i < 4; i++) {
          const a = Math.PI * (1.5 + s * (0.12 + i * 0.12));
          leaf(ctx, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92 - 1, a + (s * Math.PI) / 2, gold ? 6.5 : 5.5, gold ? '#f2c230' : '#4a9a50');
        }
      circle(ctx, 0, -r * 0.98, gold ? 2.2 : 1.6, '#e04848', '#8a2a2a', 0.6);
    },
  },
  // Grand Sumo — topknot + mawashi → rice ball → yokozuna rope → ceremonial apron → gold
  skin_orange_sumo: {
    covers: ['waist', 'chest', 'cape', 'hand', 'crown'],
    body: (ctx, g) => {
      const L = lv(g);
      const w = 12.5 * g.fat;
      roundRect(ctx, -w, 9, w * 2, 5.5, 2, '#3a4aa0', '#1a2050', 1.1);
      if (L >= 4) {
        // kesho-mawashi: ceremonial apron hanging in front
        poly(ctx, [-6.5, 12, 6.5, 12, 7.5, 22, -7.5, 22], L >= 5 ? GOLD : '#c8303a', L >= 5 ? GOLD_EDGE : '#5a1018', 1.1);
        circle(ctx, 0, 17, 2.6, L >= 5 ? '#c8303a' : GOLD, GOLD_EDGE, 0.8);
        roundRect(ctx, -7.5, 20.5, 15, 1.6, 0.6, L >= 5 ? '#c8303a' : GOLD);
      } else {
        roundRect(ctx, -4, 8, 8, 8, 1.5, '#3a4aa0', '#1a2050', 1);
        ctx.strokeStyle = '#e8e0f8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const x of [-3, -1, 1, 3]) {
          ctx.moveTo(x, 14);
          ctx.lineTo(x, 19);
        }
        ctx.stroke();
      }
      if (L >= 3) {
        // thick white yokozuna rope over the belt
        roundRect(ctx, -w - 0.5, 7, (w + 0.5) * 2, 4.4, 2.2, '#ffffff', '#a8a098', 1);
        ctx.strokeStyle = '#c8c0b8';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let x = -w + 1; x < w; x += 2.6) {
          ctx.moveTo(x, 7.4);
          ctx.lineTo(x + 1.8, 11);
        }
        ctx.stroke();
        if (L >= 5)
          for (const x of [-8, 8]) poly(ctx, [x - 1.5, 11, x + 1.5, 11, x - 0.5, 14, x + 1.5, 14, x - 1, 18], GOLD, GOLD_EDGE, 0.7);
      }
    },
    hand: (ctx, g) => {
      if (lv(g) < 2) return;
      held(ctx, g, () => {
        // rice ball with nori
        poly(ctx, [0, -5.5, 5.5, 4, -5.5, 4], '#ffffff', '#a8a098', 1.1);
        roundRect(ctx, -3, 1, 6, 3.4, 0.6, '#1e2a22');
      });
    },
    head: (ctx, g) => {
      const r = g.r;
      ellipse(ctx, 0, -r * 0.92, r * 0.55, 3, '#2a2a3a', '#101018', 1);
      ellipse(ctx, 0, -r * 1.16, 3.6, 3.2, '#2a2a3a', '#101018', 1);
      roundRect(ctx, -2.8, -r * 1.03, 5.6, lv(g) >= 5 ? 2.2 : 1.5, 0.6, lv(g) >= 5 ? GOLD : '#ffffff');
    },
  },
  // Frost Sniper — beret, scope goggle, vest, cape → ice scarf → bandolier → ice rifle → frost cape
  skin_black_frost: {
    covers: ['crown', 'cape', 'chest', 'neck'],
    tint: { rifle: '#8fdcf0', rifleTrim: '#e8fbff' },
    back: (ctx, g) => {
      if (lv(g) >= 5) {
        cape(ctx, g, '#e8f6ff', '#5aa8c8', '#8fe8ff', 1.15, 1.05);
        for (const x of [-14, -8, 8, 14]) poly(ctx, [x - 1.6, 17, x + 1.6, 17, x, 22], '#cff4ff', '#5aa8c8', 0.7);
      } else cape(ctx, g, '#1e2a3c', '#0c121c', '#8fe8ff');
    },
    body: (ctx, g) => {
      const L = lv(g);
      roundRect(ctx, -9, 0, 18, 11, 3, '#3a4a3e', '#18201a', 1.1);
      roundRect(ctx, -7, 6, 5, 4, 1, '#4e6050', '#18201a', 0.8);
      roundRect(ctx, 2, 6, 5, 4, 1, '#4e6050', '#18201a', 0.8);
      if (L >= 3) {
        // bandolier of ice-blue cartridges
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#8a5a32';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-10, 1);
        ctx.lineTo(9, 13);
        ctx.stroke();
        for (let k = 0; k < 4; k++) roundRect(ctx, -7.6 + k * 4.6 - 1.1, 2.4 + k * 2.9 - 2, 2.2, 4, 0.7, '#bff6ff', '#2a6a80', 0.6);
      }
    },
    head: (ctx, g) => {
      const r = g.r;
      ctx.save();
      ctx.rotate(-0.25);
      ellipse(ctx, -1, -r * 0.85, r * 0.95, r * 0.36, '#1e2a3c', '#0c121c', 1);
      circle(ctx, -1, -r * 1.2, 1.4, '#1e2a3c');
      if (lv(g) >= 5) drawStar(ctx, -r * 0.3, -r * 0.88, 3.2, '#ffffff', 6, 0.4);
      else roundRect(ctx, -r * 0.4, -r * 0.82, 5, 2.2, 0.6, '#8fe8ff');
      ctx.restore();
      ctx.strokeStyle = '#2a3440';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(r * 0.98, -r * 0.2);
      ctx.lineTo(r * 0.65, -1);
      ctx.stroke();
      circle(ctx, r * 0.4, -1, 3.8, lv(g) >= 5 ? 'rgba(143,232,255,0.6)' : 'rgba(143,232,255,0.35)', '#2a3440', 1.6);
      circle(ctx, r * 0.4 + 1, -2, 0.9, '#ffffff');
    },
    front: (ctx, g) => {
      if (lv(g) < 2) return;
      const y = NY(g);
      roundRect(ctx, -9, y - 2.4, 18, 4.8, 2.2, '#8fe8ff', '#2a6a80', 1);
      poly(ctx, [-5, y + 1, -11, y + 11, -2, y + 9], '#8fe8ff', '#2a6a80', 1);
    },
  },
  // Moonlight Princess — crescent tiara, cape, moonstone → pearls → tail bow → tall crown & long cape → gold & moon halo
  skin_white_moon: {
    covers: ['neck', 'crown', 'cape', 'tail'],
    tail: (ctx, g) => {
      const L = lv(g);
      if (L < 3 || !g.tail) return;
      const { x, y } = g.tail;
      poly(ctx, [x, y + 2, x + 6, y - 3, x + 6, y + 6], '#b8a8ff', '#6a5ab8', 1);
      poly(ctx, [x, y + 2, x - 6, y - 3, x - 6, y + 6], '#b8a8ff', '#6a5ab8', 1);
      drawStar(ctx, x, y + 1.5, 2.4, L >= 5 ? GOLD : '#ffffff');
    },
    back: (ctx, g) => {
      const L = lv(g);
      if (L >= 5) crescent(ctx, -4, -9, 17, 'rgba(255,230,128,0.85)', GOLD_EDGE);
      const big = L >= 4;
      cape(ctx, g, '#7a6ac8', L >= 5 ? GOLD : '#3a2a7a', '#e8e0ff', big ? 1.3 : 1, big ? 1.15 : 1);
      const stars: [number, number][] = big
        ? [
            [-16, 15],
            [16, 13],
            [-12, 7],
            [12.5, 6],
          ]
        : [
            [-13, 13],
            [13, 11],
          ];
      for (const [x, y] of stars) drawStar(ctx, x, y, 1.6, '#ffffff');
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      const band = L >= 5 ? GOLD : '#e0e4f0';
      const edge = L >= 5 ? GOLD_EDGE : '#8a8ab0';
      if (L >= 4) {
        // tall moon crown with side points
        poly(ctx, [-r * 0.7, -r * 0.8, -r * 0.6, -r * 1.25, -r * 0.3, -r * 1.02, r * 0.3, -r * 1.02, r * 0.6, -r * 1.25, r * 0.7, -r * 0.8], band, edge, 1);
        crescent(ctx, 0, -r * 1.36, 5.4, '#ffe680', '#b0902a');
        circle(ctx, -r * 0.6, -r * 1.25, 1.2, '#b8a8ff');
        circle(ctx, r * 0.6, -r * 1.25, 1.2, '#b8a8ff');
      } else {
        poly(ctx, [-r * 0.6, -r * 0.8, -r * 0.3, -r * 1.02, r * 0.3, -r * 1.02, r * 0.6, -r * 0.8], band, edge, 1);
        crescent(ctx, 0, -r * 1.18, 4, '#ffe680', '#b0902a');
      }
      circle(ctx, -r * 0.3, -r * 0.92, 1, '#b8a8ff');
      circle(ctx, r * 0.3, -r * 0.92, 1, '#b8a8ff');
    },
    front: (ctx, g) => {
      const y = NY(g);
      const L = lv(g);
      if (L >= 2) {
        const pearl = L >= 5 ? GOLD : '#e0d8ff';
        for (let i = -3; i <= 3; i++) circle(ctx, i * 2.7, y - 0.5 + (3 - Math.abs(i)) * 0.75, 1.5, pearl, L >= 5 ? GOLD_EDGE : '#6a5ab8', 0.8);
      } else {
        ctx.strokeStyle = '#a49cc8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-6, y - 1);
        ctx.quadraticCurveTo(0, y + 4, 6, y - 1);
        ctx.stroke();
      }
      circle(ctx, 0, y + 4, L >= 5 ? 3.4 : 2.6, '#e8e0ff', L >= 5 ? GOLD : '#7a6ac8', 1.1);
    },
  },
  // Gala Magician — top hat, cape, bow tie → high collar → big gold bow & band → wand → gold trim & star
  skin_whiskers_gala: {
    covers: ['crown', 'neck', 'cape'],
    back: (ctx, g) => {
      const L = lv(g);
      cape(ctx, g, '#16162a', L >= 5 ? GOLD : '#06060e', '#d8304a', L >= 5 ? 1.1 : 1);
      if (L >= 2)
        for (const sg of [-1, 1]) {
          // high standing collar, red inside
          poly(ctx, [sg * 5, -1, sg * 16, -19, sg * 12, -1], '#16162a', L >= 5 ? GOLD : '#06060e', 1);
          poly(ctx, [sg * 6.5, -1, sg * 14.5, -15.5, sg * 11, -1], '#d8304a');
        }
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      roundRect(ctx, -r * 0.95, -r * 0.92, r * 1.9, 3, 1.4, '#16162a', '#06060e', 1);
      roundRect(ctx, -r * 0.55, -r * 0.92 - 14, r * 1.1, 14.5, 1.5, '#22223a', '#06060e', 1);
      roundRect(ctx, -r * 0.55, -r * 0.92 - 5, r * 1.1, L >= 3 ? 3.6 : 3, 0.5, L >= 3 ? GOLD : '#d8304a');
      drawStar(ctx, r * 0.15, -r * 0.92 - 9.5, L >= 5 ? 3.8 : 2.2, GOLD);
    },
    front: (ctx, g) => {
      const y = NY(g);
      const L = lv(g);
      const s = L >= 3 ? 1.45 : 1;
      const edge = L >= 3 ? GOLD : '#7a1020';
      poly(ctx, [0, y, -6 * s, y - 3 * s, -6 * s, y + 3 * s], '#d8304a', edge, L >= 3 ? 1.3 : 1);
      poly(ctx, [0, y, 6 * s, y - 3 * s, 6 * s, y + 3 * s], '#d8304a', edge, L >= 3 ? 1.3 : 1);
      circle(ctx, 0, y, 1.6 * s, GOLD);
    },
  },
  // Crimson Moon — ronin: hachimaki, haori, tattered cape → short sword → gold trim → straw hat on back → gold
  skin_sable_crimson: {
    covers: ['brow', 'side', 'neck', 'cape', 'chest'],
    back: (ctx, g) => {
      const L = lv(g);
      const s = sway(g);
      if (L >= 4) {
        // straw kasa hat slung on the back
        ctx.save();
        ctx.translate(-9, -11);
        ctx.rotate(-0.45);
        poly(ctx, [-17, 3, 0, -8, 17, 3], '#dcbc7c', '#8a6a3a', 1.1);
        ctx.strokeStyle = 'rgba(138,106,58,0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const x of [-8, 0, 8]) {
          ctx.moveTo(0, -6);
          ctx.lineTo(x, 3);
        }
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = L >= 5 ? GOLD : '#d02a3a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(6, -2);
        ctx.lineTo(-6, -9);
        ctx.stroke();
      }
      poly(ctx, [-9, -2, 9, -2, 15 + s, 18, 11 + s, 15, 7 + s, 18, 0, 15, -7 + s, 18, -11 + s, 15, -15 + s, 18], '#5a1a24', L >= 5 ? GOLD : '#2a0a10', L >= 5 ? 1.5 : 1.2);
    },
    body: (ctx, g) => {
      const L = lv(g);
      const trim = L >= 3 ? GOLD : undefined;
      poly(ctx, [-11, -1.5, -3, -1.5, 1, 13, -10, 12], '#8a2a34', trim ?? '#3a0a14', trim ? 1.5 : 1);
      poly(ctx, [11, -1.5, 3, -1.5, -1, 13, 10, 12], '#2a1a20', trim ?? '#0a0408', trim ? 1.5 : 1);
      roundRect(ctx, -10, 8.5, 20, 2.8, 1, L >= 5 ? GOLD : '#e8d8c0');
      if (L >= 2) {
        // short sword (wakizashi) tucked in the sash
        ctx.save();
        ctx.translate(-1, 10);
        ctx.rotate(-0.4);
        roundRect(ctx, -12, -1.6, 17, 3.2, 1.4, '#d8b080', '#6a4a24', 0.9);
        circle(ctx, 5.5, 0, 2.2, L >= 3 ? GOLD : '#9a9aa4', '#3a3a40', 0.7);
        roundRect(ctx, 6.5, -1.1, 6, 2.2, 0.8, '#d02a3a', '#5a0a14', 0.6);
        ctx.restore();
      }
    },
    head: (ctx, g) => {
      const L = lv(g);
      headband(ctx, g, '#d02a3a', L >= 5 ? GOLD : '#7a1020', 1);
      circle(ctx, 0, -g.r * 0.5, 2.2, L >= 5 ? GOLD : '#ffffff', '#7a1020', 0.6);
      circle(ctx, 0, -g.r * 0.5, 1.1, '#d02a3a');
    },
  },
  // Blossom Captain — flower wreath, leafy shawl → bellflower → rose & butterfly → rose epaulettes → golden blossoms
  skin_mallow_bloom: {
    covers: ['crown', 'neck', 'shoulder', 'cape'],
    back: (ctx, g) => {
      const L = lv(g);
      cape(ctx, g, '#4a9a5a', '#225a30', undefined, L >= 5 ? 1.15 : 1);
      if (L >= 5) for (const x of [-15, -7, 7, 15]) flower(ctx, x + sway(g) * 0.5, 16, 1.8, '#ff8ab4', GOLD);
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      const heart = L >= 5 ? GOLD : '#ffd84a';
      for (let i = -3; i <= 3; i++) {
        const a = Math.PI * 1.5 + i * 0.3;
        leaf(ctx, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92 - 0.5, a + Math.PI / 2, 4.5, '#5aa860');
      }
      for (let i = -2; i <= 2; i++) {
        const a = Math.PI * 1.5 + i * 0.36;
        flower(ctx, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95 - 0.5, 1.8, ['#ffb3d1', '#ffffff', '#ff8ab4', '#ffffff', '#ffb3d1'][i + 2], heart);
      }
      if (L >= 3) {
        // a big rose and a butterfly on the wreath
        flower(ctx, r * 0.78, -r * 0.82, 3.2, '#ff5a8a', heart);
        const wing = L >= 5 ? GOLD : '#8ac8ff';
        ellipse(ctx, -r * 0.95, -r * 1.05, 2.6, 2, wing, '#3a6a9a', 0.7);
        ellipse(ctx, -r * 0.62, -r * 1.12, 2.6, 2, wing, '#3a6a9a', 0.7);
        roundRect(ctx, -r * 0.82, -r * 1.2, 1, 3.6, 0.5, '#3a2a2a');
      }
    },
    front: (ctx, g) => {
      const y = NY(g);
      const L = lv(g);
      for (let i = -3; i <= 3; i++) leaf(ctx, i * 3, y - 1 + Math.abs(i) * 0.4, Math.PI / 2 + i * 0.25, 6, '#6ac070');
      if (L >= 2) {
        // pink bellflower hanging like Mallow's bell
        ctx.beginPath();
        ctx.moveTo(-4.6, y + 9);
        ctx.quadraticCurveTo(-4.4, y + 1.5, 0, y + 1.2);
        ctx.quadraticCurveTo(4.4, y + 1.5, 4.6, y + 9);
        ctx.quadraticCurveTo(0, y + 7.2, -4.6, y + 9);
        ctx.fillStyle = L >= 5 ? GOLD : '#e0407a';
        ctx.fill();
        ctx.strokeStyle = L >= 5 ? GOLD_EDGE : '#b04a74';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      flower(ctx, -5, y + 1, 1.6, '#ffb3d1', L >= 5 ? GOLD : '#ffd84a');
      flower(ctx, 5, y + 1, 1.6, '#ffffff', L >= 5 ? GOLD : '#ffd84a');
      if (L >= 4)
        for (const sx of [-1, 1]) {
          leaf(ctx, sx * 12.5, y - 1, sx > 0 ? 0.3 : Math.PI - 0.3, 5.5, '#4a9a50');
          flower(ctx, sx * 12, y - 2.5, 2.6, '#ff8ab4', L >= 5 ? GOLD : '#ffd84a');
        }
    },
  },
  // Thunder Pounce — visor, storm cape, bolt (+ storm-coloured scarf, wristbands, claw guards) → lightning
  skin_pounce_storm: {
    covers: ['brow', 'chest', 'cape'],
    tint: { scarf: '#2a2e38', scarfEdge: '#ffd84a', band: '#ffd84a', guard: '#fff27a', aura: 'rgba(255,230,90,0.32)' },
    back: (ctx, g) => {
      const L = lv(g);
      cape(ctx, g, '#2a2e38', '#101218', L >= 5 ? '#ffd84a' : undefined, L >= 5 ? 1.15 : 1);
      const s = sway(g);
      const bolt = (x: number, k: number) =>
        poly(ctx, [x + s, 4, x - 3 * k + s, 11, x + 1 * k + s, 10, x - 2 * k + s, 17, x + 4 * k + s, 8, x + 0 * k + s, 9], '#ffd84a');
      bolt(12, 1);
      if (L >= 5) bolt(-12, -1);
    },
    body: (ctx, g) => {
      const L = lv(g);
      roundRect(ctx, -8, -2, 16, 3, 1.4, '#2a2e38', '#101218', 0.9);
      const k = L >= 5 ? 1.35 : 1;
      if (L >= 5) {
        ctx.save();
        ctx.shadowColor = '#fff27a';
        ctx.shadowBlur = 5;
      }
      poly(ctx, [1 * k, 1 + 2, -3 * k, 7 * k + 2, 0, 7 * k + 2, -1.5 * k, 12 * k + 2, 3.5 * k, 5 * k + 2, 0.5 * k, 5 * k + 2, 2 * k, 1 + 2], '#ffd84a', GOLD_EDGE, 0.8);
      if (L >= 5) ctx.restore();
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      if (L >= 5) {
        ctx.save();
        ctx.shadowColor = '#fff27a';
        ctx.shadowBlur = 6;
      }
      roundRect(ctx, -r * 0.98, -r * 0.7, r * 1.96, 4, 1.8, '#2a2e38', '#101218', 0.9);
      poly(ctx, [-r * 0.9, -r * 0.42, r * 0.9, -r * 0.42, r * 1.3, -r * 0.15, -r * 0.2, -r * 0.18], '#ffd84a', '#a07a10', 0.9);
      const b = L >= 5 ? 1.4 : 1;
      poly(ctx, [1 * b, -r * 0.92 * b, -2 * b, -r * 0.6, 0, -r * 0.6, -1 * b, -r * 0.35, 2.5 * b, -r * 0.72, 0.5 * b, -r * 0.72], '#ffd84a');
      if (L >= 5) ctx.restore();
    },
  },
  // Neon Imp — glowing horns, bat wings, choker (+ neon pouch & vial) → huge wings → neon halo & heart tail
  skin_devil_neon: {
    covers: ['crown', 'side', 'neck', 'cape'],
    tint: { pouch: '#c060ff', vial: '#7affc0' },
    back: (ctx, g) => {
      const L = lv(g);
      const k = L >= 4 ? 1.4 : 1;
      const flap = Math.sin(g.t * 5) * 1.5;
      if (L >= 5) {
        ctx.save();
        ctx.shadowColor = '#7affc0';
        ctx.shadowBlur = 6;
      }
      for (const sg of [-1, 1])
        poly(
          ctx,
          [sg * 6, 0, sg * 19 * k, -6 * k - flap, sg * 20 * k, 4, sg * 16 * k, 2, sg * 15 * k, 9, sg * 11 * k, 6, sg * 9, 12],
          '#2a2436',
          '#7affc0',
          L >= 4 ? 1.5 : 1.1,
        );
      if (L >= 5) ctx.restore();
    },
    head: (ctx, g) => {
      const r = g.r;
      const L = lv(g);
      ctx.save();
      ctx.shadowColor = '#7affc0';
      ctx.shadowBlur = 4;
      for (const sg of [-1, 1]) poly(ctx, [sg * r * 0.25, -r * 0.88, sg * r * 0.62, -r * 0.7, sg * r * 0.72, -r * 1.55], '#7affc0', '#1a6a4a', 0.9);
      if (L >= 5) {
        ctx.strokeStyle = '#7affc0';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(0, -r * 1.75, r * 0.75, 2.6, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    },
    front: (ctx, g) => {
      const y = NY(g);
      const L = lv(g);
      roundRect(ctx, -7.5, y - 1.5, 15, 2.8, 1.2, '#1a1624', '#7affc0', 0.9);
      if (L >= 5) {
        ctx.save();
        ctx.shadowColor = '#7affc0';
        ctx.shadowBlur = 5;
      }
      drawHeart(ctx, 0, y + 3, L >= 5 ? 4.2 : 3, '#7affc0');
      if (L >= 5) ctx.restore();
    },
  },
};

/** Ids of every skin that has costume art (tests check every shop skin is covered). */
export const COSTUME_IDS = Object.keys(COSTUMES);

/** True when this costume puts something on the head (the shared cosmetic hat is hidden). */
export function costumeHasHeadwear(id: string | undefined): boolean {
  return !!(id && COSTUMES[id]?.head);
}

/** True when this costume replaces the default level gear in that slot with its own. */
export function costumeCovers(id: string | undefined, slot: Slot): boolean {
  return !!(id && COSTUMES[id]?.covers?.includes(slot));
}

/** Recolours for the default level gear this costume leaves visible. */
export function costumeTint(id: string | undefined): GearTint {
  return (id && COSTUMES[id]?.tint) || {};
}

export function drawCostume(ctx: Ctx, id: string | undefined, layer: CostumeLayer, g: CostumeGeom) {
  const paint = id ? COSTUMES[id]?.[layer] : undefined;
  if (!paint) return;
  ctx.save();
  paint(ctx, g);
  ctx.restore();
}
