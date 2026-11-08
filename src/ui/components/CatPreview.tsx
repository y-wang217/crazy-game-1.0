import { useEffect, useRef } from 'react';
import { CATS } from '../../config/cats';
import { ENEMIES } from '../../config/enemies';
import { resolvePalette } from '../../render/renderer';
import { drawCat, drawChest, drawMouse } from '../../render/sprites';
import type { CatId, ChestTier, CosmeticLoadout, EnemyId } from '../../game/types';

/** Small animated canvas driven by a paint callback (shared by the preview components). */
function useAnimatedCanvas(size: number, paint: (ctx: CanvasRenderingContext2D, t: number) => void, deps: unknown[], animate = true) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const k = (size / 54) * dpr;
      ctx.setTransform(k, 0, 0, k, (size / 2) * dpr, (size / 2 + 2) * dpr);
      paint(ctx, t);
      if (animate) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, animate, ...deps]);
  return ref;
}

/** A small animated canvas showing one cat (menus, shop, introductions). */
export function CatPreview({
  type,
  level = 1,
  loadout,
  size = 72,
  animate = true,
  attackLoop = false,
}: {
  type: CatId;
  level?: number;
  loadout: CosmeticLoadout;
  size?: number;
  animate?: boolean;
  /** Replay the attack animation every couple of seconds (introductions). */
  attackLoop?: boolean;
}) {
  const key = JSON.stringify(loadout);
  const ref = useAnimatedCanvas(
    size,
    (ctx, t) => {
      const palette = resolvePalette(type, loadout);
      const scale = CATS[type].scale;
      ctx.scale(scale, scale);
      const attackAge = attackLoop ? (t % 1.6) : 9;
      drawCat(ctx, { type, level, palette, hat: loadout.hat, t, attackAge, aim: 0, seed: type.length });
    },
    [type, level, key, attackLoop],
    animate,
  );
  return <canvas ref={ref} style={{ width: size, height: size }} className="cat-preview" />;
}

/** Animated enemy or chest illustration. */
export function FoePreview({ enemy, chest, size = 96 }: { enemy?: EnemyId; chest?: ChestTier; size?: number }) {
  const ref = useAnimatedCanvas(
    size,
    (ctx, t) => {
      if (chest) {
        ctx.scale(1.3, 1.3);
        drawChest(ctx, chest, t, false);
      } else if (enemy) {
        const s = ENEMIES[enemy].isBoss ? 0.75 : 1.4;
        ctx.scale(s, s);
        drawMouse(ctx, { id: enemy, dirX: 1, t, hasShield: true, hit: false });
      }
    },
    [enemy, chest],
  );
  return <canvas ref={ref} style={{ width: size, height: size }} className="cat-preview" />;
}

/**
 * Round head portrait cropped from the real in-game cat art (skill cards, chips, pops).
 * Shows the cat's current cosmetic skin; hats are left off so the face stays readable.
 */
export function CatHead({ type, loadout, size = 28 }: { type: CatId; loadout: CosmeticLoadout; size?: number }) {
  const key = JSON.stringify(loadout.skins[type] ?? '');
  const ref = useAnimatedCanvas(
    size,
    (ctx) => {
      const palette = resolvePalette(type, loadout);
      // undo the generic preview transform: zoom on the head and clip to a circle
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = ctx.canvas.width / size;
      ctx.beginPath();
      ctx.arc((size / 2) * dpr, (size / 2) * dpr, (size / 2) * dpr, 0, Math.PI * 2);
      ctx.clip();
      const k = (size / 30) * dpr;
      ctx.setTransform(k, 0, 0, k, (size / 2) * dpr, (size / 2) * dpr + 9 * k);
      drawCat(ctx, { type, level: 1, palette, hat: null, t: 0, attackAge: 9, aim: 0, seed: 0 });
    },
    [type, key],
    false,
  );
  return <canvas ref={ref} style={{ width: size, height: size }} className="cat-head" />;
}
