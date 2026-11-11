// Character backgrounds for the Cat Encyclopedia (collection cards + profile pages).
//
// Every cat owns one location in the same storybook world. The scene is built from layers and
// grows with the cat's PERMANENT star rank (1★–5★, never the in-battle Lv.):
//   1★ simple    — sky, ground and one or two shapes that name the place; soft light
//   2★ props     — small themed props and decorations
//   3★ special   — a motif of the cat's Special Ability
//   4★ grand     — a back layer of scenery, richer detail and warmer, layered lighting
//   5★ ultimate  — the Ultimate Ability's signature element + a collectible-card frame
// Each cat is one data entry (palettes + back / mid / front painters that check `star`), so a
// new cat only needs a new entry; unknown ids fall back to a neutral meadow.
// The same painter serves both themes: Original Light paints the place by day, Moonlit Gothic
// by night. Scenes are static (drawn once per size, cached) for mobile performance.

import type { CatId } from '../game/types';
import type { ThemeId } from '../theme';
import { TAU, circle, drawHeart, drawStar, ellipse, poly, roundRect, type Ctx } from './shapes';

export interface ScenePalette {
  skyTop: string;
  skyBottom: string;
  /** Distant scenery (hills, walls, rooftops). */
  far: string;
  /** Nearer scenery. */
  mid: string;
  ground: string;
  ground2: string;
  /** The place's signature colour (flags, cloth, potions …). */
  accent: string;
  accent2: string;
  /** Warm lamp / magic light. */
  glow: string;
  wood: string;
  stone: string;
}

export interface SceneCtx {
  c: Ctx;
  w: number;
  h: number;
  /** One "unit" = 1% of the scene height (sizes scale with the crop). */
  u: number;
  star: number;
  night: boolean;
  p: ScenePalette;
  /** Hand-drawn outline colour for the theme. */
  line: string;
  /** Horizon / floor line (px). */
  gy: number;
  rnd: () => number;
}

interface SceneDef {
  light: ScenePalette;
  moonlit: ScenePalette;
  /** Behind the ground (sky objects, distant scenery). */
  back?: (s: SceneCtx) => void;
  /** On the ground, behind the cat. */
  mid?: (s: SceneCtx) => void;
  /** Foreground details at the edges (never over the cat's centre). */
  front?: (s: SceneCtx) => void;
  /** Where the floor starts (fraction of height). */
  ground?: number;
}

// ---------------------------------------------------------------------------
// Small reusable painters
// ---------------------------------------------------------------------------

function rng(seed: number): () => number {
  let x = seed | 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

const lw = (s: SceneCtx, k = 1) => Math.max(1, s.u * 0.55 * k);

function skyStars(s: SceneCtx, n: number, color = '#fff6d8') {
  if (!s.night) return;
  const r = rng(77);
  s.c.globalAlpha = 0.75;
  for (let i = 0; i < n; i++) circle(s.c, r() * s.w, r() * s.gy * 0.7, s.u * (0.35 + r() * 0.5), color);
  s.c.globalAlpha = 1;
}

/** Sun by day, moon by night. */
function skyLight(s: SceneCtx, x: number, y: number, r: number) {
  const c = s.c;
  const g = c.createRadialGradient(x, y, r * 0.4, x, y, r * 3);
  g.addColorStop(0, s.night ? 'rgba(255,244,210,0.35)' : 'rgba(255,245,200,0.6)');
  g.addColorStop(1, 'rgba(255,245,200,0)');
  c.fillStyle = g;
  c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  circle(c, x, y, r, s.night ? '#fff1c9' : '#ffe9a0');
  if (s.night) circle(c, x + r * 0.35, y - r * 0.2, r * 0.82, s.p.skyTop); // crescent
}

function cloud(s: SceneCtx, x: number, y: number, k: number) {
  const c = s.c;
  const col = s.night ? 'rgba(200,190,240,0.25)' : 'rgba(255,255,255,0.85)';
  ellipse(c, x, y, 9 * k * s.u, 4 * k * s.u, col);
  ellipse(c, x - 6 * k * s.u, y + 1.5 * k * s.u, 6 * k * s.u, 3 * k * s.u, col);
  ellipse(c, x + 6 * k * s.u, y + 1.5 * k * s.u, 6 * k * s.u, 3 * k * s.u, col);
}

function hill(s: SceneCtx, x: number, w: number, h: number, color: string) {
  const c = s.c;
  c.beginPath();
  c.moveTo(x - w / 2, s.gy + 1);
  c.quadraticCurveTo(x, s.gy - h * 2, x + w / 2, s.gy + 1);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function bush(s: SceneCtx, x: number, y: number, k: number, color: string) {
  const r = 4 * k * s.u;
  for (const [dx, dy, rr] of [
    [-0.8, 0.2, 0.8],
    [0.8, 0.2, 0.8],
    [0, -0.3, 1],
  ])
    circle(s.c, x + dx * r, y + dy * r, rr * r, color, s.line, lw(s, 0.6));
}

function flower(s: SceneCtx, x: number, y: number, k: number, petal: string) {
  const c = s.c;
  c.strokeStyle = s.night ? '#5f8f6a' : '#4f9a52';
  c.lineWidth = lw(s, 0.6);
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y + 4 * k * s.u);
  c.stroke();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    circle(c, x + Math.cos(a) * 1.4 * k * s.u, y + Math.sin(a) * 1.4 * k * s.u, 1.1 * k * s.u, petal);
  }
  circle(c, x, y, 0.9 * k * s.u, '#ffd34d');
}

function tree(s: SceneCtx, x: number, k: number, leaf: string) {
  const c = s.c;
  const u = s.u * k;
  roundRect(c, x - 2 * u, s.gy - 16 * u, 4 * u, 17 * u, u, s.p.wood, s.line, lw(s, 0.6));
  circle(c, x, s.gy - 20 * u, 9 * u, leaf, s.line, lw(s, 0.6));
  circle(c, x - 6 * u, s.gy - 15 * u, 6 * u, leaf, s.line, lw(s, 0.6));
  circle(c, x + 6 * u, s.gy - 15 * u, 6 * u, leaf, s.line, lw(s, 0.6));
}

function fence(s: SceneCtx, x0: number, x1: number, color: string) {
  const c = s.c;
  const y = s.gy - 5 * s.u;
  c.fillStyle = color;
  c.fillRect(x0, y + 1.5 * s.u, x1 - x0, 1.2 * s.u);
  for (let x = x0; x <= x1; x += 4.5 * s.u) poly(c, [x, s.gy + s.u, x, y, x + 1.2 * s.u, y - 1.5 * s.u, x + 2.4 * s.u, y, x + 2.4 * s.u, s.gy + s.u], color, s.line, lw(s, 0.45));
}

function bunting(s: SceneCtx, x0: number, y0: number, x1: number, y1: number, colors: string[]) {
  const c = s.c;
  const sag = 6 * s.u;
  c.strokeStyle = s.line;
  c.lineWidth = lw(s, 0.5);
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
  c.stroke();
  const n = 9;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2) + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + sag * 2) + t * t * y1;
    poly(c, [x - 1.6 * s.u, y, x + 1.6 * s.u, y, x, y + 3.6 * s.u], colors[i % colors.length], s.line, lw(s, 0.35));
  }
}

function lantern(s: SceneCtx, x: number, y: number, k: number, color: string) {
  const c = s.c;
  const u = s.u * k;
  const g = c.createRadialGradient(x, y, 0, x, y, 9 * u);
  g.addColorStop(0, s.night ? 'rgba(255,215,130,0.55)' : 'rgba(255,230,160,0.35)');
  g.addColorStop(1, 'rgba(255,215,130,0)');
  c.fillStyle = g;
  c.fillRect(x - 9 * u, y - 9 * u, 18 * u, 18 * u);
  roundRect(c, x - 2 * u, y - 2.6 * u, 4 * u, 5.2 * u, 1.4 * u, color, s.line, lw(s, 0.5));
  c.fillStyle = s.line;
  c.fillRect(x - 1.2 * u, y - 3.4 * u, 2.4 * u, 0.9 * u);
}

function archWindow(s: SceneCtx, x: number, y: number, w: number, h: number, lit: boolean) {
  const c = s.c;
  c.beginPath();
  c.moveTo(x - w / 2, y + h);
  c.lineTo(x - w / 2, y + w / 2);
  c.arc(x, y + w / 2, w / 2, Math.PI, 0);
  c.lineTo(x + w / 2, y + h);
  c.closePath();
  c.fillStyle = lit ? (s.night ? '#ffd98a' : '#cfe9ff') : s.p.far;
  c.fill();
  c.lineWidth = lw(s, 0.5);
  c.strokeStyle = s.line;
  c.stroke();
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y + h);
  c.moveTo(x - w / 2, y + h * 0.55);
  c.lineTo(x + w / 2, y + h * 0.55);
  c.stroke();
}

function crenellatedWall(s: SceneCtx, x0: number, x1: number, top: number, color: string) {
  const c = s.c;
  c.fillStyle = color;
  c.fillRect(x0, top, x1 - x0, s.gy - top + 1);
  const m = 4 * s.u;
  for (let x = x0; x < x1; x += m * 2) c.fillRect(x, top - m * 0.8, m, m * 0.8);
}

