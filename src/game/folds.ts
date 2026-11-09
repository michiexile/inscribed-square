import type { Corners } from '../geometry/square';
import type { TrackedSquare } from '../geometry/tracker';
import { type Vec, add, dist, scale } from '../geometry/vec';

/**
 * - `searching`: the round has not started; nothing is at stake until the first latch.
 * - `holding`: the held square is latched onto a live square and the score is running.
 * - `lost`: the latch broke, because the square folded away or the player slipped off; the grace clock is running.
 * - `over`: the grace time ran out.
 */
export type Phase = 'searching' | 'holding' | 'lost' | 'over';

export interface FoldsState {
  readonly phase: Phase;
  /** The live square the player is on, while holding. */
  readonly square: TrackedSquare | null;
  /** Milliseconds left to latch on again, while lost. */
  readonly graceLeft: number;
}

/**
 * Avoid Folds on a morphing curve. The player latches onto an inscribed square by holding a square within the
 * tolerance of it, then scores for every second they stay on it. Once latched, the held square may wander up to three
 * tolerances away, since the curve moves under the thumbs. When the square folds away or the player slips off, they
 * have the grace time to latch onto any square, or the round ends.
 */
export class AvoidFolds {
  /** Seconds spent latched. */
  score = 0;
  /** Times the player latched on again within the grace time after their square folded away. */
  saves = 0;
  /** Id of the square the player is on. */
  latched: number | null = null;
  private phase: Phase = 'searching';
  private graceUntil = 0;
  private lastTime = 0;
  /** Whether the current grace period began with the square dying, so latching again is a save. */
  private folded = false;

  constructor(
    /** Largest corner distance from the curve at which a held square latches, in curve units. */
    readonly tolerance: number,
    /** Milliseconds allowed to latch on again after losing the square. */
    readonly grace: number,
  ) {}

  /**
   * Advances the game to time `now` (milliseconds) with this frame's held square (null when not holding one), its
   * error, the tracker's live squares, and the squares that died since the last frame.
   */
  update(
    held: Corners | null,
    error: number,
    squares: readonly TrackedSquare[],
    died: readonly TrackedSquare[],
    now: number,
  ): FoldsState {
    const dt = now - this.lastTime;
    this.lastTime = now;
    if (this.phase === 'over') return this.state(null, now);

    if (this.phase === 'holding') {
      // The square was held up to this frame, whatever this frame finds.
      this.score += dt / 1000;
      const current = squares.find((q) => q.id === this.latched);
      if (!current || died.some((d) => d.id === this.latched)) {
        this.lose(now, true);
      } else if (!held || !near(held, current, 3 * this.tolerance)) {
        this.lose(now, false);
      } else {
        return this.state(current, now);
      }
    }

    const target =
      held && error <= this.tolerance ? squares.find((q) => near(held, q, 2 * this.tolerance)) : undefined;
    if (target) {
      if (this.phase === 'lost' && this.folded) this.saves++;
      this.phase = 'holding';
      this.latched = target.id;
      return this.state(target, now);
    }
    if (this.phase === 'lost' && now >= this.graceUntil) this.phase = 'over';
    return this.state(null, now);
  }

  private lose(now: number, folded: boolean): void {
    this.phase = 'lost';
    this.latched = null;
    this.graceUntil = now + this.grace;
    this.folded = folded;
  }

  private state(square: TrackedSquare | null, now: number): FoldsState {
    return {
      phase: this.phase,
      square,
      graceLeft: this.phase === 'lost' ? Math.max(0, this.graceUntil - now) : 0,
    };
  }
}

const centreOf = (c: Corners): Vec => scale(add(c[0], c[2]), 0.5);

/** True when the held square's centre and side are both within r of the tracked square's. */
function near(held: Corners, q: TrackedSquare, r: number): boolean {
  return dist(centreOf(held), q.square.centre) < r && Math.abs(dist(held[0], held[1]) - q.square.side) < r;
}
