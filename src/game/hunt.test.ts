import { describe, expect, it } from 'vitest';
import { fitSquareAtCentre } from '../geometry/centre';
import { Polygon } from '../geometry/polygon';
import { radialFourier } from '../geometry/fourier';
import { findSquares } from '../geometry/solver';
import { type Corners, edgeSquare } from '../geometry/square';
import { dist } from '../geometry/vec';
import { Hunt } from './hunt';

const tri = new Polygon([
  { x: -1, y: -0.6 },
  { x: 1.1, y: -0.5 },
  { x: 0.2, y: 1 },
]);
const squares = findSquares(tri);
const TOL = 0.05;
const rotated = (c: Corners, k: number): Corners => [
  c[k % 4],
  c[(k + 1) % 4],
  c[(k + 2) % 4],
  c[(k + 3) % 4],
];

/** A held square near `target`: its first two corners nudged along the curve, so the free corners miss slightly. */
function nearlyHeld(target: (typeof squares)[number], nudge: number) {
  return edgeSquare(tri, target.params[0] + nudge, target.params[1] - nudge);
}

describe('Hunt', () => {
  it('counts a held square within tolerance as the exact solver square it refines to', () => {
    const hunt = new Hunt(tri, squares, TOL);
    const held = nearlyHeld(squares[1], 0.002);
    expect(held.error).toBeGreaterThan(1e-4);
    expect(held.error).toBeLessThan(TOL);
    expect(hunt.check(held.corners, held.error)).toBe(squares[1]);
    expect(hunt.found).toEqual([squares[1]]);
  });

  it('matches whichever corner the held square starts from', () => {
    const hunt = new Hunt(tri, squares, TOL);
    expect(hunt.check(rotated(squares[2].corners, 3), 0)).toBe(squares[2]);
  });

  it('ignores a square whose error is above the tolerance', () => {
    const hunt = new Hunt(tri, squares, TOL);
    const held = nearlyHeld(squares[0], 0.05);
    expect(held.error).toBeGreaterThan(TOL);
    expect(hunt.check(held.corners, held.error)).toBeNull();
    expect(hunt.found).toEqual([]);
  });

  it('counts each square once however often it is held', () => {
    const hunt = new Hunt(tri, squares, TOL);
    hunt.check(squares[0].corners, 0);
    hunt.check(rotated(squares[0].corners, 1), 0);
    expect(hunt.found).toHaveLength(1);
  });

  it('rejects a near-miss that is within tolerance but has no inscribed square nearby', () => {
    // This curve (seed 992259 of the first random generator) has one inscribed square. Around (0.059, -0.145) the drag-centre fit spreads its error over four
    // corners to a maximum of about 0.023, but no square is inscribed there: counting it was a playtest bug.
    const curve = radialFourier(
      [
        { k: 2, amplitude: 0.11363838403485715, phase: 1.5288262940488546 },
        { k: 3, amplitude: 0.05302935956045986, phase: 3.822683011211306 },
        { k: 4, amplitude: 0.08204038238152861, phase: 3.7789530572946264 },
        { k: 5, amplitude: 0.13117450620047746, phase: 6.17963426600022 },
      ],
      240,
    );
    const hunt = new Hunt(curve, findSquares(curve), TOL);
    const fit = fitSquareAtCentre(curve, { x: 0.059, y: -0.1448 });
    expect(fit.error).toBeLessThan(TOL);
    expect(hunt.check(fit.corners, fit.error)).toBeNull();
    expect(hunt.found).toEqual([]);
  });

  it('still counts a real square the solver missed, and says so', () => {
    const hunt = new Hunt(tri, [], TOL);
    const counted = hunt.check(squares[0].corners, 0);
    expect(counted).not.toBeNull();
    expect(dist(counted!.centre, squares[0].centre)).toBeLessThan(1e-6);
    expect(hunt.extra).toBe(1);
  });
});