function tower(s: SceneCtx, x: number, w: number, top: number, color: string, roof: string) {
  const c = s.c;
  roundRect(c, x - w / 2, top, w, s.gy - top + 1, 0, color, s.line, lw(s, 0.5));
  poly(c, [x - w * 0.65, top, x + w * 0.65, top, x, top - w * 1.1], roof, s.line, lw(s, 0.5));
  archWindow(s, x, top + w * 0.5, w * 0.35, w * 0.6, s.night);
}

function rooftops(s: SceneCtx, color: string, base: number) {
  const c = s.c;
  const r = rng(11);
  let x = -2 * s.u;
  c.fillStyle = color;
  while (x < s.w) {
    const bw = (10 + r() * 12) * s.u;
    const bh = base + r() * 12 * s.u;
    c.fillRect(x, s.gy - bh, bw, bh + 1);
    if (r() > 0.4) poly(c, [x - s.u, s.gy - bh, x + bw + s.u, s.gy - bh, x + bw / 2, s.gy - bh - 6 * s.u], color);
    if (r() > 0.6) c.fillRect(x + bw * 0.7, s.gy - bh - 8 * s.u, 2.5 * s.u, 6 * s.u);
    x += bw + r() * 3 * s.u;
  }
}

function pawPrint(s: SceneCtx, x: number, y: number, k: number, color: string) {
  const u = s.u * k;
  ellipse(s.c, x, y, 1.6 * u, 1.3 * u, color);
  for (const [dx, dy] of [
    [-1.6, -1.6],
    [-0.55, -2.3],
    [0.55, -2.3],
    [1.6, -1.6],
  ])
    circle(s.c, x + dx * u, y + dy * u, 0.6 * u, color);
}

function tiledFloor(s: SceneCtx, line: string) {
  const c = s.c;
  const fh = s.h - s.gy;
  c.strokeStyle = line;
  c.lineWidth = lw(s, 0.4);
  c.beginPath();
  for (const f of [0.22, 0.5, 0.82]) {
    c.moveTo(0, s.gy + fh * f);
    c.lineTo(s.w, s.gy + fh * f);
  }
  for (let i = -6; i <= 6; i++) {
    c.moveTo(s.w / 2 + i * s.w * 0.06, s.gy);
    c.lineTo(s.w / 2 + i * s.w * 0.16, s.h);
  }
  c.stroke();
}

function curtain(s: SceneCtx, left: boolean, color: string, trim: string) {
  const c = s.c;
  const x0 = left ? 0 : s.w;
  const dir = left ? 1 : -1;
  const wdt = s.w * 0.17;
  c.beginPath();
  c.moveTo(x0, 0);
  c.lineTo(x0 + dir * wdt, 0);
  c.quadraticCurveTo(x0 + dir * wdt * 0.35, s.h * 0.45, x0 + dir * wdt * 0.8, s.h);
  c.lineTo(x0, s.h);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = trim;
  c.lineWidth = lw(s, 1.2);
  c.stroke();
  // folds
  c.strokeStyle = 'rgba(0,0,0,0.18)';
  c.lineWidth = lw(s, 0.7);
  for (const f of [0.35, 0.65]) {
    c.beginPath();
    c.moveTo(x0 + dir * wdt * f, 0);
    c.quadraticCurveTo(x0 + dir * wdt * f * 0.4, s.h * 0.5, x0 + dir * wdt * f * 0.9, s.h);
    c.stroke();
  }
}

function lightRays(s: SceneCtx, x: number, y: number, color: string, n = 5, spread = 0.9) {
  const c = s.c;
  c.save();
  c.globalAlpha = s.night ? 0.16 : 0.22;
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + ((i - (n - 1) / 2) / n) * spread;
    const len = s.h * 1.2;
    const wa = 0.05;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a - wa) * len, y + Math.sin(a - wa) * len);
    c.lineTo(x + Math.cos(a + wa) * len, y + Math.sin(a + wa) * len);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/** `#rrggbb` → `rgba(r,g,b,a)` (gradients must fade to the SAME colour, or they go grey). */
