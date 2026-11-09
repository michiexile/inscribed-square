import type { ClosedCurve } from '../geometry/curve';
import type { MorphingCurve } from '../geometry/morph';
import { type InscribedSquare, findSquares, isDegenerate } from '../geometry/solver';
import { SquareTracker, squareGap } from '../geometry/tracker';

/** One square's life on a morphing curve, in morph seconds. `died` is Infinity if it outlived the run. */
export interface Lifetime {
  readonly id: number;
  readonly born: number;
  readonly died: number;
}

export interface FoldTrace {
  readonly lifetimes: readonly Lifetime[];
  readonly duration: number;
}

/**
 * Follows every square of a morph for `duration` seconds the way Avoid Folds does: the tracker each frame, and a full
 * solve every `solveEvery` seconds whose new squares are adopted. A square found by a solve counts as born at the
 * solve, which is no earlier than its real birth.
 */
export function foldTrace(
  morph: MorphingCurve,
  duration: number,
  solveEvery = 0.25,
  frame = 1 / 60,
): FoldTrace {
  const tracker = new SquareTracker((t) => morph.at(t), 0, findSquares(morph.at(0)));
  const born = new Map<number, number>(tracker.squares.map((q) => [q.id, 0]));
  const died = new Map<number, number>();
  let nextSolve = solveEvery;
  for (let k = 1; k * frame <= duration + 1e-9; k++) {
    const time = k * frame;
    for (const d of tracker.advance(time)) died.set(d.id, time);
    if (time >= nextSolve) {
      nextSolve += solveEvery;
      for (const b of tracker.adopt(findSquares(morph.at(time)), time)) born.set(b.id, time);
    }
  }
  const lifetimes = [...born].map(([id, b]) => ({ id, born: b, died: died.get(id) ?? Infinity }));
  return { lifetimes, duration };
}

/**
 * The deaths after which a player on the dying square could not recover: within `grace` seconds of the death, no
 * other square is alive and stays alive for at least `hold` seconds. Returns their times.
 */
export function strandedFolds(trace: FoldTrace, grace: number, hold: number): number[] {
  const out: number[] = [];
  for (const dying of trace.lifetimes) {
    const t = dying.died;
    if (!isFinite(t) || t + grace + hold > trace.duration) continue;
    const rescue = trace.lifetimes.some((q) => {
      if (q.id === dying.id) return false;
      const from = Math.max(q.born, t);
      return from <= t + grace && q.died - from >= hold;
    });
    if (!rescue) out.push(t);
  }
  return out;
}

/**
 * What makes a still curve unfit for Square Hunt, given its squares from `findSquares`; empty when it is fit. A
 * curve must be generic (no continuous family, an odd count), and no two squares may be closer than `minGap` (centre
 * and side, as `squareGap` measures), or a held square within the snap tolerance cannot tell them apart.
 */
export function huntProblems(
  curve: ClosedCurve,
  squares: readonly InscribedSquare[],
  minGap: number,
): string[] {
  if (isDegenerate(curve, squares)) return ['the squares form a continuous family'];
  const problems: string[] = [];
  if (squares.length % 2 === 0) problems.push(`even count ${squares.length}: the solver missed a square`);
  let gap = Infinity;
  for (let i = 0; i < squares.length; i++)
    for (let j = i + 1; j < squares.length; j++) gap = Math.min(gap, squareGap(squares[i], squares[j]));
  if (gap < minGap) problems.push(`two squares only ${gap.toFixed(3)} apart`);
  return problems;
}

/**
 * Why an Avoid Folds level at morph `speed` can strand the player, from a trace in morph seconds; empty when it
 * cannot. `grace` and `hold` are in real seconds, so a faster morph needs rescue squares that live longer in morph
 * time.
 */
export function foldsProblems(trace: FoldTrace, speed: number, grace: number, hold: number): string[] {
  const times = [...new Set(strandedFolds(trace, grace * speed, hold * speed))];
  return times.map(
    (t) => `stranded after the fold at ${t.toFixed(1)} s (${(t / speed).toFixed(1)} s real time)`,
  );
}
