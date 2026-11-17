import { describe, expect, it } from 'vitest';
import { radialFourier } from '../geometry/fourier';
import { DEFAULT_CONTROL, HeldSquare } from './control';
import { torusLayout } from './torus';

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

describe('HeldSquare with the torus controls', () => {
  it('stands the square on the two nodes the pad moves, and reports where it is on the torus', () => {
    const held = new HeldSquare();
    const layout = torusLayout('pad', { x: 0, y: 520, width: 412, height: 380 });
    held.updateTorus(curve, 'pad', [{ x: 100, y: 800 }, null], layout);
    const h = held.updateTorus(curve, 'pad', [{ x: 100 + layout.map.size / 10, y: 800 }, null], layout)!;
    expect(h.point).toEqual({ s: expect.closeTo(0.1, 5), t: expect.closeTo(0.5, 5) });
    const nodes = [curve.point(0.1), curve.point(0.5)];
    for (const n of nodes) expect(h.corners.some((c) => Math.hypot(c.x - n.x, c.y - n.y) < 1e-9)).toBe(true);
    expect(h.free).toEqual([2, 3]);
  });

  it('reports a torus point for the drag controls too, from the nodes of the square held', () => {
    const held = new HeldSquare();
    const h = held.update(curve, 'corners', [curve.point(0.2), curve.point(0.45)])!;
    expect(h.point!.s).toBeCloseTo(0.2, 3);
    expect(h.point!.t).toBeCloseTo(0.45, 3);
  });
});
