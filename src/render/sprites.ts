// Programmatic placeholder art. Every function draws centred on (0,0) in world px.
// Swap these out for image sprites later without touching gameplay code.

import type { CatId, CatPalette, ChestTier, EnemyId } from '../game/types';

import { TAU, circle, drawHeart, drawStar, ellipse, poly, roundRect, type Ctx } from './shapes';
import { costumeCovers, costumeHasHeadwear, costumeTint, drawCostume, type CostumeGeom, type GearTint, type Slot } from './costumes';

export { drawHeart, drawStar };

// ---------------------------------------------------------------------------
// Cats
// ---------------------------------------------------------------------------

export interface CatDrawOpts {
  type: CatId;
  level: number;
  palette: CatPalette;
  hat: string | null;
  /** Global time (s) for idle motion. */
  t: number;
  /** Seconds since last attack (large = idle). */
  attackAge: number;
  /** Angle to last target (radians). */
  aim: number;
  seed?: number;
  /** 0..1 progress of a wind-up (Orange raising its belly, Black Cat aiming); undefined if none. */
  windup?: number;
  /** Punch counter for alternating paws (Tabby). */
  comboIndex?: number;
  /** Equipped skin id: draws that skin's costume (hat, cape, apron…). */
  costume?: string;
}

const HEAD_R: Partial<Record<CatId, number>> = { kitten: 12.8, devil: 12.8, orange: 13, pounce: 11.5 };

export function drawCat(ctx: Ctx, o: CatDrawOpts) {
  const p = o.palette;
  const breathe = Math.sin(o.t * 3 + (o.seed ?? 0)) * 0.025;
  let dx = 0;
  let dy = 0;
  let squash = 1;
  const a = o.attackAge;

  // V1.3 idle personality: a short fidget every ~6 s while not attacking (visual only).
  const idle = a > 1.2 && o.windup === undefined;
  const phase = (o.t + (o.seed ?? 0) * 1.7) % 6;
  const fidget = idle && o.t > 0 && phase < 0.8 ? Math.sin((phase / 0.8) * Math.PI) : 0;
  if (o.type === 'tabby' && fidget > 0) dy = -4 * Math.abs(Math.sin((phase / 0.8) * Math.PI * 2)); // eager double hop

  // Attack poses
  if (o.type === 'kitten' && a < 0.15) {
    dx = Math.cos(o.aim) * 3 * (1 - a / 0.15);
    dy = Math.sin(o.aim) * 3 * (1 - a / 0.15);
  } else if (o.type === 'orange' && o.windup !== undefined) {
    // Lazy wind-up: rises and leans back, trembling a little at the top.
    const k = o.windup;
    dy = -14 * (1 - (1 - k) * (1 - k));
    squash = 1 + 0.08 * k;
    dx = k > 0.75 ? Math.sin(o.t * 60) * 0.8 : 0;
  } else if (o.type === 'orange' && a < 0.35) {
    // SLAM: hard squash on impact, then wobble back.
    const k = a / 0.35;
    squash = 1 - 0.32 * Math.sin(Math.min(1, k * 1.6) * Math.PI) * (1 - k * 0.5);
  } else if (o.type === 'black' && a < 0.15) {
    dx = -Math.cos(o.aim) * 2.5 * (1 - a / 0.15);
    dy = -Math.sin(o.aim) * 2.5 * (1 - a / 0.15);
  } else if ((o.type === 'pounce' && a < 0.12) || (o.type === 'sable' && a < 0.2)) {
    // lunge toward the target
    const len = o.type === 'pounce' ? 0.12 : 0.2;
    const k = Math.sin((a / len) * Math.PI);
    dx = Math.cos(o.aim) * (o.type === 'pounce' ? 5 : 3.5) * k;
    dy = Math.sin(o.aim) * (o.type === 'pounce' ? 5 : 3.5) * k;
  } else if ((o.type === 'whiskers' || o.type === 'devil') && a < 0.25) {
    dy = -3 * Math.sin((a / 0.25) * Math.PI); // a little performer's hop / toss
  } else if (o.type === 'mallow' && a < 0.5) {
    dx = Math.sin((a / 0.5) * Math.PI * 3) * 1.2; // bell sway
  }
  if (o.type === 'pounce' && fidget > 0) dy = -3 * Math.abs(Math.sin((phase / 0.8) * Math.PI * 2)); // restless bounce

  ctx.save();
  // Shadow (doesn't jump)
  ellipse(ctx, 0, 15, 14 * (o.type === 'orange' ? 1.2 : 1), 4, 'rgba(60,80,40,0.22)');
  ctx.translate(dx, dy);
  ctx.scale(1 + (1 - squash) * 0.6, (1 + breathe) * squash);
  ctx.translate(0, (1 - squash) * 14);

  const fat = o.type === 'orange' ? 1.25 : 1;
  const ol = p.outline;
  const L = o.level;
  // Skin-aware level gear: a skin outfit "covers" some equipment slots. Default level gear in a
  // covered slot is not drawn (the outfit draws its own themed upgrade there instead), so a skin
  // never hides a level change by painting over it.
  const free = (s: Slot) => !costumeCovers(o.costume, s);
  const tint = costumeTint(o.costume);
  const fluffy = o.type === 'white' || o.type === 'mallow';
  const headR = HEAD_R[o.type] ?? 12;
  // Just under the chin, in front of the head: neck pieces drawn here are never hidden by the head.
  const ny = fluffy ? 7.5 : o.type === 'orange' ? 5.5 : 4.5;

  // Paws (positions are needed by the outfit too)
  const jab = o.type === 'tabby' && a < 0.07;
  const jabSide = jab ? ((o.comboIndex ?? 0) % 2 === 0 ? -1 : 1) : 0;
  const pawL = { x: -6 * fat, y: 15 };
  const pawR = { x: 6 * fat, y: 15 };
  if (jab) {
    const reach = 9 * (1 - a / 0.07) + 3;
    const tp = jabSide < 0 ? pawL : pawR;
    tp.x += Math.cos(o.aim) * reach;
    tp.y += Math.sin(o.aim) * reach - 4;
  }

  // Tail
  ctx.lineCap = 'round';
  ctx.strokeStyle = ol;
  ctx.lineWidth = o.type === 'white' ? 9 : 7;
  const tailWag = Math.sin(o.t * 2.2 + (o.seed ?? 0)) * 3;
  ctx.beginPath();
  ctx.moveTo(8 * fat, 9);
  ctx.quadraticCurveTo(20 * fat, 8, 17 * fat + tailWag, -4);
  ctx.stroke();
  ctx.strokeStyle = o.type === 'sable' || o.type === 'mallow' ? p.stripe : p.body;
  ctx.lineWidth = o.type === 'white' || o.type === 'mallow' ? 6.5 : 4.5;
  ctx.stroke();
  const tail = { x: 17 * fat + tailWag, y: -4 };
  if (o.type === 'devil') {
    // dark-tipped tail; at Lv.5 the tip becomes a heart ("devil" tail)
    if (L >= 5 && free('tail')) drawHeart(ctx, tail.x, tail.y - 2.5, 4.4, '#9a5ac8');
    else circle(ctx, tail.x, tail.y, 2.4, p.stripe);
  }
  if (o.type === 'whiskers') circle(ctx, tail.x, tail.y, 2.3, p.belly);
  if (o.type === 'white' && L >= 3 && free('tail')) {
    // ribbon on tail
    poly(ctx, [17 + tailWag, -2, 23 + tailWag, -7, 23 + tailWag, 2], '#ff7fae', '#c04a7a', 1);
    poly(ctx, [17 + tailWag, -2, 11 + tailWag, -7, 11 + tailWag, 2], '#ff7fae', '#c04a7a', 1);
    circle(ctx, 17 + tailWag, -2.5, 1.6, '#ffb3d1', '#c04a7a', 0.8);
  }

  const cg: CostumeGeom = { r: headR, fat, t: o.t, level: L, ny, pawL, pawR, tail, aim: o.aim, attackAge: a };
  drawCostume(ctx, o.costume, 'tail', cg);
  drawBackGear(ctx, o, free);
  drawCostume(ctx, o.costume, 'back', cg);

  // Body
  if (fluffy) {
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * TAU;
      circle(ctx, Math.cos(ang) * 9, 7 + Math.sin(ang) * 7, 6, p.body, ol, 1.2);
    }
  }
  ellipse(ctx, 0, 7, 12 * fat, 10 * (o.type === 'orange' ? 1.1 : 1), p.body, fluffy ? undefined : ol);
  if (o.type === 'whiskers')
    ellipse(ctx, 0, 8, 8, 8, p.belly); // tuxedo shirt front
  else ellipse(ctx, 0, 9, 7 * fat, 6, p.belly);
  if (o.type === 'pounce') {
    // Bengal rosettes
    for (const [sx, sy] of [
      [-8, 3],
      [-5, 11],
      [8, 4],
      [6, 12],
      [-9, 9],
      [9, 9],
    ] as const) {
      ellipse(ctx, sx, sy, 2.2, 1.6, p.stripe);
      ellipse(ctx, sx + 0.4, sy, 1, 0.7, p.body);
    }
  }

  // Level gear on the body (capes, belts, bibs, pouches), then the skin outfit's body pieces
  drawBodyGear(ctx, o, fat, free, tint);
  drawCostume(ctx, o.costume, 'body', cg);

  // Paws
  const pawColor = o.type === 'tabby' && L >= 3 && free('paws') ? '#ffffff' : o.type === 'sable' ? p.stripe : p.belly;
  circle(ctx, pawL.x, pawL.y, 3.6, pawColor, ol, 1.2);
  circle(ctx, pawR.x, pawR.y, 3.6, pawColor, ol, 1.2);
  drawPawGear(ctx, o, [pawL, pawR], free, tint);
  drawCostume(ctx, o.costume, 'paws', cg);

  // Head
  const hy = -7;
  let headTilt = o.type === 'white' && a < 0.6 ? Math.sin((a / 0.6) * Math.PI) * 0.18 : 0;
  if (o.type === 'kitten') headTilt += fidget * 0.22; // curious head tilt
  const glance = o.type === 'black' ? fidget * 1.8 : 0; // watchful side glance
  ctx.save();
  ctx.translate(glance, hy);
  ctx.rotate(headTilt);
  drawHead(ctx, o, free);
  ctx.restore();

  // Neck / chest pieces in front of the chin, then the outfit's front pieces
  drawNeckGear(ctx, o, ny, free, tint);
  drawCostume(ctx, o.costume, 'front', cg);

  // Held items and weapons
  if (o.type === 'black') drawRifle(ctx, o, tint);
  if (o.type === 'sable') drawRapier(ctx, o);
  if (o.type === 'whiskers' && L >= 4 && free('hand')) drawWand(ctx, o);
  if (o.type === 'orange' && L >= 3 && free('hand')) {
    // holding a fish snack
    ctx.save();
    ctx.translate(-10 * fat, 11);
    ctx.rotate(-0.5);
    ellipse(ctx, 0, 0, 4.5, 2.2, '#8ac0e8', '#3a6a9a', 1);
    poly(ctx, [4, 0, 7, -2.5, 7, 2.5], '#8ac0e8', '#3a6a9a', 1);
    ctx.restore();
  }
  drawCostume(ctx, o.costume, 'hand', cg);

  ctx.restore();

  // Idle extras drawn outside the body transform
  if (idle && o.t > 0) {
    if (o.type === 'orange') {
      // sleepy "z z" drifting up
      ctx.save();
      ctx.fillStyle = p.outline;
      ctx.font = `900 7px ${'system-ui, sans-serif'}`;
      ctx.textAlign = 'center';
      for (let i = 0; i < 2; i++) {
        const k = (o.t * 0.5 + i * 0.5 + (o.seed ?? 0) * 0.3) % 1;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
        ctx.fillText('z', 12 + k * 6, -22 - k * 12);
      }
      ctx.restore();
    } else if (o.type === 'white' && fidget > 0) {
      drawStar(ctx, -13, -24, 2.2 + fidget * 1.5, '#ffe9f4');
      drawStar(ctx, 14, -19, 1.6 + fidget, '#fff6c8');
    }
  }
}