export function rgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function glowAt(s: SceneCtx, x: number, y: number, r: number, color: string, a = 0.5) {
  const c = s.c;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(1, rgba(color, 0));
  c.save();
  c.globalAlpha = a;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

// ---------------------------------------------------------------------------
// The ten locations
// ---------------------------------------------------------------------------

const P = (o: ScenePalette) => o;

export const CAT_SCENES: Partial<Record<CatId, SceneDef>> = {
  // Kitten — a cozy adventurer's garden. Special: Brave Yarn. Ultimate: Heroic Burst.
  kitten: {
    light: P({ skyTop: '#9fd8ff', skyBottom: '#e6f6ff', far: '#b7e3a0', mid: '#8fcf7a', ground: '#9edc7f', ground2: '#83c968', accent: '#ff8a5c', accent2: '#ffd166', glow: '#fff1b8', wood: '#b9824f', stone: '#d9d2c3' }),
    moonlit: P({ skyTop: '#2b2f5e', skyBottom: '#4a4f86', far: '#3f5d55', mid: '#4c7462', ground: '#4f7a5d', ground2: '#43684f', accent: '#ff9d76', accent2: '#ffd98a', glow: '#ffe1a0', wood: '#7a5a42', stone: '#7d7890' }),
    back: (s) => {
      skyLight(s, s.w * 0.82, s.h * 0.16, 6 * s.u);
      skyStars(s, 18);
      cloud(s, s.w * 0.22, s.h * 0.18, 1);
      hill(s, s.w * 0.2, s.w * 0.7, 14 * s.u, s.p.far);
      hill(s, s.w * 0.85, s.w * 0.6, 10 * s.u, s.p.far);
      if (s.star >= 4) {
        hill(s, s.w * 0.55, s.w * 0.6, 18 * s.u, s.p.mid);
        tree(s, s.w * 0.9, 1.1, s.p.mid);
      }
      if (s.star >= 5) {
        // Heroic Burst: the hero's banner on the hilltop, bursting with light.
        lightRays(s, s.w * 0.15, s.gy - 26 * s.u, s.p.accent2, 9, 2.6);
        const x = s.w * 0.15;
        s.c.fillStyle = s.line;
        s.c.fillRect(x, s.gy - 36 * s.u, 1.2 * s.u, 22 * s.u);
        poly(s.c, [x + 1.2 * s.u, s.gy - 36 * s.u, x + 13 * s.u, s.gy - 32 * s.u, x + 1.2 * s.u, s.gy - 27 * s.u], s.p.accent, s.line, lw(s, 0.5));
        drawStar(s.c, x + 5.5 * s.u, s.gy - 31.8 * s.u, 1.8 * s.u, s.p.accent2);
      }
    },
    mid: (s) => {
      bush(s, s.w * 0.08, s.gy, 1, s.p.mid);
      bush(s, s.w * 0.93, s.gy + s.u, 0.9, s.p.mid);
      if (s.star >= 2) {
        // A little signpost and garden flowers.
        const x = s.w * 0.84;
        roundRect(s.c, x - 0.8 * s.u, s.gy - 13 * s.u, 1.6 * s.u, 14 * s.u, 0.4 * s.u, s.p.wood, s.line, lw(s, 0.5));
        poly(s.c, [x - 6 * s.u, s.gy - 13 * s.u, x + 5 * s.u, s.gy - 13 * s.u, x + 7 * s.u, s.gy - 10.5 * s.u, x + 5 * s.u, s.gy - 8 * s.u, x - 6 * s.u, s.gy - 8 * s.u], s.p.wood, s.line, lw(s, 0.5));
        for (const [fx, col] of [
          [0.16, s.p.accent],
          [0.22, s.p.accent2],
          [0.74, '#ff9ecb'],
        ] as const)
          flower(s, s.w * fx, s.gy + 3 * s.u, 1, col);
      }
      if (s.star >= 4) fence(s, s.w * 0.02, s.w * 0.26, s.night ? '#c8b9a6' : '#fff7e8');
    },
    front: (s) => {
      if (s.star >= 3) {
        // Brave Yarn: a ball of yarn rolling past with its thread trailing behind.
        const x = s.w * 0.24;
        const y = s.h * 0.9;
        s.c.strokeStyle = s.p.accent;
        s.c.lineWidth = lw(s, 0.8);
        s.c.beginPath();
        s.c.moveTo(x, y);
        s.c.bezierCurveTo(x - 8 * s.u, y - 6 * s.u, x - 12 * s.u, y + 4 * s.u, x - 22 * s.u, y - 2 * s.u);
        s.c.stroke();
        circle(s.c, x, y, 4.5 * s.u, s.p.accent, s.line, lw(s, 0.6));
        s.c.strokeStyle = 'rgba(255,255,255,0.55)';
        for (const a of [-0.6, 0, 0.6]) {
          s.c.beginPath();
          s.c.ellipse(x, y, 4.5 * s.u, 1.8 * s.u, a, 0, TAU);
          s.c.stroke();
        }
      }
      if (s.star >= 5) {
        lantern(s, s.w * 0.06, s.h * 0.3, 1, s.p.accent2);
        lantern(s, s.w * 0.94, s.h * 0.34, 1, s.p.accent2);
      }
    },
  },

  // Tabby Warrior — a forest training ground. Special: Finishing Blow. Ultimate: Hundred-Paw Flurry.
  tabby: {
    light: P({ skyTop: '#a6dcc8', skyBottom: '#eaf7e9', far: '#6fae7e', mid: '#4f9466', ground: '#c9a66b', ground2: '#b8925a', accent: '#d9534f', accent2: '#f2c14e', glow: '#fff0c2', wood: '#9a6a3f', stone: '#b5ad9c' }),
    moonlit: P({ skyTop: '#1f3340', skyBottom: '#355063', far: '#24463d', mid: '#2f5a4a', ground: '#6c5a45', ground2: '#5c4c3a', accent: '#e06a66', accent2: '#f3cf72', glow: '#ffd88a', wood: '#6b4d36', stone: '#6d6a78' }),
    back: (s) => {
      skyStars(s, 14);
      skyLight(s, s.w * 0.15, s.h * 0.14, 5 * s.u);
      // Pine forest wall.
      const r = rng(5);
      for (let i = 0; i < 9; i++) {
        const x = (i / 8) * s.w + (r() - 0.5) * 6 * s.u;
        const ht = (24 + r() * 10) * s.u;
        poly(s.c, [x - 7 * s.u, s.gy + 1, x + 7 * s.u, s.gy + 1, x, s.gy - ht], s.p.far);
      }
      if (s.star >= 4) {
        for (let i = 0; i < 6; i++) {
          const x = s.w * (0.04 + i * 0.19);
          poly(s.c, [x - 6 * s.u, s.gy + 1, x + 6 * s.u, s.gy + 1, x, s.gy - 20 * s.u], s.p.mid, s.line, lw(s, 0.4));
        }
        // Sunbeams through the trees.
        lightRays(s, s.w * 0.15, -4 * s.u, s.p.glow, 4, 0.8);
      }
    },
    mid: (s) => {
      // Training dummy (straw on a post).
      const x = s.w * 0.84;
      s.c.fillStyle = s.p.wood;
      s.c.fillRect(x - s.u, s.gy - 18 * s.u, 2 * s.u, 19 * s.u);
      ellipse(s.c, x, s.gy - 14 * s.u, 4.5 * s.u, 6 * s.u, '#e7c873', s.line, lw(s, 0.6));
      s.c.fillRect(x - 7 * s.u, s.gy - 15 * s.u, 14 * s.u, 1.6 * s.u);
      circle(s.c, x, s.gy - 22 * s.u, 3 * s.u, '#e7c873', s.line, lw(s, 0.6));
      if (s.star >= 2) {
        // Weapon rack with wooden practice swords + a log seat.
        const rx = s.w * 0.12;
        s.c.fillStyle = s.p.wood;
        s.c.fillRect(rx - 6 * s.u, s.gy - 11 * s.u, 12 * s.u, 1.4 * s.u);
        for (const dx of [-4, 0, 4]) roundRect(s.c, rx + dx * s.u - 0.6 * s.u, s.gy - 15 * s.u, 1.2 * s.u, 15 * s.u, 0.5 * s.u, '#d8b27a', s.line, lw(s, 0.4));
        ellipse(s.c, s.w * 0.28, s.gy + 4 * s.u, 6 * s.u, 2.4 * s.u, s.p.wood, s.line, lw(s, 0.5));
      }
      if (s.star >= 3) {
        // Finishing Blow: a big claw strike across the dummy.
        s.c.strokeStyle = s.p.accent;
        s.c.lineWidth = lw(s, 1.1);
        for (const d of [-2, 0, 2]) {
          s.c.beginPath();
          s.c.moveTo(x - 5 * s.u + d * s.u, s.gy - 19 * s.u);
          s.c.lineTo(x + 4 * s.u + d * s.u, s.gy - 9 * s.u);
          s.c.stroke();
        }
      }
    },
    front: (s) => {
      if (s.star >= 4) {
        bunting(s, 0, s.h * 0.08, s.w, s.h * 0.1, [s.p.accent, s.p.accent2, '#ffffff']);
      }
      if (s.star >= 5) {
        // Hundred-Paw Flurry: a whirl of paw strikes around the ring + champion banners.
        for (const [bx, col] of [
          [0.05, s.p.accent],
          [0.95, s.p.accent2],
        ] as const) {
          const x = s.w * bx;
          s.c.fillStyle = s.line;
          s.c.fillRect(x - 0.6 * s.u, s.h * 0.2, 1.2 * s.u, s.gy - s.h * 0.2);
          poly(s.c, [x - 4 * s.u, s.h * 0.22, x + 4 * s.u, s.h * 0.22, x + 4 * s.u, s.h * 0.44, x, s.h * 0.4, x - 4 * s.u, s.h * 0.44], col, s.line, lw(s, 0.5));
        }
        const r = rng(9);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          pawPrint(s, s.w * 0.5 + Math.cos(a) * s.w * 0.36, s.h * 0.55 + Math.sin(a) * s.h * 0.32, 0.9 + r() * 0.3, s.night ? 'rgba(243,207,114,0.55)' : 'rgba(217,83,79,0.45)');
        }
      }
    },
  },

  // Chubby Orange — a warm kitchen full of snacks. Special: Aftershock. Ultimate: Mega Belly Slam.
  orange: {
    ground: 0.66,
    light: P({ skyTop: '#ffe3c2', skyBottom: '#fff3e2', far: '#f6c99a', mid: '#e9a86f', ground: '#f2d9b8', ground2: '#e7c79f', accent: '#ff8c42', accent2: '#e94f4f', glow: '#ffe8a8', wood: '#b9784a', stone: '#e8dccb' }),
    moonlit: P({ skyTop: '#3d2b3d', skyBottom: '#5a3f4d', far: '#6a4752', mid: '#7f5257', ground: '#6f5560', ground2: '#5f4753', accent: '#ff9c5c', accent2: '#ff6f6f', glow: '#ffcf86', wood: '#7a5040', stone: '#8a7a88' }),
    back: (s) => {
      // Back wall with tiles + a window.
      s.c.fillStyle = rgba(s.p.far, 0.55);
      s.c.fillRect(0, s.gy - 26 * s.u, s.w, 26 * s.u);
      s.c.strokeStyle = rgba(s.p.mid, 0.35);
      s.c.lineWidth = lw(s, 0.4);
      for (let y = s.gy - 26 * s.u; y < s.gy; y += 6.5 * s.u) {
        s.c.beginPath();
        s.c.moveTo(0, y);
        s.c.lineTo(s.w, y);
        s.c.stroke();
      }
      archWindow(s, s.w * 0.5, s.h * 0.06, 20 * s.u, 22 * s.u, true);
      if (s.star >= 4) {
        // Hanging pots and a range hood.
        poly(s.c, [s.w * 0.72, s.h * 0.02, s.w * 0.98, s.h * 0.02, s.w * 1.02, s.h * 0.22, s.w * 0.68, s.h * 0.22], s.p.stone, s.line, lw(s, 0.5));
        for (const x of [0.06, 0.14, 0.22]) {
          s.c.fillStyle = s.line;
          s.c.fillRect(s.w * x, 0, 0.5 * s.u, s.h * 0.14);
          ellipse(s.c, s.w * x, s.h * 0.18, 3 * s.u, 2.5 * s.u, '#c9c3cf', s.line, lw(s, 0.5));
        }
        glowAt(s, s.w * 0.5, s.h * 0.18, 30 * s.u, s.p.glow, 0.5);
      }
    },
    mid: (s) => {
      // Counter with a mixing bowl.
      roundRect(s.c, -2, s.gy - 12 * s.u, s.w * 0.28, 12 * s.u, s.u, s.p.wood, s.line, lw(s, 0.6));
      ellipse(s.c, s.w * 0.12, s.gy - 13 * s.u, 6 * s.u, 3 * s.u, '#f5f0ea', s.line, lw(s, 0.6));
      if (s.star >= 2) {
        // Snacks: fish crackers jar, dango, a cookie plate.
        const x = s.w * 0.86;
        roundRect(s.c, x - 5 * s.u, s.gy - 16 * s.u, 10 * s.u, 14 * s.u, 2.5 * s.u, 'rgba(255,255,255,0.55)', s.line, lw(s, 0.6));
        for (let i = 0; i < 4; i++) ellipse(s.c, x - 2 * s.u + (i % 2) * 4 * s.u, s.gy - 10 * s.u + Math.floor(i / 2) * 4 * s.u, 2 * s.u, 1 * s.u, s.p.accent);
        roundRect(s.c, x - 4 * s.u, s.gy - 18 * s.u, 8 * s.u, 2.5 * s.u, s.u, s.p.accent2, s.line, lw(s, 0.5));
        for (const [dx, col] of [
          [-2, '#ffb3c8'],
          [0, '#ffffff'],
          [2, '#a8e6a0'],
        ] as const)
          circle(s.c, s.w * 0.2 + dx * 1.6 * s.u, s.gy - 18 * s.u, 1.6 * s.u, col, s.line, lw(s, 0.4));
      }
    },
    front: (s) => {
      if (s.star >= 3) {
        // Aftershock: ripples and cracks spreading over the kitchen floor.
        s.c.strokeStyle = s.night ? 'rgba(255,207,134,0.55)' : 'rgba(185,120,74,0.6)';
        s.c.lineWidth = lw(s, 0.8);
        for (const r of [10, 17, 24]) {
          s.c.beginPath();
          s.c.ellipse(s.w * 0.5, s.h * 0.92, r * s.u, r * 0.28 * s.u, 0, 0, TAU);
          s.c.stroke();
        }
        s.c.strokeStyle = s.line;
        s.c.beginPath();
        s.c.moveTo(s.w * 0.62, s.h * 0.9);
        s.c.lineTo(s.w * 0.7, s.h * 0.94);
        s.c.lineTo(s.w * 0.76, s.h * 0.91);
        s.c.stroke();
      }
      if (s.star >= 5) {
        // Mega Belly Slam: a towering celebration cake whose dishes bounce into the air.
        const x = s.w * 0.88;
        const y = s.h * 0.98;
        roundRect(s.c, x - 9 * s.u, y - 10 * s.u, 18 * s.u, 10 * s.u, 2 * s.u, '#fff4e6', s.line, lw(s, 0.6));
        roundRect(s.c, x - 6.5 * s.u, y - 18 * s.u, 13 * s.u, 8 * s.u, 2 * s.u, '#ffd1dc', s.line, lw(s, 0.6));
        roundRect(s.c, x - 4 * s.u, y - 24 * s.u, 8 * s.u, 6 * s.u, 2 * s.u, '#fff4e6', s.line, lw(s, 0.6));
        circle(s.c, x, y - 26 * s.u, 1.8 * s.u, s.p.accent2, s.line, lw(s, 0.4));
        for (const [dx, dy] of [
          [-22, -30],
          [-14, -38],
        ]) {
          ellipse(s.c, x + dx * s.u, y + dy * s.u, 4 * s.u, 1.4 * s.u, '#ffffff', s.line, lw(s, 0.5));
          circle(s.c, x + dx * s.u, y + (dy - 1.5) * s.u, 1.3 * s.u, s.p.accent);
        }
      }
    },
  },

  // Black Cat — a moonlit sniper rooftop. Special: Armor-Piercing Round. Ultimate: Charged Shot.
  black: {
    light: P({ skyTop: '#8fb1d9', skyBottom: '#dbe7f5', far: '#9aa7c2', mid: '#6f7d9c', ground: '#8c6f6a', ground2: '#7a5f5b', accent: '#ffcc33', accent2: '#4dc3ff', glow: '#fff2b0', wood: '#6e5a52', stone: '#a29bb0' }),
    moonlit: P({ skyTop: '#151a33', skyBottom: '#2d3560', far: '#262c4d', mid: '#323a63', ground: '#463a4d', ground2: '#3a3042', accent: '#ffd84a', accent2: '#5fd2ff', glow: '#fff4c4', wood: '#4c3d45', stone: '#5a5670' }),
    ground: 0.74,
    back: (s) => {
      skyStars(s, 30);
      skyLight(s, s.w * 0.78, s.h * 0.2, (s.star >= 5 ? 10 : 7) * s.u);
      rooftops(s, s.p.far, 14 * s.u);
      if (s.star >= 4) {
        // A clock tower and lit windows across town.
        tower(s, s.w * 0.2, 9 * s.u, s.h * 0.18, s.p.mid, s.p.mid);
        circle(s.c, s.w * 0.2, s.h * 0.32, 2.6 * s.u, s.p.glow, s.line, lw(s, 0.4));
        const r = rng(3);
        for (let i = 0; i < 14; i++) roundRect(s.c, r() * s.w, s.gy - (4 + r() * 18) * s.u, 1.6 * s.u, 2 * s.u, 0.3 * s.u, s.night ? '#ffd98a' : '#e8f2ff');
      }
      if (s.star >= 5) {
        // Charged Shot: a moonlit tracer streaking across the sky through a scope reticle.
        const x = s.w * 0.78;
        const y = s.h * 0.2;
        s.c.strokeStyle = s.p.accent2;
        s.c.lineWidth = lw(s, 0.6);
        s.c.beginPath();
        s.c.arc(x, y, 14 * s.u, 0, TAU);
        s.c.moveTo(x - 18 * s.u, y);
        s.c.lineTo(x + 18 * s.u, y);
        s.c.moveTo(x, y - 18 * s.u);
        s.c.lineTo(x, y + 18 * s.u);
        s.c.stroke();
        const g = s.c.createLinearGradient(0, s.h * 0.45, x, y);
        g.addColorStop(0, 'rgba(95,210,255,0)');
        g.addColorStop(1, s.p.accent2);
        s.c.strokeStyle = g;
        s.c.lineWidth = lw(s, 1.6);
        s.c.beginPath();
        s.c.moveTo(0, s.h * 0.45);
        s.c.lineTo(x, y);
        s.c.stroke();
      }
    },
    mid: (s) => {
      // The rooftop ledge the sniper perches on: slates + a chimney.
      for (let x = 0; x < s.w; x += 5 * s.u) roundRect(s.c, x, s.gy - 1.2 * s.u, 5 * s.u, 2.4 * s.u, 0.6 * s.u, s.p.ground2, s.line, lw(s, 0.3));
      roundRect(s.c, s.w * 0.86, s.gy - 16 * s.u, 8 * s.u, 16 * s.u, 0.5 * s.u, s.p.stone, s.line, lw(s, 0.6));
      if (s.star >= 2) {
        // Weather vane + a little antenna and a sandbag rest.
        const x = s.w * 0.1;
        s.c.fillStyle = s.line;
        s.c.fillRect(x, s.gy - 22 * s.u, 0.8 * s.u, 22 * s.u);
        poly(s.c, [x - 5 * s.u, s.gy - 21 * s.u, x + 6 * s.u, s.gy - 21 * s.u, x + 4 * s.u, s.gy - 23 * s.u], s.line);
        ellipse(s.c, s.w * 0.24, s.gy - 1.5 * s.u, 5 * s.u, 2.4 * s.u, '#b8a37e', s.line, lw(s, 0.5));
      }
    },
    front: (s) => {
      if (s.star >= 3) {
        // Armor-Piercing Round: a target board with a clean hole straight through.
        const x = s.w * 0.88;
        const y = s.h * 0.48;
        for (const [r, col] of [
          [6, '#f4efe6'],
          [4.3, s.p.accent],
          [2.6, '#f4efe6'],
          [1.1, s.p.accent],
        ] as const)
          circle(s.c, x, y, r * s.u, col, s.line, lw(s, 0.4));
        circle(s.c, x + 0.6 * s.u, y - 0.4 * s.u, 1 * s.u, s.p.skyTop, s.line, lw(s, 0.3));
      }
    },
  },

  // Noble White — an elegant royal garden. Special: Lingering Charm. Ultimate: Grand Royal Pose.
  white: {
    light: P({ skyTop: '#ffd9ec', skyBottom: '#fff4fa', far: '#bfe3c0', mid: '#93cf9a', ground: '#bfe7b6', ground2: '#a9dba0', accent: '#ff8fb8', accent2: '#c8a2ff', glow: '#fff3d6', wood: '#c8a37a', stone: '#f1e9f2' }),
    moonlit: P({ skyTop: '#3a2a52', skyBottom: '#5b4579', far: '#3e5a55', mid: '#4b6f65', ground: '#4f6f63', ground2: '#466357', accent: '#ff9fc6', accent2: '#cfb0ff', glow: '#ffe6f4', wood: '#80664f', stone: '#a49ab6' }),
    back: (s) => {
      skyStars(s, 16);
      skyLight(s, s.w * 0.84, s.h * 0.15, 5 * s.u);
      // Topiary hedge wall.
      s.c.fillStyle = s.p.far;
      s.c.fillRect(0, s.gy - 12 * s.u, s.w, 13 * s.u);
      for (let x = 0; x < s.w; x += 9 * s.u) circle(s.c, x, s.gy - 12 * s.u, 4.5 * s.u, s.p.far);
      if (s.star >= 4) {
        // Palace silhouette with pale towers.
        tower(s, s.w * 0.14, 8 * s.u, s.h * 0.2, s.p.stone, s.p.accent2);
        tower(s, s.w * 0.86, 8 * s.u, s.h * 0.24, s.p.stone, s.p.accent2);
        crenellatedWall(s, s.w * 0.18, s.w * 0.82, s.gy - 22 * s.u, s.p.stone);
        s.c.fillStyle = s.p.far;
        s.c.fillRect(0, s.gy - 12 * s.u, s.w, 13 * s.u);
      }
    },
    mid: (s) => {
      // Garden path + two cone topiaries.
      poly(s.c, [s.w * 0.4, s.gy, s.w * 0.6, s.gy, s.w * 0.72, s.h, s.w * 0.28, s.h], s.p.stone);
      for (const x of [0.1, 0.9]) {
        roundRect(s.c, s.w * x - 2 * s.u, s.gy - 4 * s.u, 4 * s.u, 5 * s.u, 0.5 * s.u, s.p.wood, s.line, lw(s, 0.4));
        poly(s.c, [s.w * x - 5 * s.u, s.gy - 4 * s.u, s.w * x + 5 * s.u, s.gy - 4 * s.u, s.w * x, s.gy - 20 * s.u], s.p.mid, s.line, lw(s, 0.5));
      }
      if (s.star >= 2) {
        for (const [x, col] of [
          [0.2, s.p.accent],
          [0.26, '#ffffff'],
          [0.76, s.p.accent2],
          [0.82, s.p.accent],
        ] as const)
          flower(s, s.w * x, s.gy + 2 * s.u, 1.1, col);
      }
      if (s.star >= 3) {
        // Lingering Charm: a heart-shaped rose hedge with petals drifting through the air.
        drawHeart(s.c, s.w * 0.8, s.gy - 22 * s.u, 7 * s.u, s.p.mid);
        drawHeart(s.c, s.w * 0.8, s.gy - 22.5 * s.u, 4 * s.u, s.p.accent);
        const r = rng(21);
        for (let i = 0; i < 9; i++) ellipse(s.c, r() * s.w, r() * s.gy, 1.1 * s.u, 0.6 * s.u, s.p.accent);
      }
    },
    front: (s) => {
      if (s.star >= 5) {
        // Grand Royal Pose: a red carpet up to a crowned fountain, under royal drapes.
        poly(s.c, [s.w * 0.44, s.gy, s.w * 0.56, s.gy, s.w * 0.64, s.h, s.w * 0.36, s.h], '#d8436a');
        const x = s.w * 0.16;
        ellipse(s.c, x, s.gy + 2 * s.u, 8 * s.u, 2.5 * s.u, s.p.stone, s.line, lw(s, 0.5));
        roundRect(s.c, x - 1.5 * s.u, s.gy - 10 * s.u, 3 * s.u, 11 * s.u, s.u, s.p.stone, s.line, lw(s, 0.5));
        poly(s.c, [x - 3 * s.u, s.gy - 10 * s.u, x - 3 * s.u, s.gy - 14 * s.u, x - 1.5 * s.u, s.gy - 12 * s.u, x, s.gy - 15 * s.u, x + 1.5 * s.u, s.gy - 12 * s.u, x + 3 * s.u, s.gy - 14 * s.u, x + 3 * s.u, s.gy - 10 * s.u], '#ffd34d', s.line, lw(s, 0.4));
        curtain(s, true, '#b23a5e', '#ffd34d');
        curtain(s, false, '#b23a5e', '#ffd34d');
      }
    },
  },

  // Mr. Whiskers — a magical theatre stage. Special: Endless Trick. Ultimate: Hat of Wonders.
  whiskers: {
    ground: 0.7,
    light: P({ skyTop: '#5b3d6e', skyBottom: '#7d5a8c', far: '#4a3158', mid: '#6b4a7a', ground: '#b98a5a', ground2: '#a87a4c', accent: '#d8434f', accent2: '#ffd34d', glow: '#fff1b0', wood: '#8a5d3b', stone: '#cdbfd8' }),
    moonlit: P({ skyTop: '#22163a', skyBottom: '#3a2659', far: '#1d1330', mid: '#33214f', ground: '#6f4d3a', ground2: '#5e402f', accent: '#e0505d', accent2: '#ffd96a', glow: '#fff1c2', wood: '#5e3f2b', stone: '#9a8db0' }),
    back: (s) => {
      // Backdrop cloth + proscenium arch.
      s.c.fillStyle = s.p.far;
      s.c.fillRect(0, 0, s.w, s.gy);
      s.c.strokeStyle = s.p.mid;
      s.c.lineWidth = lw(s, 0.8);
      for (let x = 4 * s.u; x < s.w; x += 7 * s.u) {
        s.c.beginPath();
        s.c.moveTo(x, 0);
        s.c.lineTo(x, s.gy);
        s.c.stroke();
      }
      if (s.star >= 2) {
        // Painted stars on the backdrop.
        for (const [x, y] of [
          [0.2, 0.2],
          [0.35, 0.1],
          [0.7, 0.16],
          [0.85, 0.3],
        ])
          drawStar(s.c, s.w * x, s.h * y, 2.4 * s.u, s.p.accent2);
      }
      if (s.star >= 4) {
        // Spotlights from the gallery.
        lightRays(s, s.w * 0.2, -6 * s.u, s.p.glow, 1, 0.5);
        lightRays(s, s.w * 0.8, -6 * s.u, s.p.glow, 1, 0.5);
        glowAt(s, s.w * 0.5, s.gy, 30 * s.u, s.p.glow, 0.45);
      }
    },
    mid: (s) => {
      // Stage boards + footlights.
      for (let y = s.gy; y < s.h; y += 4 * s.u) {
        s.c.strokeStyle = s.p.ground2;
        s.c.lineWidth = lw(s, 0.4);
        s.c.beginPath();
        s.c.moveTo(0, y);
        s.c.lineTo(s.w, y);
        s.c.stroke();
      }
      for (let x = s.w * 0.08; x < s.w; x += s.w * 0.12) {
        glowAt(s, x, s.gy + 1, 4 * s.u, s.p.glow, 0.9);
        circle(s.c, x, s.gy + 1, 1 * s.u, s.p.glow);
      }
      if (s.star >= 3) {
        // Endless Trick: a fan of playing cards and a bunny peeking from a hat.
        const x = s.w * 0.85;
        const y = s.gy - 2 * s.u;
        for (let i = -2; i <= 2; i++) {
          s.c.save();
          s.c.translate(x, y);
          s.c.rotate(i * 0.22);
          roundRect(s.c, -2.2 * s.u, -10 * s.u, 4.4 * s.u, 6.4 * s.u, 0.6 * s.u, '#ffffff', s.line, lw(s, 0.4));
          drawHeart(s.c, 0, -7 * s.u, 1.2 * s.u, i % 2 ? '#222' : s.p.accent);
          s.c.restore();
        }
        const hx = s.w * 0.16;
        ellipse(s.c, hx, s.gy - 12 * s.u, 2 * s.u, 4 * s.u, '#ffffff', s.line, lw(s, 0.4));
        ellipse(s.c, hx + 3 * s.u, s.gy - 12 * s.u, 2 * s.u, 4 * s.u, '#ffffff', s.line, lw(s, 0.4));
        roundRect(s.c, hx - 4 * s.u, s.gy - 9 * s.u, 11 * s.u, 9 * s.u, 0.5 * s.u, '#26203a', s.line, lw(s, 0.5));
        ellipse(s.c, hx + 1.5 * s.u, s.gy - 0.5 * s.u, 8 * s.u, 1.4 * s.u, '#26203a', s.line, lw(s, 0.5));
      }
    },
    front: (s) => {
      curtain(s, true, s.p.accent, s.star >= 4 ? s.p.accent2 : s.p.accent);
      curtain(s, false, s.p.accent, s.star >= 4 ? s.p.accent2 : s.p.accent);
      // Valance.
      s.c.fillStyle = s.p.accent;
      for (let x = 0; x < s.w; x += 8 * s.u) {
        s.c.beginPath();
        s.c.arc(x + 4 * s.u, 0, 4 * s.u, 0, Math.PI);
        s.c.fill();
      }
      if (s.star >= 5) {
        // Hat of Wonders: a giant floating top hat pouring out doves and stars.
        const x = s.w * 0.5;
        const y = s.h * 0.12;
        roundRect(s.c, x - 6 * s.u, y - 7 * s.u, 12 * s.u, 8 * s.u, 0.6 * s.u, '#26203a', s.p.accent2, lw(s, 0.6));
        ellipse(s.c, x, y + 1 * s.u, 10 * s.u, 1.8 * s.u, '#26203a', s.p.accent2, lw(s, 0.6));
        s.c.fillStyle = s.p.accent;
        s.c.fillRect(x - 6 * s.u, y - 2.5 * s.u, 12 * s.u, 1.8 * s.u);
        for (const [dx, dy] of [
          [-14, 2],
          [13, 4],
          [-7, 10],
          [9, 11],
        ])
          drawStar(s.c, x + dx * s.u, y + dy * s.u, 1.8 * s.u, s.p.accent2);
        for (const [dx, dy] of [
          [-20, 7],
          [19, 9],
        ]) {
          ellipse(s.c, x + dx * s.u, y + dy * s.u, 2.4 * s.u, 1.3 * s.u, '#ffffff', s.line, lw(s, 0.3));
          poly(s.c, [x + dx * s.u - s.u, y + dy * s.u, x + dx * s.u + s.u, y + dy * s.u, x + dx * s.u, y + (dy - 3) * s.u], '#ffffff', s.line, lw(s, 0.3));
        }
      }
    },
  },

  // Sir Sable — a moonlit castle courtyard. Special: Armor-Piercing Form. Ultimate: Moonshadow Slash.
  sable: {
    light: P({ skyTop: '#b5c7e8', skyBottom: '#eef1fb', far: '#a8a3b8', mid: '#8d879e', ground: '#bdb6a8', ground2: '#aaa293', accent: '#3b5bb5', accent2: '#c9d6ff', glow: '#f3f6ff', wood: '#7b5b44', stone: '#c9c3cf' }),
    moonlit: P({ skyTop: '#121735', skyBottom: '#2a3266', far: '#2c2f4f', mid: '#3a3d61', ground: '#4b4a63', ground2: '#3f3e56', accent: '#6f8cff', accent2: '#dfe6ff', glow: '#e9eeff', wood: '#4f3d33', stone: '#64627e' }),
    back: (s) => {
      skyStars(s, 26);
      skyLight(s, s.w * 0.5, s.h * 0.16, 7 * s.u);
      crenellatedWall(s, 0, s.w, s.gy - 16 * s.u, s.p.far);
      if (s.star >= 4) {
        tower(s, s.w * 0.1, 10 * s.u, s.h * 0.12, s.p.mid, s.p.accent);
        tower(s, s.w * 0.9, 10 * s.u, s.h * 0.08, s.p.mid, s.p.accent);
      }
      if (s.star >= 5) {
        // Moonshadow Slash: a great crescent cut across the sky beside the moon.
        s.c.save();
        s.c.strokeStyle = s.p.accent2;
        s.c.shadowColor = s.p.accent;
        s.c.shadowBlur = 6 * s.u;
        s.c.lineWidth = lw(s, 2.2);
        s.c.lineCap = 'round';
        s.c.beginPath();
        s.c.arc(s.w * 0.5, s.h * 0.55, s.w * 0.42, Math.PI * 1.12, Math.PI * 1.55);
        s.c.stroke();
        s.c.restore();
      }
    },
    mid: (s) => {
      // Flagstones + an arched gate.
      for (let i = 0, x = 0; x < s.w; x += 7 * s.u, i++) {
        roundRect(s.c, x, i % 2 ? s.gy + 3 * s.u : s.gy + 9 * s.u, 6.4 * s.u, 3 * s.u, s.u, s.p.ground2);
        roundRect(s.c, x + 3.5 * s.u, s.gy + 17 * s.u, 6.4 * s.u, 3 * s.u, s.u, s.p.ground2);
      }
      if (s.star >= 2) {
        // Banners on the wall + torches.
        for (const x of [0.25, 0.75]) {
          poly(s.c, [s.w * x - 3.5 * s.u, s.gy - 16 * s.u, s.w * x + 3.5 * s.u, s.gy - 16 * s.u, s.w * x + 3.5 * s.u, s.gy - 4 * s.u, s.w * x, s.gy - 6 * s.u, s.w * x - 3.5 * s.u, s.gy - 4 * s.u], s.p.accent, s.line, lw(s, 0.5));
          drawStar(s.c, s.w * x, s.gy - 11 * s.u, 1.6 * s.u, s.p.accent2, 4);
        }
        for (const x of [0.06, 0.94]) lantern(s, s.w * x, s.gy - 14 * s.u, 0.9, '#ffb84d');
      }
    },
    front: (s) => {
      if (s.star >= 3) {
        // Armor-Piercing Form: a sword driven through a breastplate on a stand.
        const x = s.w * 0.86;
        const y = s.gy + 2 * s.u;
        s.c.fillStyle = s.p.wood;
        s.c.fillRect(x - 0.6 * s.u, y - 14 * s.u, 1.2 * s.u, 14 * s.u);
        poly(s.c, [x - 4 * s.u, y - 14 * s.u, x + 4 * s.u, y - 14 * s.u, x + 3 * s.u, y - 7 * s.u, x - 3 * s.u, y - 7 * s.u], s.p.stone, s.line, lw(s, 0.5));
        s.c.save();
        s.c.translate(x, y - 11 * s.u);
        s.c.rotate(-0.7);
        roundRect(s.c, -9 * s.u, -0.5 * s.u, 18 * s.u, 1 * s.u, 0.4 * s.u, s.p.accent2, s.line, lw(s, 0.4));
        roundRect(s.c, 8.5 * s.u, -1.6 * s.u, 1 * s.u, 3.2 * s.u, 0.3 * s.u, '#ffd34d', s.line, lw(s, 0.3));
        s.c.restore();
      }
    },
  },

  // Captain Mallow — a cozy community headquarters. Special: Teamwork. Ultimate: Everyone Together!
  mallow: {
    ground: 0.7,
    light: P({ skyTop: '#ffe7c7', skyBottom: '#fff6e8', far: '#f0c9a0', mid: '#e3ad7d', ground: '#d9b48a', ground2: '#c99f73', accent: '#4fa3e0', accent2: '#ffcf4d', glow: '#fff1c4', wood: '#a96f45', stone: '#efe2d0' }),
    moonlit: P({ skyTop: '#33283f', skyBottom: '#4f3d57', far: '#5c4652', mid: '#6d5260', ground: '#6a5458', ground2: '#5b484d', accent: '#6fb8f0', accent2: '#ffd46a', glow: '#ffd89a', wood: '#6b4a37', stone: '#857888' }),
    back: (s) => {
      // Wood-panelled HQ wall + a big round window.
      s.c.fillStyle = s.p.far;
      s.c.fillRect(0, 0, s.w, s.gy);
      s.c.strokeStyle = s.p.mid;
      s.c.lineWidth = lw(s, 0.5);
      for (let x = 0; x < s.w; x += 6 * s.u) {
        s.c.beginPath();
        s.c.moveTo(x, 0);
        s.c.lineTo(x, s.gy);
        s.c.stroke();
      }
      circle(s.c, s.w * 0.5, s.h * 0.24, 11 * s.u, s.night ? '#3a3766' : '#cfeaff', s.p.wood, lw(s, 1.6));
      if (s.star >= 4) {
        // A shelf of trophies and a warm ceiling lamp.
        roundRect(s.c, s.w * 0.04, s.h * 0.3, s.w * 0.24, 1.6 * s.u, 0.4 * s.u, s.p.wood, s.line, lw(s, 0.4));
        for (const x of [0.08, 0.15, 0.22]) {
          poly(s.c, [s.w * x - 1.6 * s.u, s.h * 0.3, s.w * x + 1.6 * s.u, s.h * 0.3, s.w * x + 2.6 * s.u, s.h * 0.22, s.w * x - 2.6 * s.u, s.h * 0.22], s.p.accent2, s.line, lw(s, 0.4));
        }
        lantern(s, s.w * 0.5, s.h * 0.05, 1.3, s.p.accent2);
        glowAt(s, s.w * 0.5, s.h * 0.1, 35 * s.u, s.p.glow, 0.45);
      }
    },
    mid: (s) => {
      // Rug + a meeting table edge.
      ellipse(s.c, s.w * 0.5, s.gy + 12 * s.u, s.w * 0.4, 8 * s.u, s.p.accent, s.line, lw(s, 0.5));
      ellipse(s.c, s.w * 0.5, s.gy + 12 * s.u, s.w * 0.32, 5.5 * s.u, s.night ? '#5c7fa0' : '#a9d6f5');
      if (s.star >= 2) {
        // Mugs on a crate and a bell on the post.
        roundRect(s.c, s.w * 0.04, s.gy - 8 * s.u, 14 * s.u, 9 * s.u, s.u, s.p.wood, s.line, lw(s, 0.5));
        for (const dx of [3, 9]) roundRect(s.c, s.w * 0.04 + dx * s.u, s.gy - 12 * s.u, 3.4 * s.u, 4 * s.u, 0.8 * s.u, '#ffffff', s.line, lw(s, 0.4));
        const x = s.w * 0.9;
        s.c.fillStyle = s.p.wood;
        s.c.fillRect(x - 0.8 * s.u, s.gy - 22 * s.u, 1.6 * s.u, 22 * s.u);
        poly(s.c, [x - 3.5 * s.u, s.gy - 14 * s.u, x + 3.5 * s.u, s.gy - 14 * s.u, x + 2 * s.u, s.gy - 20 * s.u, x - 2 * s.u, s.gy - 20 * s.u], s.p.accent2, s.line, lw(s, 0.5));
      }
      if (s.star >= 3) {
        // Teamwork: a notice board pinned with everyone's paw prints.
        const x = s.w * 0.16;
        const y = s.h * 0.08;
        roundRect(s.c, x - 9 * s.u, y, 18 * s.u, 13 * s.u, s.u, '#c99566', s.line, lw(s, 0.6));
        const cols = [s.p.accent, s.p.accent2, '#ff8fb8', '#8ad18a', '#c8a2ff', '#ff9c5c'];
        cols.forEach((col, i) => pawPrint(s, x - 5.5 * s.u + (i % 3) * 5.5 * s.u, y + 5 * s.u + Math.floor(i / 3) * 5.5 * s.u, 0.8, col));
      }
    },
    front: (s) => {
      if (s.star >= 5) {
        // Everyone Together!: bunting across the hall and the whole crew's silhouettes cheering.
        bunting(s, 0, s.h * 0.04, s.w, s.h * 0.04, [s.p.accent, s.p.accent2, '#ff8fb8', '#8ad18a']);
        const r = rng(4);
        for (let i = 0; i < 6; i++) {
          const x = s.w * (i < 3 ? 0.03 + i * 0.07 : 0.79 + (i - 3) * 0.07);
          const y = s.h * (0.98 - r() * 0.05);
          const col = s.night ? 'rgba(20,15,30,0.55)' : 'rgba(110,70,40,0.35)';
          ellipse(s.c, x, y - 3 * s.u, 3 * s.u, 3.6 * s.u, col);
          circle(s.c, x, y - 8 * s.u, 2.6 * s.u, col);
          poly(s.c, [x - 2.4 * s.u, y - 9.5 * s.u, x - 1 * s.u, y - 10.5 * s.u, x - 2 * s.u, y - 12.5 * s.u], col);
          poly(s.c, [x + 2.4 * s.u, y - 9.5 * s.u, x + 1 * s.u, y - 10.5 * s.u, x + 2 * s.u, y - 12.5 * s.u], col);
        }
      }
    },
  },

  // Shadow Pounce — rooftops and shadowy forest passages. Special: Hunting Instinct. Ultimate: Shadow Pursuit.
  pounce: {
    light: P({ skyTop: '#b9b3d6', skyBottom: '#e9e4f5', far: '#7f86a8', mid: '#5d6b6c', ground: '#5e7a5c', ground2: '#4f6a4d', accent: '#9b6bff', accent2: '#c6ff6b', glow: '#efe6ff', wood: '#5d4a42', stone: '#8c869c' }),
    moonlit: P({ skyTop: '#0f1226', skyBottom: '#222846', far: '#1f2340', mid: '#1c2b2b', ground: '#22332b', ground2: '#1b2a23', accent: '#b48cff', accent2: '#d6ff7a', glow: '#e6dcff', wood: '#3c302c', stone: '#46445a' }),
    back: (s) => {
      skyStars(s, 22);
      skyLight(s, s.w * 0.2, s.h * 0.15, 5 * s.u);
      // Rooftops on one side, a forest edge on the other.
      s.c.save();
      s.c.beginPath();
      s.c.rect(s.w * 0.45, 0, s.w * 0.55, s.h);
      s.c.clip();
      rooftops(s, s.p.far, 12 * s.u);
      s.c.restore();
      for (let i = 0; i < 5; i++) {
        const x = s.w * (0.02 + i * 0.1);
        poly(s.c, [x - 6 * s.u, s.gy + 1, x + 6 * s.u, s.gy + 1, x, s.gy - (22 + (i % 2) * 8) * s.u], s.p.mid);
      }
      if (s.star >= 4) {
        // Mist between the trees and a wire running across the rooftops.
        s.c.fillStyle = s.night ? 'rgba(180,160,255,0.12)' : 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 3; i++) ellipse(s.c, s.w * (0.2 + i * 0.3), s.gy - 2 * s.u, 18 * s.u, 3 * s.u, s.c.fillStyle as string);
        s.c.strokeStyle = s.line;
        s.c.lineWidth = lw(s, 0.4);
        s.c.beginPath();
        s.c.moveTo(s.w * 0.45, s.h * 0.3);
        s.c.quadraticCurveTo(s.w * 0.75, s.h * 0.4, s.w, s.h * 0.28);
        s.c.stroke();
      }
    },
    mid: (s) => {
      // Leaf litter path.
      ellipse(s.c, s.w * 0.5, s.gy + 10 * s.u, s.w * 0.38, 6 * s.u, s.p.ground2);
      if (s.star >= 2) {
        // Ferns and a crate stack at the alley mouth.
        for (const x of [0.06, 0.14]) bush(s, s.w * x, s.gy + s.u, 0.8, s.p.mid);
        roundRect(s.c, s.w * 0.82, s.gy - 9 * s.u, 10 * s.u, 9 * s.u, 0.5 * s.u, s.p.wood, s.line, lw(s, 0.5));
        roundRect(s.c, s.w * 0.85, s.gy - 16 * s.u, 7 * s.u, 7 * s.u, 0.5 * s.u, s.p.wood, s.line, lw(s, 0.5));
      }
      if (s.star >= 3) {
        // Hunting Instinct: glowing eyes in the undergrowth and a trail of tracks.
        for (const [x, y] of [
          [0.08, 0.66],
          [0.17, 0.6],
        ]) {
          ellipse(s.c, s.w * x - 1.2 * s.u, s.h * y, 0.9 * s.u, 0.5 * s.u, s.p.accent2);
          ellipse(s.c, s.w * x + 1.2 * s.u, s.h * y, 0.9 * s.u, 0.5 * s.u, s.p.accent2);
        }
        for (let i = 0; i < 4; i++) pawPrint(s, s.w * (0.62 + i * 0.08), s.h * (0.95 - i * 0.04), 0.7, s.night ? 'rgba(214,255,122,0.45)' : 'rgba(80,60,120,0.4)');
      }
    },
    front: (s) => {
      if (s.star >= 5) {
        // Shadow Pursuit: shadow after-images streaking across the rooftops.
        for (let i = 0; i < 4; i++) {
          s.c.globalAlpha = 0.18 + i * 0.14;
          const x = s.w * (0.55 + i * 0.1);
          const y = s.h * (0.26 - i * 0.02);
          ellipse(s.c, x, y, 5 * s.u, 2.2 * s.u, s.p.accent);
          circle(s.c, x + 5 * s.u, y - 1.5 * s.u, 2 * s.u, s.p.accent);
        }
        s.c.globalAlpha = 1;
        s.c.strokeStyle = s.p.accent;
        s.c.lineWidth = lw(s, 0.6);
        for (const dy of [-1.5, 0, 1.5]) {
          s.c.beginPath();
          s.c.moveTo(s.w * 0.4, s.h * 0.3 + dy * s.u);
          s.c.lineTo(s.w * 0.55, s.h * 0.26 + dy * s.u);
          s.c.stroke();
        }
      }
    },
  },

  // Silver Devil — a mysterious potion workshop. Special: Venomous Kiss. Ultimate: Devil's Pact.
  devil: {
    ground: 0.7,
    light: P({ skyTop: '#d9cbe8', skyBottom: '#efe7f5', far: '#b9a6cf', mid: '#9c86b5', ground: '#a993b8', ground2: '#9682a6', accent: '#7ed957', accent2: '#c86bff', glow: '#eaffd6', wood: '#7a5a6e', stone: '#cfc6da' }),
    moonlit: P({ skyTop: '#1d1530', skyBottom: '#33244d', far: '#2a1f40', mid: '#3a2b55', ground: '#3b2f4c', ground2: '#32283f', accent: '#8dff6a', accent2: '#d07aff', glow: '#d9ffc7', wood: '#4b3346', stone: '#5c5270' }),
    back: (s) => {
      // Stone wall with shelves of bottles.
      s.c.fillStyle = s.p.far;
      s.c.fillRect(0, 0, s.w, s.gy);
      s.c.strokeStyle = rgba(s.p.mid, 0.6);
      s.c.lineWidth = lw(s, 0.45);
      for (let row = 0, y = 0; y < s.gy; y += 7 * s.u, row++) {
        s.c.beginPath();
        s.c.moveTo(0, y);
        s.c.lineTo(s.w, y);
        for (let x = row % 2 ? 6 * s.u : 0; x < s.w; x += 12 * s.u) {
          s.c.moveTo(x, y);
          s.c.lineTo(x, y + 7 * s.u);
        }
        s.c.stroke();
      }
      roundRect(s.c, s.w * 0.02, s.h * 0.32, s.w * 0.26, 1.6 * s.u, 0.3 * s.u, s.p.wood, s.line, lw(s, 0.4));
      const cols = [s.p.accent, s.p.accent2, '#ff7aa8', '#6bd7ff'];
      for (let i = 0; i < 4; i++) {
        const x = s.w * (0.05 + i * 0.06);
        roundRect(s.c, x - 1.4 * s.u, s.h * 0.32 - 6 * s.u, 2.8 * s.u, 6 * s.u, 1.2 * s.u, cols[i], s.line, lw(s, 0.4));
      }
      if (s.star >= 4) {
        // Second shelf, a hanging herb bundle and a glowing round window.
        roundRect(s.c, s.w * 0.72, s.h * 0.24, s.w * 0.26, 1.6 * s.u, 0.3 * s.u, s.p.wood, s.line, lw(s, 0.4));
        for (let i = 0; i < 4; i++) circle(s.c, s.w * (0.76 + i * 0.06), s.h * 0.24 - 2.4 * s.u, 2.2 * s.u, cols[(i + 1) % 4], s.line, lw(s, 0.4));
        circle(s.c, s.w * 0.5, s.h * 0.16, 8 * s.u, s.night ? '#3e2f6a' : '#efe0ff', s.p.wood, lw(s, 1.4));
        if (s.night) skyLight(s, s.w * 0.52, s.h * 0.15, 2.4 * s.u);
        glowAt(s, s.w * 0.5, s.gy, 36 * s.u, s.p.accent, 0.22);
      }
    },
    mid: (s) => {
      // Workbench with a book.
      roundRect(s.c, s.w * 0.74, s.gy - 10 * s.u, s.w * 0.28, 10 * s.u, s.u, s.p.wood, s.line, lw(s, 0.5));
      roundRect(s.c, s.w * 0.8, s.gy - 13 * s.u, 9 * s.u, 3 * s.u, 0.6 * s.u, s.p.accent2, s.line, lw(s, 0.4));
      if (s.star >= 2) {
        // Candles and mushrooms in jars.
        for (const x of [0.06, 0.12]) {
          roundRect(s.c, s.w * x - 1 * s.u, s.gy - 7 * s.u, 2 * s.u, 7 * s.u, 0.4 * s.u, '#f4ecd8', s.line, lw(s, 0.3));
          ellipse(s.c, s.w * x, s.gy - 8.5 * s.u, 0.8 * s.u, 1.4 * s.u, '#ffcf5a');
          glowAt(s, s.w * x, s.gy - 8.5 * s.u, 5 * s.u, '#ffcf5a', 0.6);
        }
        roundRect(s.c, s.w * 0.93, s.gy - 18 * s.u, 5 * s.u, 6 * s.u, 1.5 * s.u, 'rgba(255,255,255,0.4)', s.line, lw(s, 0.4));
        ellipse(s.c, s.w * 0.93 + 2.5 * s.u, s.gy - 15 * s.u, 1.8 * s.u, 1 * s.u, '#ff7aa8');
      }
      if (s.star >= 3) {
        // Venomous Kiss: a bubbling cauldron of heart-shaped poison bubbles.
        const x = s.w * 0.2;
        const y = s.gy + 2 * s.u;
        ellipse(s.c, x, y - 5 * s.u, 8 * s.u, 6.5 * s.u, '#2c2438', s.line, lw(s, 0.6));
        ellipse(s.c, x, y - 10 * s.u, 7 * s.u, 1.8 * s.u, s.p.accent, s.line, lw(s, 0.5));
        glowAt(s, x, y - 12 * s.u, 12 * s.u, s.p.accent, 0.55);
        for (const [dx, dy, k] of [
          [-2, -15, 1],
          [2.5, -19, 1.3],
          [-0.5, -24, 0.9],
        ])
          drawHeart(s.c, x + dx * s.u, y + dy * s.u, 1.6 * k * s.u, s.p.accent);
      }
    },
    front: (s) => {
      if (s.star >= 5) {
        // Devil's Pact: a glowing summoning circle on the floor with drifting runes.
        const x = s.w * 0.5;
        const y = s.h * 0.88;
        s.c.save();
        s.c.strokeStyle = s.p.accent2;
        s.c.shadowColor = s.p.accent2;
        s.c.shadowBlur = 5 * s.u;
        s.c.lineWidth = lw(s, 0.8);
        for (const r of [1, 0.78]) {
          s.c.beginPath();
          s.c.ellipse(x, y, s.w * 0.36 * r, 7 * s.u * r, 0, 0, TAU);
          s.c.stroke();
        }
        s.c.beginPath();
        for (let i = 0; i <= 5; i++) {
          const a = (i * 2 * TAU) / 5 - Math.PI / 2;
          const px = x + Math.cos(a) * s.w * 0.28;
          const py = y + Math.sin(a) * 5.4 * s.u;
          if (i === 0) s.c.moveTo(px, py);
          else s.c.lineTo(px, py);
        }
        s.c.stroke();
        s.c.restore();
        s.c.fillStyle = s.p.accent2;
        s.c.font = `${4 * s.u}px serif`;
        s.c.textAlign = 'center';
        ['ᚠ', 'ᚱ', 'ᛉ', 'ᛟ'].forEach((r, i) => s.c.fillText(r, s.w * (0.12 + i * 0.25), s.h * (0.2 + (i % 2) * 0.08)));
      }
    },
  },
};

