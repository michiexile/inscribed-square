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

/** The square the thumbs hold this frame. */
export interface Held {
  readonly corners: Corners;
  /** Indices of the corners not pinned to the curve by a thumb. */
  readonly free: readonly number[];
  /** Largest distance of a free corner from the curve. */
  readonly error: number;
}

/** Turns thumb positions into a held square, remembering the last drag-centre fit so it follows smoothly. */
export class HeldSquare {
  private lastFit: CentreFit | undefined;

  reset(): void {
    this.lastFit = undefined;
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
      this.lastFit = undefined;
      return null;
    }
    this.lastFit = fitSquareAtCentre(curve, t, this.lastFit);
    return { corners: this.lastFit.corners, free: [0, 1, 2, 3], error: this.lastFit.error };
  }
}