function drawHead(ctx: Ctx, o: CatDrawOpts, free: (s: Slot) => boolean) {
  const p = o.palette;
  const ol = p.outline;
  const r = HEAD_R[o.type] ?? 12;
  // A costume's headwear replaces the cat's own head accessory and the shared hat.
  const dressed = costumeHasHeadwear(o.costume);
  // Ears
  if (o.type === 'devil') {
    // Folded ears: small rounded flaps folded forward (Scottish-fold silhouette).
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * r * 0.85, -r * 0.45);
      ctx.quadraticCurveTo(sgn * r * 0.75, -r * 1.05, sgn * r * 0.22, -r * 0.82);
      ctx.quadraticCurveTo(sgn * r * 0.5, -r * 0.62, sgn * r * 0.85, -r * 0.45);
      ctx.fillStyle = p.stripe;
      ctx.fill();
      ctx.strokeStyle = ol;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  } else {
    const earFill = o.type === 'sable' ? p.stripe : p.body;
    const earL = [-r * 0.9, -r * 0.35, -r * 0.62, -r * 1.42, -r * 0.1, -r * 0.85];
    const earR = earL.map((v, i) => (i % 2 === 0 ? -v : v));
    poly(ctx, earL, earFill, ol);
    poly(ctx, earR, earFill, ol);
    poly(ctx, [-r * 0.72, -r * 0.5, -r * 0.6, -r * 1.15, -r * 0.3, -r * 0.8], p.earInner);
    poly(ctx, [r * 0.72, -r * 0.5, r * 0.6, -r * 1.15, r * 0.3, -r * 0.8], p.earInner);
    if (o.type === 'mallow') {
      // darker ragdoll ear points
      poly(ctx, [-r * 0.8, -r * 0.6, -r * 0.62, -r * 1.42, -r * 0.4, -r * 1.0], 'rgba(150,120,100,0.45)');
      poly(ctx, [r * 0.8, -r * 0.6, r * 0.62, -r * 1.42, r * 0.4, -r * 1.0], 'rgba(150,120,100,0.45)');
    }
  }

  if (o.type === 'white' || o.type === 'mallow') {
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * TAU;
      circle(ctx, Math.cos(ang) * r * 0.85, Math.sin(ang) * r * 0.8 + 1, 4.5, p.body, ol, 1);
    }
  }
  ellipse(ctx, 0, 0, r * (o.type === 'orange' ? 1.12 : 1), r * 0.92, p.body, o.type === 'white' ? undefined : ol);

  // Markings
  ctx.strokeStyle = p.stripe;
  ctx.lineCap = 'round';
  if (o.type === 'tabby') {
    ctx.lineWidth = 2;
    for (const x of [-3.5, 0, 3.5]) {
      ctx.beginPath();
      ctx.moveTo(x, -r * 0.85);
      ctx.lineTo(x * 0.8, -r * 0.45);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(-r * 0.7, 1);
    ctx.moveTo(r, 0);
    ctx.lineTo(r * 0.7, 1);
    ctx.stroke();
  } else if (o.type === 'orange') {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -r * 0.88);
    ctx.lineTo(-1.5, -r * 0.55);
    ctx.moveTo(2, -r * 0.88);
    ctx.lineTo(1.5, -r * 0.55);
    ctx.stroke();
  } else if (o.type === 'whiskers') {
    // tuxedo: white muzzle and a white blaze up the nose
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.92, 0, 0, TAU);
    ctx.clip();
    ellipse(ctx, 0, r * 0.45, r * 0.62, r * 0.5, p.belly);
    poly(ctx, [-2.2, r * 0.1, 0, -r * 0.55, 2.2, r * 0.1], p.belly);
    ctx.restore();
  } else if (o.type === 'sable' || o.type === 'mallow') {
    // Siamese / ragdoll mask: darker around the nose and eyes
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.92, 0, 0, TAU);
    ctx.clip();
    ellipse(
      ctx,
      0,
      r * 0.4,
      r * (o.type === 'sable' ? 0.42 : 0.45),
      r * (o.type === 'sable' ? 0.36 : 0.38),
      o.type === 'sable' ? 'rgba(90,68,52,0.42)' : 'rgba(184,160,140,0.35)',
    );
    ctx.restore();
  } else if (o.type === 'pounce') {
    for (const [sx, sy] of [
      [-5, -r * 0.6],
      [0, -r * 0.75],
      [5, -r * 0.6],
      [-r * 0.75, -1],
      [r * 0.75, -1],
    ] as const)
      ellipse(ctx, sx, sy, 1.6, 1.2, p.stripe);
  } else if (o.type === 'devil') {
    // silver shading: dark-tipped fur on the crown
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.92, 0, 0, TAU);
    ctx.clip();
    ellipse(ctx, 0, -r * 0.85, r * 0.9, r * 0.38, 'rgba(120,124,138,0.35)');
    ctx.restore();
  } else if (o.type === 'kitten' && o.costume === 'skin_calico') {
    // Calico patches (only the Calico skin — other Kitty B skins keep a plain face)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.92, 0, 0, TAU);
    ctx.clip();
    circle(ctx, -r * 0.6, -r * 0.5, r * 0.5, p.stripe);
    circle(ctx, r * 0.7, -r * 0.1, r * 0.35, '#4a3a30');
    ctx.restore();
  }

  // Forehead gear (under the eyes)
  drawBrowGear(ctx, o, r, free);

  // Cheeks
  circle(ctx, -r * 0.55, r * 0.3, 2.4, 'rgba(255,130,150,0.35)');
  circle(ctx, r * 0.55, r * 0.3, 2.4, 'rgba(255,130,150,0.35)');

  // Eyes
  const ey = -1;
  const ex = r * 0.38;
  const blink = Math.sin(o.t * 0.9 + (o.seed ?? 0) * 3) > 0.985;
  if (o.type === 'orange') {
    ctx.strokeStyle = p.eye;
    ctx.lineWidth = 1.8;
    const wide = o.attackAge < 0.3;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (wide) ctx.arc(s * ex, ey, 2.2, 0, TAU);
      else ctx.arc(s * ex, ey - 1, 2.6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  } else if (blink) {
    ctx.strokeStyle = p.eye;
    ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * ex - 2.5, ey);
      ctx.lineTo(s * ex + 2.5, ey);
      ctx.stroke();
    }
  } else if (o.type === 'black') {
    for (const s of [-1, 1]) {
      ellipse(ctx, s * ex, ey, 3, 2.4, p.eye);
      ellipse(ctx, s * ex, ey, 0.8, 2.2, '#1a1a1a');
    }
  } else if (o.type === 'sable' || o.type === 'pounce') {
    // almond eyes: calm (Sable) / focused (Pounce)
    for (const s of [-1, 1]) {
      ellipse(ctx, s * ex, ey, 3, o.type === 'sable' ? 2 : 2.3, p.eye);
      ellipse(ctx, s * ex + 0.3, ey, 1, 1.8, '#1a1a1a');
      circle(ctx, s * ex + 1, ey - 0.9, 0.6, '#ffffff');
    }
    if (o.type === 'sable') {
      // a slightly haughty brow
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = 1;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * (ex - 2.5), ey - 3.6);
        ctx.lineTo(s * (ex + 2.8), ey - 3);
        ctx.stroke();
      }
    }
  } else {
    const er = o.type === 'kitten' ? 3.3 : o.type === 'devil' ? 3.7 : 2.8;
    for (const s of [-1, 1]) {
      circle(ctx, s * ex, ey, er, p.eye);
      if (o.type === 'devil') circle(ctx, s * ex, ey + 0.3, er * 0.55, '#1e3a2a');
      circle(ctx, s * ex + 1, ey - 1.1, er * 0.38, '#ffffff');
      if (o.type === 'devil') circle(ctx, s * ex - 1.2, ey + 1.2, er * 0.18, '#ffffff');
    }
    if (o.type === 'white') {
      ctx.strokeStyle = '#3a3a4a';
      ctx.lineWidth = 1;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * (ex + 2.4), ey - 2);
        ctx.lineTo(s * (ex + 4.2), ey - 3.6);
        ctx.stroke();
      }
    }
    if (o.type === 'tabby') {
      ctx.strokeStyle = p.stripe;
      ctx.lineWidth = 1.6;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * (ex + 3), ey - 4.5);
        ctx.lineTo(s * (ex - 2.5), ey - 3.3);
        ctx.stroke();
      }
    }
  }

  // Nose & mouth
  poly(ctx, [-1.6, 2.6, 1.6, 2.6, 0, 4.2], '#e77b8a');
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 4.2);
  ctx.quadraticCurveTo(-1.6, 6.2, -3, 5);
  ctx.moveTo(0, 4.2);
  ctx.quadraticCurveTo(1.6, 6.2, 3, 5);
  ctx.stroke();
  // Whiskers
  ctx.strokeStyle = 'rgba(80,60,50,0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(s * 5, 3.5);
    ctx.lineTo(s * 13, 2);
    ctx.moveTo(s * 5, 4.5);
    ctx.lineTo(s * 13, 5.5);
  }
  ctx.stroke();

  if (o.type === 'whiskers') {
    // playful showman's grin
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 4.6, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  // Top-of-head and side gear for this level, then the skin's headwear. The shared cosmetic hat is
  // worn only when nothing else sits on top of the head (no skin headwear and no level crown gear),
  // so two hats never stack.
  drawCrownGear(ctx, o, r, free);
  if (dressed) drawCostume(ctx, o.costume, 'head', { r, fat: 1, t: o.t, level: o.level });
  else if (o.hat && !hasCrownGear(o.type, o.level)) drawHat(ctx, o.hat, r);
}

