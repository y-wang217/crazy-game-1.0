import { useEffect, useRef, useState } from 'react';
import { sceneCanvas } from '../../render/catScenes';
import { useTheme } from '../../theme';

/**
 * A cat's evolving encyclopedia background (see render/catScenes.ts). Driven only by the
 * cat id, its PERMANENT star rank and the visual theme, so a star upgrade or theme switch
 * redraws it at once. It fills its positioned parent; the drawing is static and cached per
 * size, so it is cheap on phones. The same scene serves the collection card (a crop) and the
 * profile page (the full view).
 */
export function CatScene({ cat, star, className = '' }: { cat: string; star: number; className?: string }) {
  const theme = useTheme();
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const measure = () => {
      const w = Math.round(cv.clientWidth);
      const h = Math.round(cv.clientHeight);
      if (w > 0 && h > 0) setSize((cur) => (cur && cur.w === w && cur.h === h ? cur : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !size) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(sceneCanvas(cat, star, theme, size.w, size.h, dpr), 0, 0);
  }, [cat, star, theme, size]);
  return <canvas ref={ref} className={`cat-scene ${className}`} data-cat={cat} data-star={star} data-theme={theme} aria-hidden="true" />;
}
