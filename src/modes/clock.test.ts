import { describe, expect, it } from 'vitest';
import { morphStep } from './clock';

describe('morphStep', () => {
  it('advances the morph by the real time since the last frame, times the level speed', () => {
    expect(morphStep(16, 1)).toBeCloseTo(0.016);
    expect(morphStep(16, 2.5)).toBeCloseTo(0.04);
  });

  it('caps a long gap at 0.1 real seconds before applying the speed, and never runs backwards', () => {
    // Capping after the speed would let a fast level jump less than a slow one per stalled frame.
    expect(morphStep(5000, 1)).toBeCloseTo(0.1);
    expect(morphStep(5000, 3)).toBeCloseTo(0.3);
    expect(morphStep(-20, 2)).toBe(0);
  });
});