// ---------------------------------------------------------------------------
// In-battle level gear (Lv.1–5). Every piece belongs to an equipment slot; a skin outfit that
// covers a slot replaces that piece with its own themed upgrade (see costumes.ts).
// Each level adds or upgrades something big enough to read at phone battle size.
// ---------------------------------------------------------------------------

const GOLD = '#ffd36a';
const GOLD_EDGE = '#a07a10';

/** True when this cat wears its own hat/crown at this level (the shared cosmetic hat steps aside). */
export function hasCrownGear(type: CatId, L: number): boolean {
  switch (type) {
    case 'whiskers':
      return true; // top hat
    case 'mallow':
      return L >= 2; // captain's cap
    case 'white':
      return L >= 4; // tiara
    case 'black':
    case 'orange':
    case 'devil':
      return L >= 5; // beret / donut crown / horns
    default:
      return false;
  }
}

/** Pieces behind the body (drawn before it). */
function drawBackGear(ctx: Ctx, o: CatDrawOpts, free: (s: Slot) => boolean) {
  if (o.type === 'white' && o.level >= 5 && free('cape')) {
    // Noble White Lv.5: royal rose cape with a golden hem, spreading out on both sides
    const s = Math.sin(o.t * 2.4) * 0.8;
    poly(ctx, [-8, -3, 8, -3, 20 + s, 17, 0, 15, -20 + s, 17], '#f08ab8', '#a04a78', 1.3);
    poly(ctx, [18 + s, 15, 20 + s, 17, 12, 3], GOLD);
    poly(ctx, [-18 + s, 15, -20 + s, 17, -12, 3], GOLD);
  }
}

