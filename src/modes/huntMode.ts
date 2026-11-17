import { type Banner, CLAIM_MESSAGE_MS, countBanner, huntBanner } from '../game/banner';
import type { Held } from '../game/control';
import { Claims } from '../game/count';
import { type Hold, Hunt } from '../game/hunt';
import type { Polygon } from '../geometry/polygon';
import { findSquares } from '../geometry/solver';
import type { Renderer } from '../render';
import type { GameMode } from './mode';

/** Squares the player has already found: a faint fill, and the full colour when held again. */
const FOUND = 'hsl(172, 75%, 48%)';
const FOUND_FILL = 'hsla(172, 75%, 48%, 0.14)';

/**
 * Square Hunt: find every inscribed square of a still curve, holding each for the dwell time. With `hideCount` it is
 * Odd One Out: the count stays hidden until the player claims they have found every square.
 */
export class HuntMode implements GameMode {
  private readonly claims = new Claims();
  private now = 0;
  /** Present only in Odd One Out, so the app shows the That's all button only there. */
  readonly claim?: (now: number) => void;
  private readonly hunt: Hunt;
  private readonly solveMs: number;
  private lastFound = 0;
  private error: number | null = null;
  private hold: Hold = { square: null, progress: 0, known: false };

  constructor(
    readonly curve: Polygon,
    tolerance: number,
    dwell: number,
    private readonly label: string,
    private readonly hideCount = false,
  ) {
    const t0 = performance.now();
    this.hunt = new Hunt(curve, findSquares(curve), tolerance, dwell);
    this.solveMs = performance.now() - t0;
    if (hideCount) this.claim = (now) => void this.claims.claim(this.hunt.found.length, this.total, now);
  }

  advance(): void {}

  frame(r: Renderer, held: Held | null, now: number, reveal: boolean): boolean {
    this.now = now;
    r.curve(this.curve.vertices);
    for (const q of this.hunt.found) r.fill(q.corners, FOUND_FILL);
    if (reveal)
      for (const q of this.hunt.squares) r.outline(q.corners, 'rgba(200, 160, 255, 0.7)', 1.5, [6, 6]);

    this.error = held?.error ?? null;
    this.hold = this.hunt.hold(held?.corners ?? null, held?.error ?? 0, now);
    const snapped = this.hold.square;
    if (snapped && this.hold.known) {
      // Back on a square already found: drawn in the found colour, so it is plainly not a new one.
      r.snapped(snapped.corners, FOUND, 0.3);
    } else if (snapped) {
      // The fill grows with the dwell; a ring round the centre fills up until the square counts.
      r.snapped(snapped.corners, r.closeness(0), 0.08 + 0.27 * this.hold.progress);
      if (this.hold.progress < 1) r.ring(r.toScreen(snapped.centre), 18, this.hold.progress, r.closeness(0));
    } else if (held) {
      r.loose(this.curve, held.corners, held.free, held.error);
    }
    if (this.hunt.found.length > this.lastFound) navigator.vibrate?.(40);
    this.lastFound = this.hunt.found.length;
    // Keep animating while a dwell is under way, even if the thumbs are still, and until a claim's message fades.
    const claimShowing = this.claims.last !== null && now - this.claims.last.at < CLAIM_MESSAGE_MS;
    return (snapped !== null && this.hold.progress < 1) || claimShowing;
  }

  /** The curve's square count as far as anyone knows: the solver's, plus any it missed that the player found. */
  private get total(): number {
    return this.hunt.squares.length + this.hunt.extra;
  }

  hud(): string {
    const again = this.hold.known ? ' · already found' : '';
    if (this.hideCount) return `Found ${this.hunt.found.length}${again} · ${this.label}`;
    const extra = this.hunt.extra > 0 ? ` (${this.hunt.extra} the solver missed)` : '';
    const err =
      this.error === null ? '' : ` · error ${this.error.toFixed(3)}${this.hold.progress >= 1 ? ' ✓' : ''}`;
    return (
      `Found ${this.hunt.found.length} of ${this.hunt.squares.length}${extra}${err}${again}` +
      ` · ${this.label} · solved in ${this.solveMs.toFixed(0)} ms`
    );
  }

  started(): boolean {
    return this.hunt.found.length > 0;
  }

  cleared(): boolean {
    if (this.hideCount) return this.claims.cleared;
    return this.hunt.squares.length > 0 && this.hunt.found.length >= this.hunt.squares.length;
  }

  banner(): Banner | null {
    if (this.hideCount)
      return countBanner(this.claims.last, this.now, this.claims.cleared, this.total, this.claims.wrong);
    return huntBanner(this.hunt.found.length, this.hunt.squares.length);
  }

  restart(): void {}

  released(now: number): void {
    this.hunt.hold(null, 0, now);
  }

  dispose(): void {}
}
