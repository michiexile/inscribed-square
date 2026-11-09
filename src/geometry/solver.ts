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
 * Finds the inscribed squares of a curve. It samples the free-corner error of the square on every grid pair (s, t)
 * and refines each grid local minimum with Newton's method. Two squares within a grid cell of each other share one
 * local minimum, as happens just after a fold, so it then searches a finer grid around each square found, zooming
 * in further while the count is even (a generic curve has an odd number). Each square is reported once.
 *
 * Two squares closer together than the finest zoom (about 1/250 of a grid cell) can still be missed, and the parity
 * check cannot see two missed pairs at once. On curves with continuous families of inscribed squares (a circle, a
 * regular 4k-gon) it returns an arbitrary sample of the family; `isDegenerate` detects that.
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
  const tryFrom = (s: number, t: number) => {
    const sq = refine(curve, s, t);
    if (!sq || sq.side < minSide) return;
    if (found.some((f) => sameSquare(f, sq, tolerance * 100))) return;
    found.push(sq);
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (isFinite(err[i * n + j]) && isLocalMin(err, n, i, j)) tryFrom(i / n, j / n);
    }
  }

  // Newton from the shared local minimum finds one square of a close pair. The pair is born at a fold, so its other
  // square is next to one already found: search a finer grid around each square, with a test that separates zeros
  // the error's minima merge. A generic curve has an odd number of squares, so while the count is even, zoom in.
  let half = 2 / n;
  for (let depth = 0; depth < LOCAL_DEPTH; depth++, half /= LOCAL_GRID / 4) {
    // A curve with dozens of squares is a symmetric one carrying a family (`isDegenerate`): parity means nothing there.
    if (found.length > MAX_ZOOM_SQUARES || (depth > 0 && found.length % 2 === 1)) break;
    for (const sq of [...found]) searchAround(curve, sq.params[0], sq.params[1], half, tryFrom);
  }
  return found;
}

/** `findSquares` zooms in only while it has found at most this many squares. Game curves have about 3 to 11. */
const MAX_ZOOM_SQUARES = 31;
/** How many times `findSquares` zooms in around its squares while their count is even. */
const LOCAL_DEPTH = 4;

/** Fine sub-grid points per axis in `searchAround`. */
const LOCAL_GRID = 16;

/** Runs the triangle test on a fine grid over the window [s ± half] × [t ± half], calling `tryFrom` at each zero. */
function searchAround(
  curve: ClosedCurve,
  s: number,
  t: number,
  half: number,
  tryFrom: (s: number, t: number) => void,
): void {
  const m = LOCAL_GRID + 1;
  const h = (2 * half) / LOCAL_GRID;
  const fc = new Float64Array(m * m);
  const fd = new Float64Array(m * m);
  const ps = Array.from({ length: m }, (_, i) => curve.point(s - half + i * h));
  const pt = Array.from({ length: m }, (_, j) => curve.point(t - half + j * h));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      const sq = squareOnEdge(ps[i], pt[j]);
      fc[i * m + j] = curve.signedDistance(sq[2]);
      fd[i * m + j] = curve.signedDistance(sq[3]);
    }
  }
  for (let i = 0; i < LOCAL_GRID; i++) {
    for (let j = 0; j < LOCAL_GRID; j++) {
      const k00 = i * m + j;
      const z1 = triangleZero(fc, fd, k00, k00 + m, k00 + 1);
      if (z1) tryFrom(s - half + (i + z1[0]) * h, t - half + (j + z1[1]) * h);
      const z2 = triangleZero(fc, fd, k00 + m + 1, k00 + 1, k00 + m);
      if (z2) tryFrom(s - half + (i + 1 - z2[0]) * h, t - half + (j + 1 - z2[1]) * h);
    }
  }
}

/**
 * True when two squares are the same square, perhaps listed from different starting corners: some corner of `b` is
 * within `tolerance` of the first corner of `a`, and so is the centre. Centre and side alone are not enough: on a
 * symmetric curve, turned copies of a square share both.
 */
