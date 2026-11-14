// DEV TOOL — Lv.1–5 comparison sheets for every cat and skin (never shipped to players).
// Open with `npm run dev` → http://localhost:5173/tools/level-sheets.html, or export PNGs with
// `npm run sheets` (see scripts/level-sheets.mjs). It draws with the game's real art code
// (drawCat, resolvePalette, the Lv.5 aura), so new cats and skins appear automatically.
//
// Query parameters:
//   view=art|phone   art: enlarged (default ×3). phone: actual Android portrait battle size.
//   scale=<n>        override the cat scale (world px → CSS px)
//   cats=a,b         only these cat ids (default: all, in collection order)
//   skins=all|none|<id,id>   which looks per cat (default: default look + every skin)
//   hat=<hat id>     wear a shared cosmetic hat (to check hat/headwear stacking)
//   t=<seconds>      animation time to freeze (default 0.3)

import { BALANCE } from '../config/balance';
import { CATS, CAT_ORDER } from '../config/cats';
import { COSMETICS, skinKind } from '../config/cosmetics';
import type { CatId } from '../game/types';
import { FONT_STACK, setLang, t as tr } from '../i18n';
import { drawLevelAura, resolvePalette } from '../render/renderer';
import { drawCat } from '../render/sprites';

/**
 * World px → CSS px for a cat on an Android portrait battle board (measured on a Pixel 7: the 6-column
 * Chapter 2 board is ~384 CSS px wide for 300 world px). Chapter 1's 5-column board is a bit larger.
 */
export const PHONE_SCALE = 1.28;
const ART_SCALE = 3;
const CELL = 50; // world px per board tile
const LABEL_W = 190;
const HEADER_H = 26;

interface Row {
  cat: CatId;
  skin?: string;
  label: string;
}

function rows(params: URLSearchParams): Row[] {
  const cats = (params.get('cats')?.split(',').filter((c) => c in CATS) as CatId[] | undefined) ?? CAT_ORDER;
  const skinParam = params.get('skins') ?? 'all';
  const out: Row[] = [];
  for (const cat of cats) {
    const skins = COSMETICS.filter((c) => c.slot === 'skin' && c.cat === cat);
    const picked = skinParam === 'all' ? skins : skinParam === 'none' ? [] : skins.filter((s) => skinParam.split(',').includes(s.id));
    if (skinParam === 'all' || skinParam === 'none') out.push({ cat, label: `${tr(`cat.${cat}.name`)} — default` });
    for (const s of picked) out.push({ cat, skin: s.id, label: `${tr(`cosmetic.${s.id}.name`)}${skinKind(s) === 'special' ? ' ★' : ''}` });
  }
  return out;
}

export function renderSheet(canvas: HTMLCanvasElement, params: URLSearchParams): void {
  setLang('en', false);
  const view = params.get('view') === 'phone' ? 'phone' : 'art';
  const scale = Number(params.get('scale')) || (view === 'phone' ? PHONE_SCALE : ART_SCALE);
  const hat = params.get('hat');
  const time = Number(params.get('t') ?? 0.3);
  const list = rows(params);
  const maxLv = BALANCE.levels.maxLevel;

  const colW = CELL * scale * 1.08;
  const rowH = CELL * scale * 1.12;
  const cssW = LABEL_W + colW * maxLv + 8;
  const cssH = HEADER_H + rowH * list.length + 8;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Board-like backdrop
  ctx.fillStyle = '#b8dcb4';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.fillStyle = '#21323a';
  ctx.font = `800 12px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let lv = 1; lv <= maxLv; lv++) ctx.fillText(`Lv.${lv}`, LABEL_W + (lv - 0.5) * colW, HEADER_H / 2);
  ctx.textAlign = 'left';
  ctx.fillText(`${view === 'phone' ? 'Phone battle size' : 'Enlarged'} · ×${scale}${hat ? ` · hat: ${hat}` : ''}`, 8, HEADER_H / 2);

  list.forEach((row, i) => {
    const y0 = HEADER_H + i * rowH;
    if (i % 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(0, y0, cssW, rowH);
    }
    ctx.fillStyle = '#21323a';
    ctx.font = `700 12px ${FONT_STACK}`;
    ctx.textAlign = 'left';
    ctx.fillText(row.label, 8, y0 + rowH / 2 - 7);
    ctx.fillStyle = '#5a6a70';
    ctx.font = `500 10px ${FONT_STACK}`;
    ctx.fillText(row.skin ?? row.cat, 8, y0 + rowH / 2 + 8);

    const loadout = { hat, skins: row.skin ? { [row.cat]: row.skin } : {} };
    const palette = resolvePalette(row.cat, loadout);
    for (let lv = 1; lv <= maxLv; lv++) {
      const cx = LABEL_W + (lv - 0.5) * colW;
      const cy = y0 + rowH / 2;
      // tile pad, like the battle board
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.roundRect(-CELL * 0.46, -CELL * 0.46, CELL * 0.92, CELL * 0.92, 8);
      ctx.fillStyle = 'rgba(255,248,232,0.55)';
      ctx.fill();
      // same transforms as the battle renderer: Lv.5 aura, then the cat at its species scale
      if (lv >= maxLv) drawLevelAura(ctx, time);
      ctx.scale(CATS[row.cat].scale, CATS[row.cat].scale);
      drawCat(ctx, { type: row.cat, level: lv, palette, hat, costume: row.skin, t: time, attackAge: 9, aim: 0, seed: 1 });
      ctx.restore();
    }
  });
}
