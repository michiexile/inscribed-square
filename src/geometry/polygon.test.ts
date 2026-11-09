import { describe, expect, it } from 'vitest';
import { Polygon } from './polygon';

const unitSquare = new Polygon([
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]);

describe('Polygon', () => {
  it('parameterises by arc length over [0, 1)', () => {
    expect(unitSquare.length).toBeCloseTo(4);
    expect(unitSquare.point(0)).toEqual({ x: 0, y: 0 });
    const p = unitSquare.point(0.375); // 1.5 units along: middle of the second edge
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(0.5);
  });

  it('wraps parameters outside [0, 1)', () => {
    const a = unitSquare.point(1.125);
    const b = unitSquare.point(-0.875);
    expect(a.x).toBeCloseTo(0.5);
    expect(a.y).toBeCloseTo(0);
    expect(b.x).toBeCloseTo(0.5);
    expect(b.y).toBeCloseTo(0);
  });

  it('finds the nearest point inside an edge, not just the nearest vertex', () => {
    // Nearest vertex to (0.5, -0.3) is at distance ~0.58; the true nearest point (0.5, 0) is 0.3 away.
    const n = unitSquare.nearest({ x: 0.5, y: -0.3 });
    expect(n.distance).toBeCloseTo(0.3);
    expect(n.point.x).toBeCloseTo(0.5);
    expect(n.point.y).toBeCloseTo(0);
    expect(n.s).toBeCloseTo(0.125);
  });

  it('measures distance from inside the curve too', () => {
    const n = unitSquare.nearest({ x: 0.5, y: 0.9 });
    expect(n.distance).toBeCloseTo(0.1);
    expect(n.s).toBeCloseTo(0.625);
  });

  it('rejects degenerate input', () => {
    expect(
      () =>
        new Polygon([
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]),
    ).toThrow();
  });
});

describe('Polygon.tangent', () => {
  it('is the unit direction of travel along the edge holding the parameter', () => {
    // The unit square runs (0,0) → (1,0) → (1,1) → (0,1): counter-clockwise.
    expect(unitSquare.tangent(0.1)).toEqual({ x: 1, y: 0 });
    expect(unitSquare.tangent(0.3)).toEqual({ x: 0, y: 1 });
    expect(unitSquare.tangent(0.6)).toEqual({ x: -1, y: 0 });
    expect(unitSquare.tangent(-0.1)).toEqual({ x: 0, y: -1 });
  });
});

describe('Polygon.signedDistance', () => {
  it('is positive inside and negative outside, whichever way the vertices run', () => {
    const clockwise = new Polygon([...unitSquare.vertices].reverse());
    for (const poly of [unitSquare, clockwise]) {
      expect(poly.signedDistance({ x: 0.5, y: 0.9 })).toBeCloseTo(0.1);
      expect(poly.signedDistance({ x: 0.5, y: -0.3 })).toBeCloseTo(-0.3);
    }
  });

  it('gets the sign right where the nearest point is a corner', () => {
    // Outside a convex corner the nearest point is the corner itself, and the vector to it is not normal to
    // either edge, so a sign taken from one edge alone can come out wrong here.
    expect(unitSquare.signedDistance({ x: 1.2, y: 1.05 })).toBeCloseTo(-Math.hypot(0.2, 0.05));
    expect(unitSquare.signedDistance({ x: 1.05, y: 1.2 })).toBeCloseTo(-Math.hypot(0.2, 0.05));
    // Inside a reflex corner: an L shape, notch at (1, 1).
    const ell = new Polygon([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(ell.signedDistance({ x: 1.2, y: 1.1 })).toBeCloseTo(-0.1);
    expect(ell.signedDistance({ x: 0.9, y: 0.95 })).toBeCloseTo(Math.hypot(0.1, 0.05));
    expect(ell.signedDistance({ x: 1.1, y: 1.2 })).toBeCloseTo(-0.1);
  });
});