/** Fallback for a future cat without its own scene yet: a gentle meadow (stars still evolve it). */
const FALLBACK: SceneDef = {
  light: CAT_SCENES.kitten!.light,
  moonlit: CAT_SCENES.kitten!.moonlit,
  back: (s) => {
    skyLight(s, s.w * 0.8, s.h * 0.16, 6 * s.u);
    skyStars(s, 16);
    hill(s, s.w * 0.3, s.w * 0.8, 14 * s.u, s.p.far);
  },
  mid: (s) => {
    if (s.star >= 2) bush(s, s.w * 0.1, s.gy, 1, s.p.mid);
  },
};

export function sceneFor(cat: string): SceneDef {
  return CAT_SCENES[cat as CatId] ?? FALLBACK;
}

// ---------------------------------------------------------------------------
// Shared star-rank presentation (same for every cat)
// ---------------------------------------------------------------------------

function groundDetail(s: SceneCtx) {
  const r = rng(s.w | 0);
  const col = rgba(s.p.ground2, 0.9);
  const hi = rgba(s.p.glow, 0.35);
  for (let i = 0; i < 16; i++) {
    const x = r() * s.w;
    const y = s.gy + (0.15 + r() * 0.8) * (s.h - s.gy);
    if (Math.abs(x - s.w / 2) < s.w * 0.14) continue; // keep the cat's spot clean
    ellipse(s.c, x, y, (1.2 + r()) * s.u, 0.5 * s.u, i % 3 ? col : hi);
  }
}

