import { type CentreFit, fitSquareAtCentre } from '../geometry/centre';
import type { ClosedCurve } from '../geometry/curve';
import { type Corners, bestEdgeSquare } from '../geometry/square';
import type { Vec } from '../geometry/vec';

/**
 * How the player's thumbs make a square.
 * - `corners` (control 1): each thumb picks the nearest curve point as one corner; the other two corners follow.
 * - `centre` (control 2): one thumb places the centre; the best-fitting size and angle around it are found.
 */
export type Control = 'corners' | 'centre';

export const CONTROL_NAMES: Record<Control, string> = { corners: 'Two corners', centre: 'Drag centre' };

/** The control a new player starts with: one finger works however the phone is held. */
export const DEFAULT_CONTROL: Control = 'centre';

export const isControl = (x: unknown): x is Control => x === 'corners' || x === 'centre';

/** The square the thumbs hold this frame. */
export interface Held {
  readonly corners: Corners;
  /** Indices of the corners not pinned to the curve by a thumb. */
  readonly free: readonly number[];
  /** Largest distance of a free corner from the curve. */
  readonly error: number;
}

/**
 * Turns thumb positions into a held square. With drag the centre the finger works like a trackpad: the square moves
 * by as much as the finger does, wherever on the screen the finger is, so the finger need not cover the curve. The
 * square starts at the middle of the curve and stays where it was left when the finger lifts.
 */
export class HeldSquare {
  private lastFit: CentreFit | undefined;
  /** The held centre, in curve coordinates; kept across lifts, and forgotten with `reset`. */
  private centre: Vec | null = null;
  /** Where the finger was on the previous frame while it is down. */
  private finger: Vec | null = null;

  /** Forgets the square, for a new curve. */
  reset(): void {
    this.lastFit = undefined;
    this.centre = null;
    this.finger = null;
  }

  /** The held square from the two thumb slots, in curve coordinates; null when the control lacks its thumbs. */
  update(curve: ClosedCurve, control: Control, thumbs: readonly (Vec | null)[]): Held | null {
    if (control === 'corners') {
      const params = thumbs.map((t) => (t ? curve.nearest(t).s : null));
      if (params[0] === null || params[1] === null) return null;
      const sq = bestEdgeSquare(curve, params[0], params[1]);
      return { corners: sq.corners, free: [2, 3], error: sq.error };
    }
    const t = thumbs[0] ?? thumbs[1];
    if (!t) {
      this.finger = null;
      return null;
    }
    const box = bounds(curve);
    const from = this.centre ?? { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 };
    const moved = this.finger ? { x: from.x + t.x - this.finger.x, y: from.y + t.y - this.finger.y } : from;
    this.finger = t;
    this.centre = {
      x: Math.min(box.max.x, Math.max(box.min.x, moved.x)),
      y: Math.min(box.max.y, Math.max(box.min.y, moved.y)),
    };
    this.lastFit = fitSquareAtCentre(curve, this.centre, this.lastFit);
    return { corners: this.lastFit.corners, free: [0, 1, 2, 3], error: this.lastFit.error };
  }
}

/** The curve's bounding box, from 64 points along it. */
function bounds(curve: ClosedCurve): { min: Vec; max: Vec } {
  const min = { x: Infinity, y: Infinity };
  const max = { x: -Infinity, y: -Infinity };
  for (let i = 0; i < 64; i++) {
    const p = curve.point(i / 64);
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
  }
  return { min, max };
}