function drawBodyGear(ctx: Ctx, o: CatDrawOpts, fat: number, free: (s: Slot) => boolean, tint: GearTint) {
  const L = o.level;
  const belly = o.palette.belly;
  switch (o.type) {
    case 'kitten':
      if (L >= 4 && free('cape')) {
        // blue travel cape (gold-trimmed at Lv.5)
        poly(ctx, [-9, 0, 9, 0, 13, 15, -13, 15], tint.cape ?? '#5a8ae0', L >= 5 ? GOLD : '#2a4a90', L >= 5 ? 2 : 1.2);
        ellipse(ctx, 0, 9, 7, 6, belly);
      }
      if (L >= 3 && free('waist')) {
        // explorer satchel on a strap
        ctx.strokeStyle = '#8a5a2a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 1);
        ctx.lineTo(7, 13);
        ctx.stroke();
        roundRect(ctx, 3, 8, 9.5, 8, 2, '#c0884a', '#6a4420', 1.1);
        roundRect(ctx, 3, 8, 9.5, 3.2, 1.6, '#9a6630', '#6a4420', 0.9);
        roundRect(ctx, 6.4, 10, 2.8, 2.4, 0.8, L >= 5 ? GOLD : '#f0d8a0');
      }
      break;
    case 'tabby':
      if (L >= 4 && free('waist')) {
        const col = L >= 5 ? '#f2c230' : '#2a2a2a';
        roundRect(ctx, -12, 7, 24, 4, 1.5, col);
        roundRect(ctx, -3, 6, 6, 6, 1.5, L >= 5 ? '#ffffff' : '#f2c230', '#8a6a10', 1);
      }
      break;
    case 'orange':
      if (L >= 4 && free('cape')) {
        // Plaid blanket cape
        poly(ctx, [-12 * fat, 0, 12 * fat, 0, 15 * fat, 14, -15 * fat, 14], '#5a9a6a', '#2a5a3a', 1.2);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const x of [-8, 0, 8]) {
          ctx.moveTo(x * fat, 1);
          ctx.lineTo(x * fat * 1.2, 14);
        }
        ctx.stroke();
        ellipse(ctx, 0, 9, 7 * fat, 6, belly);
      }
      if (L >= 2 && free('chest')) {
        // fish-print bib (low enough to show under the chin); golden at Lv.5
        const col = L >= 5 ? '#ffd84a' : '#ffffff';
        poly(ctx, [-7.5, 3, 7.5, 3, 5.5, 13, -5.5, 13], col, '#b0a090', 1);
        ellipse(ctx, -0.8, 8, 2.8, 1.6, '#6ab0e0');
        poly(ctx, [1.6, 8, 3.8, 6.4, 3.8, 9.6], '#6ab0e0');
      }
      break;
    case 'black':
      if (L >= 3 && free('cape')) {
        poly(ctx, [-11, -1, 11, -1, 13, 14, -13, 14], tint.cape ?? '#3a5a3a', '#1a2a1a', 1.2);
        ellipse(ctx, 0, 9, 7, 6, belly);
      }
      if (L >= 5 && free('chest')) drawStar(ctx, -5.5, 9.5, 4.2, '#ffd84a');
      break;
    case 'whiskers':
      // velvet stage cape (Lv.2+), gold-trimmed at Lv.5
      if (L >= 2 && free('cape')) {
        poly(ctx, [-10, 0, 10, 0, 13, 13, -13, 13], '#5a3a8a', L >= 5 ? GOLD : '#2a1a4a', L >= 5 ? 2 : 1.2);
        ellipse(ctx, 0, 8, 8, 8, belly);
      }
      break;
    case 'sable':
      // navy cape (always), gold trim (Lv3+), duelist's sash (Lv5)
      if (free('cape')) {
        poly(ctx, [-10, -1, 10, -1, 13, 14, -13, 14], '#2a3a6a', L >= 3 ? '#e0b070' : '#141c3a', L >= 3 ? 2 : 1.2);
        ellipse(ctx, 0, 9, 7, 6, belly);
      }
      if (L >= 5 && free('chest')) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.moveTo(-8, 3);
        ctx.lineTo(7, 14);
        ctx.stroke();
        ctx.strokeStyle = '#3a5ab0';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    case 'mallow':
      // lavender captain's cape (always), gold-trimmed at Lv.5
      if (free('cape')) {
        poly(ctx, [-11, -1, 11, -1, 14, 14, -14, 14], '#b8a8e0', L >= 5 ? GOLD : '#6a5aa0', L >= 5 ? 2 : 1.2);
        ellipse(ctx, 0, 9, 7, 6, belly);
      }
      break;
    case 'pounce':
      if (L >= 5) ellipse(ctx, 0, 13, 15, 4.5, tint.aura ?? 'rgba(110,200,180,0.32)');
      break;
    case 'devil':
      // plum cape (Lv4+), velvet herb pouch (Lv2+), glowing potion vial (Lv3+)
      if (L >= 4 && free('cape')) {
        poly(ctx, [-10, 0, 10, 0, 13, 13, -13, 13], '#6a2a7a', '#3a1048', 1.2);
        ellipse(ctx, 0, 9, 7, 6, belly);
      }
      if (L >= 2 && free('waist')) {
        ellipse(ctx, -9, 11, 4, 3.6, tint.pouch ?? '#8a4aa0', '#4a1a5a', 1);
        roundRect(ctx, -10.8, 6.8, 3.6, 1.8, 0.8, GOLD);
      }
      if (L >= 3 && free('waist')) {
        circle(ctx, 8.8, 9, 4.6, 'rgba(160,240,190,0.35)');
        roundRect(ctx, 6.8, 5, 4, 8, 1.6, tint.vial ?? '#b8f0c8', '#3a6a4a', 0.9);
        roundRect(ctx, 7.6, 3.4, 2.4, 2, 0.6, '#8a5a2a');
        circle(ctx, 8.8, 10, 1.1, '#ffffff');
      }
      break;
  }
}

