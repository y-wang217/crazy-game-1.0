import { useEffect, useRef } from 'react';
import { CATS } from '../../config/cats';
import { resolvePalette } from '../../render/renderer';
import { drawCat } from '../../render/sprites';
import type { CatId, CosmeticLoadout } from '../../game/types';

/** A small animated canvas showing one cat (used in menus and the shop). */
export function CatPreview({
  type,
  level = 1,
  loadout,
  size = 72,
  animate = true,
}: {
  type: CatId;
  level?: number;
  loadout: CosmeticLoadout;
  size?: number;
  animate?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(loadout);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const palette = resolvePalette(type, loadout);
    const start = performance.now();
    let raf = 0;
    const paint = (now: number) => {
      const t = (now - start) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const k = (size / 54) * dpr;
      ctx.setTransform(k, 0, 0, k, (size / 2) * dpr, (size / 2 + 2) * dpr);
      const scale = CATS[type].scale;
      ctx.scale(scale, scale);
      drawCat(ctx, { type, level, palette, hat: loadout.hat, t, attackAge: 9, aim: 0, seed: type.length });
      if (animate) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, level, key, size, animate]);

  return <canvas ref={ref} style={{ width: size, height: size }} className="cat-preview" />;
}
