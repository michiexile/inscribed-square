import type { ClosedCurve } from './curve';
import type { Corners } from './square';
import { type Vec, dist } from './vec';

/** The best square around a given centre (control 2), and how far each corner is from the curve. */
export interface CentreFit {
  readonly centre: Vec;
  /** Distance from the centre to each corner. */
  readonly radius: number;
  /** Angle of corner 0 from the centre, in [0, π/2). */
  readonly angle: number;
  readonly corners: Corners;
  readonly side: number;
  /** Distance of each corner from the curve. */
  readonly distances: readonly [number, number, number, number];
  /** The largest corner distance: the square is inscribed exactly when this is 0. */
  readonly error: number;
}

export interface CentreFitOptions {
  /** Smallest square considered. Default length / 50, so a centre on the curve cannot fit a point-sized square. */
  readonly minSide?: number;
}

const QUARTER = Math.PI / 2;
/** The previous fit is kept unless a fresh search beats it by this factor, so the square doesn't flicker. */
const STICKINESS = 0.7;

/**
 * Fits the square centred at `centre` whose corners lie closest to the curve, minimising the sum of squared
 * corner distances over size and angle. A coarse search over (radius, angle) picks a start, and pattern search
 * refines it. Pass the previous frame's fit as `previous` to follow it smoothly while the centre moves.
 */
export function fitSquareAtCentre(
  curve: ClosedCurve,
  centre: Vec,
  previous?: CentreFit,
  options: CentreFitOptions = {},
): CentreFit {
  const rMin = (options.minSide ?? curve.length / 50) / Math.SQRT2;
  let rMax = rMin;
  for (let i = 0; i < 64; i++) rMax = Math.max(rMax, dist(centre, curve.point(i / 64)));

  const cost = (r: number, a: number): number => {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const th = a + k * QUARTER;
      const d = curve.nearest({ x: centre.x + r * Math.cos(th), y: centre.y + r * Math.sin(th) }).distance;
      sum += d * d;
    }
    return sum;
  };

  const RADII = 32;
  const ANGLES = 24;
  let best = { r: rMin, a: 0, c: Infinity };
  for (let i = 0; i < RADII; i++) {
    const r = rMin + ((rMax - rMin) * (i + 0.5)) / RADII;
    for (let j = 0; j < ANGLES; j++) {
      const a = (QUARTER * j) / ANGLES;
      const c = cost(r, a);
      if (c < best.c) best = { r, a, c };
    }
  }
  best = polish(cost, best, (rMax - rMin) / RADII, QUARTER / ANGLES, rMin, rMax);

  if (previous) {
    const warm = polish(
      cost,
      { r: clamp(previous.radius, rMin, rMax), a: previous.angle, c: cost(previous.radius, previous.angle) },
      (rMax - rMin) / RADII / 4,
      QUARTER / ANGLES / 4,
      rMin,
      rMax,
    );
    if (!(best.c < STICKINESS * warm.c)) best = warm;
  }
  return build(curve, centre, best.r, best.a);
}

/** Pattern search on (r, a): try a step each way along each axis, halve the steps when nothing improves. */
function polish(
  cost: (r: number, a: number) => number,
  start: { r: number; a: number; c: number },
  dr: number,
  da: number,
  rMin: number,
  rMax: number,
): { r: number; a: number; c: number } {
  let { r, a, c } = start;
  for (let it = 0; it < 60 && (dr > 1e-9 || da > 1e-9); it++) {
    let moved = false;
    for (const [nr, na] of [
      [r + dr, a],
      [r - dr, a],
      [r, a + da],
      [r, a - da],
    ]) {
      const rr = clamp(nr, rMin, rMax);
      const nc = cost(rr, na);
      if (nc < c) {
        r = rr;
        a = na;
        c = nc;
        moved = true;
      }
    }
    if (!moved) {
      dr /= 2;
      da /= 2;
    }
  }
  return { r, a: a - QUARTER * Math.floor(a / QUARTER), c };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function build(curve: ClosedCurve, centre: Vec, radius: number, angle: number): CentreFit {
  const corners = [0, 1, 2, 3].map((k) => ({
    x: centre.x + radius * Math.cos(angle + k * QUARTER),
    y: centre.y + radius * Math.sin(angle + k * QUARTER),
  })) as unknown as Corners;
  const distances = corners.map((p) => curve.nearest(p).distance) as unknown as [
    number,
    number,
    number,
    number,
  ];
  return {
    centre,
    radius,
    angle,
    corners,
    side: radius * Math.SQRT2,
    distances,
    error: Math.max(...distances),
  };
}
