// Skin costumes: real outfit pieces drawn on top of the cat (hats, capes, aprons, belts…),
// not just a recolour. Every skin in the shop has one. Three layers keep the outfit
// readable at battlefield size:
//   back — behind the body (capes, wings), drawn right after the tail
//   body — over the body and level gear (collars, aprons, belts, bibs), under the paws/head
//   head — on the head (hats, masks, headbands); replaces the cat's own head accessory
//          and the shared cosmetic hat, so two hats never stack
// Coordinates follow drawCat: body centred on (0,7) (≈12×10, ×fat for Orange), head drawn
// in its own frame centred on (0,0) with radius r, eyes at y≈-1, top of the head at -r.

import { TAU, circle, drawHeart, drawStar, ellipse, poly, roundRect, type Ctx } from './shapes';

export type CostumeLayer = 'back' | 'body' | 'head';

export interface CostumeGeom {
  /** Head radius (head layer). */
  r: number;
  /** Body width factor (Orange is 1.25). */
  fat: number;
  /** Time for small cloth sway. */
  t: number;
}

type Painter = (ctx: Ctx, g: CostumeGeom) => void;
type Costume = Partial<Record<CostumeLayer, Painter>>;

const sway = (g: CostumeGeom, k = 1) => Math.sin(g.t * 2.4) * 0.8 * k;

/** A cape hanging from the shoulders, peeking out on both sides of the body. */
function cape(ctx: Ctx, g: CostumeGeom, fill: string, edge: string, lining?: string) {
  const w = 15 * g.fat;
  const s = sway(g);
  poly(ctx, [-9 * g.fat, -2, 9 * g.fat, -2, w + s, 18, 0, 16, -w + s, 18], fill, edge, 1.3);
  if (lining) {
    poly(ctx, [w - 2 + s, 16.5, w + s, 18, 10 * g.fat, 4], lining);
    poly(ctx, [-w + 2 + s, 16.5, -w + s, 18, -10 * g.fat, 4], lining);
  }
}