/** Gear worn on the paws (drawn over them, following Tabby's jabs). */
function drawPawGear(ctx: Ctx, o: CatDrawOpts, paws: { x: number; y: number }[], free: (s: Slot) => boolean, tint: GearTint) {
  if (!free('paws')) return;
  const L = o.level;
  if (o.type === 'tabby' && L >= 3) {
    // red boxing wraps
    ctx.strokeStyle = '#d84a4a';
    ctx.lineWidth = 1.6;
    for (const pw of paws) {
      ctx.beginPath();
      ctx.arc(pw.x, pw.y, 3.6, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
  }
  if (o.type === 'pounce') {
    for (const pw of paws) {
      if (L >= 4) {
        // silver claw guards: a plate over the paw with three claws sticking out
        for (const k of [-1, 0, 1]) poly(ctx, [pw.x + k * 2.6 - 1.2, pw.y + 2, pw.x + k * 2.6 + 1.2, pw.y + 2, pw.x + k * 3, pw.y + 6.5], tint.guard ?? '#eef3f8', '#4a5a6a', 0.8);
        ctx.strokeStyle = tint.guard ?? '#dfe6ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pw.x, pw.y, 3.6, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      // racing wristbands (Lv.2+)
      if (L >= 2) roundRect(ctx, pw.x - 4.4, pw.y - 4.8, 8.8, 3, 1.4, tint.band ?? '#3ab0a0', '#145048', 0.9);
    }
  }
}

/** Forehead gear: drawn before the eyes, so the eyes stay on top. */
function drawBrowGear(ctx: Ctx, o: CatDrawOpts, r: number, free: (s: Slot) => boolean) {
  if (!free('brow')) return;
  const L = o.level;
  if (o.type === 'tabby' && L >= 2) {
    const col = L >= 5 ? '#f2c230' : '#e04848';
    ctx.fillStyle = col;
    ctx.fillRect(-r * 0.98, -r * 0.5, r * 1.96, 3.2);
    poly(ctx, [r * 0.9, -r * 0.45, r * 1.45, -r * 0.8, r * 1.4, -r * 0.15], col);
  }
  if (o.type === 'pounce' && L >= 5) {
    // stealth eye mask with a teal glint
    roundRect(ctx, -r * 0.98, -4.8, r * 1.96, 6, 2.6, '#1c2a26', '#0a1410', 0.8);
    poly(ctx, [r * 0.9, -3.5, r * 1.5, -5.5, r * 1.45, -1], '#1c2a26');
    roundRect(ctx, -r * 0.9, -4.4, r * 1.8, 0.9, 0.4, '#5ae0c8');
  }
}

/** Top-of-head and side pieces (hats, tiara, cap, plume, ribbon, horns…). */
function drawCrownGear(ctx: Ctx, o: CatDrawOpts, r: number, free: (s: Slot) => boolean) {
  const L = o.level;
  switch (o.type) {
    case 'kitten':
      if (L >= 5 && free('side')) drawStar(ctx, -r * 0.78, -r * 0.72, 4.4, '#ffd84a');
      break;
    case 'orange':
      if (L >= 5 && free('crown')) {
        // a pink-frosted donut balanced on top like a crown
        ellipse(ctx, 0, -r * 0.98, 6.4, 3.6, '#e0a860', '#8a5a20', 1);
        ellipse(ctx, 0, -r * 1.06, 5.4, 2.6, '#ff8fb8');
        for (const [x, c] of [
          [-3, '#6ab0e0'],
          [0.5, '#ffe066'],
          [3, '#7ad08a'],
        ] as const)
          roundRect(ctx, x - 0.6, -r * 1.12, 1.4, 0.8, 0.3, c);
        ellipse(ctx, 0, -r * 1.06, 1.8, 0.9, '#8a5a20');
      }
      break;
    case 'black':
      if (L >= 5 && free('crown')) {
        // ace sniper's green beret with a gold star
        ctx.save();
        ctx.rotate(-0.2);
        ellipse(ctx, -1, -r * 0.88, r * 0.92, r * 0.36, '#3a5a3a', '#1a2a1a', 1);
        circle(ctx, -1, -r * 1.2, 1.4, '#3a5a3a');
        drawStar(ctx, 3, -r * 0.9, 2.6, '#ffd84a');
        ctx.restore();
      }
      break;
    case 'white':
      if (L >= 4 && free('crown')) {
        // tiara: three points with pink gems (a bigger blue centre gem at Lv.5)
        poly(ctx, [-6.5, -r * 0.8, -4.5, -r * 1.2, -2, -r * 0.92, 0, -r * 1.38, 2, -r * 0.92, 4.5, -r * 1.2, 6.5, -r * 0.8], '#ffd84a', '#c09020', 1);
        circle(ctx, 0, -r * 1.05, L >= 5 ? 2 : 1.5, L >= 5 ? '#6ab0ff' : '#ff6fa8', '#ffffff', 0.5);
        circle(ctx, -4.5, -r * 1.02, 1, '#ff6fa8');
        circle(ctx, 4.5, -r * 1.02, 1, '#ff6fa8');
      }
      break;
    case 'whiskers':
      if (free('crown')) drawMagicianHat(ctx, r, L, o.t);
      break;
    case 'sable':
      if (L >= 4 && free('side')) {
        // a big feather plume: moonlit at Lv.4, golden at Lv.5
        ctx.lineCap = 'round';
        ctx.strokeStyle = L >= 5 ? GOLD : '#bfe0ff';
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, -r * 0.75);
        ctx.quadraticCurveTo(-r * 1.4, -r * 1.45, -r * 1.35, -r * 0.1);
        ctx.stroke();
        ctx.strokeStyle = L >= 5 ? '#fff4c8' : '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      break;
    case 'mallow':
      if (L >= 2 && free('crown')) {
        // captain's cap (gold star badge at Lv.5)
        roundRect(ctx, -7, -r * 1.2, 14, 5.5, 2.2, '#8a7ab8', '#4a3a78', 1);
        roundRect(ctx, -8.5, -r * 0.8, 17, 2.4, 1, '#4a3a78');
        if (L >= 5) drawStar(ctx, 0, -r * 0.98, 3, GOLD);
        else circle(ctx, 0, -r * 0.98, 1.3, '#e8e0ff');
      }
      break;
    case 'devil':
      if (L >= 5 && free('crown')) {
        // little curled horns
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sg * r * 0.22, -r * 0.82);
          ctx.quadraticCurveTo(sg * r * 0.3, -r * 1.55, sg * r * 0.8, -r * 1.45);
          ctx.quadraticCurveTo(sg * r * 0.5, -r * 1.2, sg * r * 0.6, -r * 0.76);
          ctx.closePath();
          ctx.fillStyle = '#8a3a9a';
          ctx.fill();
          ctx.strokeStyle = '#3a1048';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
      }
      if (free('side')) {
        // plum ribbon (always) — deep velvet from Lv.4
        const col = L >= 4 ? '#6a2a7a' : '#9a5ac8';
        poly(ctx, [r * 0.35, -r * 0.82, r * 0.85, -r * 1.1, r * 0.8, -r * 0.55], col, '#4a1a5a', 0.9);
        poly(ctx, [r * 0.35, -r * 0.82, r * 0.05, -r * 1.15, r * 0.0, -r * 0.6], col, '#4a1a5a', 0.9);
        circle(ctx, r * 0.35, -r * 0.82, 1.6, '#e8b8f0');
      }
      break;
  }
}

/** Neck and shoulder pieces, drawn in front of the chin (never hidden by the head). */
function drawNeckGear(ctx: Ctx, o: CatDrawOpts, y: number, free: (s: Slot) => boolean, tint: GearTint) {
  const L = o.level;
  if (free('neck'))
    switch (o.type) {
      case 'kitten':
        if (L >= 2) {
          // red adventurer scarf (golden badge at Lv.5)
          roundRect(ctx, -8, y - 2, 16, 4, 2, '#e04848', '#9a2a2a', 1);
          poly(ctx, [-5, y + 1, -10, y + 9, -3, y + 7], '#e04848', '#9a2a2a', 1);
          if (L >= 5) circle(ctx, 1.5, y + 0.5, 2.8, '#ffd84a', '#c09020', 1);
        }
        break;
      case 'black':
        if (L >= 2) {
          poly(ctx, [-7.5, y - 1.5, 7.5, y - 1.5, 0, y + 7], '#c83242', '#6a1020', 1);
          circle(ctx, -7, y - 0.5, 1.8, '#c83242', '#6a1020', 0.8);
        }
        break;
      case 'white':
        if (L >= 2) {
          // pearl necklace with a heart pendant; golden pearls and a sapphire at Lv.5
          const pearl = L >= 5 ? '#ffd84a' : '#fff4fa';
          const edge = L >= 5 ? '#b08a20' : '#c890b0';
          for (let i = -3; i <= 3; i++) circle(ctx, i * 2.7, y - 0.5 + (3 - Math.abs(i)) * 0.75, 1.5, pearl, edge, 0.8);
          if (L >= 5) circle(ctx, 0, y + 4.6, 2.8, '#4a8ae0', GOLD, 1.2);
          else drawHeart(ctx, 0, y + 3.6, 3.2, '#ff6fa8');
        }
        break;
      case 'whiskers':
        if (L >= 3) {
          // big golden bow tie
          poly(ctx, [0, y, -6.5, y - 3.2, -6.5, y + 3.2], GOLD, GOLD_EDGE, 1);
          poly(ctx, [0, y, 6.5, y - 3.2, 6.5, y + 3.2], GOLD, GOLD_EDGE, 1);
          circle(ctx, 0, y, 1.8, '#c89aff', GOLD_EDGE, 0.8);
        }
        break;
      case 'sable':
        if (L >= 2) {
          // white lace jabot pinned with a sapphire brooch (gold setting at Lv.5)
          for (const [dy, w] of [
            [6, 2.8],
            [3.6, 3.6],
            [1.2, 4.2],
          ] as const)
            ellipse(ctx, 0, y + dy, w, 2.2, '#ffffff', '#b8a890', 0.8);
          circle(ctx, 0, y + 0.4, 2.7, L >= 5 ? GOLD : '#dfe6ee', '#5a6a80', 1);
          circle(ctx, 0, y + 0.4, 1.3, '#3a6ad8');
        }
        break;
      case 'mallow': {
        // pink collar with a golden bell (always); bigger bell with a red bow from Lv.3
        roundRect(ctx, -7.5, y - 2, 15, 3.2, 1.5, '#e05a7a', '#a03a54', 0.8);
        const br = L >= 3 ? 4 : 2.8;
        circle(ctx, 0, y + 1.2 + br * 0.6, br, GOLD, GOLD_EDGE, 1);
        roundRect(ctx, -br * 0.7, y + 1.2 + br * 0.75, br * 1.4, 0.8, 0.4, GOLD_EDGE);
        if (L >= 3) {
          poly(ctx, [0, y - 0.5, -5, y - 3.5, -5, y + 2.5], '#d83a4a', '#7a1a24', 0.8);
          poly(ctx, [0, y - 0.5, 5, y - 3.5, 5, y + 2.5], '#d83a4a', '#7a1a24', 0.8);
        }
        break;
      }
      case 'pounce': {
        // dark-green scarf; long flowing tails from Lv.3
        const fill = tint.scarf ?? '#2f5a46';
        const edge = tint.scarfEdge ?? '#173426';
        roundRect(ctx, -9, y - 2, 18, 4, 2, fill, edge, 1);
        const s = Math.sin(o.t * 3) * 1.2;
        if (L >= 3) {
          poly(ctx, [5, y, 18, y + 4 + s, 17, y + 8 + s, 7, y + 2.5], fill, edge, 1);
          poly(ctx, [5, y + 1, 15, y + 10 + s, 12.5, y + 12 + s, 6, y + 3], fill, edge, 1);
        } else poly(ctx, [6, y + 0.5, 11, y + 7, 8.5, y + 2.5], fill, edge, 1);
        break;
      }
    }
  if (o.type === 'mallow' && L >= 4 && free('shoulder'))
    for (const sx of [-1, 1]) {
      // golden epaulettes with fringe, on the shoulders beside the fluffy head
      roundRect(ctx, sx * 12.5 - 4, y - 3, 8, 3.8, 1.8, GOLD, GOLD_EDGE, 0.9);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const k of [-2.5, 0, 2.5]) {
        ctx.moveTo(sx * 12.5 + k, y + 0.8);
        ctx.lineTo(sx * 12.5 + k, y + 3.4);
      }
      ctx.stroke();
    }
}

function drawRifle(ctx: Ctx, o: CatDrawOpts, tint: GearTint) {
  const a = o.attackAge;
  ctx.save();
  ctx.translate(2, 6);
  ctx.rotate(o.aim);
  if (Math.cos(o.aim) < 0) ctx.scale(1, -1);
  const gold = o.level >= 4;
  const metal = gold ? (tint.rifle ?? '#c8a030') : '#6a6a78';
  const trim = gold ? (tint.rifleTrim ?? '#f2c230') : '#4a4a58';
  // stock
  roundRect(ctx, -9, -2.5, 9, 5.5, 2, '#8a5a32', '#4a2a10', 1);
  // barrel
  roundRect(ctx, -1, -1.8, 24, 3.6, 1.5, metal, '#2a2a32', 1);
  roundRect(ctx, 21, -2.4, 4, 4.8, 1, trim);
  // scope
  roundRect(ctx, 3, -6.5, 11, 4, 2, gold ? trim : '#3a3a48', '#1a1a22', 1);
  circle(ctx, 14, -4.5, 1.8, o.level >= 2 ? '#ff5a5a' : '#8ad8ff');
  if (o.windup !== undefined) {
    // scope glint pulses faster as the shot approaches
    ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(o.t * (8 + o.windup * 20)));
    drawStar(ctx, 14, -4.5, 3 + o.windup * 2, '#ffffff', 4, 0.35);
    ctx.globalAlpha = 1;
  }
  // muzzle flash
  if (a < 0.08) {
    drawStar(ctx, 29, 0, 6, '#fff2a0', 6, 0.4);
    drawStar(ctx, 29, 0, 3.5, '#ffffff', 6, 0.5);
  }
  ctx.restore();
}