export function sameSquare(a: InscribedSquare, b: InscribedSquare, tolerance: number): boolean {
  return dist(a.centre, b.centre) < tolerance && b.corners.some((c) => dist(c, a.corners[0]) < tolerance);
}

/**
 * Where the linear interpolation of (fc, fd) over the triangle p0, p1, p2 vanishes, as barycentric weights (a, b)
 * of p1 and p2; null when it has no zero there.
 */
function triangleZero(
  fc: Float64Array,
  fd: Float64Array,
  p0: number,
  p1: number,
  p2: number,
): [number, number] | null {
  const ux = fc[p1] - fc[p0];
  const uy = fd[p1] - fd[p0];
  const vx = fc[p2] - fc[p0];
  const vy = fd[p2] - fd[p0];
  const det = ux * vy - uy * vx;
  if (det === 0) return null;
  const a = (-fc[p0] * vy + fd[p0] * vx) / det;
  const b = (-ux * fd[p0] + uy * fc[p0]) / det;
  return a >= 0 && b >= 0 && a + b <= 1 ? [a, b] : null;
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
    const J = jacobian(curve, x);
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

/**
 * True when some square in the list lies on a continuous family of inscribed squares, as on a curve with 4-fold
 * symmetry (a circle, a regular 4k-gon). There the count `findSquares` returns is meaningless, so levels must reject
 * such curves.
 *
 * A square is on a family when the Jacobian is singular there and Newton, started a small step along its null
 * direction, stays about that far away instead of returning to the square.
 */
export function isDegenerate(curve: ClosedCurve, squares: readonly InscribedSquare[]): boolean {
  return squares.some((q) => onFamily(curve, q));
}

/** How far `onFamily` steps along the null direction, in curve parameter. */
const FAMILY_STEP = 4e-3;

function onFamily(curve: ClosedCurve, square: InscribedSquare): boolean {
  const x = square.params;
  const J = jacobian(curve, x);
  const n = nullDirection(J);
  if (!n) return false;
  // Fast exit: an isolated square has a non-singular Jacobian (or, at a fold, Newton walks back to it anyway).
  const jn = J.map((row) => row.reduce((acc, v, k) => acc + v * n[k], 0));
  if (Math.hypot(...jn) > 1e-4 * Math.hypot(...J.flat())) return false;
  const r = refineFrom(curve, x.map((v, k) => v + FAMILY_STEP * n[k]) as [number, number, number, number]);
  if (!r) return false;
  const moved = Math.hypot(...r.params.map((p, k) => p - x[k] - Math.round(p - x[k])));
  return moved > FAMILY_STEP / 3;
}

/** The unit vector y minimising |J y| (inverse iteration on JᵀJ), or null if it cannot be found. */
function nullDirection(J: number[][]): number[] | null {
  const M = [0, 1, 2, 3].map((i) =>
    [0, 1, 2, 3].map((j) => J.reduce((acc, row) => acc + row[i] * row[j], 0)),
  );
  const mu = 1e-12 * (M[0][0] + M[1][1] + M[2][2] + M[3][3]);
  const shifted = M.map((row, i) => row.map((v, j) => (i === j ? v + mu : v)));
  let y = [0.5, 0.5, 0.5, 0.5];
  for (let it = 0; it < 8; it++) {
    const z = solveLinear(shifted, y);
    if (!z) return null;
    const len = Math.hypot(...z);
    if (!(len > 0) || !isFinite(len)) return null;
    y = z.map((v) => v / len);
  }
  return y;
}

/** The Jacobian of the residual (C − point(u), D − point(v)) with respect to (s, t, u, v). */
function jacobian(curve: ClosedCurve, x: readonly number[]): number[][] {
  const L = curve.length;
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
  return [
    [dCds.x, dCdt.x, -tu.x, 0],
    [dCds.y, dCdt.y, -tu.y, 0],
    [dDds.x, dDdt.x, 0, -tv.x],
    [dDds.y, dDdt.y, 0, -tv.y],
  ];
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
