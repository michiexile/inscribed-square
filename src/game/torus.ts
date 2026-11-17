import type { InscribedSquare } from '../geometry/solver';
import type { Vec } from '../geometry/vec';
import type { Area } from './cards';
import type { Control } from './control';

/** A point on the (s, t) torus: the curve parameters of the two nodes the player holds, each in [0, 1). */
export interface TorusPoint {
  readonly s: number;
  readonly t: number;
}

/** A dial in layout pixels. */
export interface Dial {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Where the torus map and any dials go, in layout pixels. */
export interface TorusLayout {
  readonly map: { readonly x: number; readonly y: number; readonly size: number };
  readonly dials: readonly Dial[];
}

/** Where the nodes start: opposite each other on the curve. */
const START: TorusPoint = { s: 0, t: 0.5 };
const MARGIN = 16;
/** A finger landing this far out from a dial's centre, in radii, still takes hold of it. */
const DIAL_REACH = 1.3;
/** The torus map beside the drag controls, in layout pixels. */
const SMALL_MAP = 110;

const wrap = (x: number): number => x - Math.floor(x);

/**
 * The eight points of the torus where `square` can be held: any two neighbouring corners as the two nodes, in either
 * order, since the held square is the better of the squares on either side of the two nodes.
 */
export function torusPoints(square: InscribedSquare): TorusPoint[] {
  const p = square.params;
  const points: TorusPoint[] = [];
  for (let i = 0; i < 4; i++) {
    const [a, b] = [p[i], p[(i + 1) % 4]];
    points.push({ s: a, t: b }, { s: b, t: a });
  }
  return points;
}

/**
 * Lays out the torus map in `area`, the space under (or beside) the curve: as big as fits for the pad control,
 * with two dials under it (or between them, if that fits a bigger map) for the dial control, and small in the corner for the other controls.
 */
export function torusLayout(control: Control, area: Area): TorusLayout {
  const bottom = area.y + area.height - MARGIN;
  if (control === 'pad') {
    const size = Math.max(0, Math.min(area.width - 2 * MARGIN, area.height - 2 * MARGIN));
    return { map: { x: area.x + (area.width - size) / 2, y: bottom - size, size }, dials: [] };
  }
  if (control === 'dials') {
    const radius = Math.max(0, Math.min((area.width - 4 * MARGIN) / 5, (area.height - 2 * MARGIN) / 2));
    const y = bottom - radius;
    const dials = [
      { x: area.x + MARGIN + radius, y, radius },
      { x: area.x + area.width - MARGIN - radius, y, radius },
    ];
    // The map goes above the dials if there is room for a bigger one there, else between them.
    const between = Math.max(0, Math.min(area.width - 4 * MARGIN - 4 * radius, 2 * radius));
    const above = Math.max(0, Math.min(area.width - 2 * MARGIN, area.height - 2 * radius - 3 * MARGIN));
    const map =
      above > between
        ? { x: area.x + (area.width - above) / 2, y: y - radius - MARGIN - above, size: above }
        : { x: area.x + (area.width - between) / 2, y: y + radius - between, size: between };
    return { map, dials };
  }
  const size = Math.max(0, Math.min(SMALL_MAP, area.height - 2 * MARGIN));
  return { map: { x: area.x + area.width - MARGIN - size, y: bottom - size, size }, dials: [] };
}

/**
 * The torus pad: one finger anywhere moves the held point on the torus like a trackpad, one map width being once
 * round the curve, wrapping at the edges. The point stays where it was left when the finger lifts.
 */
export class PadControl {
  private point: TorusPoint = START;
  private finger: Vec | null = null;

  /** The held point from the two thumb slots, in layout pixels; null while no finger is down. */
  update(thumbs: readonly (Vec | null)[], mapSize: number): TorusPoint | null {
    const f = thumbs[0] ?? thumbs[1];
    if (!f) {
      this.finger = null;
      return null;
    }
    if (this.finger && mapSize > 0) {
      this.point = {
        s: wrap(this.point.s + (f.x - this.finger.x) / mapSize),
        t: wrap(this.point.t - (f.y - this.finger.y) / mapSize),
      };
    }
    this.finger = f;
    return this.point;
  }
}

/**
 * Two dials, one per node: a finger that lands on a dial turns it like a knob, a full turn moving its node once
 * round the curve, anticlockwise forward. Either thumb can turn either dial, one at a time or both at once.
 */
export class DialControl {
  private point: TorusPoint = START;
  /** Per thumb slot: the dial it took hold of (or null for none), and its angle there on the previous frame. */
  private grips: ({ dial: number | null; angle: number } | null)[] = [null, null];

  /** The held point from the two thumb slots, in layout pixels; null while no finger is down. */
  update(thumbs: readonly (Vec | null)[], dials: readonly Dial[]): TorusPoint | null {
    let next = this.point;
    thumbs.forEach((f, slot) => {
      if (!f) {
        this.grips[slot] = null;
        return;
      }
      const grip = this.grips[slot];
      if (!grip) {
        const dial = dials.findIndex((d) => Math.hypot(f.x - d.x, f.y - d.y) <= DIAL_REACH * d.radius);
        const d = dials[dial];
        this.grips[slot] = { dial: dial < 0 ? null : dial, angle: d ? angleAt(d, f) : 0 };
        return;
      }
      if (grip.dial === null) return;
      const angle = angleAt(dials[grip.dial], f);
      let turn = (angle - grip.angle) / (2 * Math.PI);
      turn -= Math.round(turn);
      grip.angle = angle;
      next = grip.dial === 0 ? { s: wrap(next.s + turn), t: next.t } : { s: next.s, t: wrap(next.t + turn) };
    });
    this.point = next;
    return thumbs.some((f) => f) ? this.point : null;
  }
}

/** The angle of a finger around a dial, anticlockwise on screen. */
const angleAt = (d: Dial, f: Vec): number => Math.atan2(-(f.y - d.y), f.x - d.x);
