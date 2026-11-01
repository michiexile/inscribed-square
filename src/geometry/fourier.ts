import { Polygon } from './polygon';

/** One harmonic of a radial Fourier curve: amplitude (relative to the base radius) and phase. */
export interface Harmonic {
  readonly k: number;
  readonly amplitude: number;
  readonly phase: number;
}

/**
 * Samples the star-shaped curve r(θ) = 1 + Σ a_k cos(kθ + φ_k) as a polygon with the given number of vertices.
 * The curve is simple whenever Σ |a_k| < 1, since r stays positive.
 */
export function radialFourier(harmonics: readonly Harmonic[], vertices: number): Polygon {
  const total = harmonics.reduce((sum, h) => sum + Math.abs(h.amplitude), 0);
  if (total >= 1) throw new Error('Harmonic amplitudes must sum to less than 1 to keep the curve simple');
  const points = Array.from({ length: vertices }, (_, i) => {
    const theta = (2 * Math.PI * i) / vertices;
    const r = harmonics.reduce((acc, h) => acc + h.amplitude * Math.cos(h.k * theta + h.phase), 1);
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
  });
  return new Polygon(points);
}
