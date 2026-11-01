import { type ClosedCurve, type Nearest, wrap } from './curve';
import { type Vec, add, dist, scale, sub } from './vec';

/** A closed polygon, parameterised by arc length. */
export class Polygon implements ClosedCurve {
  readonly length: number;
  /** cumulative[i] = arc length from vertex 0 to vertex i; cumulative[n] = length. */
  private readonly cumulative: number[];
  /** Edge i runs from (xs[i], ys[i]) by (dxs[i], dys[i]); inv2[i] is 1 / its squared length, or 0 if it has none. */
  private readonly edges: {
    xs: Float64Array;
    ys: Float64Array;
    dxs: Float64Array;
    dys: Float64Array;
    inv2: Float64Array;
  };

  constructor(readonly vertices: readonly Vec[]) {
    if (vertices.length < 3) throw new Error('A polygon needs at least 3 vertices');
    this.cumulative = [0];
    for (let i = 0; i < vertices.length; i++) {
      const next = vertices[(i + 1) % vertices.length];
      this.cumulative.push(this.cumulative[i] + dist(vertices[i], next));
    }
    this.length = this.cumulative[vertices.length];
    if (!(this.length > 0)) throw new Error('A polygon needs non-zero length');
    const n = vertices.length;
    this.edges = {
      xs: new Float64Array(n),
      ys: new Float64Array(n),
      dxs: new Float64Array(n),
      dys: new Float64Array(n),
      inv2: new Float64Array(n),
    };
    for (let i = 0; i < n; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      this.edges.xs[i] = a.x;
      this.edges.ys[i] = a.y;
      this.edges.dxs[i] = dx;
      this.edges.dys[i] = dy;
      this.edges.inv2[i] = len2 > 0 ? 1 / len2 : 0;
    }
  }

  point(s: number): Vec {
    const target = wrap(s) * this.length;
    const lo = this.edgeAt(target);
    const a = this.vertices[lo];
    const b = this.vertices[(lo + 1) % this.vertices.length];
    const edge = this.cumulative[lo + 1] - this.cumulative[lo];
    const t = edge > 0 ? (target - this.cumulative[lo]) / edge : 0;
    return add(a, scale(sub(b, a), t));
  }

  tangent(s: number): Vec {
    const i = this.edgeAt(wrap(s) * this.length);
    const d = sub(this.vertices[(i + 1) % this.vertices.length], this.vertices[i]);
    const len = Math.hypot(d.x, d.y);
    return len > 0 ? scale(d, 1 / len) : { x: 1, y: 0 };
  }

  /** Index of the edge holding the given arc length (binary search over cumulative lengths). */
  private edgeAt(target: number): number {
    let lo = 0;
    let hi = this.vertices.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cumulative[mid] <= target) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  nearest(p: Vec): Nearest {
    // Allocation-free inner loop over the precomputed edge arrays: this runs tens of thousands of times per
    // solver call (WORKLOG-solver.md).
    const { xs, ys, dxs, dys, inv2 } = this.edges;
    const n = xs.length;
    let bestD2 = Infinity;
    let bestI = 0;
    let bestT = 0;
    for (let i = 0; i < n; i++) {
      const ax = p.x - xs[i];
      const ay = p.y - ys[i];
      let t = (ax * dxs[i] + ay * dys[i]) * inv2[i];
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const ex = ax - t * dxs[i];
      const ey = ay - t * dys[i];
      const d2 = ex * ex + ey * ey;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestI = i;
        bestT = t;
      }
    }
    const point = { x: xs[bestI] + bestT * dxs[bestI], y: ys[bestI] + bestT * dys[bestI] };
    const arc = this.cumulative[bestI] + bestT * (this.cumulative[bestI + 1] - this.cumulative[bestI]);
    return { s: wrap(arc / this.length), point, distance: Math.sqrt(bestD2) };
  }
}