/** Sir Sable's rapier, held low and swept toward the target when he attacks. */
function drawRapier(ctx: Ctx, o: CatDrawOpts) {
  const a = o.attackAge;
  ctx.save();
  ctx.translate(6, 8);
  const swing = a < 0.2 ? Math.sin((a / 0.2) * Math.PI) : 0;
  ctx.rotate(swing ? o.aim : -0.9 + Math.sin(o.t * 1.3) * 0.04);
  const gold = o.level >= 3;
  const len = o.level >= 5 ? 25 : 22;
  ctx.strokeStyle = o.level >= 5 ? '#f4fbff' : '#cfd8e2';
  ctx.lineWidth = o.level >= 5 ? 2.1 : 1.6;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(len + swing * 4, 0);
  ctx.stroke();
  roundRect(ctx, -1, -3.5, 3.4, 7, 1, gold ? '#e0b070' : '#7a8aa0', gold ? GOLD_EDGE : undefined, 0.8);
  roundRect(ctx, -4, -1, 4, 2, 1, '#2a3a6a');
  if (o.level >= 5) drawStar(ctx, len - 2 + swing * 4, 0, 2.6, '#ffffff', 4, 0.35);
  ctx.restore();
}

/** Mr. Whiskers' wand (Lv.4+), with a star at the tip (big and golden at Lv.5). */
function drawWand(ctx: Ctx, o: CatDrawOpts) {
  ctx.save();
  ctx.translate(-9, 10);
  ctx.rotate(-0.6 + (o.attackAge < 0.25 ? -0.6 * Math.sin((o.attackAge / 0.25) * Math.PI) : 0));
  roundRect(ctx, -1.1, -13, 2.4, 13, 1, '#1e1c26');
  roundRect(ctx, -1.2, -13, 2.6, 2.6, 0.8, '#ffffff');
  drawStar(ctx, 0, -15.5, o.level >= 5 ? 4.2 : 3, GOLD);
  ctx.restore();
}

/** Mr. Whiskers' little tilted top hat (always): purple band, gold band from Lv.3, gold star at Lv.5. */
function drawMagicianHat(ctx: Ctx, r: number, level: number, t: number) {
  ctx.save();
  ctx.translate(r * 0.25, -r * 0.92);
  ctx.rotate(0.22 + Math.sin(t * 1.5) * 0.03);
  roundRect(ctx, -8, -1, 16, 2.6, 1.2, '#1e1c26', '#0e0c14', 1);
  roundRect(ctx, -5.2, -11, 10.4, 10.5, 1.5, '#2a2836', '#0e0c14', 1);
  ctx.fillStyle = level >= 3 ? GOLD : '#8a5ac8';
  ctx.fillRect(-5.2, -4, 10.4, level >= 3 ? 3 : 2.2);
  if (level >= 5) drawStar(ctx, 0, -8, 3.4, GOLD);
  ctx.restore();
}

function drawHat(ctx: Ctx, id: string, r: number) {
  const top = -r * 0.9;
  switch (id) {
    case 'hat_bow':
      poly(ctx, [0, top, -7, top - 5, -7, top + 4], '#e84a5a', '#a02a3a', 1);
      poly(ctx, [0, top, 7, top - 5, 7, top + 4], '#e84a5a', '#a02a3a', 1);
      circle(ctx, 0, top, 2.2, '#ff7a8a', '#a02a3a', 1);
      break;
    case 'hat_flower':
      for (let i = -2; i <= 2; i++) {
        const x = i * 4.2;
        const y = top + Math.abs(i) * 1.6;
        const col = ['#ff9ac0', '#ffe066', '#ffffff', '#a8d8ff', '#ff9ac0'][i + 2];
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * TAU;
          circle(ctx, x + Math.cos(ang) * 1.8, y + Math.sin(ang) * 1.8, 1.5, col);
        }
        circle(ctx, x, y, 1.1, '#f2a020');
      }
      break;
    case 'hat_party':
      poly(ctx, [-6, top + 2, 6, top + 2, 0, top - 14], '#6ac0f0', '#2a6a9a', 1);
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-4, top - 2);
      ctx.lineTo(3, top - 4);
      ctx.moveTo(-2, top - 7);
      ctx.lineTo(2, top - 8.5);
      ctx.stroke();
      circle(ctx, 0, top - 14, 2.4, '#ff7aa0');
      break;
    case 'hat_crown':
      poly(ctx, [-7, top + 2, -7, top - 6, -3.5, top - 2, 0, top - 8, 3.5, top - 2, 7, top - 6, 7, top + 2], '#ffd84a', '#b08a10', 1.2);
      circle(ctx, 0, top - 1, 1.5, '#e04868');
      circle(ctx, -4.5, top, 1.1, '#4a8ae0');
      circle(ctx, 4.5, top, 1.1, '#4ae08a');
      break;
  }
}

// ---------------------------------------------------------------------------
// Enemies (forest mice)
// ---------------------------------------------------------------------------

export interface MouseDrawOpts {
  id: EnemyId;
  dirX: number;
  t: number;
  hasShield: boolean;
  hit: boolean;
}

const MOUSE_COLORS: Record<EnemyId, { body: string; belly: string; outline: string }> = {
  normal: { body: '#b4acc4', belly: '#e8e2f0', outline: '#5e5672' },
  fast: { body: '#e0c08e', belly: '#fff0d8', outline: '#8a6a3a' },
  armored: { body: '#9a8c80', belly: '#d8cec4', outline: '#4e443a' },
  shielded: { body: '#a8b8a0', belly: '#e4eede', outline: '#4e6046' },
  boss: { body: '#8a7a9e', belly: '#d8cce6', outline: '#3e3250' },
  mushroomKing: { body: '#7a8a9a', belly: '#dde4ea', outline: '#2e3846' },
  moonEmperor: { body: '#5c5a8c', belly: '#e6e0ff', outline: '#22224a' },
  // Elites: richer, darker coats so the crowned silhouettes stand out from the crowd.
  brute: { body: '#8f7fa8', belly: '#ddd2ea', outline: '#3e3252' },
  ironclad: { body: '#8c8f9c', belly: '#d6d8e0', outline: '#3a3c48' },
  thief: { body: '#c9a46a', belly: '#f4e2c0', outline: '#5e4220' },
  captain: { body: '#b49a7a', belly: '#f0e2cc', outline: '#5a4228' },
  canMonster: { body: '#c9d3e3', belly: '#ff8f6b', outline: '#55607a' },
};

/** Body size per enemy (elites are visibly bigger, except the nimble Thief). */
const MOUSE_SCALE: Partial<Record<EnemyId, number>> = {
  boss: 2,
  mushroomKing: 2,
  moonEmperor: 2.15,
  fast: 0.85,
  armored: 1.08,
  brute: 1.5,
  ironclad: 1.3,
  thief: 0.95,
  captain: 1.3,
};

/** Small gold crown: the shared "elite" mark. */
function eliteCrown(ctx: Ctx, x: number, y: number) {
  poly(ctx, [x - 4.5, y, x - 4.5, y - 5, x - 2, y - 2.5, x, y - 6, x + 2, y - 2.5, x + 4.5, y - 5, x + 4.5, y], '#ffd84a', '#a07a10', 0.9);
  circle(ctx, x, y - 6, 0.9, '#ff6a7a');
}

