import { type Harmonic, radialFourier } from './fourier';
import type { Polygon } from './polygon';
import { rng } from './random';

interface Mode {
  readonly k: number;
  /** Mean amplitude; the amplitude swings between (1 − SWING) and (1 + SWING) times this. */
  readonly base: number;
  /** Angular frequency of the amplitude swing, and its phase. */
  readonly omega: number;
  readonly psi: number;
  /** Starting phase, and the rate it drifts at, in radians per second. */
  readonly phase: number;
  readonly drift: number;
}

const SWING = 0.5;
/** Largest possible amplitude sum. Below 1 keeps the curve simple; the mean sum is MAX_TOTAL / (1 + SWING). */
const MAX_TOTAL = 0.85;

/**
 * A random star-shaped curve r(θ) = 1 + Σ a_k(τ) cos(kθ + φ_k(τ)) over harmonics 2 to 7 that deforms smoothly with
 * time τ in seconds. Each amplitude swings sinusoidally around its mean and never reaches 0, and each phase drifts
 * at its own rate, so the curve never passes through a rotationally symmetric shape. Vertex i always sits at angle
 * 2πi / vertices, so vertices move only radially.
 */
export class MorphingCurve {
  private readonly modes: readonly Mode[];
  /** An upper bound on how fast any vertex moves, in curve units per second. */
  readonly maxSpeed: number;

  constructor(
    readonly seed: number,
    readonly vertices = 360,
  ) {
    const next = rng(seed);
    const raw = [2, 3, 4, 5, 6, 7].map((k) => ({
      k,
      weight: 0.5 + next(),
      omega: 0.1 + 0.2 * next(),
      psi: 2 * Math.PI * next(),
      phase: 2 * Math.PI * next(),
      drift: (next() < 0.5 ? -1 : 1) * (0.05 + 0.15 * next()),
    }));
    const sum = raw.reduce((acc, m) => acc + m.weight, 0);
    this.modes = raw.map(({ weight, ...m }) => ({ ...m, base: (weight * MAX_TOTAL) / (1 + SWING) / sum }));
    // |dr/dτ| ≤ Σ base·(SWING·ω + (1 + SWING)·|drift|), and a vertex moves only radially.
    this.maxSpeed = this.modes.reduce(
      (acc, m) => acc + m.base * (SWING * m.omega + (1 + SWING) * Math.abs(m.drift)),
      0,
    );
  }

  harmonicsAt(time: number): Harmonic[] {
    return this.modes.map((m) => ({
      k: m.k,
      amplitude: m.base * (1 + SWING * Math.sin(m.omega * time + m.psi)),
      phase: m.phase + m.drift * time,
    }));
  }

  at(time: number): Polygon {
    return radialFourier(this.harmonicsAt(time), this.vertices);
  }
}
