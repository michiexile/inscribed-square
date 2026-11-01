import { describe, expect, it } from 'vitest';
import { radialFourier } from './fourier';
import { Polygon } from './polygon';
import { randomCurve } from './random';
import { findSquares } from './solver';
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
  });
});
