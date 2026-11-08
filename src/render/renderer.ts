import { BALANCE } from '../config/balance';
import { CATS, TARGET_MODE_INFO } from '../config/cats';
import { findCosmetic } from '../config/cosmetics';
import type { Battle, CatUnit, Foe } from '../game/battle';
import { getCatStats } from '../game/combat';
import { cellCenter, worldSize } from '../game/path';
import { Rng } from '../game/rng';
import type { CatId, CatPalette, ChestTier, CosmeticLoadout, EnemyId, MapDef } from '../game/types';
import { FONT_STACK, t as tr } from '../i18n';
import { drawCat, drawChest, drawHeart, drawMouse, drawStar } from './sprites';

export interface DragView {
  uid: number;
  /** Pointer position in world px. */
  x: number;
  y: number;
  overTileId: string | null;
}

export interface DrawOptions {
  /** Cats highlighted by the tutorial (glow + range ring). */
  focusUids?: number[];
}

export function resolvePalette(type: CatId, loadout: CosmeticLoadout): CatPalette {
  const base = CATS[type].palette;
  const skin = findCosmetic(loadout.skins[type]);
  return skin?.palette ? { ...base, ...skin.palette } : base;
}

const TAU = Math.PI * 2;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private dpr = 1;
  /** Visual-only HP trail per foe (white bar that catches up after a hit). */
  private trail = new Map<number, { v: number; t: number }>();
  scale = 1;
  readonly worldW: number;
  readonly worldH: number;

  constructor(private canvas: HTMLCanvasElement, private map: MapDef) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    const ws = worldSize(map);
    this.worldW = ws.w;
    this.worldH = ws.h;
  }

  /** Fit the canvas into the given CSS box, preserving world aspect ratio. */
  resize(availW: number, availH: number): void {
    const aspect = this.worldW / this.worldH;
    let w = availW;
    let h = w / aspect;
    if (h > availH) {
      h = availH;
      w = h * aspect;
    }
    w = Math.max(50, Math.floor(w));
    h = Math.max(50, Math.floor(h));
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.scale = w / this.worldW;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.bgKey = '';
  }

  /** CSS client coordinates → world px. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * this.worldW, y: ((clientY - r.top) / r.height) * this.worldH };
  }

  /** World px → CSS client coordinates (for DOM overlays such as the tutorial). */
  worldToClient(x: number, y: number): { x: number; y: number; k: number } {
    const r = this.canvas.getBoundingClientRect();
    const k = r.width / this.worldW;
    return { x: r.left + x * k, y: r.top + y * k, k };
  }

  // ------------------------------------------------------------------------
  // Static background (cached per stage + size)
  // ------------------------------------------------------------------------

  private ensureBackground(battle: Battle): void {
    const key = `${battle.stage.id}|${this.canvas.width}x${this.canvas.height}`;
    if (this.bg && this.bgKey === key) return;
    const bg = this.bg ?? document.createElement('canvas');
    bg.width = this.canvas.width;
    bg.height = this.canvas.height;
    const ctx = bg.getContext('2d')!;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    paintBackground(ctx, this.map, battle);
    this.bg = bg;
    this.bgKey = key;
  }

  // ------------------------------------------------------------------------
  // Frame
  // ------------------------------------------------------------------------

  draw(battle: Battle, drag: DragView | null, loadout: CosmeticLoadout, opts: DrawOptions = {}): void {
    this.ensureBackground(battle);
    const ctx = this.ctx;
    const k = this.dpr * this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const t = battle.vtime;
    const dragCat = drag ? battle.catByUid(drag.uid) ?? null : null;

    // Drop-target highlights
    if (dragCat) {
      for (const tile of battle.tiles) {
        if (!tile.unlocked || tile.id === dragCat.tileId) continue;
        const kind = battle.previewDrop(dragCat.uid, tile.id).result;
        if (kind === 'cancel') continue;
        const hover = drag!.overTileId === tile.id;
        // green = move, gold = merge, blue = swap
        const [fill, fillHover, stroke] =
          kind === 'merged'
            ? ['rgba(255,214,64,0.3)', 'rgba(255,214,64,0.65)', '#e8a800']
            : kind === 'swapped'
              ? ['rgba(110,170,240,0.12)', 'rgba(110,170,240,0.5)', '#4a8ad8']
              : ['rgba(110,210,120,0.22)', 'rgba(110,210,120,0.55)', '#3aa35a'];
        ctx.beginPath();
        ctx.roundRect(tile.x - 22, tile.y - 22, 44, 44, 8);
        ctx.fillStyle = hover ? fillHover : fill;
        ctx.fill();
        ctx.lineWidth = hover ? 3 : kind === 'swapped' ? 1.2 : 2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    }

    // Range rings: dragged cat (at hover tile) or recently tapped cat
    if (dragCat) {
      const tile = drag!.overTileId ? battle.tileById(drag!.overTileId) : null;
      const st = getCatStats(CATS[dragCat.type], dragCat.level, battle.mods);
      const pos = tile && tile.unlocked ? tile : { x: drag!.x, y: drag!.y };
      this.rangeRing(pos.x, pos.y, st.range, dragCat.type === 'white' ? '#ff8fc0' : '#ffffff');
    }
    for (const cat of battle.cats) {
      const age = t - cat.modeAt;
      if (age < 1.2 && cat !== dragCat) {
        const st = getCatStats(CATS[cat.type], cat.level, battle.mods);
        ctx.globalAlpha = 1 - age / 1.2;
        this.rangeRing(cat.x, cat.y, st.range, TARGET_MODE_INFO[cat.mode].color);
        ctx.globalAlpha = 1;
      }
    }

    // Tutorial focus: pulsing glow + range ring
    for (const uid of opts.focusUids ?? []) {
      const cat = battle.catByUid(uid);
      if (!cat || cat === dragCat) continue;
      const st = getCatStats(CATS[cat.type], cat.level, battle.mods);
      this.rangeRing(cat.x, cat.y, st.range, '#ffd84a');
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.beginPath();
      ctx.arc(cat.x, cat.y, 24 + pulse * 4, 0, TAU);
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(255,216,74,${0.6 + pulse * 0.4})`;
      ctx.stroke();
    }

    // Foes (sorted by y for overlap)
    const foes = [...battle.foes].sort((a, b) => a.y - b.y);
    for (const f of foes) this.drawFoe(f, t, battle.time);
    if (this.trail.size > 200) this.trail.clear();

    // Cats
    for (const cat of battle.cats) {
      if (cat === dragCat) {
        ctx.globalAlpha = 0.35;
        this.drawCatUnit(cat, t, loadout, cat.x, cat.y, false);
        ctx.globalAlpha = 1;
      } else {
        this.drawCatUnit(cat, t, loadout, cat.x, cat.y, true);
      }
    }

    // Projectiles
    for (const p of battle.projectiles) {
      if (p.style === 'bullet') {
        const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = 'rgba(255,240,160,0.5)';
        ctx.beginPath();
        ctx.ellipse(-10, 0, 12, 2.2, 0, 0, TAU);
        ctx.fill();
        drawStar(ctx, 0, 0, 5, '#ffe066', 4, 0.45);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, TAU);
        ctx.fillStyle = '#ff8fb0';
        ctx.fill();
        ctx.strokeStyle = '#c04a70';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0.3, 2.6);
        ctx.stroke();
      }
    }

    this.drawEffects(battle);

    // Dragged cat follows pointer (on top of everything)
    if (dragCat) {
      ctx.save();
      ctx.translate(0, -6);
      this.drawCatUnit(dragCat, t, loadout, drag!.x, drag!.y, true, 1.15);
      ctx.restore();
    }

    // Pre-wave countdown
    if (battle.waveIndex === -1) {
      const s = Math.ceil(battle.prepRemaining);
      if (!battle.frozen) this.banner(tr('battle.firstWaveIn', { n: s }), this.worldH * 0.5);
    }
  }

  private rangeRing(x: number, y: number, r: number, color: string) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private banner(text: string, y: number) {
    const ctx = this.ctx;
    ctx.font = `800 18px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 28;
    ctx.beginPath();
    ctx.roundRect(this.worldW / 2 - w / 2, y - 17, w, 34, 17);
    ctx.fillStyle = 'rgba(60,50,40,0.6)';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, this.worldW / 2, y + 1);
  }

  private drawCatUnit(cat: CatUnit, t: number, loadout: CosmeticLoadout, x: number, y: number, showBadges: boolean, extraScale = 1) {
    const ctx = this.ctx;
    const def = CATS[cat.type];
    const spawnAge = t - cat.spawnAt;
    const mergeAge = t - cat.mergeAt;
    const moveAge = t - cat.movedAt;
    let s = def.scale * extraScale;
    if (spawnAge < 0.3) s *= easeOutBack(spawnAge / 0.3);
    if (moveAge < 0.25) s *= 1 + 0.12 * Math.sin((moveAge / 0.25) * Math.PI);
    if (mergeAge < 0.35) s *= 1 + 0.32 * Math.sin((mergeAge / 0.35) * Math.PI);
    const buffAge = t - cat.buffAt;
    if (buffAge < 0.4) s *= 1 + 0.12 * Math.sin((buffAge / 0.4) * Math.PI);

    ctx.save();
    ctx.translate(x, y);
    if (mergeAge < 0.45) {
      ctx.globalAlpha *= 1 - mergeAge / 0.45;
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
      g.addColorStop(0, 'rgba(255,240,140,0.9)');
      g.addColorStop(1, 'rgba(255,240,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = showBadges ? 1 : 0.35;
    }
    // Level-5 sparkle aura
    if (cat.level >= BALANCE.levels.maxLevel) {
      for (let i = 0; i < 3; i++) {
        const a = t * 1.5 + (i * TAU) / 3;
        drawStar(ctx, Math.cos(a) * 19, Math.sin(a) * 15 - 2, 2.2, '#ffe066');
      }
    }
    ctx.save();
    ctx.scale(s, s);
    drawCat(ctx, {
      type: cat.type,
      level: cat.level,
      palette: resolvePalette(cat.type, loadout),
      hat: loadout.hat,
      t,
      attackAge: t - cat.attackAt,
      aim: Math.atan2(cat.aimY - cat.y, cat.aimX - cat.x),
      seed: cat.uid,
    });
    ctx.restore();

    if (showBadges) {
      // Level pips
      const lv = cat.level;
      const colors = ['#9aa0a8', '#5ab0e0', '#6ac060', '#c070e0', '#f2b020'];
      ctx.beginPath();
      ctx.roundRect(-20, 10, 15, 11, 5);
      ctx.fillStyle = colors[Math.min(lv - 1, colors.length - 1)];
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `800 9px ${FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(lv), -12.5, 15.8);

      // Target mode badge
      const info = TARGET_MODE_INFO[cat.mode];
      const pop = t - cat.modeAt < 0.25 ? 1 + 0.4 * Math.sin(((t - cat.modeAt) / 0.25) * Math.PI) : 1;
      ctx.save();
      ctx.translate(15, -17);
      ctx.scale(pop, pop);
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, TAU);
      ctx.fillStyle = info.color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `900 9px ${FONT_STACK}`;
      ctx.fillText(tr(`mode.${cat.mode}.short`), 0, 0.8);
      ctx.restore();
    }
    ctx.restore();
  }

  /** t = visual clock (flashes, fades); walkT = simulation clock (walk cycle freezes with the game). */
  private drawFoe(f: Foe, t: number, walkT: number) {
    const ctx = this.ctx;
    const hitAge = t - f.hitAt;
    const hit = hitAge < 0.08;
    ctx.save();
    ctx.translate(f.x, f.y);
    if (hitAge < 0.12) {
      // little knock-back wobble
      const k = 1 - hitAge / 0.12;
      ctx.translate(-f.dirX * 1.5 * k, 0);
      ctx.scale(1 + 0.12 * k, 1 - 0.1 * k);
    }
    const spawnAge = t - f.bornAt;
    if (spawnAge < 0.25) ctx.globalAlpha = Math.max(0, spawnAge / 0.25);
    if (f.kind === 'chest') drawChest(ctx, f.defId as ChestTier, walkT + f.uid, hit);
    else drawMouse(ctx, { id: f.defId as EnemyId, dirX: f.dirX, t: walkT + f.uid * 0.37, hasShield: f.shield > 0, hit });

    // Distracted by the white cat
    if (f.slowT > 0) {
      const b = Math.sin(t * 6 + f.uid) * 1.5;
      drawHeart(ctx, -5, -f.radius - 14 + b, 4, '#ff6fa8');
      drawHeart(ctx, 5, -f.radius - 17 - b, 3.2, '#ff9cc4');
    }

    // HP / shield bar
    const w = f.isBoss ? 46 : f.kind === 'chest' ? 26 : 22;
    const by = -f.radius - (f.isBoss ? 26 : 9);
    const damaged = f.hp < f.maxHp || f.shield < f.maxShield || f.isBoss || f.kind === 'chest';
    if (damaged) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(40,30,30,0.6)';
      ctx.beginPath();
      ctx.roundRect(-w / 2 - 1, by - 1, w + 2, 5, 2.5);
      ctx.fill();
      const hpf = Math.max(0, f.hp / f.maxHp);
      // White trail shows recent damage, then catches up.
      const tr0 = this.trail.get(f.uid) ?? { v: hpf, t };
      const trailV = Math.max(hpf, tr0.v - (t - tr0.t) * 0.9);
      this.trail.set(f.uid, { v: trailV, t });
      if (trailV > hpf) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.roundRect(-w / 2, by, w * trailV, 3, 1.5);
        ctx.fill();
      }
      ctx.fillStyle = f.kind === 'chest' ? '#f2c230' : hpf > 0.5 ? '#6ad04a' : hpf > 0.25 ? '#f2c230' : '#ef5a4a';
      ctx.beginPath();
      ctx.roundRect(-w / 2, by, w * hpf, 3, 1.5);
      ctx.fill();
      if (f.maxShield > 0 && f.shield > 0) {
        ctx.fillStyle = '#5ad0f0';
        ctx.beginPath();
        ctx.roundRect(-w / 2, by - 4, w * (f.shield / f.maxShield), 2.6, 1.3);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawEffects(battle: Battle) {
    const ctx = this.ctx;
    const t = battle.vtime;
    for (const e of battle.effects) {
      const age = t - e.born;
      if (age < 0) continue;
      const k = Math.min(1, age / e.dur);
      switch (e.kind) {
        case 'ring': {
          ctx.globalAlpha = 1 - k;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r0 + (e.r1 - e.r0) * easeOut(k), 0, TAU);
          ctx.lineWidth = (e.width ?? 3.5) * (1 - k) + 1;
          ctx.strokeStyle = e.color;
          ctx.stroke();
          break;
        }
        case 'text': {
          ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
          ctx.font = `900 ${e.size}px ${FONT_STACK}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const y = e.y - easeOut(k) * 16;
          const label = e.mode ? tr(`mode.${e.mode}`) : e.text;
          const stroke = e.mode ? TARGET_MODE_INFO[e.mode].color : e.stroke;
          ctx.lineWidth = stroke ? 4 : 3;
          ctx.strokeStyle = stroke ?? 'rgba(50,30,20,0.75)';
          ctx.strokeText(label, e.x, y);
          ctx.fillStyle = e.color;
          ctx.fillText(label, e.x, y);
          break;
        }
        case 'particles': {
          ctx.globalAlpha = 1 - k;
          for (const p of e.parts) {
            const px = e.x + p.vx * age * (1 - k * 0.5);
            const py = e.y + p.vy * age * (1 - k * 0.5) + (e.gravity ?? 40) * age * age;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(px, py, p.size * (1 - k * 0.5), 0, TAU);
            ctx.fill();
          }
          break;
        }
        case 'pow': {
          ctx.globalAlpha = 1 - k;
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.rot);
          const s = 0.6 + easeOut(k) * 0.7;
          ctx.scale(s, s);
          drawStar(ctx, 0, 0, 8, '#fff1a0', 6, 0.5);
          drawStar(ctx, 0, 0, 4.5, '#ffffff', 6, 0.5);
          ctx.restore();
          break;
        }
        case 'beam': {
          // summon / merge light column
          ctx.globalAlpha = (1 - k) * 0.85;
          const g = ctx.createLinearGradient(e.x, e.y - 70, e.x, e.y + 16);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.7, e.color);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          const w = 26 * (1 - k * 0.6);
          ctx.fillRect(e.x - w / 2, e.y - 70, w, 86);
          break;
        }
        case 'hearts': {
          ctx.globalAlpha = 1 - k;
          drawHeart(ctx, e.x - 4, e.y - 6 - k * 14, 3.5, '#ff6fa8');
          drawHeart(ctx, e.x + 5, e.y - 3 - k * 18, 2.6, '#ffa0c8');
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

function easeOut(k: number) {
  return 1 - (1 - k) * (1 - k);
}
function easeOutBack(k: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(1, Math.max(0, k));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// ---------------------------------------------------------------------------
// Background painting
// ---------------------------------------------------------------------------

function paintBackground(ctx: CanvasRenderingContext2D, map: MapDef, battle: Battle) {
  const { w, h } = worldSize(map);
  const cell = map.cell;
  const rng = new Rng(1234);

  // Grass with soft checker patches
  ctx.fillStyle = map.theme.grass;
  ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
  }
  // grass tufts
  ctx.strokeStyle = map.theme.grassDark;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x - 3, y - 4);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 5);
    ctx.moveTo(x + 2, y);
    ctx.lineTo(x + 3, y - 4);
    ctx.stroke();
  }

  // Road
  const pts = battle.path.points;
  const stroke = (width: number, color: string, dash?: number[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(dash ?? []);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  stroke(40, map.theme.roadEdge);
  stroke(34, map.theme.road);
  stroke(3, 'rgba(200,160,100,0.35)', [6, 10]);
  // pebbles on road
  for (let i = 0; i < 40; i++) {
    const p = battle.path.pointAt(rng.next() * battle.path.length);
    const ox = (rng.next() - 0.5) * 24;
    const oy = (rng.next() - 0.5) * 24;
    ctx.fillStyle = 'rgba(180,140,90,0.35)';
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy, 1.2 + rng.next() * 1.4, 0, TAU);
    ctx.fill();
  }
  // direction chevrons
  ctx.strokeStyle = 'rgba(170,120,60,0.4)';
  ctx.lineWidth = 2.2;
  for (let d = 40; d < battle.path.length - 30; d += 75) {
    const p = battle.path.pointAt(d);
    const a = Math.atan2(p.dy, p.dx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.lineTo(3, 0);
    ctx.lineTo(-3, 5);
    ctx.stroke();
    ctx.restore();
  }

  // Which cells are free for decoration?
  const used = new Set<string>();
  for (const t of map.tiles) used.add(`${t.c}-${t.r}`);
  const onPath = (c: number, r: number) => {
    const p = cellCenter(map, c, r);
    for (let d = 0; d < battle.path.length; d += 6) {
      const q = battle.path.pointAt(d);
      if (Math.abs(q.x - p.x) < cell * 0.75 && Math.abs(q.y - p.y) < cell * 0.75) return true;
    }
    return false;
  };
  const [bc, br] = map.base;
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (used.has(`${c}-${r}`) || onPath(c, r) || (c === bc && r === br)) continue;
      const p = cellCenter(map, c, r);
      const roll = rng.next();
      if (roll < 0.55) drawTree(ctx, p.x + (rng.next() - 0.5) * 10, p.y + (rng.next() - 0.5) * 8, 0.8 + rng.next() * 0.35, rng);
      else if (roll < 0.75) drawMushrooms(ctx, p.x, p.y, rng);
      else drawFlowers(ctx, p.x, p.y, rng);
    }
  }

  // Tiles
  for (const tile of battle.tiles) {
    const x = tile.x - 21;
    const y = tile.y - 21;
    ctx.beginPath();
    ctx.roundRect(x, y, 42, 42, 9);
    if (tile.unlocked) {
      ctx.fillStyle = '#f5edd3';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#d5bf8c';
      ctx.stroke();
      // paw print
      ctx.fillStyle = 'rgba(210,185,130,0.45)';
      ctx.beginPath();
      ctx.ellipse(tile.x, tile.y + 3, 5, 4, 0, 0, TAU);
      ctx.fill();
      for (const [dx, dy] of [[-5.5, -3], [-2, -6.5], [2, -6.5], [5.5, -3]]) {
        ctx.beginPath();
        ctx.arc(tile.x + dx, tile.y + dy, 1.9, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(90,110,70,0.16)';
      ctx.fill();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(90,110,70,0.45)';
      ctx.stroke();
      ctx.setLineDash([]);
      // lock
      ctx.fillStyle = 'rgba(90,100,80,0.55)';
      ctx.beginPath();
      ctx.roundRect(tile.x - 5, tile.y - 1, 10, 8, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,100,80,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tile.x, tile.y - 1, 3.5, Math.PI, TAU);
      ctx.stroke();
    }
  }

  // Entrance burrow
  const start = pts[0];
  const ex = Math.max(8, start.x + 10);
  ctx.fillStyle = '#8a6a48';
  ctx.beginPath();
  ctx.ellipse(ex - 6, start.y, 16, 22, 0, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a1e';
  ctx.beginPath();
  ctx.ellipse(ex - 6, start.y, 10, 15, 0, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  // little sign (only where there is room above the road)
  if (start.y > 45) {
  ctx.fillStyle = '#b08050';
  ctx.fillRect(14, start.y - 34, 3, 14);
  ctx.beginPath();
  ctx.roundRect(4, start.y - 42, 26, 12, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `800 8px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MICE', 17, start.y - 35.5);
  }

  // Cat house (base)
  const b = cellCenter(map, bc, br);
  drawHouse(ctx, b.x, b.y + 2);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rng: Rng) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(60,90,40,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 15, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#9a6a42';
  ctx.beginPath();
  ctx.roundRect(-3.5, 2, 7, 13, 2);
  ctx.fill();
  const greens = ['#6ab04a', '#7cc05a', '#5a9a40'];
  for (const [dx, dy, r] of [[-7, -2, 10], [7, -2, 10], [0, -10, 12], [0, 0, 11]] as const) {
    ctx.fillStyle = greens[Math.floor(rng.next() * greens.length)];
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(-4, -12, 5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawMushrooms(ctx: CanvasRenderingContext2D, x: number, y: number, rng: Rng) {
  for (let i = 0; i < 2; i++) {
    const mx = x + (rng.next() - 0.5) * 22;
    const my = y + (rng.next() - 0.5) * 16;
    ctx.fillStyle = '#f6eedc';
    ctx.fillRect(mx - 2, my - 2, 4, 7);
    ctx.fillStyle = i ? '#e85a4a' : '#f0a040';
    ctx.beginPath();
    ctx.arc(mx, my - 2, 6, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx - 2, my - 4, 1.2, 0, TAU);
    ctx.arc(mx + 2.5, my - 3, 1, 0, TAU);
    ctx.fill();
  }
}

function drawFlowers(ctx: CanvasRenderingContext2D, x: number, y: number, rng: Rng) {
  const cols = ['#ffffff', '#ffd0e0', '#fff0a0', '#c8d8ff'];
  for (let i = 0; i < 4; i++) {
    const fx = x + (rng.next() - 0.5) * 34;
    const fy = y + (rng.next() - 0.5) * 30;
    ctx.fillStyle = cols[Math.floor(rng.next() * cols.length)];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 2.4, fy + Math.sin(a) * 2.4, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f2b030';
    ctx.beginPath();
    ctx.arc(fx, fy, 1.3, 0, TAU);
    ctx.fill();
  }
}

function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(60,90,40,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 24, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff4dc';
  ctx.strokeStyle = '#a07a50';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-18, -4, 36, 21, 3);
  ctx.fill();
  ctx.stroke();
  // roof with ears
  ctx.fillStyle = '#e8706a';
  ctx.strokeStyle = '#9a3a3a';
  ctx.beginPath();
  ctx.moveTo(-23, -2);
  ctx.lineTo(-18, -16);
  ctx.lineTo(-12, -12);
  ctx.lineTo(0, -20);
  ctx.lineTo(12, -12);
  ctx.lineTo(18, -16);
  ctx.lineTo(23, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // door
  ctx.fillStyle = '#8a5a3a';
  ctx.beginPath();
  ctx.roundRect(-6, 3, 12, 14, [6, 6, 0, 0]);
  ctx.fill();
  // window w/ fish
  ctx.fillStyle = '#a8d8f0';
  ctx.beginPath();
  ctx.arc(11, 4, 3.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e0a050';
  ctx.beginPath();
  ctx.ellipse(-12, 5, 3.5, 2, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
