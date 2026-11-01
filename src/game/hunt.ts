import type { ClosedCurve } from '../geometry/curve';
import { type InscribedSquare, refine } from '../geometry/solver';
import type { Corners } from '../geometry/square';
import { add, dist, scale } from '../geometry/vec';

/**
 * Square Hunt on a static curve: the player holds a square, and a held square within the tolerance counts as found
 * once Newton refinement confirms an inscribed square close to it. The found square is that exact square, so the
 * game can snap the held square onto it.
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
  ) {}

  /**
   * Checks a held square. Returns the exact inscribed square it counts as (already found or new), or null if the
   * error is above the tolerance or no inscribed square lies within twice the tolerance of it.
   */
  check(corners: Corners, error: number): InscribedSquare | null {
    if (!(error <= this.tolerance)) return null;
    const held = { centre: scale(add(corners[0], corners[2]), 0.5), side: dist(corners[0], corners[1]) };
    const exact = refine(this.curve, this.curve.nearest(corners[0]).s, this.curve.nearest(corners[1]).s);
    const near = (q: { centre: { x: number; y: number }; side: number }, r: number) =>
      dist(q.centre, held.centre) < r && Math.abs(q.side - held.side) < r;
    if (!exact || exact.side < this.curve.length / 50 || !near(exact, 2 * this.tolerance)) return null;
    const same = (q: InscribedSquare) =>
      dist(q.centre, exact.centre) < 1e-4 * this.curve.length &&
      Math.abs(q.side - exact.side) < 1e-4 * this.curve.length;
    const already = this.found.find(same);
    if (already) return already;
    const match = this.squares.find(same);
    if (!match) this.extra++;
    const counted = match ?? exact;
    this.found.push(counted);
    return counted;
  }
}