/** 5★ collectible-card frame: ornate corners and an inner border in the place's accent colour. */
function cardFrame(s: SceneCtx) {
  const c = s.c;
  const m = 2.2 * s.u;
  c.save();
  c.strokeStyle = s.p.accent2;
  c.lineWidth = lw(s, 0.9);
  c.globalAlpha = 0.9;
  c.strokeRect(m, m, s.w - 2 * m, s.h - 2 * m);
  c.lineWidth = lw(s, 0.45);
  c.strokeRect(m * 1.8, m * 1.8, s.w - 3.6 * m, s.h - 3.6 * m);
  for (const [x, y, sx, sy] of [
    [m, m, 1, 1],
    [s.w - m, m, -1, 1],
    [m, s.h - m, 1, -1],
    [s.w - m, s.h - m, -1, -1],
  ]) {
    c.save();
    c.translate(x, y);
    c.scale(sx, sy);
    c.lineWidth = lw(s, 0.8);
    c.beginPath();
    c.moveTo(0, 9 * s.u);
    c.quadraticCurveTo(0, 0, 9 * s.u, 0);
    c.moveTo(2.5 * s.u, 6 * s.u);
    c.quadraticCurveTo(5.5 * s.u, 5.5 * s.u, 6 * s.u, 2.5 * s.u);
    c.stroke();
    circle(c, 3.2 * s.u, 3.2 * s.u, 1.3 * s.u, s.p.accent, s.line, lw(s, 0.3));
    c.restore();
  }
  c.restore();
}

