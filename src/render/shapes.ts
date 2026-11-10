// Small canvas drawing helpers shared by the sprite and costume art.

export type Ctx = CanvasRenderingContext2D;

export const TAU = Math.PI * 2;

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, lw = 1.5) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke?: string, lw = 1.5) {
  ellipse(ctx, x, y, r, r, fill, stroke, lw);
}

export function poly(ctx: Ctx, pts: number[], fill: string, stroke?: string, lw = 1.5) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 1.5) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function drawHeart(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.35);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawStar(ctx: Ctx, x: number, y: number, r: number, color: string, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
