import { type ClosedCurve, type Nearest, wrap } from './curve';
import { type Vec, add, dist, dot, scale, sub } from './vec';

/** A closed polygon, parameterised by arc length. */
export class Polygon implements ClosedCurve {
  readonly length: number;
  /** cumulative[i] = arc length from vertex 0 to vertex i; cumulative[n] = length. */
  private readonly cumulative: number[];

  constructor(readonly vertices: readonly Vec[]) {
    if (vertices.length < 3) throw new Error('A polygon needs at least 3 vertices');
    this.cumulative = [0];
    for (let i = 0; i < vertices.length; i++) {
      const next = vertices[(i + 1) % vertices.length];
      this.cumulative.push(this.cumulative[i] + dist(vertices[i], next));
    }
    this.length = this.cumulative[vertices.length];
    if (!(this.length > 0)) throw new Error('A polygon needs non-zero length');
  }

  point(s: number): Vec {
    const target = wrap(s) * this.length;
    // Binary search for the edge containing the target arc length.
    let lo = 0;
    let hi = this.vertices.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cumulative[mid] <= target) lo = mid;
      else hi = mid - 1;
    }
    const a = this.vertices[lo];
    const b = this.vertices[(lo + 1) % this.vertices.length];
    const edge = this.cumulative[lo + 1] - this.cumulative[lo];
    const t = edge > 0 ? (target - this.cumulative[lo]) / edge : 0;
    return add(a, scale(sub(b, a), t));
  }

  nearest(p: Vec): Nearest {
    let best: Nearest = { s: 0, point: this.vertices[0], distance: Infinity };
    const n = this.vertices.length;
    for (let i = 0; i < n; i++) {
      const a = this.vertices[i];
      const ab = sub(this.vertices[(i + 1) % n], a);
      const len2 = dot(ab, ab);
      const t = len2 > 0 ? Math.min(1, Math.max(0, dot(sub(p, a), ab) / len2)) : 0;
      const q = add(a, scale(ab, t));
      const d = dist(p, q);
      if (d < best.distance) {
        const arc = this.cumulative[i] + t * Math.sqrt(len2);
        best = { s: wrap(arc / this.length), point: q, distance: d };
      }
    }
    return best;
  }
}