/** Paint the scene for a cat at a permanent star rank (1–5) in the given theme. */
export function drawCatScene(ctx: Ctx, w: number, h: number, cat: string, star: number, theme: ThemeId): void {
  const def = sceneFor(cat);
  const night = theme === 'moonlit';
  const p = night ? def.moonlit : def.light;
  const u = h / 80;
  const s: SceneCtx = {
    c: ctx,
    w,
    h,
    u,
    star: Math.max(1, Math.min(5, Math.round(star))),
    night,
    p,
    line: night ? 'rgba(20,14,36,0.7)' : 'rgba(92,64,51,0.55)',
    gy: h * (def.ground ?? 0.72),
    rnd: rng(cat.length * 97 + star),
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, s.gy);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(1, p.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  def.back?.(s);
  // Floor.
  const fl = ctx.createLinearGradient(0, s.gy, 0, h);
  fl.addColorStop(0, p.ground);
  fl.addColorStop(1, p.ground2);
  ctx.fillStyle = fl;
  ctx.fillRect(0, s.gy, w, h - s.gy);
  if (cat === 'orange') tiledFloor(s, rgba(p.wood, 0.25));
  // A soft pool of light where the cat stands keeps it the focal point at every rank.
  glowAt(s, w * 0.5, s.gy + 3 * u, (18 + s.star * 3) * u, p.glow, 0.3 + s.star * 0.06);
  // 2★+: the place gets lived-in detail on the ground (tufts, specks, scuffs).
  if (s.star >= 2) groundDetail(s);
  def.mid?.(s);
  // 3★+: the Special Ability's colour gathers around the cat (a quiet halo, stronger at 5★).
  if (s.star >= 3) glowAt(s, w * 0.5, h * 0.5, (s.star >= 5 ? 34 : 26) * u, p.accent, s.star >= 5 ? 0.32 : 0.2);
  def.front?.(s);
  // 4★+: layered, warmer lighting (vignette); 5★: the collectible frame.
  if (s.star >= 4) {
    const v = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, night ? 'rgba(8,4,20,0.45)' : 'rgba(90,60,40,0.18)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  if (s.star >= 5) cardFrame(s);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Cache (scenes are static: draw once per cat / rank / theme / size)
// ---------------------------------------------------------------------------

const cache = new Map<string, HTMLCanvasElement>();

export function sceneCanvas(cat: string, star: number, theme: ThemeId, w: number, h: number, dpr: number): HTMLCanvasElement {
  const key = `${cat}|${star}|${theme}|${w}x${h}@${dpr}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawCatScene(ctx, w, h, cat, star, theme);
    }
    if (cache.size > 80) cache.delete(cache.keys().next().value as string);
    cache.set(key, cv);
  }
  return cv;
}
