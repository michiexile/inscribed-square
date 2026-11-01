import { describe, expect, it } from 'vitest';
import { fitSquareAtCentre } from './centre';
import { Polygon } from './polygon';
import { findSquares } from './solver';
import { dist } from './vec';

// An acute triangle turned so that none of its squares is axis-aligned: a fitter that only searches the size,
// or only a few fixed angles, cannot hit them.
const tri = new Polygon(
  [
    { x: -1, y: -0.6 },
    { x: 1.1, y: -0.5 },
    { x: 0.2, y: 1 },
  ].map((v) => ({
    x: v.x * Math.cos(0.3) - v.y * Math.sin(0.3),
    y: v.x * Math.sin(0.3) + v.y * Math.cos(0.3),
  })),
);

describe('fitSquareAtCentre', () => {
  it('recovers an inscribed square, size and angle, from its centre alone', () => {
    for (const target of findSquares(tri)) {
      const fit = fitSquareAtCentre(tri, target.centre);
      expect(fit.error).toBeLessThan(1e-4);
      expect(fit.side).toBeCloseTo(target.side, 3);
      // Same corner set, whatever corner the fit starts from.
      for (const c of target.corners)
        expect(Math.min(...fit.corners.map((f) => dist(f, c)))).toBeLessThan(1e-3);
    }
  });

  it('reports a clearly non-zero error away from every square centre', () => {
    const fit = fitSquareAtCentre(tri, { x: 0.05, y: 0.35 });
    expect(fit.error).toBeGreaterThan(0.02);
  });

  it('never shrinks the square to a point on the curve', () => {
    // A centre on the curve would have zero error with a zero-size square.
    const onCurve = tri.point(0.1);
    const fit = fitSquareAtCentre(tri, onCurve);
    expect(fit.side).toBeGreaterThanOrEqual(tri.length / 50 - 1e-12);
    expect(fit.error).toBeGreaterThan(0.01);
  });
});
