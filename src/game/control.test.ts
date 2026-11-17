import { describe, expect, it } from 'vitest';
import { radialFourier } from '../geometry/fourier';
import { DEFAULT_CONTROL, HeldSquare } from './control';

const curve = radialFourier(
  [
    { k: 2, amplitude: 0.1, phase: 0.3 },
    { k: 3, amplitude: 0.15, phase: 1 },
  ],
  360,
);
const centreOf = (h: { corners: readonly { x: number; y: number }[] } | null) => ({
  x: (h!.corners[0].x + h!.corners[2].x) / 2,
  y: (h!.corners[0].y + h!.corners[2].y) / 2,
});

describe('DEFAULT_CONTROL', () => {
  it('is drag the centre, which works with one finger', () => {
    expect(DEFAULT_CONTROL).toBe('centre');
  });
});

describe('HeldSquare with drag the centre', () => {
  it('moves the square by how far the finger moves, wherever the finger lands', () => {
    const held = new HeldSquare();
    // The first touch, far below the curve, leaves the square at the middle of the curve.
    const a = centreOf(held.update(curve, 'centre', [{ x: 0.2, y: -3 }, null]));
    expect(Math.hypot(a.x, a.y)).toBeLessThan(0.15);
    const b = centreOf(held.update(curve, 'centre', [{ x: 0.5, y: -2.8 }, null]));
    expect(b.x - a.x).toBeCloseTo(0.3, 1);
    expect(b.y - a.y).toBeCloseTo(0.2, 1);
  });

  it('picks up where the square was left when the finger lands again', () => {
    const held = new HeldSquare();
    held.update(curve, 'centre', [{ x: 0, y: -3 }, null]);
    const left = centreOf(held.update(curve, 'centre', [{ x: 0.4, y: -3 }, null]));
    expect(held.update(curve, 'centre', [null, null])).toBeNull();
    const back = centreOf(held.update(curve, 'centre', [{ x: -1, y: -2 }, null]));
    expect(back.x).toBeCloseTo(left.x, 1);
    expect(back.y).toBeCloseTo(left.y, 1);
  });

  it('keeps the square near the curve however far the finger goes', () => {
    const held = new HeldSquare();
    held.update(curve, 'centre', [{ x: 0, y: 0 }, null]);
    const c = centreOf(held.update(curve, 'centre', [{ x: 9, y: 9 }, null]));
    expect(Math.hypot(c.x, c.y)).toBeLessThan(2);
  });
});
