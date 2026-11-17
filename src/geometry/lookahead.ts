import type { ClosedCurve } from './curve';
import type { InscribedSquare } from './solver';
import { SquareTracker, type TrackedSquare, type TrackerOptions } from './tracker';

/** The longest step the tracker ahead takes between recorded snapshots, in seconds. */
const STEP = 1 / 60;

/**
 * A square tracker that runs `lead` seconds ahead of the time it shows. It keeps a snapshot of the squares at every
 * step, so the squares at the display time are the ones a plain tracker would show, but every death up to `lead`
 * seconds ahead is already known: `deathOf` says when a live square will fold away.
 *
 * Full solves must be made at `aheadTime`, the time the tracker ahead has reached, and passed to `adopt`; their new
 * squares appear on screen when the display time catches up.
 */
export class LeadTracker {
  private readonly ahead: SquareTracker;
  private history: { time: number; squares: readonly TrackedSquare[] }[];
  private readonly deaths = new Map<number, number>();
  private shown: readonly TrackedSquare[];

  constructor(
    curveAt: (time: number) => ClosedCurve,
    /** The display time. */
    public time: number,
    squares: readonly InscribedSquare[],
    /** How far ahead of the display the tracker runs, in seconds. */
    readonly lead: number,
    options: TrackerOptions = {},
  ) {
    this.ahead = new SquareTracker(curveAt, time, squares, { ...options, maxDt: options.maxDt ?? STEP });
    this.shown = this.ahead.squares;
    this.history = [{ time, squares: this.shown }];
    this.runTo(time + lead);
  }

  /** The live squares at the display time, oldest first. */
  get squares(): readonly TrackedSquare[] {
    return this.shown;
  }

  /** The time the tracker ahead has reached: where full solves for `adopt` must be made. */
  get aheadTime(): number {
    return this.ahead.time;
  }

  /** When the square with this id dies, if that is no later than `aheadTime`; undefined if it outlives it. */
  deathOf(id: number): number | undefined {
    return this.deaths.get(id);
  }

  /** Moves the display to `time` and returns the squares that died on the way. */
  advance(time: number): TrackedSquare[] {
    this.runTo(time + this.lead);
    let i = 0;
    while (i + 1 < this.history.length && this.history[i + 1].time <= time + 1e-9) i++;
    this.history = this.history.slice(i);
    const before = this.shown;
    this.shown = this.history[0].squares;
    this.time = time;
    return before.filter((q) => !this.shown.some((s) => s.id === q.id));
  }

  /** Adds the new squares of a full solve made at `solvedAt` (normally `aheadTime`). Returns them. */
  adopt(squares: readonly InscribedSquare[], solvedAt: number): TrackedSquare[] {
    const born = this.ahead.adopt(squares, solvedAt);
    if (born.length > 0)
      this.history[this.history.length - 1] = { time: this.ahead.time, squares: this.ahead.squares };
    if (this.lead === 0) this.shown = this.ahead.squares;
    return born;
  }

  /** Runs the tracker ahead to `to` in even steps of at most STEP, recording each step and every death. */
  private runTo(to: number): void {
    const from = this.ahead.time;
    if (!(to > from)) return;
    const n = Math.ceil((to - from) / STEP - 1e-9);
    for (let k = 1; k <= n; k++) {
      const t = from + ((to - from) * k) / n;
      for (const d of this.ahead.advance(t)) this.deaths.set(d.id, t);
      this.history.push({ time: t, squares: this.ahead.squares });
    }
  }
}
