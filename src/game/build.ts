import type { ClosedCurve } from '../geometry/curve';
import type { InscribedSquare } from '../geometry/solver';
import { huntProblems } from './validate';

/** A built curve's square count, whether it is settled, and whether it meets the target. */
export interface BuildCount {
  readonly count: number;
  /** False while two squares are within `minGap` of each other or the count is even: about to change, or unsure. */
  readonly settled: boolean;
  readonly met: boolean;
}

/** Judges a built curve with its squares from `findSquares` against the target count. */
export function buildCount(
  curve: ClosedCurve,
  squares: readonly InscribedSquare[],
  target: number,
  minGap: number,
): BuildCount {
  const settled = huntProblems(curve, squares, minGap).length === 0;
  return { count: squares.length, settled, met: settled && squares.length === target };
}
