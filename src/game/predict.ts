import type { MorphingCurve } from '../geometry/morph';
import { rng } from '../geometry/random';
import { findSquares } from '../geometry/solver';
import type { Corners } from '../geometry/square';
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

/** The squares of a round at one moment before it, by the round's square ids. */
export interface PastFrame {
  readonly time: number;
  readonly squares: ReadonlyMap<number, Corners>;
}

/**
 * The round's squares over the `seconds` before it, a frame per 1/60 s, oldest first and ending at the round itself:
 * each square is tracked backward from the round, so a square born in that time is missing before its birth.
 */
export function lookBack(morph: MorphingCurve, round: Round, seconds: number): PastFrame[] {
  const tracker = new SquareTracker(
    (back) => morph.at(round.time - back),
    0,
    round.squares.map((q) => q.square),
  );
  // The tracker numbers squares from 1 in the order given, the same order as the round's squares.
  const frame = (back: number): PastFrame => ({
    time: round.time - back,
    squares: new Map(tracker.squares.map((q) => [round.squares[q.id - 1].id, q.square.corners])),
  });
  const frames = [frame(0)];
  const steps = Math.round(seconds / FRAME);
  for (let k = 1; k <= steps; k++) {
    tracker.advance(k * FRAME);
    frames.push(frame(k * FRAME));
  }
  return frames.reverse();
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

/**
 * Choosing a card by holding it: a press commits only after `ms` milliseconds on the same card, so the player can
 * look at a card, and see its square on the curve, without answering.
 */
export class CardPress {
  private pressing: { id: number; since: number; progress: number } | null = null;

  constructor(readonly ms: number) {}

  /** The card being held and how far through the press it is, 0 to 1; null when none is. */
  get held(): { readonly id: number; readonly progress: number } | null {
    return this.pressing && { id: this.pressing.id, progress: this.pressing.progress };
  }

  down(id: number, now: number): void {
    this.pressing = { id, since: now, progress: 0 };
  }

  up(): void {
    this.pressing = null;
  }

  /** Advances the press to `now`; returns the card's id at the moment it commits, else null. */
  update(now: number): number | null {
    const p = this.pressing;
    if (!p) return null;
    p.progress = Math.min(1, (now - p.since) / this.ms);
    if (p.progress < 1) return null;
    this.pressing = null;
    return p.id;
  }
}