/**
 * 罐頭怪 / Living Cat Food Can: a walking tin (NOT a mouse with a can) — tin body with a fish
 * label, a lid with a pull tab, a cheeky face on the label, little waving arms and fast legs.
 */
export function drawCanMonster(ctx: Ctx, o: { dirX: number; t: number; hit: boolean }) {
  const line = '#55607a';
  const run = o.t * 26;
  const bob = Math.abs(Math.sin(run)) * 2;
  ctx.save();
  ellipse(ctx, 0, 12, 11, 3.4, 'rgba(60,80,40,0.25)');
  ctx.scale(o.dirX, 1);
  // legs (fast scamper)
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (const [x, ph] of [
    [-4, 0],
    [4, Math.PI],
  ] as const) {
    const sw = Math.sin(run + ph) * 4;
    ctx.beginPath();
    ctx.moveTo(x, 6);
    ctx.lineTo(x + sw, 11);
    ctx.stroke();
    ellipse(ctx, x + sw + 1.4, 11.4, 2.4, 1.4, '#ffd34d', line, 1);
  }
  ctx.translate(0, -bob);
  // arms (waving)
  for (const side of [-1, 1]) {
    const wave = Math.sin(run * 0.5 + (side > 0 ? 0 : Math.PI)) * 0.6;
    ctx.save();
    ctx.translate(side * 9, -2);
    ctx.rotate(side * (0.9 + wave));
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 7);
    ctx.stroke();
    circle(ctx, 0, 8, 1.9, '#ffffff', line, 1);
    ctx.restore();
  }
  // tin body
  const body = o.hit ? '#ffffff' : '#c9d3e3';
  ctx.beginPath();
  ctx.rect(-9, -9, 18, 15);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ellipse(ctx, 0, 6, 9, 3, o.hit ? '#ffffff' : '#9aa6b8', line, 1.5);
  // label band with a fish
  ctx.fillStyle = o.hit ? '#ffffff' : '#ff8f6b';
  ctx.fillRect(-9, -5.5, 18, 8);
  ellipse(ctx, 5.2, 0.6, 2.4, 1.3, '#fff4e0');
  poly(ctx, [7.4, 0.6, 9, -0.6, 9, 1.8], '#fff4e0');
  // face
  circle(ctx, -3.6, -2.2, 2.3, '#ffffff', line, 0.9);
  circle(ctx, 1.8, -2.2, 2.3, '#ffffff', line, 0.9);
  circle(ctx, -3, -2, 1.1, '#2a2230');
  circle(ctx, 2.4, -2, 1.1, '#2a2230');
  ctx.beginPath();
  ctx.arc(-0.9, 1, 1.8, 0, Math.PI);
  ctx.fillStyle = '#6a2030';
  ctx.fill();
  // lid + pull tab
  ellipse(ctx, 0, -9, 9, 3, o.hit ? '#ffffff' : '#e3e9f2', line, 1.5);
  const tab = Math.sin(run * 0.5) * 0.4;
  ctx.save();
  ctx.translate(2, -10);
  ctx.rotate(-0.4 + tab);
  ellipse(ctx, 0, -2, 2.4, 1.4, 'rgba(0,0,0,0)', line, 1.2);
  ctx.restore();
  ctx.restore();
}

export function drawMouse(ctx: Ctx, o: MouseDrawOpts) {
  if (o.id === 'canMonster') return drawCanMonster(ctx, o);
  const c = MOUSE_COLORS[o.id];
  const s = MOUSE_SCALE[o.id] ?? 1;
  const quick = o.id === 'fast' || o.id === 'thief';
  const bob = Math.abs(Math.sin(o.t * (quick ? 16 : 9))) * 1.5;
  ctx.save();
  ellipse(ctx, 0, 9 * s, 10 * s, 3 * s, 'rgba(60,80,40,0.25)');
  ctx.scale(o.dirX * s, s);
  ctx.translate(0, -bob);

  const body = o.hit ? '#ffffff' : c.body;
  // tail
  ctx.strokeStyle = c.outline;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, 4);
  ctx.quadraticCurveTo(-16, 6 + Math.sin(o.t * 8) * 2, -18, -2);
  ctx.stroke();
  // feet
  const step = Math.sin(o.t * (quick ? 22 : 12));
  ellipse(ctx, -3 + step * 1.5, 8 + bob, 2.6, 1.8, '#f0a8b8', c.outline, 1);
  ellipse(ctx, 4 - step * 1.5, 8 + bob, 2.6, 1.8, '#f0a8b8', c.outline, 1);
  // body
  ellipse(ctx, 0, 1, 10, 8, body, c.outline);
  ellipse(ctx, 2, 3, 5.5, 4.5, c.belly);
  // ears
  circle(ctx, -3, -8, 4.6, body, c.outline);
  circle(ctx, -3, -8, 2.6, '#f4b0c0');
  circle(ctx, 4, -8.5, 4.6, body, c.outline);
  circle(ctx, 4, -8.5, 2.6, '#f4b0c0');
  // face
  circle(ctx, 9.5, 0.5, 1.6, '#f07a90');
  circle(ctx, 4.5, -2.5, 1.7, '#2a2230');
  circle(ctx, 5, -3, 0.6, '#ffffff');
  ctx.strokeStyle = 'rgba(60,50,60,0.5)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(8, 1);
  ctx.lineTo(13, -1);
  ctx.moveTo(8, 1.8);
  ctx.lineTo(13, 2.5);
  ctx.stroke();

  if (o.id === 'fast') {
    // sweatband + speed lines
    ctx.fillStyle = '#e04848';
    ctx.fillRect(-6, -6.5, 12, 2.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const y of [-3, 1, 5]) {
      ctx.moveTo(-14, y);
      ctx.lineTo(-20, y);
    }
    ctx.stroke();
  } else if (o.id === 'armored') {
    // acorn helmet
    ctx.beginPath();
    ctx.ellipse(0, -5, 9, 6.5, 0, Math.PI, TAU);
    ctx.fillStyle = '#8a5a2a';
    ctx.fill();
    ctx.strokeStyle = '#4a2a10';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,170,0.35)';
    ctx.beginPath();
    for (const x of [-5, -1, 3]) {
      ctx.moveTo(x, -10);
      ctx.lineTo(x + 3, -5);
    }
    ctx.stroke();
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(-1, -13.5, 2, 3);
  } else if (o.id === 'shielded') {
    if (o.hasShield) {
      ctx.save();
      ctx.translate(10, 2);
      ctx.rotate(0.2);
      ellipse(ctx, 0, 0, 5, 10, '#5ab04a', '#2a6a2a');
      ctx.strokeStyle = '#2a6a2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(0, 9);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = '#6a8a4a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(9, 6);
      ctx.lineTo(11, -4);
      ctx.stroke();
    }
  } else if (o.id === 'boss') {
    // cape, crown, angry brows, cheese
    poly(ctx, [-8, -4, 6, -4, 2, 9, -12, 8], '#c03a4a', '#6a1a2a', 0.8);
    ellipse(ctx, 2, 3, 5.5, 4.5, c.belly);
    poly(ctx, [-4, -11, -4, -16, -1.5, -13, 1, -17, 3.5, -13, 6, -16, 6, -11], '#ffd84a', '#a07a10', 0.8);
    ctx.strokeStyle = '#2a2230';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2.5, -5.5);
    ctx.lineTo(6.5, -4.2);
    ctx.stroke();
    poly(ctx, [8, 4, 14, 1, 14, 7], '#ffd060', '#b08a20', 0.8);
    circle(ctx, 12, 4.5, 0.8, '#e0a830');
  } else if (o.id === 'mushroomKing') {
    // mossy cloak
    poly(ctx, [-9, -3, 6, -3, 3, 9, -13, 8], '#3f6a5a', '#1e3a30', 0.8);
    ellipse(ctx, 2, 3, 5.5, 4.5, c.belly);
    // glowing eyes + stern brow
    circle(ctx, 4.5, -2.5, 1.9, '#9ff0d8');
    ctx.strokeStyle = '#1e2430';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2.5, -5.6);
    ctx.lineTo(7, -4.6);
    ctx.stroke();
    // mushroom scepter
    ctx.strokeStyle = '#6a4a3a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.lineTo(13, -6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(13, -6, 3.2, Math.PI, TAU);
    ctx.fillStyle = '#e86a5a';
    ctx.fill();
    circle(ctx, 12, -7.5, 0.7, '#ffffff');
    // The giant cap IS the shield: full and glowing while shielded, cracked once broken.
    const capW = o.hasShield ? 15 : 12;
    const capH = o.hasShield ? 11 : 8;
    if (o.hasShield) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(o.t * 3);
      circle(ctx, 0, -10, 17, '#c89aff');
      ctx.restore();
    }
    ctx.beginPath();
    ctx.ellipse(0, -9, capW, capH, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fillStyle = o.hit ? '#ffffff' : o.hasShield ? '#9a5ac8' : '#7a5a8a';
    ctx.fill();
    ctx.strokeStyle = '#3a2050';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    for (const [x, y, r] of [
      [-8, -13, 2.2],
      [-1, -17, 2.6],
      [7, -13, 2],
      [2, -11, 1.4],
    ] as const) {
      circle(ctx, x * (capW / 15), -9 + (y + 9) * (capH / 11), r, '#f5e9d5');
    }
    if (!o.hasShield) {
      ctx.strokeStyle = '#2a1838';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, -16);
      ctx.lineTo(-1, -12);
      ctx.lineTo(-4, -10);
      ctx.moveTo(5, -15);
      ctx.lineTo(3, -11);
      ctx.stroke();
    }
  } else if (o.id === 'moonEmperor') {
    // Moonlight veil (= shield): a glowing lavender halo while it holds
    if (o.hasShield) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(o.t * 3);
      circle(ctx, 0, -2, 18, '#b8a8ff');
      ctx.restore();
    }
    // royal night cloak with star specks
    poly(ctx, [-9, -4, 6, -4, 3, 9, -14, 8], '#2a2a6a', '#14143a', 0.8);
    for (const [x, y] of [
      [-8, 2],
      [-4, 5],
      [-10, 6],
    ] as const)
      circle(ctx, x, y, 0.7, '#f5e9d5');
    ellipse(ctx, 2, 3, 5.5, 4.5, c.belly);
    // glowing eyes + stern brow
    circle(ctx, 4.5, -2.5, 1.9, '#d8c8ff');
    ctx.strokeStyle = '#14143a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2.5, -5.6);
    ctx.lineTo(7, -4.6);
    ctx.stroke();
    // crescent-moon crown
    ctx.save();
    ctx.translate(0.5, -14);
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.fillStyle = '#ffe9a8';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2.2, -1.4, 4.4, 0, TAU);
    ctx.fillStyle = o.hasShield ? '#5c5a8c' : '#3e3c6a';
    ctx.fill();
    ctx.restore();
    poly(ctx, [-5, -9, -5, -12, -2.5, -10.5, 0, -13, 2.5, -10.5, 5, -12, 5, -9], '#ffd84a', '#a07a10', 0.8);
  } else if (o.id === 'brute') {
    // HP elite: big belly, cheese-wedge shoulder pad, sturdy brow
    ellipse(ctx, 2, 3, 6.5, 5.2, c.belly);
    poly(ctx, [-9, -4, -2, -7, -3, 0], '#ffd060', '#b08a20', 0.8);
    circle(ctx, -5, -4, 0.8, '#e0a830');
    ctx.strokeStyle = '#2a2230';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(2.5, -5.4);
    ctx.lineTo(6.8, -4.6);
    ctx.stroke();
    eliteCrown(ctx, 0.5, -12.5);
  } else if (o.id === 'ironclad') {
    // Armor elite: full steel helmet with a visor slit and rivets
    ctx.beginPath();
    ctx.ellipse(0.5, -4.5, 10, 7.5, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fillStyle = o.hit ? '#ffffff' : '#9aa4b4';
    ctx.fill();
    ctx.strokeStyle = '#3a3c48';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = '#2a2c36';
    ctx.fillRect(2, -6.5, 8, 1.6);
    for (const x of [-6, -2, 2]) circle(ctx, x, -9, 0.8, '#e8ecf4');
    eliteCrown(ctx, 0.5, -12.5);
  } else if (o.id === 'thief') {
    // Fast elite: bandit mask, loot bag, speed lines
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(1, -4.6, 10, 3.2);
    circle(ctx, 5, -3, 1.2, '#ffffff');
    ellipse(ctx, -10, -2, 4.5, 4, '#e8d8b0', '#6a5230', 0.9);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const y of [-1, 3, 7]) {
      ctx.moveTo(-15, y);
      ctx.lineTo(-22, y);
    }
    ctx.stroke();
    eliteCrown(ctx, 0.5, -12);
  } else if (o.id === 'captain') {
    // Escort elite: captain's hat and a little banner
    poly(ctx, [-8, -9, 8, -9, 5, -14, -5, -14], '#3a4a8a', '#1a2450', 0.9);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(-1.2, -13.2, 2.4, 2.4);
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11, 8);
    ctx.lineTo(-11, -10);
    ctx.stroke();
    poly(ctx, [-11, -10, -4, -8, -11, -5], '#e05a5a', '#7a2020', 0.7);
    eliteCrown(ctx, 0.5, -15);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Treasure chests (they waddle on little feet)
