// Background full solves for Avoid Folds: the main thread posts a morph seed and time, and gets back that curve's
// inscribed squares. A full solve takes about 60 ms on a phone, too long for a frame (WORKLOG-solver.md).
import { MorphingCurve } from '../geometry/morph';
import { type InscribedSquare, findSquares } from '../geometry/solver';

export interface SolveRequest {
  readonly seed: number;
  readonly time: number;
}

export interface SolveResult extends SolveRequest {
  readonly squares: InscribedSquare[];
}

let morph: MorphingCurve | null = null;

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { seed, time } = e.data;
  if (morph?.seed !== seed) morph = new MorphingCurve(seed);
  const result: SolveResult = { seed, time, squares: findSquares(morph.at(time)) };
  self.postMessage(result);
};
