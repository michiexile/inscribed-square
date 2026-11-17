import { describe, expect, it } from 'vitest';
import { radialFourier } from '../geometry/fourier';
import { findSquares } from '../geometry/solver';
import { bestEdgeSquare } from '../geometry/square';
import { DialControl, PadControl, torusLayout, torusPoints } from './torus';

const curve = radialFourier(
  [
    { k: 2, amplitude: 0.12, phase: 0.3 },
    { k: 3, amplitude: 0.15, phase: 1 },
  ],
  360,
);

describe('torusPoints', () => {
  it('gives the eight (s, t) points where the square appears, each of which holds that square', () => {
    const square = findSquares(curve)[0];
    const points = torusPoints(square);
    expect(points).toHaveLength(8);
    for (const p of points) {
      const held = bestEdgeSquare(curve, p.s, p.t);
      expect(held.error).toBeLessThan(1e-3);
      const centre = {
        x: (held.corners[0].x + held.corners[2].x) / 2,
        y: (held.corners[0].y + held.corners[2].y) / 2,
      };
      expect(Math.hypot(centre.x - square.centre.x, centre.y - square.centre.y)).toBeLessThan(1e-3);
    }
    // The map is symmetric: swapping the two nodes gives the same square.
    for (const p of points)
      expect(points.some((q) => Math.abs(q.s - p.t) < 1e-9 && Math.abs(q.t - p.s) < 1e-9)).toBe(true);
  });
});

const area = { x: 0, y: 520, width: 412, height: 380 };

describe('torusLayout', () => {
  it('fills the space under the curve with a big pad for the pad control', () => {
    const l = torusLayout('pad', area);
    expect(l.map.size).toBeGreaterThanOrEqual(300);
    expect(l.map.y).toBeGreaterThanOrEqual(area.y);
    expect(l.map.y + l.map.size).toBeLessThanOrEqual(area.y + area.height);
    expect(l.dials).toEqual([]);
  });

  it('puts two dials at the bottom corners for the dial control, with a map above them', () => {
    const l = torusLayout('dials', area);
    expect(l.dials).toHaveLength(2);
    expect(l.map.size).toBeGreaterThanOrEqual(150);
    expect(l.map.y).toBeGreaterThanOrEqual(area.y);
    for (const d of l.dials) expect(l.map.y + l.map.size).toBeLessThanOrEqual(d.y - d.radius);
    for (const d of l.dials) {
      expect(d.x - d.radius).toBeGreaterThanOrEqual(0);
      expect(d.x + d.radius).toBeLessThanOrEqual(412);
      expect(d.y + d.radius).toBeLessThanOrEqual(area.y + area.height);
      expect(d.radius).toBeGreaterThanOrEqual(50);
    }
  });
});

describe('PadControl', () => {
  it('moves both nodes by the finger, one pad width being once round the curve, wrapping at the edges', () => {
    const pad = new PadControl();
    pad.update([{ x: 100, y: 800 }, null], 300);
    const a = pad.update([{ x: 175, y: 800 }, null], 300)!;
    // Started at (0, 0.5): a quarter pad to the right is a quarter of the curve.
    expect(a.s).toBeCloseTo(0.25);
    expect(a.t).toBeCloseTo(0.5);
    const b = pad.update([{ x: 175 + 300, y: 800 - 150 }, null], 300)!;
    expect(b.s).toBeCloseTo(0.25);
    expect(b.t).toBeCloseTo(0);
  });

  it('keeps the nodes where they were when the finger lifts and lands again elsewhere', () => {
    const pad = new PadControl();
    pad.update([{ x: 0, y: 0 }, null], 300);
    pad.update([{ x: 30, y: 0 }, null], 300);
    expect(pad.update([null, null], 300)).toBeNull();
    pad.update([null, { x: 200, y: 200 }], 300);
    expect(pad.update([null, { x: 200, y: 200 }], 300)!.s).toBeCloseTo(0.1);
  });
});

describe('DialControl', () => {
  const dials = torusLayout('dials', area).dials;
  const on = (d: (typeof dials)[number], turn: number) => ({
    x: d.x + d.radius * 0.8 * Math.cos(2 * Math.PI * turn),
    y: d.y - d.radius * 0.8 * Math.sin(2 * Math.PI * turn),
  });

  it('turns one node per dial, a full turn being once round the curve, one finger at a time', () => {
    const control = new DialControl();
    control.update([on(dials[0], 0), null], dials);
    const a = control.update([on(dials[0], 0.25), null], dials)!;
    expect(a.s).toBeCloseTo(0.25);
    expect(a.t).toBeCloseTo(0.5);
    control.update([null, null], dials);
    // The same thumb, in another slot, now turns the second dial; the first stays put.
    control.update([null, on(dials[1], 0.5)], dials);
    const b = control.update([null, on(dials[1], 0.4)], dials)!;
    expect(b.s).toBeCloseTo(0.25);
    expect(b.t).toBeCloseTo(0.4);
  });

  it('ignores a finger that lands on neither dial', () => {
    const control = new DialControl();
    control.update([{ x: 206, y: 100 }, null], dials);
    const a = control.update([{ x: 300, y: 300 }, null], dials)!;
    expect(a).toEqual({ s: 0, t: 0.5 });
  });

  it('turns both dials at once with two thumbs', () => {
    const control = new DialControl();
    control.update([on(dials[0], 0), on(dials[1], 0)], dials);
    const a = control.update([on(dials[0], 0.1), on(dials[1], -0.1)], dials)!;
    expect(a.s).toBeCloseTo(0.1);
    expect(a.t).toBeCloseTo(0.4);
  });
});