// ---------------------------------------------------------------------------

const CHEST_COLORS: Record<ChestTier, { box: string; band: string; lid: string; outline: string }> = {
  bronze: { box: '#c8864a', band: '#8a4a1a', lid: '#d89a5a', outline: '#5a2a0a' },
  silver: { box: '#c8d4e0', band: '#7a8aa0', lid: '#e0e8f2', outline: '#4a5a70' },
  gold: { box: '#ffcc33', band: '#c08a10', lid: '#ffe070', outline: '#8a5a00' },
};

export function drawChest(ctx: Ctx, tier: ChestTier, t: number, hit: boolean) {
  const c = CHEST_COLORS[tier];
  const s = tier === 'gold' ? 1.15 : tier === 'silver' ? 1.07 : 1;
  ctx.save();
  ellipse(ctx, 0, 11 * s, 13 * s, 3.5 * s, 'rgba(60,80,40,0.25)');
  ctx.scale(s, s);
  const step = Math.sin(t * 10);
  ctx.translate(0, -Math.abs(step) * 1.2);
  // feet
  ellipse(ctx, -6, 10 + step, 3, 2, '#6a4a3a');
  ellipse(ctx, 6, 10 - step, 3, 2, '#6a4a3a');
  // glow
  if (tier !== 'bronze') {
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4);
    circle(ctx, 0, 0, 18, tier === 'gold' ? '#fff08a' : '#e8f4ff');
    ctx.globalAlpha = 1;
  }
  roundRect(ctx, -12, -3, 24, 13, 2.5, hit ? '#ffffff' : c.box, c.outline);
  ctx.beginPath();
  ctx.moveTo(-12, -3);
  ctx.quadraticCurveTo(0, -15, 12, -3);
  ctx.closePath();
  ctx.fillStyle = hit ? '#ffffff' : c.lid;
  ctx.fill();
  ctx.strokeStyle = c.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = c.band;
  ctx.fillRect(-12, -3.5, 24, 2.5);
  ctx.fillRect(-2, -12, 4, 22);
  roundRect(ctx, -3, -1, 6, 6, 1.2, '#fff4c0', c.outline, 1);
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(-0.6, 0.6, 1.2, 2.6);
  // twinkle
  const tw = (Math.sin(t * 5) + 1) / 2;
  drawStar(ctx, 9, -11, 2 + tw * 2, '#ffffff');
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Small UI glyphs on canvas
// ---------------------------------------------------------------------------

export function drawFishIcon(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ellipse(ctx, 0, 0, 6, 3.2, '#e0a050', '#8a5a20', 1);
  poly(ctx, [5, 0, 9, -3.5, 9, 3.5], '#e0a050', '#8a5a20', 1);
  circle(ctx, -3, -0.8, 0.9, '#3a2a10');
  ctx.restore();
}

/**
 * Special-skin sparkle: two small twinkling stars near the head in the skin's colour, so a
 * special skin is recognisable at a glance (visual only).
 */
export function drawSkinGlint(ctx: Ctx, color: string, t: number, seed = 0) {
  for (let i = 0; i < 2; i++) {
    const ph = t * 2.2 + seed * 0.7 + i * Math.PI;
    const k = 0.5 + 0.5 * Math.sin(ph);
    if (k < 0.15) continue;
    const x = i === 0 ? -15 : 14;
    const y = i === 0 ? -22 : -14;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * k;
    drawStar(ctx, x, y, 1.6 + 2.2 * k, color, 4, 0.35);
    ctx.restore();
  }
}
