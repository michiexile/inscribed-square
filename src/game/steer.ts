import type { EditableCurve } from '../geometry/editable';
import { type InscribedSquare, findSquares } from '../geometry/solver';
import { SquareTracker, squareGap } from '../geometry/tracker';

export type SteerState = 'playing' | 'won' | 'lost';

/**
 * Steer the Curve rules: the player reshapes the curve to make every target square fold away while the keeper
 * square survives. Squares fold in pairs, so a target has to be pushed into some square other than the keeper.
 */
export class Steer {
  state: SteerState = 'playing';
  private alive: Set<number>;

  constructor(
    readonly keeper: number,
    readonly targets: readonly number[],
  ) {
    this.alive = new Set(targets);
  }

  /** Takes the ids of squares that died this frame and returns the state. */
  update(died: readonly number[]): SteerState {
    if (this.state !== 'playing') return this.state;
    if (died.includes(this.keeper)) return (this.state = 'lost');
    for (const id of died) this.alive.delete(id);
    if (this.alive.size === 0) this.state = 'won';
    return this.state;
  }

  /** Targets still alive. */
  get left(): number {
    return this.alive.size;
  }

  restart(): void {
    this.state = 'playing';
    this.alive = new Set(this.targets);
  }
}

/** How far a push may move the curve between tracker steps, in curve units. */
export const PUSH_STEP = 0.004;

/**
 * A square tracker over a curve the player edits: each `push` interpolates from the old shape to the new in steps
 * of at most `PUSH_STEP`, so Newton follows every square across the change.
 */
export class EditTracker {
  readonly tracker: SquareTracker;
  private shapes: EditableCurve[];
  private t = 0;

  constructor(
    public curve: EditableCurve,
    squares: readonly InscribedSquare[] = findSquares(curve.polygon()),
  ) {
    this.shapes = [curve];
    // Time k is shape k; the tracker's sub-steps between whole times interpolate between consecutive shapes.
    this.tracker = new SquareTracker(
      (time) => {
        const k = Math.min(this.shapes.length - 2, Math.floor(time - this.base));
        if (k < 0) return this.shapes[0].polygon();
        return this.shapes[k].lerp(this.shapes[k + 1], time - this.base - k).polygon();
      },
      0,
      squares,
      { maxDt: 1 },
    );
  }

  private base = 0;

  /** Pushes the curve at angle `psi` by `delta` and returns the ids of the squares that died. */
  push(psi: number, delta: number): number[] {
    const n = Math.max(1, Math.ceil(Math.abs(delta) / PUSH_STEP));
    let shape = this.curve;
    this.base = this.t;
    this.shapes = [shape];
    for (let i = 0; i < n; i++) {
      shape = shape.pushed(psi, delta / n);
      this.shapes.push(shape);
    }
    this.t += n;
    this.curve = shape;
    return this.tracker.advance(this.t).map((d) => d.id);
  }
}

/**
 * The keeper and target for a curve with none chosen by hand, as indices into its squares: keep the biggest square,
 * and target one of the closest pair that leaves it out, since a close pair is nearest to folding. Null with fewer
 * than three squares.
 */
export function steerPick(squares: readonly InscribedSquare[]): { keeper: number; targets: number[] } | null {
  if (squares.length < 3) return null;
  const keeper = squares.reduce((b, q, i) => (q.side > squares[b].side ? i : b), 0);
  let best: { gap: number; target: number } | null = null;
  for (let i = 0; i < squares.length; i++)
    for (let j = i + 1; j < squares.length; j++) {
      if (i === keeper || j === keeper) continue;
      const gap = squareGap(squares[i], squares[j]);
      if (!best || gap < best.gap) best = { gap, target: i };
    }
  return best && { keeper, targets: [best.target] };
}
