import { describe, expect, it } from 'vitest';
import { radialFourier } from './fourier';
import { MorphingCurve } from './morph';
import { Polygon } from './polygon';
import { randomCurve, rng } from './random';
import { findSquares, isDegenerate } from './solver';
import { type Vec, dist } from './vec';

/**
 * A triangle inscribes exactly one square per side whose two adjacent base angles are both at most 90°,
 * with two corners on that side. A side of length a with height h carries a square of side a·h / (a + h).
 * No other squares exist: two of the four corners share a side, and diagonal corners cannot.
 */
function expectedSides(vertices: Vec[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % 3];
    const c = vertices[(i + 2) % 3];
    const base = dist(a, b);
    const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    const h = area2 / base;
    const angleOk = (p: Vec, q: Vec) => (q.x - p.x) * (c.x - p.x) + (q.y - p.y) * (c.y - p.y) > 0;
    if (angleOk(a, b) && angleOk(b, a)) out.push((base * h) / (base + h));
  }
  return out.sort((x, y) => x - y);
}

const rotate = (vs: Vec[], angle: number): Vec[] =>
  vs.map((v) => ({
    x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
    y: v.x * Math.sin(angle) + v.y * Math.cos(angle),
  }));

describe('findSquares', () => {
  it('finds exactly the three squares of an acute triangle, each once', () => {
    // A solver that keeps every grid hit reports each square four times (once per starting corner);
    // one that skips the minimum-size check reports collapsed squares along s = t.
    const tri = rotate(
      [
        { x: -1, y: -0.6 },
        { x: 1.1, y: -0.5 },
        { x: 0.2, y: 1 },
      ],
      0.3,
    );
    const squares = findSquares(new Polygon(tri));
    const sides = squares.map((q) => q.side).sort((x, y) => x - y);
    const expected = expectedSides(tri);
    expect(expected).toHaveLength(3);
    expect(sides).toHaveLength(3);
    sides.forEach((s, i) => expect(s).toBeCloseTo(expected[i], 6));
  });

  it('finds the single square of an obtuse triangle', () => {
    const tri = [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: -0.4, y: 0.5 },
    ];
    const expected = expectedSides(tri);
    expect(expected).toHaveLength(1);
    const squares = findSquares(new Polygon(tri));
    expect(squares).toHaveLength(1);
    expect(squares[0].side).toBeCloseTo(expected[0], 6);
  });

  it('returns squares whose four corners all lie on the curve', () => {
    const curve = radialFourier(
      [
        { k: 2, amplitude: 0.18, phase: 0.4 },
        { k: 3, amplitude: 0.12, phase: 1.9 },
        { k: 5, amplitude: 0.05, phase: 0.7 },
      ],
      240,
    );
    const squares = findSquares(curve);
    expect(squares.length).toBeGreaterThan(0);
    for (const q of squares) {
      for (const c of q.corners) expect(curve.nearest(c).distance).toBeLessThan(1e-7);
      expect(dist(q.corners[0], q.corners[1])).toBeCloseTo(q.side, 9);
      expect(dist(q.corners[0], q.corners[2])).toBeCloseTo(q.side * Math.SQRT2, 9);
    }
  });

  it('finds an odd number of squares on fine samples of generic smooth curves', () => {
    // A generic smooth curve inscribes an odd number of squares. A solver that misses one, or counts one twice,
    // gets an even number on some of these.
    for (let seed = 1; seed <= 8; seed++) expect(findSquares(randomCurve(seed)).length % 2).toBe(1);
    // Two of curve 131's three squares differ by about 0.001 in every parameter, an eighth of a grid cell.
    expect(findSquares(randomCurve(131))).toHaveLength(3);
  });

  it('finds both squares of a pair just born at a fold, closer together than the grid spacing', () => {
    // Seed 1 of the morph, just after two folds. Each time two of the squares differ by 0.003 to 0.007 in every
    // parameter, under one grid cell at the default grid. The grid local-minimum search saw one basin and
    // returned an even count (6 and 4); even grid 512 missed the first pair.
    const morph = new MorphingCurve(1);
    expect(findSquares(morph.at(24.75))).toHaveLength(7);
    expect(findSquares(morph.at(33.15))).toHaveLength(5);
  });
});

/** A regular polygon on the unit circle, turned by `rot`, with each vertex radius scaled by 1 + noise · U(−1, 1). */
function regular(n: number, noise = 0, seed = 7, rot = 0.1): Polygon {
  const next = rng(seed);
  return new Polygon(
    Array.from({ length: n }, (_, i) => {
      const r = 1 + noise * (2 * next() - 1);
      const a = (2 * Math.PI * i) / n + rot;
      return { x: r * Math.cos(a), y: r * Math.sin(a) };
    }),
  );
}

describe('isDegenerate', () => {
  it('flags curves with 4-fold symmetry, which inscribe a continuous family of squares', () => {
    // A circle inscribes a square at every rotation, all with the same centre and side, so a solver that only
    // dedupes and counts reports a small, even, meaningless number (2 for this 256-gon).
    for (const curve of [regular(256), regular(8), regular(4)])
      expect(isDegenerate(curve, findSquares(curve))).toBe(true);
  });

  it('passes the same shapes after a small random perturbation, which leaves an odd count', () => {
    // The circle gets a smooth perturbation, as level curves do. Jittering each of its 256 vertices instead breaks
    // the family into some 40 squares a grid step apart, whose count the solver cannot pin down.
    const bumpyCircle = radialFourier(
      [
        { k: 2, amplitude: 0.02, phase: 0.3 },
        { k: 3, amplitude: 0.015, phase: 2.1 },
        { k: 5, amplitude: 0.01, phase: 4 },
      ],
      256,
    );
    for (const curve of [bumpyCircle, regular(8, 0.02)]) {
      const squares = findSquares(curve);
      expect(isDegenerate(curve, squares)).toBe(false);
      expect(squares.length % 2).toBe(1);
    }
  });

  it('passes generic curves, including one with a pair of squares about to fold', () => {
    // At a fold the Jacobian is singular too, but the squares are isolated: no family runs through them.
    for (let seed = 1; seed <= 4; seed++)
      expect(isDegenerate(randomCurve(seed), findSquares(randomCurve(seed)))).toBe(false);
    const nearFold = new MorphingCurve(1).at(33.15);
    expect(isDegenerate(nearFold, findSquares(nearFold))).toBe(false);
  });

  it('passes a hexagon, which is symmetric but not 4-fold, and reports its three squares', () => {
    // The three are turns of one another by 60°, with the same centre and side: deduping by centre and side alone
    // merges them into one.
    const hex = regular(6);
    const squares = findSquares(hex);
    expect(squares).toHaveLength(3);
    expect(isDegenerate(hex, squares)).toBe(false);
  });
});
