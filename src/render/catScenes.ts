// Character backgrounds for the Cat Encyclopedia (collection cards + profile pages).
//
// Every cat owns one location in the same storybook world. The scene is built from layers and
// grows with the cat's PERMANENT star rank (1★–5★, never the in-battle Lv.). It is always the
// SAME place — each star only adds to it, so upgrading a cat visibly furnishes its world:
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
  /** An indoor room: its own floor painter replaces the outdoor ground speckles. */
  floor?: (s: SceneCtx) => void;
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

// ---- Indoor rooms (V1.6 personal scenes) ----

/** Little repeating wallpaper motif (dots, hearts, stars or fish) over the wall. */
function wallpaper(s: SceneCtx, color: string, motif: 'dot' | 'heart' | 'star' | 'fish' | 'diamond', step = 9) {
  const c = s.c;
  const st = step * s.u;
  let row = 0;
  for (let y = st * 0.6; y < s.gy - 2 * s.u; y += st, row++) {
    for (let x = (row % 2 ? st / 2 : 0) + st * 0.2; x < s.w; x += st) {
      const k = s.u * 0.9;
      if (motif === 'dot') circle(c, x, y, k * 0.9, color);
      else if (motif === 'heart') drawHeart(c, x, y, k * 1.6, color);
      else if (motif === 'star') drawStar(c, x, y, k * 1.3, color);
      else if (motif === 'diamond') poly(c, [x, y - k * 1.6, x + k, y, x, y + k * 1.6, x - k, y], color);
      else {
        ellipse(c, x, y, k * 1.6, k * 0.8, color);
        poly(c, [x + k * 1.3, y, x + k * 2.4, y - k * 0.8, x + k * 2.4, y + k * 0.8], color);
      }
    }
  }
}

/** Wooden floorboards with staggered joints. */
function plankFloor(s: SceneCtx, line: string) {
  const c = s.c;
  const fh = s.h - s.gy;
  c.strokeStyle = line;
  c.lineWidth = lw(s, 0.4);
  const rows = 4;
  for (let i = 1; i <= rows; i++) {
    const y = s.gy + fh * (i / (rows + 0.6)) ** 1.25;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(s.w, y);
    c.stroke();
    const prev = s.gy + fh * ((i - 1) / (rows + 0.6)) ** 1.25;
    for (let x = (i % 2) * 9 * s.u; x < s.w; x += 18 * s.u) {
      c.beginPath();
      c.moveTo(x, prev);
      c.lineTo(x, y);
      c.stroke();
    }
  }
}

/** A skirting board where wall meets floor. */
function skirting(s: SceneCtx, color: string) {
  roundRect(s.c, -2, s.gy - 2.2 * s.u, s.w + 4, 2.6 * s.u, 0, color, s.line, lw(s, 0.4));
}

/** Oval rug with a trim ring (sits under the cat). */
function rug(s: SceneCtx, x: number, y: number, rx: number, ry: number, fill: string, trim: string) {
  ellipse(s.c, x, y, rx, ry, fill, s.line, lw(s, 0.5));
  s.c.strokeStyle = trim;
  s.c.lineWidth = lw(s, 0.8);
  s.c.beginPath();
  s.c.ellipse(x, y, rx * 0.8, ry * 0.72, 0, 0, TAU);
  s.c.stroke();
}

/** What a window shows: daytime sky with a cloud, or night sky with the moon and stars. */
function windowSky(s: SceneCtx, x: number, y: number, w: number, h: number) {
  const c = s.c;
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, s.night ? '#1d2350' : '#9fd8ff');
  g.addColorStop(1, s.night ? '#3a3f7a' : '#e2f4ff');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  if (s.night) {
    const r = rng(41);
    for (let i = 0; i < 7; i++) circle(c, x + r() * w, y + r() * h, s.u * 0.45, '#fff6d8');
    circle(c, x + w * 0.68, y + h * 0.3, Math.min(w, h) * 0.16, '#fff1c9');
    circle(c, x + w * 0.74, y + h * 0.26, Math.min(w, h) * 0.13, '#1d2350');
  } else {
    ellipse(c, x + w * 0.35, y + h * 0.4, w * 0.2, h * 0.08, 'rgba(255,255,255,0.9)');
    circle(c, x + w * 0.72, y + h * 0.28, Math.min(w, h) * 0.12, '#ffe9a0');
  }
}

function roundWindow(s: SceneCtx, x: number, y: number, r: number, frame: string) {
  const c = s.c;
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.clip();
  windowSky(s, x - r, y - r, r * 2, r * 2);
  c.restore();
  c.strokeStyle = frame;
  c.lineWidth = lw(s, 2.2);
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.stroke();
  c.lineWidth = lw(s, 0.9);
  c.beginPath();
  c.moveTo(x - r, y);
  c.lineTo(x + r, y);
  c.moveTo(x, y - r);
  c.lineTo(x, y + r);
  c.stroke();
}

/** Tall arched window (palace bedroom) with a sill. */
function tallWindow(s: SceneCtx, x: number, top: number, w: number, h: number, frame: string) {
  const c = s.c;
  const path = () => {
    c.beginPath();
    c.moveTo(x - w / 2, top + h);
    c.lineTo(x - w / 2, top + w / 2);
    c.arc(x, top + w / 2, w / 2, Math.PI, 0);
    c.lineTo(x + w / 2, top + h);
    c.closePath();
  };
  c.save();
  path();
  c.clip();
  windowSky(s, x - w / 2, top, w, h);
  c.restore();
  path();
  c.strokeStyle = frame;
  c.lineWidth = lw(s, 1.8);
  c.stroke();
  c.lineWidth = lw(s, 0.7);
  c.beginPath();
  c.moveTo(x, top + w * 0.15);
  c.lineTo(x, top + h);
  for (const f of [0.5, 0.75]) {
    c.moveTo(x - w / 2, top + h * f);
    c.lineTo(x + w / 2, top + h * f);
  }
  c.stroke();
  roundRect(c, x - w * 0.62, top + h - 0.4 * s.u, w * 1.24, 2.2 * s.u, 0.6 * s.u, frame, s.line, lw(s, 0.4));
}

