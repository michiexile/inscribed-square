// Background full solves for Build a Curve: the main thread posts the curve's harmonics while the player drags, and
// gets back its inscribed squares, so the count can update without stalling frames.
import { type Harmonic, radialFourier } from '../geometry/fourier';
import { type InscribedSquare, findSquares } from '../geometry/solver';

export interface CountRequest {
  readonly id: number;
  readonly harmonics: readonly Harmonic[];
}

export interface CountResult {
  readonly id: number;
  readonly squares: InscribedSquare[];
}

self.onmessage = (e: MessageEvent<CountRequest>) => {
  const { id, harmonics } = e.data;
  const result: CountResult = { id, squares: findSquares(radialFourier(harmonics, 360)) };
  self.postMessage(result);
};
