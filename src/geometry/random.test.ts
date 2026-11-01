import { describe, expect, it } from 'vitest';
import { randomCurve } from './random';

/** True when the polygon turns both ways somewhere, i.e. it is not convex. */
function nonConvex(vs: readonly { x: number; y: number }[]): boolean {
  let left = false;
  let right = false;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    const c = vs[(i + 2) % vs.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross > 1e-12) left = true;
    if (cross < -1e-12) right = true;
  }
  return left && right;
}

describe('randomCurve', () => {
  it('gives the same curve for the same seed and a different one for another seed', () => {
    expect(randomCurve(7).vertices).toEqual(randomCurve(7).vertices);
    expect(randomCurve(7).vertices).not.toEqual(randomCurve(8).vertices);
  });

  it('mixes harmonics with no common factor, so no rotational symmetry survives', () => {
    // A curve whose harmonics share a factor m has m-fold symmetry, and m = 4 inscribes a continuous family of
    // squares (#2). Harmonics 2 and 3 alone have no common factor.
    for (let seed = 1; seed <= 20; seed++) {
      const ks = randomCurve(seed)
        .harmonics.filter((h) => h.amplitude > 0)
        .map((h) => h.k);
      expect(ks).toContain(2);
      expect(ks).toContain(3);
    }
  });

  it('is never convex: every curve has dents for squares to hide in', () => {
    for (let seed = 1; seed <= 20; seed++) expect(nonConvex(randomCurve(seed).vertices)).toBe(true);
  });
});
