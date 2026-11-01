import type { InscribedSquare } from '../geometry/solver';
import type { Corners } from '../geometry/square';
import { add, dist, scale } from '../geometry/vec';

/**
 * Square Hunt on a static curve: the player holds a square, and every square held within the tolerance is
 * recorded as found, matched against the solver's list.
 */
export class Hunt {
  /** Found squares, in the order found. Solver squares where they matched one, else the held square itself. */
  readonly found: InscribedSquare[] = [];
  /** How many found squares matched none of the solver's: the solver missed them. */
  extra = 0;

  constructor(
    readonly squares: readonly InscribedSquare[],
    /** Largest corner distance from the curve that still counts as inscribed, in curve units. */
    readonly tolerance: number,
  ) {}

  /**
   * Records a held square if its error is within the tolerance. Returns the square it counts as (already found
   * or new), or null if it is not close enough to inscribed.
   */
  check(corners: Corners, error: number): InscribedSquare | null {
    if (!(error <= this.tolerance)) return null;
    const held = toSquare(corners);
    const same = (q: InscribedSquare) =>
      dist(q.centre, held.centre) < 2 * this.tolerance && Math.abs(q.side - held.side) < 2 * this.tolerance;
    const already = this.found.find(same);
    if (already) return already;
    const match = this.squares.find(same);
    if (!match) this.extra++;
    const counted = match ?? held;
    this.found.push(counted);
    return counted;
  }
}

function toSquare(corners: Corners): InscribedSquare {
  return {
    corners,
    params: [NaN, NaN, NaN, NaN],
    centre: scale(add(corners[0], corners[2]), 0.5),
    side: dist(corners[0], corners[1]),
  };
}
