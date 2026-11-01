import type { ClosedCurve } from '../geometry/curve';
import { type InscribedSquare, refine } from '../geometry/solver';
import type { Corners } from '../geometry/square';
import { add, dist, scale } from '../geometry/vec';

/** Where a held square stands: the inscribed square it snaps onto, if any, and how far through the dwell it is. */
export interface Hold {
  readonly square: InscribedSquare | null;
  /** 0 to 1; reaching 1 counts the square as found. Already-found squares are at 1 straight away. */
  readonly progress: number;
}

/**
 * Square Hunt on a static curve: the player holds a square, and a held square within the tolerance snaps onto an
 * inscribed square once Newton refinement confirms one close to it. It counts as found after being held on that
 * square continuously for the dwell time, so scrubbing across the screen does not collect squares.
 */
export class Hunt {
  /** Found squares, in the order found. Solver squares where they matched one, else the refined square itself. */
  readonly found: InscribedSquare[] = [];
  /** How many found squares matched none of the solver's: the solver missed them. */
  extra = 0;

  constructor(
    readonly curve: ClosedCurve,
    readonly squares: readonly InscribedSquare[],
    /** Largest corner distance from the curve that still counts, in curve units. */
    readonly tolerance: number,
    /** How long a square must be held, in milliseconds, before it counts. */
    readonly dwell: number,
  ) {}

  private holding: { square: InscribedSquare; since: number } | null = null;

  /**
   * Updates the hold with this frame's held square at time `now` (milliseconds). A frame off the square, or on a
   * different one, restarts the dwell.
   */
  hold(corners: Corners | null, error: number, now: number): Hold {
    const square = corners ? this.match(corners, error) : null;
    if (!square) {
      this.holding = null;
      return { square: null, progress: 0 };
    }
    if (this.found.includes(square)) return { square, progress: 1 };
    if (this.holding?.square !== square) this.holding = { square, since: now };
    const progress = Math.min(1, (now - this.holding.since) / this.dwell);
    if (progress >= 1) {
      if (!this.squares.includes(square)) this.extra++;
      this.found.push(square);
    }
    return { square, progress };
  }

  /**
   * The exact inscribed square a held square snaps onto: a found square, a solver square, or one the solver missed.
   * Null if the error is above the tolerance or no inscribed square lies within twice the tolerance of it.
   */
  match(corners: Corners, error: number): InscribedSquare | null {
    if (!(error <= this.tolerance)) return null;
    const held = { centre: scale(add(corners[0], corners[2]), 0.5), side: dist(corners[0], corners[1]) };
    const exact = refine(this.curve, this.curve.nearest(corners[0]).s, this.curve.nearest(corners[1]).s);
    const near = (q: { centre: { x: number; y: number }; side: number }, r: number) =>
      dist(q.centre, held.centre) < r && Math.abs(q.side - held.side) < r;
    if (!exact || exact.side < this.curve.length / 50 || !near(exact, 2 * this.tolerance)) return null;
    const same = (q: InscribedSquare) =>
      dist(q.centre, exact.centre) < 1e-4 * this.curve.length &&
      Math.abs(q.side - exact.side) < 1e-4 * this.curve.length;
    return (
      this.found.find(same) ??
      this.squares.find(same) ??
      (this.holding && same(this.holding.square) ? this.holding.square : exact)
    );
  }
}
