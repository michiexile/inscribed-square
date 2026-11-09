import { type ClosedCurve, wrap } from './curve';
import { type Corners, perp, squareOnEdge } from './square';
import { type Vec, add, dist, scale, sub } from './vec';

/** An inscribed square found by the solver. */
export interface InscribedSquare {
  /** Corners in counter-clockwise order, all on the curve. */
  readonly corners: Corners;
  /** Curve parameter of each corner. */
  readonly params: readonly [number, number, number, number];
  readonly centre: Vec;
  readonly side: number;
}

export interface SolveOptions {
  /** Grid resolution per axis on the (s, t) torus. Default 128. */
  readonly grid?: number;
  /** Squares smaller than this are ignored, which excludes the collapsed squares along s = t. Default length / 50. */
  readonly minSide?: number;
}

/**
 * Finds the inscribed squares of a curve: samples the free-corner error of the square on every grid pair (s, t),
 * then refines each local minimum with Newton's method. Each square is reported once.
 *
 * This is the crude solver. It can miss squares closer together than the grid spacing, and on curves with
 * continuous families of inscribed squares (a circle, a regular 4k-gon) it returns an arbitrary sample of the family.
 */
export function findSquares(curve: ClosedCurve, options: SolveOptions = {}): InscribedSquare[] {
  const n = options.grid ?? 128;
  const minSide = options.minSide ?? curve.length / 50;
  const pts = Array.from({ length: n }, (_, i) => curve.point(i / n));

  // err[i * n + j]: squared free-corner error of the square left of pts[i] → pts[j]; Infinity when it is too small.
  const err = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (dist(pts[i], pts[j]) < minSide / 2) {
        err[i * n + j] = Infinity;
        continue;
      }
      const sq = squareOnEdge(pts[i], pts[j]);
      const dc = curve.nearest(sq[2]).distance;
      const dd = curve.nearest(sq[3]).distance;
      err[i * n + j] = dc * dc + dd * dd;
    }
  }

  const found: InscribedSquare[] = [];
  const tolerance = curve.length * 1e-7;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const e = err[i * n + j];
      if (!isFinite(e) || !isLocalMin(err, n, i, j)) continue;
      const sq = refine(curve, i / n, j / n);
      if (!sq || sq.side < minSide) continue;
      if (
        found.some(
          (f) => dist(f.centre, sq.centre) < tolerance * 100 && Math.abs(f.side - sq.side) < tolerance * 100,
        )
      )
        continue;
      found.push(sq);
    }
  }
  return found;
}

/** True when cell (i, j) is no larger than its eight torus neighbours, all of which must be finite. */
function isLocalMin(err: Float64Array, n: number, i: number, j: number): boolean {
  const e = err[i * n + j];
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (di === 0 && dj === 0) continue;
      const v = err[((i + di + n) % n) * n + ((j + dj + n) % n)];
      if (!isFinite(v) || v < e) return false;
    }
  }
  return true;
}

/**
 * Newton's method on the four unknowns (s, t, u, v): the square left of point(s) → point(t) must have its free
 * corners at point(u) and point(v). Returns null if it does not converge.
 */
export function refine(
  curve: ClosedCurve,
  s0: number,
  t0: number,
  maxIterations = 40,
): InscribedSquare | null {
  const start = squareOnEdge(curve.point(s0), curve.point(t0));
  return refineFrom(curve, [s0, t0, curve.nearest(start[2]).s, curve.nearest(start[3]).s], maxIterations);
}

/**
 * Newton's method from a full starting guess (s, t, u, v), such as an inscribed square's parameters on a slightly
 * different curve. Starting from all four parameters keeps it on the same square where `refine`, which picks u and v
 * by nearest point, could switch to another. Returns null if it does not converge.
 */
export function refineFrom(
  curve: ClosedCurve,
  start: readonly [number, number, number, number],
  maxIterations = 40,
): InscribedSquare | null {
  const L = curve.length;
  // Parameters are not wrapped during the iteration: point and tangent wrap them, so crossing 0 costs nothing.
  let x = [...start];

  const residual = (y: number[]): number[] => {
    const sq = squareOnEdge(curve.point(y[0]), curve.point(y[1]));
    const pu = curve.point(y[2]);
    const pv = curve.point(y[3]);
    return [sq[2].x - pu.x, sq[2].y - pu.y, sq[3].x - pv.x, sq[3].y - pv.y];
  };
  const norm = (r: number[]) => Math.hypot(r[0], r[1], r[2], r[3]);

  let r = residual(x);
  let rn = norm(r);
  const tolerance = L * 1e-12;
  for (let it = 0; it < maxIterations && rn > tolerance; it++) {
    // d(point)/ds = L · tangent. With A = point(s), B = point(t), R = perp:
    // C = B + R(B − A), D = A + R(B − A).
    const ta = scale(curve.tangent(x[0]), L);
    const tb = scale(curve.tangent(x[1]), L);
    const tu = scale(curve.tangent(x[2]), L);
    const tv = scale(curve.tangent(x[3]), L);
    const dCds = scale(perp(ta), -1);
    const dCdt = add(tb, perp(tb));
    const dDds = sub(ta, perp(ta));
    const dDdt = perp(tb);
    const J = [
      [dCds.x, dCdt.x, -tu.x, 0],
      [dCds.y, dCdt.y, -tu.y, 0],
      [dDds.x, dDdt.x, 0, -tv.x],
      [dDds.y, dDdt.y, 0, -tv.y],
    ];
    const step = solveLinear(
      J,
      r.map((v) => -v),
    );
    if (!step) return null;
    // Backtracking: halve the step until the residual shrinks.
    let k = 1;
    let next = x;
    let nextR = r;
    let nextN = rn;
    for (let h = 0; h < 30; h++, k /= 2) {
      next = x.map((v, i) => v + k * step[i]);
      nextR = residual(next);
      nextN = norm(nextR);
      if (nextN < rn) break;
    }
    if (!(nextN < rn)) return null;
    x = next;
    r = nextR;
    rn = nextN;
  }
  if (rn > L * 1e-9) return null;

  const params = x.map(wrap) as [number, number, number, number];
  const a = curve.point(params[0]);
  const b = curve.point(params[1]);
  const corners = squareOnEdge(a, b);
  return {
    corners,
    params,
    centre: scale(add(corners[0], corners[2]), 0.5),
    side: dist(a, b),
  };
}

/** Solves the square system A x = b by Gaussian elimination with partial pivoting; null if A is singular. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    if (Math.abs(m[pivot][col]) < 1e-14) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = col + 1; row < n; row++) {
      const f = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) m[row][k] -= f * m[col][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let acc = m[row][n];
    for (let k = row + 1; k < n; k++) acc -= m[row][k] * x[k];
    x[row] = acc / m[row][row];
  }
  return x;
}
