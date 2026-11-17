import { type Harmonic, radialFourier } from './fourier';
import type { Polygon } from './polygon';
import { randomCurve } from './random';

/** The harmonics a push moves: 2 to 8. Leaving out 0 and 1 means a push cannot just grow or shift the curve. */
const KS = [2, 3, 4, 5, 6, 7, 8];
/** Largest amplitude sum a push may reach; below 1 keeps the curve simple. */
const MAX_TOTAL = 0.9;

/**
 * A star-shaped curve r(θ) = 1 + Σ a_k cos(kθ + φ_k) that the player reshapes by pushing. Each push at angle ψ by δ
 * adds δ/7 · cos(k(θ − ψ)) to every harmonic, which raises the curve by δ at ψ and ripples elsewhere. Immutable:
 * every push returns a new curve.
 */
export class EditableCurve {
  private constructor(
    /** Cosine and sine coefficients per harmonic in KS: a cos(kθ + φ) = re cos kθ − im sin kθ, re + i·im = a e^{iφ}. */
    private readonly re: readonly number[],
    private readonly im: readonly number[],
  ) {}

  /** The random curve `randomCurve(seed)`, made editable. */
  static fromSeed(seed: number): EditableCurve {
    const base = randomCurve(seed).harmonics;
    const at = (k: number) => base.find((h) => h.k === k);
    return new EditableCurve(
      KS.map((k) => (at(k) ? at(k)!.amplitude * Math.cos(at(k)!.phase) : 0)),
      KS.map((k) => (at(k) ? at(k)!.amplitude * Math.sin(at(k)!.phase) : 0)),
    );
  }

  get harmonics(): Harmonic[] {
    return KS.map((k, i) => ({
      k,
      amplitude: Math.hypot(this.re[i], this.im[i]),
      phase: Math.atan2(this.im[i], this.re[i]),
    }));
  }

  /** This curve pushed outward by `delta` (inward if negative) at angle `psi`, keeping the amplitude sum below 1. */
  pushed(psi: number, delta: number): EditableCurve {
    const w = delta / KS.length;
    // cos(k(θ − ψ)) = cos(kθ + φ) with φ = −kψ.
    const re = KS.map((k, i) => this.re[i] + w * Math.cos(-k * psi));
    const im = KS.map((k, i) => this.im[i] + w * Math.sin(-k * psi));
    const total = KS.reduce((s, _, i) => s + Math.hypot(re[i], im[i]), 0);
    const scale = total > MAX_TOTAL ? MAX_TOTAL / total : 1;
    return new EditableCurve(
      re.map((v) => v * scale),
      im.map((v) => v * scale),
    );
  }

  /** The curve a fraction `f` of the way from this one to `other`. */
  lerp(other: EditableCurve, f: number): EditableCurve {
    return new EditableCurve(
      this.re.map((v, i) => v + (other.re[i] - v) * f),
      this.im.map((v, i) => v + (other.im[i] - v) * f),
    );
  }

  /** The radius at angle `theta`. */
  radius(theta: number): number {
    return KS.reduce((r, k, i) => r + this.re[i] * Math.cos(k * theta) - this.im[i] * Math.sin(k * theta), 1);
  }

  polygon(vertices = 360): Polygon {
    return radialFourier(this.harmonics, vertices);
  }
}
