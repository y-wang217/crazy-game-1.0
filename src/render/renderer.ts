import { BALANCE } from '../config/balance';
import { CATS, TARGET_MODE_INFO } from '../config/cats';
import { ENEMIES } from '../config/enemies';
import { findCosmetic, skinGlint } from '../config/cosmetics';
import type { Battle, CatUnit, Foe, Projectile } from '../game/battle';
import { cellCenter, worldSize } from '../game/path';
import { Rng } from '../game/rng';
import type { CatId, CatPalette, ChestTier, CosmeticLoadout, EnemyId, MapDef } from '../game/types';
import { FONT_STACK, t as tr } from '../i18n';
import { boardPalette, getTheme } from '../theme';
import type { Environment } from '../theme/palettes';
import type { BoardPalette } from '../theme/palettes';
import { drawCat, drawChest, drawHeart, drawMouse, drawSkinGlint, drawStar } from './sprites';

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

  private env: Environment;

  constructor(
    private canvas: HTMLCanvasElement,
    private map: MapDef,
  ) {
    this.env = map.environment ?? 'forest';
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
    const key = `${battle.stage.id}|${this.canvas.width}x${this.canvas.height}|${getTheme()}`;
    if (this.bg && this.bgKey === key) return;
    const bg = this.bg ?? document.createElement('canvas');
    bg.width = this.canvas.width;
    bg.height = this.canvas.height;
    const ctx = bg.getContext('2d')!;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    paintBackground(ctx, this.map, battle, boardPalette(this.env));
    this.bg = bg;
    this.bgKey = key;
  }

  // ------------------------------------------------------------------------
  // Frame
  // ------------------------------------------------------------------------

  /** Simulation clock of the battle being drawn (wind-up poses follow game time, not wall time). */
  private simTime = 0;

  /** Battle being drawn (for buff glows / star halos in drawCatUnit). */
  private cur: Battle | null = null;
  /** vtime of the last frame, to detect a clock that jumped back. */
  private trailClock = 0;

  draw(battle: Battle, drag: DragView | null, loadout: CosmeticLoadout, opts: DrawOptions = {}): void {
    this.simTime = battle.time;
    // HP trails are keyed by foe uid and timed by vtime. A restarted or restored battle reuses
    // uids and restarts its clock, so stale trails must not carry over (they would grow).
    if (battle !== this.cur || battle.vtime < this.trailClock) this.trail.clear();
    this.trailClock = battle.vtime;
    this.cur = battle;
    this.ensureBackground(battle);
    const ctx = this.ctx;
    const k = this.dpr * this.scale;
    // Orange slams shake the board a little.
    let sx = 0;
    let sy = 0;
    for (const e of battle.effects) {
      if (e.kind !== 'shake') continue;
      const age = battle.vtime - e.born;
      if (age < 0 || age > e.dur) continue;
      const amp = e.amp * (1 - age / e.dur);
      sx += Math.sin(age * 90) * amp;
      sy += Math.cos(age * 70) * amp * 0.6;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.bg) ctx.drawImage(this.bg, sx * k, sy * k);
    ctx.setTransform(k, 0, 0, k, sx * k, sy * k);
    const t = battle.vtime;
    const dragCat = drag ? (battle.catByUid(drag.uid) ?? null) : null;

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
      const st = battle.unitStats(dragCat);
      const pos = tile && tile.unlocked ? tile : { x: drag!.x, y: drag!.y };
      this.rangeRing(pos.x, pos.y, st.range, dragCat.type === 'white' ? '#ff8fc0' : dragCat.type === 'mallow' ? '#ffd36a' : '#ffffff');
    }
    for (const cat of battle.cats) {
      const age = t - cat.modeAt;
      if (age < 1.2 && cat !== dragCat) {
        const st = battle.unitStats(cat);
        ctx.globalAlpha = 1 - age / 1.2;
        this.rangeRing(cat.x, cat.y, st.range, TARGET_MODE_INFO[cat.mode].color);
        ctx.globalAlpha = 1;
      }
    }

    // Tutorial focus: pulsing glow + range ring
    for (const uid of opts.focusUids ?? []) {
      const cat = battle.catByUid(uid);
      if (!cat || cat === dragCat) continue;
      const st = battle.unitStats(cat);
      this.rangeRing(cat.x, cat.y, st.range, '#ffd84a');
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.beginPath();
      ctx.arc(cat.x, cat.y, 24 + pulse * 4, 0, TAU);
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(255,216,74,${0.6 + pulse * 0.4})`;
      ctx.stroke();
    }

    // Wind-up telegraphs: where the Orange slam will land, and the Black Cat's aim line.
    for (const cat of battle.cats) {
      const w = cat.windup;
      if (!w) continue;
      const p = Math.min(1, Math.max(0, (battle.time - w.start) / Math.max(0.01, w.fireAt - w.start)));
      if (cat.type === 'orange') {
        const st = battle.unitStats(cat);
        ctx.beginPath();
        ctx.arc(w.x, w.y, st.splashRadius, 0, TAU);
        ctx.fillStyle = `rgba(230,140,60,${0.08 + p * 0.14})`;
        ctx.fill();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(200,110,40,${0.4 + p * 0.5})`;
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (cat.type === 'black') {
        const f = battle.foes.find((x) => x.uid === w.targetUid);
        const tx = f ? f.x : w.x;
        const ty = f ? f.y : w.y;
        ctx.beginPath();
        ctx.moveTo(cat.x, cat.y + 2);
        ctx.lineTo(tx, ty);
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1 + p * 1.5;
        ctx.strokeStyle = `rgba(255,70,90,${0.25 + p * 0.6})`;
        ctx.stroke();
        ctx.setLineDash([]);
        // crosshair closing in
        const r = 14 - p * 7;
        ctx.strokeStyle = `rgba(255,70,90,${0.5 + p * 0.5})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(tx, ty, r, 0, TAU);
        ctx.moveTo(tx - r - 4, ty);
        ctx.lineTo(tx - r + 3, ty);
        ctx.moveTo(tx + r - 3, ty);
        ctx.lineTo(tx + r + 4, ty);
        ctx.moveTo(tx, ty - r - 4);
        ctx.lineTo(tx, ty - r + 3);
        ctx.moveTo(tx, ty + r - 3);
        ctx.lineTo(tx, ty + r + 4);
        ctx.stroke();
      }
    }

    // Foes (sorted by y for overlap)
    const foes = [...battle.foes].sort((a, b) => a.y - b.y);
    for (const f of foes)
      this.drawFoe(f, t, battle.time, f.uid === battle.focusUid, f.kind === 'enemy' && f.defId !== 'captain' && battle.isGuarded(f));
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

    // Projectiles (attack effects evolve with the shooter's permanent star rank)
    for (const p of battle.projectiles) this.drawProjectile(p, t);

    this.drawEffects(battle);
    if (this.env === 'mushroom') this.drawSpores(t);
    else if (boardPalette().fireflies) this.drawFireflies(t);

    // Dragged cat follows pointer (on top of everything)
    if (dragCat) {
      ctx.save();
      ctx.translate(0, -6);
      this.drawCatUnit(dragCat, t, loadout, drag!.x, drag!.y, true, 1.15);
      ctx.restore();
    }

    // (The preparation countdown is shown by the HUD, not on the board.)
  }

  /** A few slow, twinkling fireflies (moonlit theme). Purely decorative, kept sparse. */
  /** Mushroom forest: glowing spores drifting slowly upward (both themes). */
  private drawSpores(t: number) {
    const ctx = this.ctx;
    const moon = boardPalette(this.env).moon;
    for (let i = 0; i < 14; i++) {
      const speed = 6 + (i % 4) * 2;
      const bx = ((i * 71) % this.worldW) + Math.sin(t * 0.6 + i) * 8;
      const by = this.worldH - ((t * speed + i * 113) % (this.worldH + 20));
      const a = (moon ? 0.35 : 0.5) * (0.6 + 0.4 * Math.sin(t * 2 + i));
      const col = moon ? (i % 2 ? '159,224,208' : '200,160,255') : '255,255,255';
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, moon ? 5 : 3.5);
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, moon ? 5 : 3.5, 0, TAU);
      ctx.fill();
    }
  }

  private drawFireflies(t: number) {
    const ctx = this.ctx;
    for (let i = 0; i < 9; i++) {
      const bx = ((i * 97) % this.worldW) + Math.sin(t * 0.4 + i) * 14;
      const by = ((i * 151 + 40) % this.worldH) + Math.cos(t * 0.33 + i * 1.7) * 12;
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.3));
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, 6);
      g.addColorStop(0, `rgba(255,236,170,${a})`);
      g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, TAU);
      ctx.fill();
    }
  }

  private rangeRing(x: number, y: number, r: number, color: string) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = boardPalette(this.env).rangeFill;
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.setLineDash([]);
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
    // Permanent star rank: a soft halo at 5★; buffs (Captain Mallow) glow gold; ultimates flash.
    const b = this.cur;
    if (b && showBadges) {
      const star = b.starOf(cat.type);
      if (star >= 5) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 2 + cat.uid);
        ctx.strokeStyle = '#ffd36a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 15, 17, 5, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      const buffed = cat.buffSpeedUntil > b.time || cat.buffDmgUntil > b.time || b.teamBuff.until > b.time;
      if (buffed) {
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 6);
        const g = ctx.createRadialGradient(0, 4, 2, 0, 4, 24);
        g.addColorStop(0, 'rgba(255,214,106,0.9)');
        g.addColorStop(1, 'rgba(255,214,106,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 4, 24, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      if (cat.empowered) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#9fe0d0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 2, 20, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      const ultAge = t - cat.ultAt;
      if (ultAge < 0.9) {
        ctx.save();
        ctx.globalAlpha = 1 - ultAge / 0.9;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + ultAge * 4;
          drawStar(ctx, Math.cos(a) * (16 + ultAge * 14), Math.sin(a) * (12 + ultAge * 10), 2.6, i % 2 ? '#ffd36a' : '#ffffff');
        }
        ctx.restore();
      }
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
      costume: loadout.skins[cat.type],
      t,
      attackAge: t - cat.attackAt,
      aim: Math.atan2(cat.aimY - cat.y, cat.aimX - cat.x),
      seed: cat.uid,
      windup: cat.windup
        ? Math.min(1, Math.max(0, (this.simTime - cat.windup.start) / Math.max(0.01, cat.windup.fireAt - cat.windup.start)))
        : undefined,
      comboIndex: cat.comboIndex,
    });
    const glint = skinGlint(cat.type, loadout);
    if (glint) drawSkinGlint(ctx, glint, t, cat.uid);
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
      // V1.3: compact badge tucked into the tile's bottom-right corner (clear of face and hat).
      ctx.save();
      ctx.translate(14, 15.5);
      ctx.scale(pop, pop);
      ctx.beginPath();
      ctx.arc(0, 0, 6.2, 0, TAU);
      ctx.fillStyle = info.color;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `900 7.5px ${FONT_STACK}`;
      ctx.fillText(tr(`mode.${cat.mode}.short`), 0, 0.6);
      ctx.restore();
    }
    ctx.restore();
  }

  /** t = visual clock (flashes, fades); walkT = simulation clock (walk cycle freezes with the game). */
  private drawFoe(f: Foe, t: number, walkT: number, focused = false, guarded = false) {
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
    // Charmed by Noble White: soft pink glow underfoot (and the legs slow down via f.walk).
    if (f.slowT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(t * 6 + f.uid);
      ctx.beginPath();
      ctx.ellipse(0, f.radius * 0.6, f.radius * 1.25, f.radius * 0.5, 0, 0, TAU);
      ctx.fillStyle = '#ff9cc8';
      ctx.fill();
      ctx.restore();
    }
    // V1.3: chests get a pulsing golden ground glow so they read instantly.
    if (f.kind === 'chest') {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(t * 5 + f.uid);
      const g = ctx.createRadialGradient(0, 2, 2, 0, 2, f.radius + 12);
      g.addColorStop(0, `rgba(255,220,90,${0.45 + 0.25 * pulse})`);
      g.addColorStop(1, 'rgba(255,220,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 2, f.radius + 12, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Elites: pulsing gold ring underfoot; the Captain also shows its guard radius.
    const elite = f.kind === 'enemy' ? ENEMIES[f.defId as EnemyId]?.elite : undefined;
    if (elite) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(t * 4 + f.uid);
      if (elite === 'escort') {
        ctx.globalAlpha = 0.18 + 0.08 * pulse;
        ctx.beginPath();
        ctx.arc(0, 2, BALANCE.elite.guardRadius, 0, TAU);
        ctx.fillStyle = '#ffd84a';
        ctx.fill();
        ctx.globalAlpha = 0.55;
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#e0a830';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 0.55 + 0.3 * pulse;
      ctx.beginPath();
      ctx.ellipse(0, f.radius * 0.65, f.radius * 1.35, f.radius * 0.55, 0, 0, TAU);
      ctx.strokeStyle = '#ffd84a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    const walk = f.walk + f.uid * 0.37;
    if (f.kind === 'chest') drawChest(ctx, f.defId as ChestTier, walk, hit);
    else drawMouse(ctx, { id: f.defId as EnemyId, dirX: f.dirX, t: walk, hasShield: f.shield > 0, hit });
    if (guarded) {
      // Protected by a Mouse Captain: tiny gold shield badge
      ctx.save();
      ctx.translate(f.radius * 0.6, -f.radius - 4);
      ctx.beginPath();
      ctx.moveTo(-3.5, -3);
      ctx.lineTo(3.5, -3);
      ctx.lineTo(3.5, 0.5);
      ctx.quadraticCurveTo(0, 4.5, 0, 4.5);
      ctx.quadraticCurveTo(0, 4.5, -3.5, 0.5);
      ctx.closePath();
      ctx.fillStyle = '#ffd84a';
      ctx.fill();
      ctx.strokeStyle = '#a07a10';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    void walkT;
    // V1.3: tiny impact spark on every hit (visual only).
    if (hitAge < 0.14) {
      const k = hitAge / 0.14;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#fff6c8';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const r0 = f.radius * 0.5 + 5 * k;
      const r1 = r0 + 5;
      for (let i = 0; i < 4; i++) {
        const a = (i * TAU) / 4 + f.uid;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - 4);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 - 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Status effects: poison bubbles (Silver Devil), Devil's Pact sigil, armor shred, vulnerable.
    const st = this.simTime;
    if (f.poisonUntil > st) {
      for (let i = 0; i < 2 + f.poisonStacks; i++) {
        const k = (t * 0.9 + i * 0.37 + f.uid * 0.13) % 1;
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.fillStyle = i % 2 ? '#b58ad6' : '#9fd0a8';
        ctx.beginPath();
        ctx.arc((i - 1.5) * 4, -f.radius * 0.4 - k * 14, 1.6 + (1 - k) * 1.2, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (f.poisonStacks > 1) {
        ctx.font = `900 8px ${FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(40,20,50,0.8)';
        ctx.strokeText(`×${f.poisonStacks}`, f.radius + 4, -f.radius);
        ctx.fillStyle = '#d8b8f0';
        ctx.fillText(`×${f.poisonStacks}`, f.radius + 4, -f.radius);
      }
    }
    if (f.markUntil > st) {
      ctx.save();
      ctx.rotate(t * 1.5);
      ctx.strokeStyle = 'rgba(181,138,214,0.85)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, f.radius + 7, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      drawHeart(ctx, 0, -f.radius - 6, 3.2, '#9a5ac8');
    }
    if (f.shredUntil > st && f.shred > 0) {
      ctx.strokeStyle = '#8ab8e8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-f.radius * 0.6, -f.radius * 0.2);
      ctx.lineTo(-f.radius * 0.1, f.radius * 0.1);
      ctx.lineTo(-f.radius * 0.4, f.radius * 0.5);
      ctx.stroke();
    }
    if (f.vulnUntil > st) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8);
      ctx.strokeStyle = '#ffb35a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 2, f.radius + 2, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Tap-to-focus: a subtle gold crosshair.
    if (focused) {
      const r = f.radius + 9 + Math.sin(t * 4) * 1.5;
      ctx.strokeStyle = 'rgba(217,173,114,0.95)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        ctx.moveTo(dx * (r - 4), dy * (r - 4));
        ctx.lineTo(dx * (r + 4), dy * (r + 4));
      }
      ctx.stroke();
    }

    // Distracted by the white cat
    if (f.slowT > 0) {
      const b = Math.sin(t * 6 + f.uid) * 1.5;
      drawHeart(ctx, -5, -f.radius - 14 + b, 4, '#ff6fa8');
      drawHeart(ctx, 5, -f.radius - 17 - b, 3.2, '#ff9cc4');
    }

    // HP / shield bar
    const w = f.isBoss ? 40 : f.kind === 'chest' ? 20 : 20;
    const by = -f.radius - (f.isBoss ? 26 : 9);
    const damaged = f.hp < f.maxHp || f.shield < f.maxShield || f.isBoss || f.kind === 'chest';
    if (damaged) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(40,30,30,0.6)';
      ctx.beginPath();
      ctx.roundRect(-w / 2 - 1, by - 1, w + 2, 5, 2.5);
      ctx.fill();
      // Fractions are always clamped to 0–1 so a bar can never be wider than its frame.
      const hpf = frac(f.hp, f.maxHp);
      // White trail shows recent damage, then catches up.
      const tr0 = this.trail.get(f.uid) ?? { v: hpf, t };
      const trailV = Math.min(1, Math.max(hpf, tr0.v - Math.max(0, t - tr0.t) * 0.9));
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
        ctx.roundRect(-w / 2, by - 4, w * frac(f.shield, f.maxShield), 2.6, 1.3);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** One projectile; size and trail detail grow with the shooter's permanent star rank. */
  private drawProjectile(p: Projectile, t: number) {
    const ctx = this.ctx;
    const star = p.star ?? 1;
    const size = p.size ?? 1;
    const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
    ctx.save();
    ctx.translate(p.x, p.y);
    // Trail: none at 1★, a soft streak from 2★, sparkles from 4★.
    if (star >= 2) {
      ctx.save();
      ctx.rotate(ang);
      const col = p.style === 'magic' ? '200,154,255' : p.style === 'venom' ? '159,208,168' : p.style === 'bullet' ? '255,240,160' : '255,170,200';
      const g = ctx.createLinearGradient(-14 - star * 3, 0, 0, 0);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(1, `rgba(${col},0.55)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(-8 - star * 1.5, 0, 8 + star * 2, 2 + size * 1.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (star >= 4) drawStar(ctx, -Math.cos(ang) * 10 + Math.sin(t * 20) * 2, -Math.sin(ang) * 10, 2, star >= 5 ? '#ffd36a' : '#ffffff', 4, 0.4);
    }
    if (p.style === 'bullet') {
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,240,160,0.5)';
      ctx.beginPath();
      ctx.ellipse(-10 * size, 0, 12 * size, 2.2 * size, 0, 0, TAU);
      ctx.fill();
      drawStar(ctx, 0, 0, 5 * size, (p.armorIgnore ?? 0) > 0 ? '#ff8a8a' : star >= 5 ? '#ffd36a' : '#ffe066', 4, 0.45);
    } else if (p.style === 'magic') {
      // Mr. Whiskers' enchanted yarn: purple glow, gold thread.
      const r = 4.2 * size;
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.2);
      g.addColorStop(0, 'rgba(200,154,255,0.6)');
      g.addColorStop(1, 'rgba(200,154,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = '#8a5ac8';
      ctx.fill();
      ctx.strokeStyle = '#ffd36a';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, t * 8, t * 8 + 4);
      ctx.stroke();
      if (size > 1.5)
        for (let i = 0; i < 3; i++) drawStar(ctx, Math.cos(t * 6 + i * 2) * r * 1.4, Math.sin(t * 6 + i * 2) * r * 1.4, 2, '#ffd36a', 4, 0.4);
    } else if (p.style === 'venom') {
      // Silver Devil's sweet venom: a violet droplet with a green glint.
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = '#9a5ac8';
      ctx.beginPath();
      ctx.moveTo(0, -5 * size);
      ctx.quadraticCurveTo(4 * size, 1, 0, 4 * size);
      ctx.quadraticCurveTo(-4 * size, 1, 0, -5 * size);
      ctx.fill();
      ctx.fillStyle = '#b8f0c8';
      ctx.beginPath();
      ctx.arc(-1, 0.5, 1.2, 0, TAU);
      ctx.fill();
    } else {
      // Kitten's yarn ball (bigger when empowered; golden at 5★).
      const r = 4 * size;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = star >= 5 ? '#ffd36a' : '#ff8fb0';
      ctx.fill();
      ctx.strokeStyle = star >= 5 ? '#a07a10' : '#c04a70';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0.3, 2.6);
      ctx.stroke();
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
          const label = e.mode ? tr(`mode.${e.mode}`) : e.ult ? tr(`ability.${e.ult}.ult.name`) : e.text;
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
        case 'shake':
          break;
        case 'sparkle': {
          ctx.globalAlpha = 1 - k;
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU + k * 2;
            const r = 10 + k * 22;
            drawStar(ctx, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.7, 2.6 * (1 - k * 0.5), i % 2 ? '#ffd1e6' : '#fff6c8');
          }
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
        case 'slash': {
          // Sir Sable's sword wave: a bright crescent streak; higher stars add a silver edge and glints.
          ctx.globalAlpha = 1 - k;
          ctx.lineCap = 'round';
          const grow = easeOut(Math.min(1, k * 3));
          const x2 = e.x1 + (e.x2 - e.x1) * grow;
          const y2 = e.y1 + (e.y2 - e.y1) * grow;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = e.width * (1 - k * 0.6);
          ctx.globalAlpha = (1 - k) * 0.45;
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1.5, e.width * 0.25);
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          if (e.star >= 3) {
            ctx.strokeStyle = '#cfe6ff';
            ctx.lineWidth = 1;
            const nx = -(e.y2 - e.y1);
            const ny = e.x2 - e.x1;
            const nl = Math.hypot(nx, ny) || 1;
            ctx.beginPath();
            ctx.moveTo(e.x1 + (nx / nl) * e.width * 0.5, e.y1 + (ny / nl) * e.width * 0.5);
            ctx.lineTo(x2 + (nx / nl) * e.width * 0.5, y2 + (ny / nl) * e.width * 0.5);
            ctx.stroke();
          }
          if (e.star >= 4)
            for (let i = 1; i <= 3; i++)
              drawStar(ctx, e.x1 + (x2 - e.x1) * (i / 4), e.y1 + (y2 - e.y1) * (i / 4), 2.4 * (1 - k), e.star >= 5 ? '#ffd36a' : '#ffffff', 4, 0.4);
          break;
        }
        case 'telegraph': {
          // Brief warning line before a big ultimate (Moonshadow Slash / charged shot).
          ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(age * 14));
          ctx.strokeStyle = e.color;
          ctx.lineWidth = Math.max(2, e.width);
          ctx.lineCap = 'round';
          ctx.globalAlpha *= 0.4;
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          ctx.globalAlpha = 0.8;
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
          break;
        }
        case 'claw': {
          // Shadow Pounce: three quick claw marks.
          ctx.globalAlpha = 1 - k;
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.rot + Math.PI / 2);
          const s = (e.big ? 1.5 : 1) * (0.8 + easeOut(k) * 0.4);
          ctx.scale(s, s);
          ctx.strokeStyle = e.color;
          ctx.lineCap = 'round';
          ctx.lineWidth = 2;
          for (const o of [-4, 0, 4]) {
            ctx.beginPath();
            ctx.moveTo(o - 3, -7);
            ctx.quadraticCurveTo(o + 2, 0, o - 1, 7);
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'bell': {
          // Captain Mallow's golden bell with two little notes.
          ctx.globalAlpha = 1 - k;
          ctx.save();
          ctx.translate(e.x, e.y - k * 6);
          ctx.rotate(Math.sin(age * 18) * 0.35 * (1 - k));
          const s = e.big ? 1.6 : 1;
          ctx.scale(s, s);
          ctx.fillStyle = '#ffd36a';
          ctx.strokeStyle = '#a07a10';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-5, 4);
          ctx.quadraticCurveTo(-5, -6, 0, -6);
          ctx.quadraticCurveTo(5, -6, 5, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#a07a10';
          ctx.beginPath();
          ctx.arc(0, 5, 1.4, 0, TAU);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#fff3c0';
          ctx.font = `900 9px ${FONT_STACK}`;
          ctx.fillText('♪', e.x + 9, e.y - 8 - k * 12);
          ctx.fillText('♫', e.x - 10, e.y - 4 - k * 16);
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

function paintBackground(ctx: CanvasRenderingContext2D, map: MapDef, battle: Battle, P: BoardPalette) {
  const { w, h } = worldSize(map);
  const cell = map.cell;
  const rng = new Rng(1234);

  // Ground with soft checker patches
  ctx.fillStyle = P.grass;
  ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = P.grassChecker;
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
  }
  // Moonlight wash from the top-right corner
  if (P.moon) {
    const g = ctx.createRadialGradient(w * 0.95, -20, 10, w * 0.95, -20, h * 0.9);
    g.addColorStop(0, 'rgba(230,225,255,0.22)');
    g.addColorStop(1, 'rgba(230,225,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // grass tufts
  ctx.strokeStyle = P.tuft;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < Math.round((w * h) / 2100); i++) {
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
  const mushroomEnv = map.environment === 'mushroom';
  stroke(40, P.roadEdge);
  stroke(34, P.road);
  if (mushroomEnv) {
    // Stepping stones instead of a dashed centre line.
    for (let d = 8; d < battle.path.length; d += 17) {
      const p = battle.path.pointAt(d);
      ctx.fillStyle = P.roadDash;
      ctx.beginPath();
      ctx.ellipse(p.x + (rng.next() - 0.5) * 6, p.y + (rng.next() - 0.5) * 6, 5 + rng.next() * 2, 3.5 + rng.next() * 1.5, rng.next() * 3, 0, TAU);
      ctx.fill();
    }
  } else stroke(3, P.roadDash, [6, 10]);
  for (let i = 0; i < 40; i++) {
    const p = battle.path.pointAt(rng.next() * battle.path.length);
    const ox = (rng.next() - 0.5) * 24;
    const oy = (rng.next() - 0.5) * 24;
    ctx.fillStyle = P.pebble;
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy, 1.2 + rng.next() * 1.4, 0, TAU);
    ctx.fill();
  }
  // direction chevrons
  ctx.strokeStyle = P.chevron;
  ctx.lineWidth = 2.6;
  for (let d = 36; d < battle.path.length - 30; d += 56) {
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
      if (mushroomEnv) {
        if (roll < 0.6) drawGiantMushroom(ctx, p.x, p.y + 4, 0.95 + rng.next() * 0.2, rng, P);
        else drawMushrooms(ctx, p.x, p.y, rng, P);
        continue;
      }
      if (roll < 0.55) drawTree(ctx, p.x + (rng.next() - 0.5) * 10, p.y + (rng.next() - 0.5) * 8, 0.8 + rng.next() * 0.35, rng, P);
      else if (roll < 0.75) drawMushrooms(ctx, p.x, p.y, rng, P);
      else drawFlowers(ctx, p.x, p.y, rng, P);
    }
  }

  if (mushroomEnv) {
    // Little mushrooms sprinkled in the gaps (never on the road or a tile).
    const tileNear = (x: number, y: number) => battle.tiles.some((t) => Math.abs(t.x - x) < 26 && Math.abs(t.y - y) < 26);
    let placed = 0;
    for (let i = 0; i < 400 && placed < 28; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h;
      if (tileNear(x, y) || battle.path.distanceTo(x, y) < 26) continue;
      drawTinyMushroom(ctx, x, y, P.mushroomCaps[placed % P.mushroomCaps.length], P);
      placed++;
    }
    // Fairy ring around the cat house.
    const hb = cellCenter(map, map.base[0], map.base[1]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.2;
      if (Math.sin(a) < -0.6) continue; // leave the road side open
      drawTinyMushroom(ctx, hb.x + Math.cos(a) * 25, hb.y + 4 + Math.sin(a) * 21, P.mushroomCaps[i % P.mushroomCaps.length], P);
    }
  }

  // Tiles: buildable ones are bright "pools" with a rim, locked ones are dim and dashed.
  for (const tile of battle.tiles) {
    // V1.3: locked tiles are smaller and fainter so buildable tiles stand out.
    const half = tile.unlocked ? 21 : 16;
    ctx.beginPath();
    ctx.roundRect(tile.x - half, tile.y - half, half * 2, half * 2, tile.unlocked ? 9 : 7);
    if (tile.unlocked) {
      const g = ctx.createRadialGradient(tile.x, tile.y, 4, tile.x, tile.y, 28);
      g.addColorStop(0, P.tileGlow);
      g.addColorStop(1, P.tileFill);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = P.tileBorder;
      ctx.stroke();
      // paw print
      ctx.fillStyle = P.tilePaw;
      ctx.beginPath();
      ctx.ellipse(tile.x, tile.y + 3, 5, 4, 0, 0, TAU);
      ctx.fill();
      for (const [dx, dy] of [
        [-5.5, -3],
        [-2, -6.5],
        [2, -6.5],
        [5.5, -3],
      ]) {
        ctx.beginPath();
        ctx.arc(tile.x + dx, tile.y + dy, 1.9, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = P.lockedFill;
      ctx.fill();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = P.lockedBorder;
      ctx.stroke();
      ctx.setLineDash([]);
      // lock
      ctx.fillStyle = P.lockIcon;
      ctx.beginPath();
      ctx.roundRect(tile.x - 5, tile.y - 1, 10, 8, 2);
      ctx.fill();
      ctx.strokeStyle = P.lockIcon;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tile.x, tile.y - 1, 3.5, Math.PI, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Lanterns along the road (moonlit theme): warm glows that also light the path.
  if (P.lanterns) {
    for (const frac of [0.18, 0.45, 0.72, 0.93]) {
      const p = battle.path.pointAt(battle.path.length * frac);
      const lx = p.x + p.dy * 20;
      const ly = p.y - p.dx * 20;
      if (mushroomEnv) {
        const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 30);
        g.addColorStop(0, 'rgba(159,224,208,0.35)');
        g.addColorStop(1, 'rgba(159,224,208,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lx, ly, 30, 0, TAU);
        ctx.fill();
        drawTinyMushroom(ctx, lx, ly + 3, '#9fe0d0', P, 1.4);
        continue;
      }
      const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 34);
      g.addColorStop(0, 'rgba(255,214,140,0.35)');
      g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, ly, 34, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#4a3d4e';
      ctx.fillRect(lx - 0.8, ly - 2, 1.6, 10);
      ctx.fillStyle = '#ffd88a';
      ctx.beginPath();
      ctx.roundRect(lx - 3, ly - 8, 6, 7, 2);
      ctx.fill();
      ctx.strokeStyle = '#7d6a4c';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Entrance burrow
  const start = pts[0];
  // Burrow sits on the board edge where the road enters, opening toward the road.
  const dirA = Math.atan2(pts[1].y - start.y, pts[1].x - start.x);
  ctx.save();
  ctx.translate(Math.min(w, Math.max(0, start.x)), Math.min(h, Math.max(0, start.y)));
  ctx.rotate(dirA);
  ctx.fillStyle = P.burrowOuter;
  ctx.beginPath();
  ctx.ellipse(2, 0, 16, 22, 0, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.fillStyle = P.burrowInner;
  ctx.beginPath();
  ctx.ellipse(2, 0, 10, 15, 0, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.restore();
  // little sign (only where there is room above the road)
  if (start.y > 45 && Math.abs(dirA) < 0.3) {
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
  drawHouse(ctx, b.x, b.y + 2, P);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rng: Rng, P: BoardPalette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(20,30,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 15, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = P.trunk;
  ctx.beginPath();
  ctx.roundRect(-3.5, 2, 7, 13, 2);
  ctx.fill();
  for (const [dx, dy, r] of [
    [-7, -2, 10],
    [7, -2, 10],
    [0, -10, 12],
    [0, 0, 11],
  ] as const) {
    ctx.fillStyle = P.treeGreens[Math.floor(rng.next() * P.treeGreens.length)];
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = P.treeHighlight;
  ctx.beginPath();
  ctx.arc(-4, -12, 5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawMushrooms(ctx: CanvasRenderingContext2D, x: number, y: number, rng: Rng, P: BoardPalette) {
  for (let i = 0; i < 2; i++) {
    const mx = x + (rng.next() - 0.5) * 22;
    const my = y + (rng.next() - 0.5) * 16;
    if (P.moon) {
      // soft bioluminescent glow
      const g = ctx.createRadialGradient(mx, my - 2, 1, mx, my - 2, 14);
      g.addColorStop(0, i ? 'rgba(181,138,214,0.35)' : 'rgba(127,200,192,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my - 2, 14, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = P.mushroomStem;
    ctx.fillRect(mx - 2, my - 2, 4, 7);
    ctx.fillStyle = P.mushroomCaps[i % P.mushroomCaps.length];
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

function drawTinyMushroom(ctx: CanvasRenderingContext2D, x: number, y: number, cap: string, P: BoardPalette, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = P.mushroomStem;
  ctx.fillRect(-1.2, -1, 2.4, 4);
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.arc(0, -1, 3.6, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(-1.2, -2.6, 0.7, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Big spotted toadstool for the mushroom forest (replaces trees). */
function drawGiantMushroom(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rng: Rng, P: BoardPalette) {
  const cap = P.mushroomCaps[Math.floor(rng.next() * P.mushroomCaps.length)];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (P.moon) {
    const g = ctx.createRadialGradient(0, -8, 2, 0, -8, 30);
    g.addColorStop(0, 'rgba(181,138,214,0.32)');
    g.addColorStop(1, 'rgba(181,138,214,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -8, 30, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(20,20,40,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 15, 4.5, 0, 0, TAU);
  ctx.fill();
  // stem
  ctx.fillStyle = P.mushroomStem;
  ctx.beginPath();
  ctx.moveTo(-5, 14);
  ctx.quadraticCurveTo(-3, 0, -4, -6);
  ctx.lineTo(4, -6);
  ctx.quadraticCurveTo(3, 0, 5, 14);
  ctx.closePath();
  ctx.fill();
  // cap
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(0, -7, 18, 13, 0, Math.PI, TAU);
  ctx.quadraticCurveTo(0, -2, -18, -7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [dx, dy, r] of [
    [-9, -11, 2.6],
    [0, -16, 3],
    [8, -11, 2.2],
    [3, -9, 1.5],
    [-3, -8, 1.3],
  ] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, TAU);
    ctx.fill();
  }
  // a tiny companion mushroom
  drawTinyMushroom(ctx, 11, 12, P.mushroomCaps[(P.mushroomCaps.indexOf(cap) + 1) % P.mushroomCaps.length], P);
  ctx.restore();
}

function drawFlowers(ctx: CanvasRenderingContext2D, x: number, y: number, rng: Rng, P: BoardPalette) {
  for (let i = 0; i < 4; i++) {
    const fx = x + (rng.next() - 0.5) * 34;
    const fy = y + (rng.next() - 0.5) * 30;
    ctx.fillStyle = P.flowers[Math.floor(rng.next() * P.flowers.length)];
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

function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, P: BoardPalette) {
  ctx.save();
  ctx.translate(x, y);
  if (P.moon) {
    const g = ctx.createRadialGradient(0, 6, 2, 0, 6, 36);
    g.addColorStop(0, 'rgba(255,214,140,0.3)');
    g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 6, 36, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(20,30,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 24, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = P.houseWall;
  ctx.strokeStyle = P.houseWallEdge;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-18, -4, 36, 21, 3);
  ctx.fill();
  ctx.stroke();
  // roof with ears
  ctx.fillStyle = P.houseRoof;
  ctx.strokeStyle = P.houseRoofEdge;
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
  ctx.fillStyle = P.houseDoor;
  ctx.beginPath();
  ctx.roundRect(-6, 3, 12, 14, [6, 6, 0, 0]);
  ctx.fill();
  // window w/ fish
  ctx.fillStyle = P.houseWindow;
  ctx.beginPath();
  ctx.arc(11, 4, 3.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e0a050';
  ctx.beginPath();
  ctx.ellipse(-12, 5, 3.5, 2, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** a/b clamped to 0–1 (0 when b is not positive or either value is not finite). */
export function frac(a: number, b: number): number {
  const v = a / b;
  return Number.isFinite(v) && v > 0 ? Math.min(1, v) : 0;
}
