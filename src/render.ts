import type { ClosedCurve } from './geometry/curve';
import type { Corners } from './geometry/square';
import type { Vec } from './geometry/vec';

export const THUMB_COLOURS = ['#4fc3f7', '#ffb74d'];

/** Drawing helpers over a 2D canvas context, in curve coordinates mapped to CSS pixels. */
export class Renderer {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly toScreen: (p: Vec) => Vec,
    /** Corner distance below which a corner shows as on the curve (green). */
    readonly tolerance: number,
  ) {}

  /** Green within tolerance, through yellow, to red at eight times the tolerance. */
  closeness(d: number): string {
    const t = Math.min(1, Math.max(0, (d - this.tolerance) / (7 * this.tolerance)));
    return `hsl(${Math.round(120 * (1 - t))}, 85%, 55%)`;
  }

  path(points: readonly Vec[]): void {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach((v, i) => {
      const p = this.toScreen(v);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
  }

  /** A dot at a point already in screen coordinates. */
  dot(p: Vec, r: number, colour: string): void {
    this.ctx.fillStyle = colour;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  curve(vertices: readonly Vec[]): void {
    this.path(vertices);
    this.ctx.strokeStyle = '#e0e6eb';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  fill(corners: Corners, colour: string): void {
    this.path(corners);
    this.ctx.fillStyle = colour;
    this.ctx.fill();
  }

  outline(corners: Corners, colour: string, width: number, dash: number[] = []): void {
    this.path(corners);
    this.ctx.setLineDash(dash);
    this.ctx.strokeStyle = colour;
    this.ctx.lineWidth = width;
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  /** An inscribed square the player is on: filled, outlined, with its corners marked. */
  snapped(corners: Corners, colour: string, fillAlpha: number): void {
    this.path(corners);
    this.ctx.fillStyle = colour.replace('hsl(', 'hsla(').replace(')', `, ${fillAlpha})`);
    this.ctx.fill();
    this.outline(corners, colour, 3);
    for (const c of corners) this.dot(this.toScreen(c), 6, colour);
  }

  /** A ring around a screen point, filled to `progress` (0 to 1) clockwise from the top. */
  ring(centre: Vec, radius: number, progress: number, colour: string): void {
    this.ctx.strokeStyle = colour;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(centre.x, centre.y, radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress);
    this.ctx.stroke();
  }

  /**
   * A held square not on any inscribed square: its outline coloured by error, and its free corners coloured by
   * distance and tethered to their nearest curve points.
   */
  loose(curve: ClosedCurve, corners: Corners, free: readonly number[], error: number): void {
    const ctx = this.ctx;
    this.outline(corners, this.closeness(error), 2);
    for (const k of free) {
      const n = curve.nearest(corners[k]);
      const p = this.toScreen(corners[k]);
      const q = this.toScreen(n.point);
      ctx.strokeStyle = this.closeness(n.distance);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.setLineDash([]);
      this.dot(p, 6, this.closeness(n.distance));
    }
  }

  /** A thumb's ring, and for the two-corners control a tether to the corner it drives. */
  thumb(at: Vec, index: number, corner?: Vec): void {
    const ctx = this.ctx;
    const colour = THUMB_COLOURS[index];
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 36, 0, 2 * Math.PI);
    ctx.stroke();
    if (!corner) {
      this.dot(at, 4, colour);
      return;
    }
    const c = this.toScreen(corner);
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    ctx.setLineDash([]);
    this.dot(c, 7, colour);
  }
}
