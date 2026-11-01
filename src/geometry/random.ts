import { type Harmonic, radialFourier } from './fourier';
import type { Polygon } from './polygon';

/** A small seeded PRNG (mulberry32), returning floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A random star-shaped curve r(θ) = 1 + Σ a_k cos(kθ + φ_k) over harmonics 2 to 7. Raw amplitudes are random,
 * then scaled so they sum to between 0.55 and 0.85: high enough that the curve always has dents, below the
 * limit of 1 that keeps it simple. Every harmonic is present, so no rotational symmetry survives.
 */
export function randomCurve(seed: number, vertices = 360): Polygon & { harmonics: readonly Harmonic[] } {
  const next = rng(seed);
  const raw = [2, 3, 4, 5, 6, 7].map((k) => ({ k, amplitude: 0.2 + next(), phase: 2 * Math.PI * next() }));
  const total = 0.55 + 0.3 * next();
  const sum = raw.reduce((acc, h) => acc + h.amplitude, 0);
  const harmonics = raw.map((h) => ({ ...h, amplitude: (h.amplitude * total) / sum }));
  return Object.assign(radialFourier(harmonics, vertices), { harmonics });
}
