import type { Vec } from './vec';

/** The point on a curve closest to a query point. */
export interface Nearest {
  /** Curve parameter of the nearest point, in [0, 1). */
  readonly s: number;
  readonly point: Vec;
  readonly distance: number;
}

/**
 * A closed curve parameterised over [0, 1), with parameters outside that range wrapping around.
 * Polygons and splines both implement this, so the solver never depends on the curve type.
 */
export interface ClosedCurve {
  /** Total length. */
  readonly length: number;
  point(s: number): Vec;
  nearest(p: Vec): Nearest;
}

/** Wraps a parameter into [0, 1). */
export const wrap = (s: number): number => s - Math.floor(s);
