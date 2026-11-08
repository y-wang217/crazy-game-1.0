import type { MapDef } from './types';

export interface Point {
  x: number;
  y: number;
}

/** Polyline path with distance-based lookup. */
export class PathGeom {
  readonly points: Point[];
  readonly cumulative: number[];
  readonly length: number;

  constructor(points: Point[]) {
    this.points = points;
    this.cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  static fromMap(map: MapDef): PathGeom {
    return new PathGeom(map.path.map(([c, r]) => cellCenter(map, c, r)));
  }

  /** Position and heading at distance d along the path (clamped). */
  pointAt(d: number): { x: number; y: number; dx: number; dy: number } {
    const dist = Math.max(0, Math.min(this.length, d));
    let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i] < dist) i++;
    const a = this.points[i - 1];
    const b = this.points[i];
    const segLen = this.cumulative[i] - this.cumulative[i - 1] || 1;
    const t = (dist - this.cumulative[i - 1]) / segLen;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      dx: (b.x - a.x) / segLen,
      dy: (b.y - a.y) / segLen,
    };
  }

  /** Shortest distance from a point to the road polyline. */
  distanceTo(x: number, y: number): number {
    let best = Infinity;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / len2));
      best = Math.min(best, Math.hypot(x - (a.x + vx * t), y - (a.y + vy * t)));
    }
    return best;
  }
}

export function cellCenter(map: MapDef, c: number, r: number): Point {
  return { x: (c + 0.5) * map.cell, y: (r + 0.5) * map.cell };
}

export function worldSize(map: MapDef): { w: number; h: number } {
  return { w: map.cols * map.cell, h: map.rows * map.cell };
}
