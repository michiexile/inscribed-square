import { type Banner, huntBanner } from '../game/banner';
import type { Held } from '../game/control';
import { type Hold, Hunt } from '../game/hunt';
import type { Polygon } from '../geometry/polygon';
import { findSquares } from '../geometry/solver';
import type { Renderer } from '../render';
import type { GameMode } from './mode';

/** Square Hunt: find every inscribed square of a still curve, holding each for the dwell time. */
export class HuntMode implements GameMode {
  private readonly hunt: Hunt;
  private readonly solveMs: number;
  private lastFound = 0;
  private error: number | null = null;
  private hold: Hold = { square: null, progress: 0 };

  constructor(
    readonly curve: Polygon,
    tolerance: number,
    dwell: number,
    private readonly label: string,
  ) {
    const t0 = performance.now();
    this.hunt = new Hunt(curve, findSquares(curve), tolerance, dwell);
    this.solveMs = performance.now() - t0;
  }

  advance(): void {}

  frame(r: Renderer, held: Held | null, now: number, reveal: boolean): boolean {
    r.curve(this.curve.vertices);
    for (const q of this.hunt.found) r.fill(q.corners, 'rgba(102, 220, 120, 0.12)');
    if (reveal)
      for (const q of this.hunt.squares) r.outline(q.corners, 'rgba(200, 160, 255, 0.7)', 1.5, [6, 6]);

    this.error = held?.error ?? null;
    this.hold = this.hunt.hold(held?.corners ?? null, held?.error ?? 0, now);
    const snapped = this.hold.square;
    if (snapped) {
      // The fill grows with the dwell; a ring round the centre fills up until the square counts.
      r.snapped(snapped.corners, r.closeness(0), 0.08 + 0.27 * this.hold.progress);
      if (this.hold.progress < 1) r.ring(r.toScreen(snapped.centre), 18, this.hold.progress, r.closeness(0));
    } else if (held) {
      r.loose(this.curve, held.corners, held.free, held.error);
    }
    if (this.hunt.found.length > this.lastFound) navigator.vibrate?.(40);
    this.lastFound = this.hunt.found.length;
    // Keep animating while a dwell is under way, even if the thumbs are still.
    return snapped !== null && this.hold.progress < 1;
  }

  hud(): string {
    const extra = this.hunt.extra > 0 ? ` (${this.hunt.extra} the solver missed)` : '';
    const err =
      this.error === null ? '' : ` · error ${this.error.toFixed(3)}${this.hold.progress >= 1 ? ' ✓' : ''}`;
    return (
      `Found ${this.hunt.found.length} of ${this.hunt.squares.length}${extra}${err}` +
      ` · ${this.label} · solved in ${this.solveMs.toFixed(0)} ms`
    );
  }

  banner(): Banner | null {
    return huntBanner(this.hunt.found.length, this.hunt.squares.length);
  }

  restart(): void {}

  released(now: number): void {
    this.hunt.hold(null, 0, now);
  }

  dispose(): void {}
}
