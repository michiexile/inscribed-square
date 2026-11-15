import { describe, expect, it } from 'vitest';
import { EditableCurve } from '../geometry/editable';
import type { InscribedSquare } from '../geometry/solver';
import { findSquares } from '../geometry/solver';
import { buildCount } from './build';

const square = (x: number, side = 0.5): InscribedSquare => ({
  corners: [
    { x, y: 0 },
    { x: x + side, y: 0 },
    { x: x + side, y: side },
    { x, y: side },
  ],
  params: [0, 0.25, 0.5, 0.75],
  centre: { x: x + side / 2, y: side / 2 },
  side,
});

describe('buildCount', () => {
  it('meets the target when the count matches and the squares are clearly apart', () => {
    const curve = EditableCurve.fromSeed(3).polygon();
    const squares = findSquares(curve);
    expect(buildCount(curve, squares, squares.length, 0.05)).toEqual({
      count: squares.length,
      settled: true,
      met: true,
    });
    expect(buildCount(curve, squares, squares.length + 2, 0.05).met).toBe(false);
  });

  it('does not count a target met while two squares sit almost on top of each other', () => {
    // Two squares that close are about to fold away or were just born: the count is about to change, and a finer
    // solve may disagree, so the build is not settled.
    const curve = EditableCurve.fromSeed(3).polygon();
    const squares = [square(0), square(0.01), square(2)];
    expect(buildCount(curve, squares, 3, 0.05)).toEqual({ count: 3, settled: false, met: false });
  });
});
