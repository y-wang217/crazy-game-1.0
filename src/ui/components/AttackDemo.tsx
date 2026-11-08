import { useEffect, useRef } from 'react';
import { CATS } from '../../config/cats';
import { getCatStats } from '../../game/combat';
import type { CatId, CosmeticLoadout } from '../../game/types';
import { resolvePalette } from '../../render/renderer';
import { drawCat, drawHeart, drawMouse, drawStar } from '../../render/sprites';
import { boardPalette, useTheme } from '../../theme';

/**
 * A small looping "signature attack" demonstration for the encyclopedia.
 * Purely visual (no battle simulation), but it uses the cat's REAL timing
 * values (attack interval, wind-up, combo gap, slow strength) so what you see
 * matches how the cat behaves in battle.
 */
export function AttackDemo({ type, level, loadout }: { type: CatId; level: number; loadout: CosmeticLoadout }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const key = JSON.stringify(loadout);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 300;
    const H = 120;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const def = CATS[type];
    const st = getCatStats(def, level);
    const P = boardPalette();
    const palette = resolvePalette(type, loadout);

    // Scene layout per attack style.
    const catX = type === 'black' ? 34 : type === 'tabby' ? 120 : 70;
    const catY = 70;
    const laneY = 86;
    const cycle = Math.max(2.4, st.interval * (type === 'tabby' ? 4 : type === 'kitten' ? 3 : 2));
    const mice =
      type === 'orange'
        ? [0, 14, 28].map((o) => ({ off: o, row: o % 2 }))
        : type === 'white'
          ? [0, 46, 92].map((o) => ({ off: o, row: 0 }))
          : type === 'black'
            ? [{ off: 0, row: 0 }]
            : [0, 60].map((o) => ({ off: o, row: 0 }));

    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const ct = t % cycle; // time within the loop
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // ground + lane
      ctx.fillStyle = P.grass;
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 14);
      ctx.fill();
      ctx.fillStyle = P.road;
      ctx.fillRect(0, laneY - 10, W, 22);

      // attack timing within the loop
      const interval = st.interval;
      const windup = def.windup ?? 0;
      const sinceStart = ct % interval; // time since this attack cycle began
      const winding = windup > 0 && sinceStart < windup;
      const impactAge = windup > 0 ? sinceStart - windup : sinceStart;

      // White slows the mice that are in her aura.
      const slowK = type === 'white' ? 1 - st.slowStrength : 1;
      const walk = (base: number) => {
        const speed = type === 'black' ? 30 : 34;
        return W + 20 + base - ((ct * speed * (type === 'white' && ct > 0.6 ? slowK : 1)) % (W + 80));
      };

      // mice
      const positions = mice.map((m) => ({ x: walk(m.off), y: laneY - 2 + m.row * 6 }));
      for (const [i, p] of positions.entries()) {
        const near = Math.abs(p.x - catX) < st.range * 1.3 || type === 'black';
        const hit = near && impactAge >= 0 && impactAge < 0.1 && (type !== 'black' || i === 0);
        ctx.save();
        ctx.translate(p.x, p.y);
        if (type === 'white' && ct > 0.6) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#ff9cc8';
          ctx.beginPath();
          ctx.ellipse(0, 6, 13, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          drawHeart(ctx, -4, -18 + Math.sin(t * 6 + i) * 1.5, 3.6, '#ff6fa8');
        }
        drawMouse(ctx, { id: 'normal', dirX: -1, t: t * (type === 'white' && ct > 0.6 ? slowK : 1) + i, hasShield: false, hit });
        ctx.restore();
      }

      const target = positions[0];
      // telegraphs
      if (type === 'orange' && winding) {
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(200,110,40,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(target.x + 14, laneY, st.splashRadius * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (type === 'black' && winding) {
        const k = sinceStart / windup;
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = `rgba(255,70,90,${0.3 + k * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(catX + 20, catY + 4);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(target.x, target.y, 12 - k * 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // impact effects
      if (impactAge >= 0 && impactAge < 0.5) {
        const k = impactAge / 0.5;
        ctx.globalAlpha = 1 - k;
        if (type === 'orange') {
          ctx.strokeStyle = '#e0883a';
          ctx.lineWidth = 6 * (1 - k) + 1;
          ctx.beginPath();
          ctx.arc(target.x + 14, laneY, 8 + st.splashRadius * 0.55 * k, 0, Math.PI * 2);
          ctx.stroke();
          for (let i = 0; i < 3; i++) label(ctx, String(Math.round(i === 0 ? st.damage : st.damage * st.splashRatio)), positions[i].x, laneY - 24 - k * 14, i === 0 ? 14 : 11);
        } else if (type === 'black') {
          ctx.strokeStyle = 'rgba(255,240,160,0.9)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(catX + 26, catY + 4);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          drawStar(ctx, target.x, target.y, 10 * (1 - k * 0.5), '#fff1a0', 6, 0.45);
          label(ctx, String(Math.round(st.damage)), target.x, target.y - 24 - k * 14, 16);
        } else if (type === 'kitten') {
          const px = catX + (target.x - catX) * Math.min(1, impactAge / 0.18);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ff8fb0';
          ctx.beginPath();
          ctx.arc(px, catY - (1 - Math.min(1, impactAge / 0.18)) * 6, 4, 0, Math.PI * 2);
          ctx.fill();
          if (impactAge > 0.18) label(ctx, String(Math.round(st.damage)), target.x, target.y - 22, 12);
        } else if (type === 'tabby') {
          const gap = def.comboGap ?? 0.08;
          for (let h = 0; h < st.comboHits; h++) {
            const a = impactAge - h * gap;
            if (a < 0 || a > 0.22) continue;
            ctx.globalAlpha = 1 - a / 0.22;
            drawStar(ctx, target.x - 8 + h * 6, target.y - 6 + (h % 2) * 6, 7, '#fff1a0', 6, 0.5);
            label(ctx, String(st.damage % 1 ? st.damage.toFixed(1) : st.damage), target.x + h * 8, target.y - 22 - a * 30, 11);
          }
        } else if (type === 'white') {
          ctx.strokeStyle = '#ff8fc0';
          ctx.lineWidth = 4 * (1 - k) + 1;
          ctx.beginPath();
          ctx.arc(catX, catY, 10 + st.range * 0.9 * k, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // the cat
      ctx.save();
      ctx.translate(catX, catY);
      const s = def.scale * 1.15;
      ctx.scale(s, s);
      drawCat(ctx, {
        type,
        level,
        palette,
        hat: loadout.hat,
        t,
        attackAge: impactAge >= 0 ? impactAge : 9,
        aim: Math.atan2(target.y - catY, target.x - catX),
        seed: 3,
        windup: winding ? sinceStart / windup : undefined,
        comboIndex: Math.floor(Math.max(0, impactAge) / (def.comboGap ?? 0.08)),
      });
      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, level, key, theme]);

  return <canvas ref={ref} className="attack-demo" style={{ width: '100%', maxWidth: 300, aspectRatio: '300 / 120' }} />;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.font = `900 ${size}px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(50,30,20,0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}
