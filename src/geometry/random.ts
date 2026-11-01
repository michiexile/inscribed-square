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
 * A random star-shaped curve from harmonics 2 to 5, each with amplitude in [0.02, 0.14] and a random phase.
 * Every harmonic is present, so no rotational symmetry survives and the curve is generic.
 */
export function randomCurve(seed: number, vertices = 240): Polygon & { harmonics: readonly Harmonic[] } {
  const next = rng(seed);
  const harmonics = [2, 3, 4, 5].map((k) => ({
    k,
    amplitude: 0.02 + 0.12 * next(),
    phase: 2 * Math.PI * next(),
  }));
  return Object.assign(radialFourier(harmonics, vertices), { harmonics });
}
