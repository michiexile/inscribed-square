import { type CentreFit, fitSquareAtCentre } from '../geometry/centre';
import type { ClosedCurve } from '../geometry/curve';
import { type Corners, bestEdgeSquare } from '../geometry/square';
import type { Vec } from '../geometry/vec';
import { DialControl, PadControl, type TorusLayout, type TorusPoint } from './torus';

/**
 * How the player's thumbs make a square.
 * - `corners` (control 1): each thumb picks the nearest curve point as one corner; the other two corners follow.
 * - `centre` (control 2): one thumb places the centre; the best-fitting size and angle around it are found.
 * - `pad` and `dials`: the player moves two nodes along the curve directly, by a point on the (s, t) torus map or by
 *   one dial per node (`torus.ts`); the square stands on the two nodes, like `corners`.
 */
export type Control = 'corners' | 'centre' | 'pad' | 'dials';

export const CONTROL_NAMES: Record<Control, string> = {
  corners: 'Two corners',
  centre: 'Drag centre',
  pad: 'Torus pad',
  dials: 'Dials',
};

/** The controls in the order the control button steps through them. */
export const CONTROLS: readonly Control[] = ['centre', 'pad', 'dials', 'corners'];

/** The control a new player starts with: one finger works however the phone is held. */
export const DEFAULT_CONTROL: Control = 'centre';

export const isControl = (x: unknown): x is Control => CONTROLS.includes(x as Control);

/** The square the thumbs hold this frame. */
export interface Held {
  readonly corners: Corners;
  /** Indices of the corners not pinned to the curve by a thumb. */
  readonly free: readonly number[];
  /** Largest distance of a free corner from the curve. */
  readonly error: number;
  /** Where corners 0 and 1 are on the (s, t) torus. */
  readonly point?: TorusPoint;
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
      return this.onNodes(curve, { s: params[0], t: params[1] });
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
    const { corners, error } = this.lastFit;
    const point = { s: curve.nearest(corners[0]).s, t: curve.nearest(corners[1]).s };
    return { corners, free: [0, 1, 2, 3], error, point };
  }

  private readonly pad = new PadControl();
  private readonly dials = new DialControl();

  /**
   * The held square for the torus controls, from the two thumb slots in layout pixels: the pad or the dials move two
   * nodes along the curve, and the square stands on them. Null while no finger is down.
   */
  updateTorus(
    curve: ClosedCurve,
    control: 'pad' | 'dials',
    thumbs: readonly (Vec | null)[],
    layout: TorusLayout,
  ): Held | null {
    const point =
      control === 'pad' ? this.pad.update(thumbs, layout.map.size) : this.dials.update(thumbs, layout.dials);
    return point && this.onNodes(curve, point);
  }

  /** The square on two nodes, on whichever side of them fits the curve better. */
  private onNodes(curve: ClosedCurve, point: TorusPoint): Held {
    const sq = bestEdgeSquare(curve, point.s, point.t);
    return { corners: sq.corners, free: [2, 3], error: sq.error, point };
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