/** A V-shaped collar/neckerchief tied at the neck. */
function kerchief(ctx: Ctx, fill: string, edge: string, depth = 8) {
  poly(ctx, [-8, -1.5, 8, -1.5, 0, depth], fill, edge, 1.1);
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

const COSTUMES: Record<string, Costume> = {
  // ------------------------------------------------------------------ regular
  // Calico Kitten — farm kid: straw hat + red bandana
  skin_calico: {
    body: (ctx) => {
      kerchief(ctx, '#e04848', '#9a2a2a', 9);
      for (const [x, y] of [
        [-3, 1],
        [3, 1],
        [0, 5],
      ])
        circle(ctx, x, y, 0.9, '#ffffff');
    },
    head: (ctx, g) => {
      const r = g.r;
      ellipse(ctx, 0, -r * 0.82, r * 1.18, 3.4, '#ecc86e', '#9a7a2a', 1.1);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.86, r * 0.62, r * 0.55, 0, Math.PI, TAU);
      ctx.fillStyle = '#f2d483';
      ctx.fill();
      ctx.strokeStyle = '#9a7a2a';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      roundRect(ctx, -r * 0.62, -r * 0.98, r * 1.24, 2.4, 1, '#e04848');
    },
  },
  // Silver Tabby — boxer in training: track-jacket collar + blue sweatband
  skin_silver: {
    body: (ctx) => {
      poly(ctx, [-9, -1.5, -1, -1.5, -1, 12, -10, 9], '#2f4f9a', '#18284f', 1.1);
      poly(ctx, [9, -1.5, 1, -1.5, 1, 12, 10, 9], '#2f4f9a', '#18284f', 1.1);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-7.5, -1);
      ctx.lineTo(-8.6, 8.4);
      ctx.moveTo(7.5, -1);
      ctx.lineTo(8.6, 8.4);
      ctx.stroke();
      roundRect(ctx, -0.8, 1, 1.6, 10, 0.6, '#d0d4dc');
    },
    head: (ctx, g) => {
      headband(ctx, g, '#3a6ad8', '#1a3a8a', 1);
      roundRect(ctx, -g.r * 0.98, -g.r * 0.5, g.r * 1.96, 1, 0.5, '#ffffff');
    },
  },
  // Cream Puff — baker: chef's toque, apron with pocket, red-white neckerchief
  skin_cream: {
    body: (ctx, g) => {
      const w = 8.5 * g.fat;
      roundRect(ctx, -w, 2, w * 2, 14, 3, '#ffffff', '#b0a090', 1.1);
      roundRect(ctx, -w * 0.45, 9, w * 0.9, 4.5, 1.2, '#f4ece0', '#b0a090', 0.9);
      ctx.strokeStyle = '#b0a090';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w, 4);
      ctx.lineTo(-12 * g.fat, 5);
      ctx.moveTo(w, 4);
      ctx.lineTo(12 * g.fat, 5);
      ctx.stroke();
      kerchief(ctx, '#e84a4a', '#9a2a2a', 6);
      circle(ctx, -2.5, 0.5, 0.8, '#ffffff');
      circle(ctx, 2.5, 0.5, 0.8, '#ffffff');
    },
    head: (ctx, g) => {
      const r = g.r;
      const y = -r * 0.95;
      roundRect(ctx, -r * 0.62, y - 4, r * 1.24, 5, 1.5, '#ffffff', '#a8a098', 1);
      for (const [x, dy, rr] of [
        [-r * 0.42, -6.5, 4.6],
        [r * 0.42, -6.5, 4.6],
        [0, -8.5, 5.2],
      ] as const)
        circle(ctx, x, y + dy, rr, '#ffffff', '#a8a098', 1);
      roundRect(ctx, -r * 0.6, y - 4.5, r * 1.2, 3, 1, '#ffffff');
    },
  },
  // Midnight Ninja — hood with forehead plate, face mask, sash with a throwing star
  skin_midnight: {
    body: (ctx) => {
      ctx.strokeStyle = '#141a30';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-9, 1);
      ctx.lineTo(8, 13);
      ctx.stroke();
      ctx.strokeStyle = '#3a4a80';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      drawStar(ctx, -5, 10, 3.2, '#c8d0e0', 4, 0.35);
      circle(ctx, -5, 10, 0.8, '#141a30');
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
      roundRect(ctx, -4, -r * 0.82, 8, 3.6, 1, '#b8c0d0', '#5a6478', 0.8);
      // lower face mask
      ctx.beginPath();
      ctx.moveTo(-r * 0.92, r * 0.15);
      ctx.quadraticCurveTo(0, r * 0.05, r * 0.92, r * 0.15);
      ctx.quadraticCurveTo(r * 0.7, r * 0.95, 0, r * 0.95);
      ctx.quadraticCurveTo(-r * 0.7, r * 0.95, -r * 0.92, r * 0.15);
      ctx.fillStyle = '#1a2242';
      ctx.fill();
      ctx.stroke();
      // knot tails
      const s = sway(g, 1.5);
      poly(ctx, [r * 0.9, -r * 0.5, r * 1.5, -r * 0.8 + s, r * 1.45, -r * 0.35 + s], '#1a2242', '#0c1020', 0.8);
    },
  },
  // Sakura Dream — kimono: crossed collar, wide obi, blossom hairpin with a dangle
  skin_sakura: {
    body: (ctx) => {
      poly(ctx, [-10, -1.5, 2, 9, -2, 12, -11, 6], '#ff9ac0', '#c04a7a', 1);
      poly(ctx, [10, -1.5, -2, 9, 2, 12, 11, 6], '#ffffff', '#c04a7a', 1);
      roundRect(ctx, -12, 8, 24, 5, 1.5, '#c0305a', '#7a1a3a', 1);
      roundRect(ctx, -12, 9.8, 24, 1.2, 0.5, '#ffd36a');
    },
    head: (ctx, g) => {
      const r = g.r;
      ctx.strokeStyle = '#7a4a2a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.95);
      ctx.lineTo(-r * 1.0, -r * 0.35);
      ctx.stroke();
      flower(ctx, -r * 0.62, -r * 0.88, 2.4, '#ff8ab4');
      flower(ctx, -r * 0.2, -r * 1.02, 1.8, '#ffc8dc');
      ctx.strokeStyle = '#d0a040';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, -r * 0.4);
      ctx.lineTo(-r * 1.0, r * 0.05);
      ctx.stroke();
      circle(ctx, -r * 1.0, r * 0.1, 1.4, '#ff8ab4');
    },
  },
  // Snowy Showman — winter outfit: striped bobble beanie + long striped scarf
  skin_whiskers_snow: {
    body: (ctx, g) => {
      roundRect(ctx, -10, -2, 20, 5, 2.4, '#d84a5a', '#8a2a34', 1);
      const s = sway(g, 1.5);
      poly(ctx, [4, 1, 9, 1, 11 + s, 14, 6 + s, 14], '#d84a5a', '#8a2a34', 1);
      ctx.fillStyle = '#ffffff';
      for (const y of [5, 9]) ctx.fillRect(6.6 + s * (y / 14), y, 4, 1.5);
      for (const x of [-6, 0]) ctx.fillRect(x, -2, 2, 5);
    },
    head: (ctx, g) => {
      const r = g.r;
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
      circle(ctx, 0, -r * 1.42, 3.2, '#ffffff', '#a0a4b4', 0.9);
    },
  },
  // Chocolate Point — musketeer: plumed wide-brim hat + white lace collar
  skin_sable_chocolate: {
    body: (ctx) => {
      for (let i = -3; i <= 3; i++) circle(ctx, i * 2.6, 0.4 + (3 - Math.abs(i)) * 0.7, 2.2, '#ffffff', '#b8a890', 0.7);
      circle(ctx, 0, 3.8, 1.6, '#c03a3a', '#6a1a1a', 0.7);
    },
    head: (ctx, g) => {
      const r = g.r;
      ctx.save();
      ctx.rotate(-0.12);
      ellipse(ctx, 0, -r * 0.85, r * 1.25, 3.4, '#5a3a28', '#2a1a10', 1.1);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.88, r * 0.62, r * 0.55, 0, Math.PI, TAU);
      ctx.fillStyle = '#6e4630';
      ctx.fill();
      ctx.strokeStyle = '#2a1a10';
      ctx.stroke();
      roundRect(ctx, -r * 0.62, -r * 1.0, r * 1.24, 2, 1, '#d9ad72');
      // plume
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r * 0.4, -r * 1.05);
      ctx.quadraticCurveTo(r * 1.2, -r * 1.7, r * 1.55, -r * 0.95 + sway(g));
      ctx.stroke();
      ctx.strokeStyle = '#c03a3a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    },
  },
  // Peach Captain — sailor: white sailor cap + navy sailor collar with a red knot
  skin_mallow_peach: {
    body: (ctx) => {
      poly(ctx, [-11, -2, 11, -2, 9, 7, 0, 10, -9, 7], '#2a3a7a', '#141c44', 1.1);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(-7.6, 5.6);
      ctx.lineTo(0, 8);
      ctx.lineTo(7.6, 5.6);
      ctx.lineTo(9, 0);
      ctx.stroke();
      poly(ctx, [-3, 7, 3, 7, 0, 11], '#e04848', '#8a2a2a', 0.8);
      poly(ctx, [-1, 10, -3, 15, 0, 13], '#e04848');
      poly(ctx, [1, 10, 3, 15, 0, 13], '#e04848');
    },
    head: (ctx, g) => {
      const r = g.r;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.86, r * 0.88, r * 0.45, 0, Math.PI, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#8a90a4';
      ctx.lineWidth = 1;
      ctx.stroke();
      roundRect(ctx, -r * 0.88, -r * 0.92, r * 1.76, 3.4, 1, '#2a3a7a');
      circle(ctx, 0, -r * 1.34, 1.8, '#e04848');
    },
  },
  // Ginger Sprinter — runner: sweatband + numbered race bib
  skin_pounce_ginger: {
    body: (ctx) => {
      roundRect(ctx, -6, 1, 12, 9, 1.2, '#ffffff', '#5a5a5a', 1);
      circle(ctx, -4.5, 2.4, 0.7, '#5a5a5a');
      circle(ctx, 4.5, 2.4, 0.7, '#5a5a5a');
      ctx.fillStyle = '#d84a3a';
      ctx.font = '900 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('7', 0, 6.2);
    },
    head: (ctx, g) => {
      headband(ctx, g, '#ffffff', '#8a8a8a', -1);
      roundRect(ctx, -g.r * 0.98, -g.r * 0.55, g.r * 1.96, 1.4, 0.6, '#2fa860');
    },
  },
  // Lilac Mischief — little witch: pointed hat with a buckle + big bow collar
  skin_devil_lilac: {
    body: (ctx) => {
      poly(ctx, [0, 0.5, -7, -3, -7, 4], '#b080e0', '#5a3a8a', 1);
      poly(ctx, [0, 0.5, 7, -3, 7, 4], '#b080e0', '#5a3a8a', 1);
      circle(ctx, 0, 0.5, 2, '#d0a8f8', '#5a3a8a', 0.9);
    },
    head: (ctx, g) => {
      const r = g.r;
      ellipse(ctx, 0, -r * 0.82, r * 1.15, 3, '#5a3a8a', '#2a1a48', 1);
      poly(ctx, [-r * 0.58, -r * 0.85, r * 0.58, -r * 0.85, r * 0.3, -r * 1.7, r * 0.75, -r * 2.05], '#6a4a9a', '#2a1a48', 1);
      roundRect(ctx, -r * 0.55, -r * 1.1, r * 1.05, 2.6, 0.8, '#b080e0');
      roundRect(ctx, -1.8, -r * 1.12, 3.6, 3, 0.6, '#ffd36a', '#a07a10', 0.6);
    },
  },

  // ------------------------------------------------------------------ special
  // Starlight Kitten — little wizard: starry pointed hat + star cape
  skin_kitten_star: {
    back: (ctx, g) => {
      cape(ctx, g, '#2a3a8a', '#141c48', '#ffd36a');
      drawStar(ctx, -12, 12, 2, '#ffe066');
      drawStar(ctx, 12.5, 10, 1.6, '#ffe066');
    },
    body: (ctx) => {
      roundRect(ctx, -8, -2, 16, 3, 1.4, '#2a3a8a', '#141c48', 0.9);
      drawStar(ctx, 0, -0.5, 3, '#ffd84a');
    },
    head: (ctx, g) => {
      const r = g.r;
      ellipse(ctx, 0, -r * 0.82, r * 1.05, 3, '#2a3a8a', '#141c48', 1);
      poly(ctx, [-r * 0.6, -r * 0.85, r * 0.6, -r * 0.85, r * 0.2, -r * 1.75, -r * 0.35, -r * 2.05], '#3a4aa8', '#141c48', 1);
      drawStar(ctx, -r * 0.35, -r * 2.05, 3, '#ffe066');
      drawStar(ctx, r * 0.05, -r * 1.2, 2, '#ffe066');
      drawStar(ctx, -r * 0.3, -r * 1.45, 1.4, '#ffffff');
    },
  },
  // Golden Champion — prize fighter: red robe, golden title belt, laurel crown
  skin_tabby_champion: {
    back: (ctx, g) => cape(ctx, g, '#c8303a', '#6a1018', '#ffd36a'),
    body: (ctx) => {
      roundRect(ctx, -12.5, 8, 25, 4.5, 1.5, '#b02a30', '#5a1018', 1);
      ellipse(ctx, 0, 10.2, 5.5, 4, '#ffd84a', '#a07a10', 1.1);
      drawStar(ctx, 0, 10.2, 2.4, '#e04848');
      // robe lapels
      poly(ctx, [-9, -1.5, -2, -1.5, -5, 7], '#c8303a', '#6a1018', 1);
      poly(ctx, [9, -1.5, 2, -1.5, 5, 7], '#c8303a', '#6a1018', 1);
    },
    head: (ctx, g) => {
      const r = g.r;
      for (const s of [-1, 1])
        for (let i = 0; i < 4; i++) {
          const a = Math.PI * (1.5 + s * (0.12 + i * 0.12));
          leaf(ctx, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92 - 1, a + (s * Math.PI) / 2, 5.5, '#4a9a50');
        }
      circle(ctx, 0, -r * 0.98, 1.6, '#e04848', '#8a2a2a', 0.6);
    },
  },
  // Grand Sumo — topknot + thick mawashi belt with hanging tassels
  skin_orange_sumo: {
    body: (ctx, g) => {
      const w = 12.5 * g.fat;
      roundRect(ctx, -w, 9, w * 2, 5.5, 2, '#3a4aa0', '#1a2050', 1.1);
      roundRect(ctx, -4, 8, 8, 8, 1.5, '#3a4aa0', '#1a2050', 1);
      ctx.strokeStyle = '#e8e0f8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const x of [-3, -1, 1, 3]) {
        ctx.moveTo(x, 14);
        ctx.lineTo(x, 19);
      }
      ctx.stroke();
    },
    head: (ctx, g) => {
      const r = g.r;
      ellipse(ctx, 0, -r * 0.92, r * 0.55, 3, '#2a2a3a', '#101018', 1);
      ellipse(ctx, 0, -r * 1.16, 3.6, 3.2, '#2a2a3a', '#101018', 1);
      roundRect(ctx, -2.6, -r * 1.02, 5.2, 1.5, 0.6, '#ffffff');
    },
  },
  // Frost Sniper — night sniper: tilted beret, scope goggle, tactical vest, cape
  skin_black_frost: {
    back: (ctx, g) => cape(ctx, g, '#1e2a3c', '#0c121c', '#8fe8ff'),
    body: (ctx) => {
      roundRect(ctx, -9, 0, 18, 11, 3, '#3a4a3e', '#18201a', 1.1);
      roundRect(ctx, -7, 6, 5, 4, 1, '#4e6050', '#18201a', 0.8);
      roundRect(ctx, 2, 6, 5, 4, 1, '#4e6050', '#18201a', 0.8);
      ctx.strokeStyle = '#8fe8ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, 1);
      ctx.lineTo(-6, 5);
      ctx.moveTo(6, 1);
      ctx.lineTo(6, 5);
      ctx.stroke();
    },
    head: (ctx, g) => {
      const r = g.r;
      ctx.save();
      ctx.rotate(-0.25);
      ellipse(ctx, -1, -r * 0.85, r * 0.95, r * 0.36, '#1e2a3c', '#0c121c', 1);
      circle(ctx, -1, -r * 1.2, 1.4, '#1e2a3c');
      roundRect(ctx, -r * 0.4, -r * 0.82, 5, 2.2, 0.6, '#8fe8ff');
      ctx.restore();
      // scope goggle over the aiming eye
      ctx.strokeStyle = '#2a3440';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(r * 0.98, -r * 0.2);
      ctx.lineTo(r * 0.65, -1);
      ctx.stroke();
      circle(ctx, r * 0.4, -1, 3.8, 'rgba(143,232,255,0.35)', '#2a3440', 1.6);
      circle(ctx, r * 0.4 + 1, -2, 0.9, '#ffffff');
    },
  },
  // Moonlight Princess — royal: crescent-moon tiara, starry cape, moonstone pendant
  skin_white_moon: {
    back: (ctx, g) => {
      cape(ctx, g, '#7a6ac8', '#3a2a7a', '#e8e0ff');
      drawStar(ctx, -13, 13, 1.6, '#ffffff');
      drawStar(ctx, 13, 11, 1.4, '#ffffff');
    },
    body: (ctx) => {
      ctx.strokeStyle = '#c8c0e8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, -1);
      ctx.quadraticCurveTo(0, 5, 6, -1);
      ctx.stroke();
      circle(ctx, 0, 3.6, 2.4, '#e8e0ff', '#7a6ac8', 1);
    },
    head: (ctx, g) => {
      const r = g.r;
      poly(ctx, [-r * 0.6, -r * 0.8, -r * 0.3, -r * 1.02, r * 0.3, -r * 1.02, r * 0.6, -r * 0.8], '#e0e4f0', '#8a8ab0', 1);
      ctx.beginPath();
      ctx.arc(0, -r * 1.18, 4, Math.PI * 0.2, Math.PI * 1.8);
      ctx.arc(1.6, -r * 1.18, 3.2, Math.PI * 1.75, Math.PI * 0.25, true);
      ctx.closePath();
      ctx.fillStyle = '#ffe680';
      ctx.fill();
      ctx.strokeStyle = '#b0902a';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      circle(ctx, -r * 0.3, -r * 0.92, 1, '#b8a8ff');
      circle(ctx, r * 0.3, -r * 0.92, 1, '#b8a8ff');
    },
  },
  // Gala Magician — tall top hat with red band, black cape with red lining, red bow tie
  skin_whiskers_gala: {
    back: (ctx, g) => cape(ctx, g, '#16162a', '#06060e', '#d8304a'),
    body: (ctx) => {
      poly(ctx, [0, 1, -6, -2.5, -6, 4.5], '#d8304a', '#7a1020', 1);
      poly(ctx, [0, 1, 6, -2.5, 6, 4.5], '#d8304a', '#7a1020', 1);
      circle(ctx, 0, 1, 1.6, '#ffd36a');
    },
    head: (ctx, g) => {
      const r = g.r;
      roundRect(ctx, -r * 0.95, -r * 0.92, r * 1.9, 3, 1.4, '#16162a', '#06060e', 1);
      roundRect(ctx, -r * 0.55, -r * 0.92 - 14, r * 1.1, 14.5, 1.5, '#22223a', '#06060e', 1);
      roundRect(ctx, -r * 0.55, -r * 0.92 - 4.5, r * 1.1, 3, 0.5, '#d8304a');
      drawStar(ctx, r * 0.15, -r * 0.92 - 9, 2.2, '#ffd36a');
    },
  },
  // Crimson Moon — ronin: red hachimaki, red-black haori collar, tattered cape
  skin_sable_crimson: {
    back: (ctx, g) => {
      const s = sway(g);
      poly(ctx, [-9, -2, 9, -2, 15 + s, 18, 11 + s, 15, 7 + s, 18, 0, 15, -7 + s, 18, -11 + s, 15, -15 + s, 18], '#5a1a24', '#2a0a10', 1.2);
    },
    body: (ctx) => {
      poly(ctx, [-11, -1.5, -3, -1.5, 1, 13, -10, 12], '#8a2a34', '#3a0a14', 1);
      poly(ctx, [11, -1.5, 3, -1.5, -1, 13, 10, 12], '#2a1a20', '#0a0408', 1);
      roundRect(ctx, -10, 8.5, 20, 2.5, 1, '#e8d8c0');
    },
    head: (ctx, g) => {
      headband(ctx, g, '#d02a3a', '#7a1020', 1);
      circle(ctx, 0, -g.r * 0.5, 2, '#ffffff', '#7a1020', 0.6);
      circle(ctx, 0, -g.r * 0.5, 1.1, '#d02a3a');
    },
  },
  // Blossom Captain — garden: flower wreath + leafy shawl with blossoms
  skin_mallow_bloom: {
    back: (ctx, g) => cape(ctx, g, '#4a9a5a', '#225a30'),
    body: (ctx) => {
      for (let i = -3; i <= 3; i++) leaf(ctx, i * 3, 0.5 + Math.abs(i) * 0.4, Math.PI / 2 + i * 0.25, 6, '#6ac070');
      flower(ctx, -5, 2.5, 1.6, '#ffb3d1');
      flower(ctx, 5, 2.5, 1.6, '#ffffff');
      flower(ctx, 0, 4, 1.9, '#ff8ab4');
    },
    head: (ctx, g) => {
      const r = g.r;
      for (let i = -3; i <= 3; i++) {
        const a = Math.PI * 1.5 + i * 0.3;
        const x = Math.cos(a) * r * 0.92;
        const y = Math.sin(a) * r * 0.92 - 0.5;
        leaf(ctx, x, y, a + Math.PI / 2, 4.5, '#5aa860');
      }
      for (let i = -2; i <= 2; i++) {
        const a = Math.PI * 1.5 + i * 0.36;
        flower(ctx, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95 - 0.5, 1.8, ['#ffb3d1', '#ffffff', '#ff8ab4', '#ffffff', '#ffb3d1'][i + 2]);
      }
    },
  },
  // Thunder Pounce — storm runner: yellow visor with a bolt, storm cape, bolt emblem
  skin_pounce_storm: {
    back: (ctx, g) => {
      cape(ctx, g, '#2a2e38', '#101218');
      const s = sway(g);
      poly(ctx, [12 + s, 4, 9 + s, 11, 13 + s, 10, 10 + s, 17, 16 + s, 8, 12 + s, 9], '#ffd84a');
    },
    body: (ctx) => {
      roundRect(ctx, -8, -2, 16, 3, 1.4, '#2a2e38', '#101218', 0.9);
      poly(ctx, [1, 1, -3, 7, 0, 7, -1.5, 12, 3.5, 5, 0.5, 5, 2, 1], '#ffd84a', '#a07a10', 0.8);
    },
    head: (ctx, g) => {
      const r = g.r;
      roundRect(ctx, -r * 0.98, -r * 0.7, r * 1.96, 4, 1.8, '#2a2e38', '#101218', 0.9);
      poly(ctx, [-r * 0.9, -r * 0.42, r * 0.9, -r * 0.42, r * 1.3, -r * 0.15, -r * 0.2, -r * 0.18], '#ffd84a', '#a07a10', 0.9);
      poly(ctx, [1, -r * 0.92, -2, -r * 0.6, 0, -r * 0.6, -1, -r * 0.35, 2.5, -r * 0.72, 0.5, -r * 0.72], '#ffd84a');
    },
  },
  // Neon Imp — glowing horns + bat-wing cape + neon choker
  skin_devil_neon: {
    back: (ctx, g) => {
      const flap = Math.sin(g.t * 5) * 1.5;
      for (const sg of [-1, 1])
        poly(ctx, [sg * 6, 0, sg * 19, -6 - flap, sg * 20, 4, sg * 16, 2, sg * 15, 9, sg * 11, 6, sg * 9, 12], '#2a2436', '#7affc0', 1.1);
    },
    body: (ctx) => {
      roundRect(ctx, -7, -1.5, 14, 2.6, 1.2, '#1a1624', '#7affc0', 0.9);
      drawHeart(ctx, 0, 3.4, 3, '#7affc0');
    },
    head: (ctx, g) => {
      const r = g.r;
      ctx.save();
      ctx.shadowColor = '#7affc0';
      ctx.shadowBlur = 4;
      for (const sg of [-1, 1]) poly(ctx, [sg * r * 0.25, -r * 0.88, sg * r * 0.62, -r * 0.7, sg * r * 0.72, -r * 1.55], '#7affc0', '#1a6a4a', 0.9);
      ctx.restore();
    },
  },
};

/** Ids of every skin that has costume art (tests check every shop skin is covered). */
export const COSTUME_IDS = Object.keys(COSTUMES);

/** True when this costume puts something on the head (the cat's own head accessory and the hat are hidden). */
export function costumeHasHeadwear(id: string | undefined): boolean {
  return !!(id && COSTUMES[id]?.head);
}

export function drawCostume(ctx: Ctx, id: string | undefined, layer: CostumeLayer, g: CostumeGeom) {
  const paint = id ? COSTUMES[id]?.[layer] : undefined;
  if (!paint) return;
  ctx.save();
  paint(ctx, g);
  ctx.restore();
}