/** A floor cushion / pillow with a little button. */
function pillow(s: SceneCtx, x: number, y: number, k: number, fill: string, trim: string) {
  const u = s.u * k;
  const c = s.c;
  c.beginPath();
  c.moveTo(x - 7 * u, y - 3.5 * u);
  c.quadraticCurveTo(x, y - 6 * u, x + 7 * u, y - 3.5 * u);
  c.quadraticCurveTo(x + 8.5 * u, y, x + 7 * u, y + 3.5 * u);
  c.quadraticCurveTo(x, y + 5.5 * u, x - 7 * u, y + 3.5 * u);
  c.quadraticCurveTo(x - 8.5 * u, y, x - 7 * u, y - 3.5 * u);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = s.line;
  c.lineWidth = lw(s, 0.6);
  c.stroke();
  circle(c, x, y, 0.9 * u, trim);
}

/** A sitting plush teddy bear. */
function teddy(s: SceneCtx, x: number, y: number, k: number, fur: string, belly: string, bow: string) {
  const u = s.u * k;
  const c = s.c;
  const L = lw(s, 0.55);
  ellipse(c, x - 3.6 * u, y - 1 * u, 2.2 * u, 1.6 * u, fur, s.line, L); // feet
  ellipse(c, x + 3.6 * u, y - 1 * u, 2.2 * u, 1.6 * u, fur, s.line, L);
  ellipse(c, x, y - 5 * u, 5 * u, 5.5 * u, fur, s.line, L); // body
  ellipse(c, x, y - 4.2 * u, 3 * u, 3.4 * u, belly);
  circle(c, x - 3.6 * u, y - 14.5 * u, 1.9 * u, fur, s.line, L); // ears
  circle(c, x + 3.6 * u, y - 14.5 * u, 1.9 * u, fur, s.line, L);
  circle(c, x, y - 11.5 * u, 4.4 * u, fur, s.line, L); // head
  ellipse(c, x, y - 10.4 * u, 2 * u, 1.5 * u, belly);
  circle(c, x - 1.5 * u, y - 12.4 * u, 0.5 * u, s.line);
  circle(c, x + 1.5 * u, y - 12.4 * u, 0.5 * u, s.line);
  circle(c, x, y - 10.8 * u, 0.55 * u, s.line);
  poly(c, [x, y - 7.6 * u, x - 2.6 * u, y - 8.8 * u, x - 2.6 * u, y - 6.4 * u], bow, s.line, lw(s, 0.35));
  poly(c, [x, y - 7.6 * u, x + 2.6 * u, y - 8.8 * u, x + 2.6 * u, y - 6.4 * u], bow, s.line, lw(s, 0.35));
}

/** A string of round light bulbs between two points. */
function stringLights(s: SceneCtx, x0: number, y0: number, x1: number, y1: number, colors: string[]) {
  const c = s.c;
  const sag = 5 * s.u;
  c.strokeStyle = s.line;
  c.lineWidth = lw(s, 0.4);
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
  c.stroke();
  const n = 11;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2) + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + sag * 2) + t * t * y1;
    const col = colors[i % colors.length];
    if (s.night) glowAt(s, x, y + 1.2 * s.u, 3.2 * s.u, col, 0.55);
    circle(c, x, y + 1.2 * s.u, 0.9 * s.u, col, s.line, lw(s, 0.3));
  }
}

/** Crystal chandelier hanging from the ceiling. */
function chandelier(s: SceneCtx, x: number, k: number, gold: string, glow: string) {
  const u = s.u * k;
  const c = s.c;
  glowAt(s, x, 12 * u, 20 * u, glow, s.night ? 0.55 : 0.35);
  c.fillStyle = gold;
  c.fillRect(x - 0.3 * u, 0, 0.6 * u, 6 * u);
  ellipse(c, x, 9 * u, 9 * u, 2.4 * u, gold, s.line, lw(s, 0.45));
  for (const dx of [-7, -3.5, 0, 3.5, 7]) {
    c.fillStyle = gold;
    c.fillRect(x + dx * u - 0.3 * u, 6.5 * u, 0.6 * u, 2.2 * u);
    ellipse(c, x + dx * u, 6.2 * u, 0.6 * u, 1.1 * u, '#fff6dc'); // candle flame
    poly(c, [x + dx * u, 11 * u, x + dx * u - 0.9 * u, 12.8 * u, x + dx * u, 15 * u, x + dx * u + 0.9 * u, 12.8 * u], 'rgba(230,240,255,0.95)', s.line, lw(s, 0.3)); // crystal drop
  }
}

/** Scalloped fabric valance along the top of the room. */
function scallopValance(s: SceneCtx) {
  const c = s.c;
  const col = s.night ? '#9d7cc9' : '#ffb8d6';
  const r = 4 * s.u;
  c.fillStyle = col;
  c.fillRect(0, 0, s.w, 2 * s.u);
  for (let x = r; x < s.w + r; x += r * 2) {
    c.beginPath();
    c.arc(x, 2 * s.u, r, 0, Math.PI);
    c.fill();
  }
  c.fillStyle = s.p.wood;
  c.fillRect(0, 0, s.w, 0.8 * s.u);
}

/** A gold crown (s.u-sized). */
function crown(s: SceneCtx, x: number, y: number, k: number, gold: string, gem: string) {
  const u = s.u * k;
  poly(s.c, [x - 4 * u, y, x - 4 * u, y - 4 * u, x - 2 * u, y - 2 * u, x, y - 5 * u, x + 2 * u, y - 2 * u, x + 4 * u, y - 4 * u, x + 4 * u, y], gold, s.line, lw(s, 0.45));
  for (const dx of [-4, 0, 4]) circle(s.c, x + dx * u, y - (dx ? 4.3 : 5.3) * u, 0.7 * u, gem);
}

