import type { MorphingCurve } from '../geometry/morph';
import { rng } from '../geometry/random';
import { findSquares } from '../geometry/solver';
import { SquareTracker, type TrackedSquare } from '../geometry/tracker';

/** A Predict round: the curve frozen at `time`, its squares, and the pair that folds away first, at `foldAt`. */
export interface Round {
  readonly time: number;
  readonly squares: readonly TrackedSquare[];
  readonly dying: readonly number[];
  readonly foldAt: number;
}

const FRAME = 1 / 60;

/**
 * The Predict round frozen at morph time `time`, asking which pair folds away about `warning` seconds later: null
 * unless the curve has at least `minSquares` squares then, and the first fold comes between 0.6 and 1.4 times the
 * warning later and takes exactly two squares. A fold much sooner would show the pair already on top of each other.
 */
export function foldRound(morph: MorphingCurve, time: number, warning: number, minSquares = 4): Round | null {
  const squares = findSquares(morph.at(time));
  if (squares.length < minSquares) return null;
  const tracker = new SquareTracker((t) => morph.at(t), time, squares);
  const start = tracker.squares;
  for (let k = 1; k * FRAME <= 1.4 * warning; k++) {
    const t = time + k * FRAME;
    const died = tracker.advance(t);
    if (died.length === 0) continue;
    if (t - time < 0.6 * warning || died.length !== 2) return null;
    return { time, squares: start, dying: died.map((d) => d.id), foldAt: t };
  }
  return null;
}

/**
 * - `asking`: the player picks the square they think folds away next.
 * - `answered`: the answer is in, and the fold plays out.
 * - `done`: every round is answered.
 */
export type PredictPhase = 'asking' | 'answered' | 'done';

/**
 * Predict rules: a run of `length` rounds, one answer each; the level clears with at least `goal` right. Each round
 * costs a full solve and some tracking, so `roundAt` builds it only when it is reached.
 */
export class PredictGame {
  score = 0;
  index = 0;
  phase: PredictPhase = 'asking';
  /** The last answer: the square picked and whether it was right. */
  last: { readonly id: number; readonly right: boolean } | null = null;
  private built: { index: number; round: Round } | null = null;

  constructor(
    readonly length: number,
    private readonly roundAt: (index: number) => Round,
    readonly goal: number,
  ) {}

  get round(): Round | null {
    if (this.index >= this.length) return null;
    if (this.built?.index !== this.index) this.built = { index: this.index, round: this.roundAt(this.index) };
    return this.built.round;
  }

  get cleared(): boolean {
    return this.phase === 'done' && this.score >= this.goal;
  }

  /** Answers the current round with the square `id`. Right if it is either square of the folding pair. */
  answer(id: number): boolean {
    if (this.phase !== 'asking') return false;
    const right = this.round!.dying.includes(id);
    if (right) this.score++;
    this.last = { id, right };
    this.phase = 'answered';
    return right;
  }

  /** Moves on from an answered round. */
  next(): void {
    if (this.phase !== 'answered') return;
    this.index++;
    this.last = null;
    this.phase = this.index >= this.length ? 'done' : 'asking';
  }
}

/**
 * Rounds for a curve with no stored rounds: each call returns the next valid round at a later time, trying times a
 * seeded random 1 to 3 seconds apart, so a seed always gives the same rounds.
 */
export function roundSearch(morph: MorphingCurve, warning: number, seed: number): () => Round {
  const next = rng(seed);
  let time = 0;
  return () => {
    for (;;) {
      time += 1 + 2 * next();
      const round = foldRound(morph, time, warning);
      if (round) {
        time = round.foldAt;
        return round;
      }
    }
  };
}
