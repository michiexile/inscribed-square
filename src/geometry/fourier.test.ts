import { describe, expect, it } from 'vitest';
import { radialFourier } from './fourier';
import { dist } from './vec';

describe('radialFourier', () => {
  it('with no harmonics samples the unit circle', () => {
    const p = radialFourier([], 64);
    expect(p.vertices).toHaveLength(64);
    for (const v of p.vertices) expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });

  it('applies the harmonic at the right angle', () => {
    // r(θ) = 1 + 0.5 cos(2θ): radius 1.5 at θ = 0, radius 0.5 at θ = π/2.
    const p = radialFourier([{ k: 2, amplitude: 0.5, phase: 0 }], 4);
    expect(dist(p.vertices[0], { x: 1.5, y: 0 })).toBeCloseTo(0);
    expect(dist(p.vertices[1], { x: 0, y: 0.5 })).toBeCloseTo(0);
  });

  it('refuses amplitudes that could make the curve cross itself', () => {
    expect(() => radialFourier([{ k: 3, amplitude: 1, phase: 0 }], 32)).toThrow();
  });
});
