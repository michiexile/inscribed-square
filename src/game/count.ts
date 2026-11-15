/**
 * What a claim of having found every square earned. A wrong claim says whether the count was even, which by itself
 * proves a square is missing: a generic curve has an odd number of squares.
 */
export type ClaimResult = { readonly right: true } | { readonly right: false; readonly even: boolean };

/** The latest claim: its result, when it was made (milliseconds), and how many squares were found then. */
export interface LastClaim {
  readonly result: ClaimResult;
  readonly at: number;
  readonly found: number;
}

/**
 * Odd One Out rules: the count is hidden, and the player claims when they think they have found every square. A
 * right claim clears the level; wrong claims are counted.
 */
export class Claims {
  wrong = 0;
  cleared = false;
  last: LastClaim | null = null;

  /** Claims that `found` squares are all of the curve's `total`, at time `now`. */
  claim(found: number, total: number, now: number): ClaimResult {
    const result: ClaimResult = found >= total ? { right: true } : { right: false, even: found % 2 === 0 };
    if (result.right) this.cleared = true;
    else if (!this.cleared) this.wrong++;
    this.last = { result, at: now, found };
    return result;
  }
}
