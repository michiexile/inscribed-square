import { describe, expect, it } from 'vitest';
import { EditableCurve } from './editable';
import { randomCurve } from './random';

const radiusAt = (c: EditableCurve, theta: number) =>
  c.harmonics.reduce((r, h) => r + h.amplitude * Math.cos(h.k * theta + h.phase), 1);

describe('EditableCurve', () => {
  it('starts as the random curve of its seed', () => {
    const c = EditableCurve.fromSeed(3);
    const base = randomCurve(3);
    for (const theta of [0, 1, 2.5, 4]) {
      const r = base.harmonics.reduce((acc, h) => acc + h.amplitude * Math.cos(h.k * theta + h.phase), 1);
      expect(radiusAt(c, theta)).toBeCloseTo(r, 9);
    }
  });

  it('raises the curve most where it is pushed, by the push', () => {
    const c = EditableCurve.fromSeed(3);
    const before = Array.from({ length: 360 }, (_, i) => radiusAt(c, (2 * Math.PI * i) / 360));
    const pushed = c.pushed(1, 0.02);
    const rise = before.map((r, i) => radiusAt(pushed, (2 * Math.PI * i) / 360) - r);
    expect(rise[Math.round((1 / (2 * Math.PI)) * 360)]).toBeCloseTo(0.02, 3);
    const peak = rise.indexOf(Math.max(...rise));
    expect(Math.abs((peak * 2 * Math.PI) / 360 - 1)).toBeLessThan(0.05);
  });

  it('never lets the amplitudes reach 1, so the curve stays simple however hard it is pushed', () => {
    let c = EditableCurve.fromSeed(3);
    for (let i = 0; i < 500; i++) c = c.pushed(0.3, 0.05);
    expect(c.harmonics.reduce((s, h) => s + h.amplitude, 0)).toBeLessThan(1);
    expect(() => c.polygon()).not.toThrow();
  });

  it('interpolates between two shapes, so a tracker can cross a push in small steps', () => {
    const a = EditableCurve.fromSeed(3);
    const b = a.pushed(2, 0.04);
    const mid = a.lerp(b, 0.5);
    for (const theta of [0, 2, 3])
      expect(radiusAt(mid, theta)).toBeCloseTo((radiusAt(a, theta) + radiusAt(b, theta)) / 2, 9);
  });
});