/** Sparkle glints (4-point stars). */
function sparkles(s: SceneCtx, n: number, color: string, seed: number, top = 0, bottom = s.gy) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * s.w;
    const y = top + r() * (bottom - top);
    if (Math.abs(x - s.w / 2) < s.w * 0.12 && y > s.h * 0.3) continue;
    drawStar(s.c, x, y, (0.8 + r() * 1.1) * s.u, color, 4, 0.35);
  }
}

// ---------------------------------------------------------------------------
// The ten locations
// ---------------------------------------------------------------------------

const P = (o: ScenePalette) => o;

export const CAT_SCENES: Partial<Record<CatId, SceneDef>> = {
  // Kitty B (貓B) — a cozy nursery for the baby of the team. Special: Brave Yarn. Ultimate: Heroic Burst.
  kitten: {
    ground: 0.7,
    light: P({ skyTop: '#ffe4d4', skyBottom: '#fff4ea', far: '#ffcdb8', mid: '#ffb8a0', ground: '#f3d9bb', ground2: '#e9c8a2', accent: '#ff8a5c', accent2: '#ffd166', glow: '#fff1c8', wood: '#e2b483', stone: '#bfe1f2' }),
    moonlit: P({ skyTop: '#2f2b52', skyBottom: '#463f70', far: '#5c5288', mid: '#76679f', ground: '#5c4b66', ground2: '#4e3f58', accent: '#ff9d76', accent2: '#ffd98a', glow: '#ffe2a8', wood: '#8f6e58', stone: '#7fa6cc' }),
    floor: (s) => plankFloor(s, rgba(s.p.wood, s.night ? 0.45 : 0.55)),
    back: (s) => {
      // 1★: a plain little room. 2★: star wallpaper and a round window.
      if (s.star >= 2) {
        wallpaper(s, rgba(s.p.far, s.night ? 0.55 : 0.8), 'star', 10);
        roundWindow(s, s.w * 0.17, s.h * 0.27, 9 * s.u, s.p.wood);
        if (s.night) glowAt(s, s.w * 0.17, s.h * 0.27, 18 * s.u, '#cfd8ff', 0.25);
      }
      skirting(s, s.p.wood);
      if (s.star >= 4) {
        // A baby mobile of stars and a moon hanging from the ceiling.
        const x = s.w * 0.74;
        s.c.fillStyle = s.line;
        s.c.fillRect(x - 0.25 * s.u, 0, 0.5 * s.u, 6 * s.u);
        s.c.fillRect(x - 9 * s.u, 6 * s.u, 18 * s.u, 0.6 * s.u);
        for (const [dx, len, kind] of [
          [-8, 6, 'star'],
          [-3, 10, 'moon'],
          [3, 8, 'star'],
          [8, 5, 'heart'],
        ] as const) {
          s.c.fillRect(x + dx * s.u - 0.15 * s.u, 6 * s.u, 0.3 * s.u, len * s.u);
          const y = (7 + len) * s.u;
          if (kind === 'star') drawStar(s.c, x + dx * s.u, y, 1.9 * s.u, s.p.accent2);
          else if (kind === 'heart') drawHeart(s.c, x + dx * s.u, y, 2.6 * s.u, '#ff9ecb');
          else {
            circle(s.c, x + dx * s.u, y, 2 * s.u, s.p.stone);
            circle(s.c, x + dx * s.u + 0.9 * s.u, y - 0.5 * s.u, 1.7 * s.u, s.p.skyTop);
          }
        }
      }
      if (s.star >= 4) {
        // The crib and a toy shelf, under a pastel garland.
        const x0 = s.w * 0.84;
        const top = s.gy - 18 * s.u;
        roundRect(s.c, x0, top + 9 * s.u, s.w * 0.2, 9 * s.u, s.u, rgba(s.p.stone, 0.9), s.line, lw(s, 0.5)); // blanket
        s.c.fillStyle = s.p.wood;
        s.c.fillRect(x0 - s.u, top, s.w * 0.2, 1.3 * s.u);
        for (let x = x0; x < s.w + 2 * s.u; x += 3 * s.u) roundRect(s.c, x, top, 1.1 * s.u, 18 * s.u, 0.5 * s.u, s.p.wood, s.line, lw(s, 0.3));
        const sy = s.h * 0.42;
        roundRect(s.c, s.w * 0.03, sy, s.w * 0.24, 1.4 * s.u, 0.4 * s.u, s.p.wood, s.line, lw(s, 0.4));
        for (const [i, col] of [s.p.accent, s.p.stone, s.p.accent2].entries()) {
          const bx = s.w * 0.05 + i * 5 * s.u;
          roundRect(s.c, bx, sy - 4 * s.u, 4 * s.u, 4 * s.u, 0.6 * s.u, col, s.line, lw(s, 0.4));
        }
        bunting(s, 0, s.h * 0.05, s.w, s.h * 0.07, ['#ffb3c8', s.p.stone, s.p.accent2, '#c9f0c0']);
      }
      if (s.star >= 5) {
        // Heroic Burst: a glowing star night-light, with star stickers all over the wall.
        sparkles(s, 16, s.p.accent2, 13, 2 * s.u, s.gy - 6 * s.u);
        const x = s.w * 0.36;
        const y = s.h * 0.2;
        lightRays(s, x, y, s.p.accent2, 9, 2.8);
        glowAt(s, x, y, 16 * s.u, s.p.glow, 0.7);
        drawStar(s.c, x, y, 5.5 * s.u, s.p.accent2);
        drawStar(s.c, x, y, 3 * s.u, '#fff6d8');
      }
    },
    mid: (s) => {
      // A soft round rug, and a big pillow to flop onto.
      rug(s, s.w * 0.5, s.gy + 9 * s.u, 30 * s.u, 6.5 * s.u, s.night ? '#7c6aa6' : '#cfe8f7', s.night ? '#ffd98a' : '#ffffff');
      pillow(s, s.w * 0.12, s.gy + 2 * s.u, 1.05, s.night ? '#c9a8e8' : '#ffd0dc', '#ffffff');
      if (s.star >= 3) {
        // A plush teddy and alphabet blocks.
        teddy(s, s.w * 0.87, s.gy + 4 * s.u, 1, s.night ? '#c9935f' : '#e2a96e', '#f7dcc0', s.p.accent);
        for (const [dx, dy, col] of [
          [0, 0, s.p.accent2],
          [4.6, 0, s.p.stone],
          [2.3, -4.6, '#ffb3c8'],
        ] as const)
          roundRect(s.c, s.w * 0.23 + dx * s.u, s.gy + 1 * s.u + dy * s.u, 4.4 * s.u, 4.4 * s.u, 0.7 * s.u, col, s.line, lw(s, 0.45));
      }
    },
    front: (s) => {
      if (s.star >= 3) {
        // Brave Yarn: a ball of yarn rolling out of a basket, its thread trailing behind.
        const x = s.w * 0.3;
        const y = s.h * 0.92;
        s.c.strokeStyle = s.p.accent;
        s.c.lineWidth = lw(s, 0.8);
        s.c.beginPath();
        s.c.moveTo(x, y);
        s.c.bezierCurveTo(x - 8 * s.u, y - 6 * s.u, x - 12 * s.u, y + 4 * s.u, x - 20 * s.u, y - 2 * s.u);
        s.c.stroke();
        circle(s.c, x, y, 4.5 * s.u, s.p.accent, s.line, lw(s, 0.6));
        s.c.strokeStyle = 'rgba(255,255,255,0.55)';
        for (const a of [-0.6, 0, 0.6]) {
          s.c.beginPath();
          s.c.ellipse(x, y, 4.5 * s.u, 1.8 * s.u, a, 0, TAU);
          s.c.stroke();
        }
        roundRect(s.c, s.w * 0.02, s.h * 0.86, 11 * s.u, 7 * s.u, 2 * s.u, s.p.wood, s.line, lw(s, 0.5));
        circle(s.c, s.w * 0.02 + 4 * s.u, s.h * 0.86, 2.5 * s.u, s.p.stone, s.line, lw(s, 0.4));
        circle(s.c, s.w * 0.02 + 7.5 * s.u, s.h * 0.86, 2.3 * s.u, '#ffb3c8', s.line, lw(s, 0.4));
      }
    },
  },

  // Tabby Warrior — a training yard in the forest: dummies, practice posts, a dojo hall. Special: Finishing Blow. Ultimate: Hundred-Paw Flurry.
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
      // 2★: the yard gets its wooden fence.
      if (s.star >= 2) fence(s, 0, s.w, s.night ? '#a38f78' : '#d8b98c');
      if (s.star >= 4) {
        // The dojo hall behind the yard, with paper lanterns, and an old tree.
        const hx = s.w * 0.5;
        const top = s.gy - 24 * s.u;
        roundRect(s.c, hx - 26 * s.u, top, 52 * s.u, 24 * s.u, 0, s.p.wood, s.line, lw(s, 0.5));
        for (let x = hx - 22 * s.u; x < hx + 22 * s.u; x += 8.8 * s.u) roundRect(s.c, x, top + 5 * s.u, 7 * s.u, 12 * s.u, 0.4 * s.u, s.night ? '#ffe2a6' : '#fbf3e2', s.line, lw(s, 0.35));
        poly(s.c, [hx - 33 * s.u, top + 1 * s.u, hx + 33 * s.u, top + 1 * s.u, hx + 24 * s.u, top - 9 * s.u, hx - 24 * s.u, top - 9 * s.u], s.night ? '#3d3348' : '#5c4a5e', s.line, lw(s, 0.5));
        roundRect(s.c, hx - 7 * s.u, top - 12.5 * s.u, 14 * s.u, 3.5 * s.u, 0.5 * s.u, s.p.accent, s.line, lw(s, 0.4)); // banner board
        for (const dx of [-30, 30]) lantern(s, hx + dx * s.u, top + 4 * s.u, 0.9, s.p.accent);
        fence(s, 0, s.w, s.night ? '#a38f78' : '#d8b98c');
        tree(s, s.w * 0.06, 1.2, s.p.mid);
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
      // 2★: a rope-wrapped striking post. 3★: stepping stumps for footwork drills.
      if (s.star >= 2) {
        const px = s.w * 0.16;
        roundRect(s.c, px - 2 * s.u, s.gy - 16 * s.u, 4 * s.u, 17 * s.u, 0.8 * s.u, s.p.wood, s.line, lw(s, 0.5));
        s.c.strokeStyle = '#e9d6a8';
        s.c.lineWidth = lw(s, 0.9);
        for (let y = s.gy - 14 * s.u; y < s.gy - 6 * s.u; y += 1.6 * s.u) {
          s.c.beginPath();
          s.c.moveTo(px - 2 * s.u, y);
          s.c.lineTo(px + 2 * s.u, y + 0.8 * s.u);
          s.c.stroke();
        }
      }
      if (s.star >= 3)
        for (const [dx, dy] of [
          [0.3, 6],
          [0.36, 10],
          [0.66, 9],
        ])
          ellipse(s.c, s.w * dx, s.gy + dy * s.u, 3.4 * s.u, 1.4 * s.u, '#c58f5c', s.line, lw(s, 0.45));
      if (s.star >= 3) {
        // Weapon rack with wooden practice swords, a water bucket and a towel.
        const rx = s.w * 0.04;
        s.c.fillStyle = s.p.wood;
        s.c.fillRect(rx - 3 * s.u, s.gy - 11 * s.u, 10 * s.u, 1.4 * s.u);
        for (const dx of [-1, 2, 5]) roundRect(s.c, rx + dx * s.u - 0.6 * s.u, s.gy - 15 * s.u, 1.2 * s.u, 15 * s.u, 0.5 * s.u, '#d8b27a', s.line, lw(s, 0.4));
        const bx = s.w * 0.72;
        poly(s.c, [bx - 3 * s.u, s.gy - 4 * s.u, bx + 3 * s.u, s.gy - 4 * s.u, bx + 2.3 * s.u, s.gy + 2 * s.u, bx - 2.3 * s.u, s.gy + 2 * s.u], s.p.wood, s.line, lw(s, 0.45));
        ellipse(s.c, bx, s.gy - 4 * s.u, 3 * s.u, 0.8 * s.u, '#7fc8e8', s.line, lw(s, 0.35));
        poly(s.c, [s.w * 0.84 - 4.5 * s.u, s.gy - 15 * s.u, s.w * 0.84 - 1 * s.u, s.gy - 15 * s.u, s.w * 0.84 - 1.6 * s.u, s.gy - 9 * s.u, s.w * 0.84 - 4 * s.u, s.gy - 10 * s.u], s.night ? '#e9e2f5' : '#ffffff', s.line, lw(s, 0.35));
        for (const fx of [0.52, 0.58]) flower(s, s.w * fx, s.gy + 1 * s.u, 0.8, s.p.accent2);
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
        // The champion's trophy.
        const tx = s.w * 0.2;
        const ty = s.h * 0.96;
        roundRect(s.c, tx - 4 * s.u, ty - 2.5 * s.u, 8 * s.u, 2.5 * s.u, 0.5 * s.u, s.p.wood, s.line, lw(s, 0.4));
        roundRect(s.c, tx - 1 * s.u, ty - 6 * s.u, 2 * s.u, 3.6 * s.u, 0.4 * s.u, '#f2c14e', s.line, lw(s, 0.4));
        s.c.beginPath();
        s.c.moveTo(tx - 4.5 * s.u, ty - 12 * s.u);
        s.c.quadraticCurveTo(tx, ty - 3 * s.u, tx + 4.5 * s.u, ty - 12 * s.u);
        s.c.closePath();
        s.c.fillStyle = '#f2c14e';
        s.c.fill();
        s.c.strokeStyle = s.line;
        s.c.lineWidth = lw(s, 0.45);
        s.c.stroke();
        drawStar(s.c, tx, ty - 9.5 * s.u, 1.4 * s.u, '#fff6d8');
      }
    },
  },

  // Big Orange (大肥橙) — a lazy snack corner at home: big beanbag, food everywhere. Special: Aftershock. Ultimate: Mega Belly Slam.
  orange: {
    ground: 0.66,
    light: P({ skyTop: '#ffe1bd', skyBottom: '#fff1dc', far: '#f8c58e', mid: '#eaa46a', ground: '#f0d0a4', ground2: '#e3bb88', accent: '#ff8c42', accent2: '#e94f4f', glow: '#ffe8a8', wood: '#b9784a', stone: '#f1e6d6' }),
    moonlit: P({ skyTop: '#3d2b3d', skyBottom: '#5a3f4d', far: '#6f4b55', mid: '#86595b', ground: '#6f5560', ground2: '#5f4753', accent: '#ff9c5c', accent2: '#ff6f6f', glow: '#ffcf86', wood: '#7a5040', stone: '#8a7a88' }),
    floor: (s) => plankFloor(s, rgba(s.p.wood, 0.4)),
    back: (s) => {
      // 1★: a plain warm corner. 2★: fish wallpaper and a sunny (or moonlit) window.
      if (s.star >= 2) {
        wallpaper(s, rgba(s.p.far, s.night ? 0.6 : 0.75), 'fish', 11);
        tallWindow(s, s.w * 0.2, s.h * 0.08, 18 * s.u, s.gy - s.h * 0.08 - 14 * s.u, s.p.wood);
      }
      skirting(s, s.p.wood);
      if (s.star >= 3) {
        // A snack shelf: fish-cracker jar, cans and a bowl of dango.
        const y = s.h * 0.34;
        roundRect(s.c, s.w * 0.62, y, s.w * 0.3, 1.5 * s.u, 0.4 * s.u, s.p.wood, s.line, lw(s, 0.4));
        const jx = s.w * 0.67;
        roundRect(s.c, jx - 3.5 * s.u, y - 10 * s.u, 7 * s.u, 10 * s.u, 2 * s.u, 'rgba(255,255,255,0.6)', s.line, lw(s, 0.5));
        roundRect(s.c, jx - 3 * s.u, y - 11.5 * s.u, 6 * s.u, 2 * s.u, 0.8 * s.u, s.p.accent2, s.line, lw(s, 0.4));
        for (let i = 0; i < 4; i++) ellipse(s.c, jx - 1.4 * s.u + (i % 2) * 2.8 * s.u, y - 7 * s.u + Math.floor(i / 2) * 3 * s.u, 1.4 * s.u, 0.7 * s.u, s.p.accent);
        for (const [i, col] of ['#7fc8e8', s.p.accent2, '#7fc8e8'].entries())
          roundRect(s.c, s.w * 0.75 + i * 4.2 * s.u, y - 5 * s.u, 3.6 * s.u, 5 * s.u, 0.6 * s.u, col, s.line, lw(s, 0.4));
      }
      if (s.star >= 4) {
        // The fridge (covered in fish magnets) + warm string lights.
        const fx = s.w * 0.04;
        roundRect(s.c, fx - 4 * s.u, s.gy - 34 * s.u, 15 * s.u, 34 * s.u, 2 * s.u, s.night ? '#c9c3d6' : '#ffffff', s.line, lw(s, 0.6));
        s.c.fillStyle = s.line;
        s.c.fillRect(fx - 4 * s.u, s.gy - 22 * s.u, 15 * s.u, 0.5 * s.u);
        for (const [dx, dy, col] of [
          [2, -30, s.p.accent],
          [7, -27, '#7fc8e8'],
          [4, -17, s.p.accent2],
        ] as const) {
          ellipse(s.c, fx + dx * s.u, s.gy + dy * s.u, 1.6 * s.u, 0.8 * s.u, col);
          poly(s.c, [fx + (dx + 1.3) * s.u, s.gy + dy * s.u, fx + (dx + 2.3) * s.u, s.gy + (dy - 0.8) * s.u, fx + (dx + 2.3) * s.u, s.gy + (dy + 0.8) * s.u], col);
        }
        stringLights(s, 0, s.h * 0.04, s.w, s.h * 0.06, ['#ffcf5a', '#ff8c42', '#ffe8a8']);
      }
    },
    mid: (s) => {
      // The giant squishy beanbag he naps on, and his food bowl full of fish.
      const bx = s.w * 0.5;
      const by = s.gy + 8 * s.u;
      ellipse(s.c, bx, by, 24 * s.u, 8 * s.u, s.night ? '#c8693a' : '#ff9a52', s.line, lw(s, 0.6));
      ellipse(s.c, bx - 6 * s.u, by - 3 * s.u, 9 * s.u, 3 * s.u, s.night ? '#d98050' : '#ffb57a');
      const fx = s.w * 0.86;
      ellipse(s.c, fx, s.gy + 4 * s.u, 7 * s.u, 2 * s.u, s.p.accent2, s.line, lw(s, 0.5));
      roundRect(s.c, fx - 6 * s.u, s.gy + 1 * s.u, 12 * s.u, 3 * s.u, 1.4 * s.u, s.p.accent2, s.line, lw(s, 0.5));
      for (const dx of [-3, 0, 3]) {
        ellipse(s.c, fx + dx * s.u, s.gy + 0.5 * s.u, 1.8 * s.u, 0.9 * s.u, '#9fc8e0', s.line, lw(s, 0.3));
      }
      if (s.star >= 3) {
        // Snack crumbs: a fish bone, a cookie and a half-eaten onigiri.
        const r = s.c;
        r.strokeStyle = s.line;
        r.lineWidth = lw(s, 0.5);
        const x = s.w * 0.16;
        const y = s.gy + 7 * s.u;
        r.beginPath();
        r.moveTo(x - 5 * s.u, y);
        r.lineTo(x + 4 * s.u, y);
        for (let i = -3; i <= 2; i += 1.6) {
          r.moveTo(x + i * s.u, y - 1.6 * s.u);
          r.lineTo(x + i * s.u, y + 1.6 * s.u);
        }
        r.stroke();
        poly(r, [x + 4 * s.u, y, x + 6 * s.u, y - 1.5 * s.u, x + 6 * s.u, y + 1.5 * s.u], s.line);
        circle(r, s.w * 0.26, s.gy + 3 * s.u, 2.4 * s.u, '#d9a35c', s.line, lw(s, 0.4));
        for (const [dx, dy] of [
          [-0.8, -0.6],
          [0.7, 0.4],
          [0.2, -1.2],
        ])
          circle(r, s.w * 0.26 + dx * s.u, s.gy + 3 * s.u + dy * s.u, 0.35 * s.u, '#6b4226');
        poly(r, [s.w * 0.74, s.gy + 10 * s.u, s.w * 0.74 + 3 * s.u, s.gy + 5 * s.u, s.w * 0.74 + 6 * s.u, s.gy + 10 * s.u], '#ffffff', s.line, lw(s, 0.4));
        roundRect(r, s.w * 0.74 + 1.6 * s.u, s.gy + 8 * s.u, 2.8 * s.u, 2 * s.u, 0.3 * s.u, '#2f3a2f');
      }
    },
    front: (s) => {
      if (s.star >= 3) {
        // Aftershock: ripples and cracks spreading over the floor.
        s.c.strokeStyle = s.night ? 'rgba(255,207,134,0.55)' : 'rgba(185,120,74,0.6)';
        s.c.lineWidth = lw(s, 0.8);
        for (const r of [28, 34, 40]) {
          s.c.beginPath();
          s.c.ellipse(s.w * 0.5, s.h * 0.94, r * s.u, r * 0.2 * s.u, 0, 0, TAU);
          s.c.stroke();
        }
      }
      if (s.star >= 5) {
        // Mega Belly Slam: a towering party cake and a mountain of fish snacks, bouncing.
        const x = s.w * 0.9;
        const y = s.h * 0.98;
        roundRect(s.c, x - 9 * s.u, y - 10 * s.u, 18 * s.u, 10 * s.u, 2 * s.u, '#fff4e6', s.line, lw(s, 0.6));
        roundRect(s.c, x - 6.5 * s.u, y - 18 * s.u, 13 * s.u, 8 * s.u, 2 * s.u, '#ffd1dc', s.line, lw(s, 0.6));
        roundRect(s.c, x - 4 * s.u, y - 24 * s.u, 8 * s.u, 6 * s.u, 2 * s.u, '#fff4e6', s.line, lw(s, 0.6));
        circle(s.c, x, y - 26 * s.u, 1.8 * s.u, s.p.accent2, s.line, lw(s, 0.4));
        const r = rng(8);
        for (let i = 0; i < 9; i++) {
          const fx = s.w * 0.06 + r() * s.w * 0.2;
          const fy = s.h * (0.88 + r() * 0.08);
          ellipse(s.c, fx, fy, 2 * s.u, 1 * s.u, i % 2 ? s.p.accent : '#ffcf5a', s.line, lw(s, 0.3));
        }
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

  // Black Cat — a night-watch lookout on the town rooftops. Special: Armor-Piercing Round. Ultimate: Charged Shot.
  black: {
    light: P({ skyTop: '#8fb1d9', skyBottom: '#dbe7f5', far: '#9aa7c2', mid: '#6f7d9c', ground: '#8c6f6a', ground2: '#7a5f5b', accent: '#ffcc33', accent2: '#4dc3ff', glow: '#fff2b0', wood: '#6e5a52', stone: '#a29bb0' }),
    moonlit: P({ skyTop: '#151a33', skyBottom: '#2d3560', far: '#262c4d', mid: '#323a63', ground: '#463a4d', ground2: '#3a3042', accent: '#ffd84a', accent2: '#5fd2ff', glow: '#fff4c4', wood: '#4c3d45', stone: '#5a5670' }),
    ground: 0.74,
    back: (s) => {
      skyStars(s, 30);
      skyLight(s, s.w * 0.78, s.h * 0.2, (s.star >= 5 ? 10 : 7) * s.u);
      if (!s.night) cloud(s, s.w * 0.3, s.h * 0.14, 0.9);
      rooftops(s, s.p.far, 14 * s.u);
      if (s.star >= 2) {
        // 2★: a water tower on the skyline — the best lookout in town.
        const wx = s.w * 0.6;
        const wt = s.gy - 30 * s.u;
        for (const dx of [-4, 4]) {
          s.c.fillStyle = s.p.mid;
          s.c.fillRect(wx + dx * s.u - 0.5 * s.u, wt + 8 * s.u, 1 * s.u, 22 * s.u);
        }
        roundRect(s.c, wx - 6 * s.u, wt, 12 * s.u, 9 * s.u, 1 * s.u, s.p.mid, s.line, lw(s, 0.45));
        poly(s.c, [wx - 7 * s.u, wt, wx + 7 * s.u, wt, wx, wt - 5 * s.u], s.p.mid, s.line, lw(s, 0.45));
      }
      if (s.star >= 4) {
        // A searchlight sweeping the sky.
        s.c.save();
        s.c.globalAlpha = s.night ? 0.2 : 0.12;
        poly(s.c, [s.w * 0.4, s.gy - 14 * s.u, s.w * 0.1, -2 * s.u, s.w * 0.32, -2 * s.u], s.p.glow);
        s.c.restore();
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
      if (s.night && s.star >= 4) {
        // A thin curl of chimney smoke against the night sky.
        s.c.strokeStyle = 'rgba(220,214,240,0.35)';
        s.c.lineWidth = lw(s, 1.4);
        s.c.beginPath();
        s.c.moveTo(s.w * 0.86 + 4 * s.u, s.gy - 17 * s.u);
        s.c.bezierCurveTo(s.w * 0.86 + 8 * s.u, s.gy - 24 * s.u, s.w * 0.86, s.gy - 28 * s.u, s.w * 0.86 + 6 * s.u, s.gy - 36 * s.u);
        s.c.stroke();
      }
      if (s.star >= 3) {
        // 3★ night-watch kit: a lantern on the chimney and binoculars on the ledge.
        lantern(s, s.w * 0.86 + 4 * s.u, s.gy - 19 * s.u, 0.8, s.p.accent);
        const bx = s.w * 0.7;
        const by = s.gy - 2.5 * s.u;
        for (const dx of [-1.6, 1.6]) roundRect(s.c, bx + dx * s.u - 1.3 * s.u, by - 2 * s.u, 2.6 * s.u, 3.6 * s.u, 0.8 * s.u, '#3a3346', s.line, lw(s, 0.35));
        s.c.fillStyle = s.p.accent2;
        for (const dx of [-1.6, 1.6]) s.c.fillRect(bx + dx * s.u - 0.8 * s.u, by - 2.2 * s.u, 1.6 * s.u, 0.6 * s.u);
      }
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

  // Noble White — a princess bedroom in the palace, lit by moonlight. Special: Lingering Charm. Ultimate: Grand Royal Pose.
  white: {
    ground: 0.72,
    light: P({ skyTop: '#fbe0ee', skyBottom: '#fff2f8', far: '#f3c6dd', mid: '#e7add0', ground: '#f7e8f1', ground2: '#ecd5e4', accent: '#ff8fb8', accent2: '#c8a2ff', glow: '#fff3d6', wood: '#e8c27a', stone: '#ffffff' }),
    moonlit: P({ skyTop: '#2d2149', skyBottom: '#47366d', far: '#5a4782', mid: '#6d5697', ground: '#4f4166', ground2: '#43375a', accent: '#ff9fc6', accent2: '#cfb0ff', glow: '#e9e6ff', wood: '#e6c47a', stone: '#d9d0ec' }),
    floor: (s) => {
      // Polished marble with a soft reflection.
      tiledFloor(s, rgba(s.p.mid, 0.35));
      glowAt(s, s.w * 0.5, s.gy + 4 * s.u, 26 * s.u, '#ffffff', s.night ? 0.12 : 0.35);
    },
    back: (s) => {
      // 1★: a plain pink room. 2★: damask wallpaper and panelled wainscoting with gold trim.
      // 3★: the tall moonlit window behind her.
      const wy = s.gy - 13 * s.u;
      if (s.star >= 2) {
        wallpaper(s, rgba(s.p.far, s.night ? 0.6 : 0.85), 'diamond', 8);
        s.c.fillStyle = rgba(s.p.mid, s.night ? 0.55 : 0.45);
        s.c.fillRect(0, wy, s.w, s.gy - wy);
        s.c.fillStyle = s.p.wood;
        s.c.fillRect(0, wy - 0.6 * s.u, s.w, 1.2 * s.u);
        for (let x = 2 * s.u; x < s.w; x += 16 * s.u) roundRect(s.c, x, wy + 2.5 * s.u, 12 * s.u, 7 * s.u, 1 * s.u, 'rgba(255,255,255,0.12)', s.p.wood, lw(s, 0.4));
      }
      if (s.star >= 3) {
        tallWindow(s, s.w * 0.5, s.h * 0.05, 26 * s.u, wy - s.h * 0.05 - 1 * s.u, s.p.wood);
        if (s.night) lightRays(s, s.w * 0.5, s.h * 0.1, '#e9e6ff', 5, 0.7);
        else glowAt(s, s.w * 0.5, s.h * 0.3, 24 * s.u, s.p.glow, 0.45);
      }
      if (s.star >= 4) {
        // Candle sconces glowing on the wall.
        for (const x of [0.22, 0.78]) {
          glowAt(s, s.w * x, s.h * 0.3, 9 * s.u, '#ffe0a0', s.night ? 0.6 : 0.35);
          roundRect(s.c, s.w * x - 1.6 * s.u, s.h * 0.34, 3.2 * s.u, 1.2 * s.u, 0.5 * s.u, s.p.wood, s.line, lw(s, 0.35));
          roundRect(s.c, s.w * x - 0.6 * s.u, s.h * 0.29, 1.2 * s.u, 3.2 * s.u, 0.3 * s.u, '#fffaf0', s.line, lw(s, 0.3));
          ellipse(s.c, s.w * x, s.h * 0.28, 0.6 * s.u, 1.1 * s.u, '#ffcf5a');
        }
      }
      if (s.star >= 4) {
        // A sheer canopy draped from the ceiling, and a crystal chandelier.
        for (const left of [true, false]) {
          const x0 = left ? 0 : s.w;
          const d = left ? 1 : -1;
          s.c.save();
          s.c.globalAlpha = s.night ? 0.5 : 0.6;
          s.c.beginPath();
          s.c.moveTo(x0, 0);
          s.c.lineTo(x0 + d * s.w * 0.24, 0);
          s.c.quadraticCurveTo(x0 + d * s.w * 0.1, s.h * 0.3, x0 + d * s.w * 0.15, s.gy);
          s.c.lineTo(x0, s.gy);
          s.c.closePath();
          s.c.fillStyle = s.night ? '#b79ae0' : '#ffd6ea';
          s.c.fill();
          s.c.restore();
          circle(s.c, x0 + d * s.w * 0.11, s.h * 0.36, 1.4 * s.u, s.p.wood, s.line, lw(s, 0.3)); // tie-back
        }
        scallopValance(s);
        chandelier(s, s.w * 0.5, 1, s.p.wood, s.p.glow);
      }
    },
    mid: (s) => {
      // A pink rug with gold trim, and a velvet pouf with tassels.
      rug(s, s.w * 0.5, s.gy + 9 * s.u, 30 * s.u, 6.5 * s.u, s.night ? '#a5679a' : '#ffc2da', s.p.wood);
      const px = s.w * 0.87;
      ellipse(s.c, px, s.gy + 3 * s.u, 7 * s.u, 3 * s.u, s.night ? '#8a5aa3' : '#d8a4f0', s.line, lw(s, 0.5));
      roundRect(s.c, px - 7 * s.u, s.gy - 3 * s.u, 14 * s.u, 6 * s.u, 2.5 * s.u, s.night ? '#9b6ab5' : '#e7b8fb', s.line, lw(s, 0.5));
      ellipse(s.c, px, s.gy - 3 * s.u, 7 * s.u, 2.4 * s.u, s.night ? '#b48ad0' : '#f2d2ff', s.line, lw(s, 0.45));
      for (const dx of [-6, 6]) circle(s.c, px + dx * s.u, s.gy + 1 * s.u, 0.9 * s.u, s.p.wood);
      if (s.star >= 3) {
        // A vanity with a heart mirror, and roses in a vase.
        const vx = s.w * 0.13;
        roundRect(s.c, vx - 8 * s.u, s.gy - 7 * s.u, 16 * s.u, 2 * s.u, 0.6 * s.u, s.p.stone, s.line, lw(s, 0.45));
        for (const dx of [-6.5, 6.5]) roundRect(s.c, vx + dx * s.u - 0.6 * s.u, s.gy - 5 * s.u, 1.2 * s.u, 6 * s.u, 0.4 * s.u, s.p.wood);
        drawHeart(s.c, vx, s.gy - 17 * s.u, 10 * s.u, s.p.wood);
        drawHeart(s.c, vx, s.gy - 16.8 * s.u, 8 * s.u, s.night ? '#c9d6ff' : '#eaf6ff');
        roundRect(s.c, vx + 3.5 * s.u, s.gy - 10.5 * s.u, 2.4 * s.u, 3.5 * s.u, 0.8 * s.u, '#ffffff', s.line, lw(s, 0.3)); // perfume
        for (const [dx, dy] of [
          [-1.6, -2],
          [0.6, -3],
          [1.8, -1.2],
        ])
          circle(s.c, vx - 4 * s.u + dx * s.u, s.gy - 9 * s.u + dy * s.u, 1.3 * s.u, s.p.accent, s.line, lw(s, 0.3));
        roundRect(s.c, vx - 5.5 * s.u, s.gy - 10 * s.u, 3 * s.u, 3 * s.u, 0.8 * s.u, s.p.stone, s.line, lw(s, 0.3));
      }
      if (s.star >= 3) {
        // Lingering Charm: hearts and petals drifting through the room.
        const r = rng(21);
        for (let i = 0; i < 7; i++) {
          const x = s.w * (0.08 + r() * 0.84);
          if (Math.abs(x - s.w / 2) < s.w * 0.12) continue;
          drawHeart(s.c, x, s.h * (0.12 + r() * 0.45), (1.6 + r() * 1.2) * s.u, rgba(s.p.accent, 0.85));
        }
        for (let i = 0; i < 9; i++) ellipse(s.c, r() * s.w, r() * s.gy, 1.1 * s.u, 0.6 * s.u, s.p.accent);
      }
    },
    front: (s) => {
      if (s.star >= 5) {
        // Grand Royal Pose: a crown on a velvet cushion, royal drapes and sparkles everywhere.
        sparkles(s, 18, s.night ? '#fff1c9' : '#ffffff', 31, 2 * s.u, s.h * 0.95);
        const x = s.w * 0.16;
        const y = s.h * 0.95;
        roundRect(s.c, x - 3 * s.u, y - 12 * s.u, 6 * s.u, 12 * s.u, 0.8 * s.u, s.p.stone, s.line, lw(s, 0.5));
        roundRect(s.c, x - 5 * s.u, y - 13.5 * s.u, 10 * s.u, 2 * s.u, 0.6 * s.u, s.p.wood, s.line, lw(s, 0.4));
        pillow(s, x, y - 16.5 * s.u, 0.7, '#c2385e', s.p.wood);
        crown(s, x, y - 18.5 * s.u, 1, '#ffd34d', s.p.accent2);
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
  if (def.floor) def.floor(s);
  // A soft pool of light where the cat stands keeps it the focal point at every rank.
  glowAt(s, w * 0.5, s.gy + 3 * u, (18 + s.star * 3) * u, p.glow, 0.3 + s.star * 0.06);
  // 2★+: the place gets lived-in detail on the ground (tufts, specks, scuffs).
  if (s.star >= 2 && !def.floor) groundDetail(s);
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
