import { useEffect, useRef } from "react";
import { drawHouse } from "../../render/renderer";
import { BOARD_PALETTES } from "../../theme/palettes";
import { useTheme } from "../../theme";

/**
 * The Fish-Dry Hut (魚乾小屋) — the very same house the cats defend at the end of every road,
 * drawn by the battle renderer's own drawHouse with the board palette of the current theme
 * (no new artwork). Used on Home as the cats' shared home base.
 */
export function HutArt({
  width = 132,
  className = "",
}: {
  width?: number;
  className?: string;
}) {
  const theme = useTheme();
  const ref = useRef<HTMLCanvasElement>(null);
  // The house spans about 50 × 42 board units (roof tip at −20, shadow at +22).
  const scale = width / 50;
  const height = Math.round(42 * scale);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, 50, 42);
    drawHouse(
      ctx,
      25,
      21,
      BOARD_PALETTES[theme === "moonlit" ? "moonlit" : "light"],
    );
  }, [theme, width, height, scale]);
  return (
    <canvas
      ref={ref}
      className={`hut-art ${className}`}
      style={{ width, height }}
      aria-hidden
    />
  );
}
