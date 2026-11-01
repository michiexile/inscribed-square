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
