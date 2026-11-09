import type { ClosedCurve } from './curve';
import { type InscribedSquare, refineFrom, sameSquare } from './solver';
import { dist } from './vec';

/** A square the tracker is following, under an id that stays the same while the square lives. */
export interface TrackedSquare {
  readonly id: number;
  readonly square: InscribedSquare;
  /**
   * How far the nearest other tracked square is: the larger of the distance between centres and the difference in
   * side. Infinity when this is the only one. Two squares about to fold away draw together, so a small gap warns of a
   * fold.
   */
  readonly gap: number;
  /** The id of that nearest square, or null when there is none. */
  readonly partner: number | null;
}

export interface TrackerOptions {
  /** Squares smaller than this count as dead. Default length / 50, matching the solver. */
  readonly minSide?: number;
  /** Longest time step Newton is asked to bridge, in seconds; longer steps are split. Default 1/60. */
  readonly maxDt?: number;
}

/**
 * Follows the inscribed squares of a deforming curve. `advance` moves every square to a later time with a few Newton
 * steps from its last parameters, which is cheap enough for every frame. A square dies at a fold, where it meets
 * another and both vanish: Newton fails, or lands on the same square as its partner.
 *
 * Squares are born in pairs at folds too, and local tracking cannot see that. A full solve run in the background
 * catches them: `adopt` carries its result forward to the tracker's time and adds the squares it did not have.
 */
export class SquareTracker {
  private tracked: TrackedSquare[] = [];
  private nextId = 1;
  private readonly maxDt: number;
  private readonly minSide: number;

  constructor(
    private readonly curveAt: (time: number) => ClosedCurve,
    /** The time the tracked squares belong to. */
    public time: number,
    squares: readonly InscribedSquare[],
    options: TrackerOptions = {},
  ) {
    this.maxDt = options.maxDt ?? 1 / 60;
    this.minSide = options.minSide ?? curveAt(time).length / 50;
    this.tracked = squares.map((square) => ({ id: this.nextId++, square, gap: Infinity, partner: null }));
    this.updateGaps();
  }

  /** The live squares, oldest first. */
  get squares(): readonly TrackedSquare[] {
    return this.tracked;
  }

  /** Moves every square to `time` and returns the ones that died on the way. */
  advance(time: number): TrackedSquare[] {
    const died: TrackedSquare[] = [];
    let live = this.tracked.map((t) => t.square);
    let ids = this.tracked.map((t) => t.id);
    for (const curve of this.path(this.time, time)) {
      const next = this.step(curve, live);
      for (let i = 0; i < live.length; i++) {
        if (!next[i]) died.push(this.tracked.find((t) => t.id === ids[i])!);
      }
      ids = ids.filter((_, i) => next[i]);
      live = next.filter((q): q is InscribedSquare => q !== null);
    }
    this.time = time;
    this.tracked = live.map((square, i) => ({ id: ids[i], square, gap: Infinity, partner: null }));
    this.updateGaps();
    return died;
  }

  /**
   * Adds the squares of a full solve made at the earlier time `solvedAt` that the tracker is not following yet,
   * after carrying them forward to the tracker's time. Returns the new squares.
   */
  adopt(squares: readonly InscribedSquare[], solvedAt: number): TrackedSquare[] {
    let carried: InscribedSquare[] = [...squares];
    for (const curve of this.path(solvedAt, this.time)) {
      carried = this.step(curve, carried).filter((q): q is InscribedSquare => q !== null);
    }
    const born: TrackedSquare[] = [];
    for (const square of carried) {
      if (this.tracked.some((t) => this.same(t.square, square))) continue;
      const fresh = { id: this.nextId++, square, gap: Infinity, partner: null };
      this.tracked.push(fresh);
      born.push(fresh);
    }
    if (born.length > 0) this.updateGaps();
    return born.map((b) => this.tracked.find((t) => t.id === b.id)!);
  }

  /** The curves at evenly spaced times after `from` up to and including `to`, no more than maxDt apart. */
  private path(from: number, to: number): ClosedCurve[] {
    if (!(to > from)) return [];
    const n = Math.ceil((to - from) / this.maxDt - 1e-9);
    return Array.from({ length: n }, (_, k) => this.curveAt(from + ((to - from) * (k + 1)) / n));
  }

  /** One Newton step onto `curve` for each square; null where it died. Two squares landing together both die. */
  private step(curve: ClosedCurve, squares: readonly InscribedSquare[]): (InscribedSquare | null)[] {
    const next = squares.map((q) => {
      const r = refineFrom(curve, q.params);
      // Newton could in principle converge onto a distant square instead of failing; in six minutes of tracking
      // three morphs that never happened (WORKLOG-tracking.md), so there is no jump check.
      return r && r.side >= this.minSide ? r : null;
    });
    const out = [...next];
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const a = next[i];
        const b = next[j];
        if (a && b && this.same(a, b)) out[i] = out[j] = null;
      }
    }
    return out;
  }

  private same(a: InscribedSquare, b: InscribedSquare): boolean {
    return sameSquare(a, b, 1e-6);
  }

  private updateGaps(): void {
    this.tracked = this.tracked.map((t) => {
      let gap = Infinity;
      let partner: number | null = null;
      for (const o of this.tracked) {
        if (o.id === t.id) continue;
        const g = squareGap(t.square, o.square);
        if (g < gap) {
          gap = g;
          partner = o.id;
        }
      }
      return { ...t, gap, partner };
    });
  }
}

/** How far apart two squares are: the larger of the distance between centres and the difference in side. */
export function squareGap(a: InscribedSquare, b: InscribedSquare): number {
  return Math.max(dist(a.centre, b.centre), Math.abs(a.side - b.side));
}
