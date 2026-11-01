import { describe, expect, it } from 'vitest';
import { randomCurve } from './random';

describe('randomCurve', () => {
  it('gives the same curve for the same seed and a different one for another seed', () => {
    expect(randomCurve(7).vertices).toEqual(randomCurve(7).vertices);
    expect(randomCurve(7).vertices).not.toEqual(randomCurve(8).vertices);
  });

  it('mixes several harmonics so that no rotational symmetry survives', () => {
    // A curve with only one harmonic k has k-fold symmetry, and k = 4 inscribes a continuous family of squares.
    for (let seed = 1; seed <= 20; seed++) {
      const harmonics = randomCurve(seed).harmonics;
      expect(harmonics.filter((h) => h.amplitude >= 0.02).length).toBeGreaterThanOrEqual(3);
    }
  });
});
