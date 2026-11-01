import type { ClosedCurve, Nearest } from './curve';
import { type Vec, add, dist, sub } from './vec';

/** Four corners of a square, in counter-clockwise order. */
export type Corners = readonly [Vec, Vec, Vec, Vec];

/** Rotation by +90°. */
export const perp = (v: Vec): Vec => ({ x: -v.y, y: v.x });

/** The square with edge a → b that lies to the left of the edge, so its corners run counter-clockwise from a. */
export function squareOnEdge(a: Vec, b: Vec): Corners {
  const n = perp(sub(b, a));
  return [a, b, add(b, n), add(a, n)];
}

/** A square built on two corners picked from the curve, and how far its other two corners are from the curve. */
export interface EdgeSquare {
  /** Curve parameters of the first two corners. */
  readonly s: number;
  readonly t: number;
  readonly corners: Corners;
  readonly side: number;
  /** Nearest curve points to the two free corners (corners 2 and 3). */
  readonly nearest: readonly [Nearest, Nearest];
  /** Distances of the two free corners from the curve. */
  readonly distances: readonly [number, number];
  /** The larger free-corner distance: the square is inscribed exactly when this is 0. */
  readonly error: number;
}

/** The square to the left of the edge from curve point s to curve point t (control 1, one orientation). */
export function edgeSquare(curve: ClosedCurve, s: number, t: number): EdgeSquare {
  const corners = squareOnEdge(curve.point(s), curve.point(t));
  const nc = curve.nearest(corners[2]);
  const nd = curve.nearest(corners[3]);
  return {
    s,
    t,
    corners,
    side: dist(corners[0], corners[1]),
    nearest: [nc, nd],
    distances: [nc.distance, nd.distance],
    error: Math.max(nc.distance, nd.distance),
  };
}

/**
 * Two corners on the curve fix two squares, one on each side of the edge between them. Returns the one with the
 * smaller error. The square on the right of s → t is the square on the left of t → s, so its parameters come
 * back swapped.
 */
export function bestEdgeSquare(curve: ClosedCurve, s: number, t: number): EdgeSquare {
  const left = edgeSquare(curve, s, t);
  const right = edgeSquare(curve, t, s);
  return right.error < left.error ? right : left;
}
