import type { ClosedCurve } from './geometry/curve';
import type { Corners } from './geometry/square';
import type { Vec } from './geometry/vec';
import type { Dial, TorusLayout, TorusPoint } from './game/torus';

export const THUMB_COLOURS = ['#4fc3f7', '#ffb74d'];

/** Drawing helpers over a 2D canvas context, in curve coordinates mapped to CSS pixels. */
export class Renderer {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly toScreen: (p: Vec) => Vec,
    /** Corner distance below which a corner shows as on the curve (green). */
    readonly tolerance: number,
    /** The canvas size in layout pixels. */
    readonly size: { readonly width: number; readonly height: number } = { width: 0, height: 0 },
  ) {}

  /** The same canvas with another mapping from curve coordinates, such as into a card. */
  within(toScreen: (p: Vec) => Vec): Renderer {
    return new Renderer(this.ctx, toScreen, this.tolerance, this.size);
  }

  /** A card's background and border, in layout pixels. */
  panel(x: number, y: number, size: number, border: string, width: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 10);
    ctx.fillStyle = '#161d23';
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = width;
    ctx.stroke();
  }

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

  curve(vertices: readonly Vec[], colour = '#e0e6eb', width = 2): void {
    this.path(vertices);
    this.ctx.strokeStyle = colour;
    this.ctx.lineWidth = width;
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
   * A square's outline drawn as a fuse: faint all round, and solid for `fraction` (0 to 1) of the way round from the
   * first corner, so how much is left reads at a glance, even where squares overlap.
   */
  fuse(corners: Corners, fraction: number, colour: string, width: number): void {
    this.outline(corners, colour.replace('hsl(', 'hsla(').replace(')', ', 0.3)'), 1.5, [4, 4]);
    const pts = [...corners, corners[0]].map((c) => this.toScreen(c));
    let left = 4 * fraction;
    const ctx = this.ctx;
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < 4 && left > 0; i++, left--) {
      const f = Math.min(1, left);
      ctx.lineTo(pts[i].x + (pts[i + 1].x - pts[i].x) * f, pts[i].y + (pts[i + 1].y - pts[i].y) * f);
    }
    ctx.stroke();
  }

  /** A round letter badge at a screen point, for picking a square by tapping, with a thin line to `from`. */
  badge(at: Vec, letter: string, colour: string, from: Vec): void {
    this.ctx.strokeStyle = colour;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(at.x, at.y);
    this.ctx.stroke();
    this.dot(at, 13, '#101418');
    this.ctx.strokeStyle = colour;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(at.x, at.y, 13, 0, 2 * Math.PI);
    this.ctx.stroke();
    this.label(at, letter, colour);
  }

  /** Centred text at a screen point. */
  label(at: Vec, text: string, colour: string): void {
    this.ctx.font = '600 14px system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = colour;
    this.ctx.fillText(text, at.x, at.y);
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

  /** A thumb's ring and a tether to the point it drives (a corner, or the square's centre), in screen coordinates. */
  thumb(at: Vec, index: number, target: Vec): void {
    const ctx = this.ctx;
    const colour = THUMB_COLOURS[index];
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 36, 0, 2 * Math.PI);
    ctx.stroke();
    const c = target;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    ctx.setLineDash([]);
    this.dot(c, 7, colour);
  }

  /**
   * The (s, t) torus map: s across in the first node's colour, t up in the second's. The dashed diagonal is where the
   * two nodes coincide; `marks` are points of found squares, and `point` is the player's, with its mirror image.
   */
  torusMap(
    map: TorusLayout['map'],
    point: TorusPoint | null,
    marks: readonly TorusPoint[],
    mark: string,
  ): void {
    const { x, y, size } = map;
    if (size <= 0) return;
    const ctx = this.ctx;
    const at = (p: TorusPoint): Vec => ({ x: x + p.s * size, y: y + (1 - p.t) * size });
    ctx.fillStyle = '#161d23';
    ctx.fillRect(x, y, size, size);
    ctx.lineWidth = 2;
    ctx.strokeStyle = THUMB_COLOURS[0];
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x + size, y + size);
    ctx.stroke();
    ctx.strokeStyle = THUMB_COLOURS[1];
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.strokeStyle = '#2a333b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x + size, y);
    ctx.stroke();
    ctx.setLineDash([]);
    const r = Math.max(2.5, size / 60);
    for (const m of marks) this.dot(at(m), r, mark);
    if (point) {
      ctx.globalAlpha = 0.35;
      this.dot(at({ s: point.t, t: point.s }), r + 1, '#ffffff');
      ctx.globalAlpha = 1;
      this.dot(at(point), r + 2, '#ffffff');
    }
  }

  /** A dial for one node: a ring, and a hand pointing at the node's parameter, anticlockwise from the right. */
  dial(d: Dial, param: number, colour: string, active: boolean): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#161d23';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = colour;
    ctx.lineWidth = active ? 4 : 2;
    ctx.stroke();
    const a = 2 * Math.PI * param;
    const tip = { x: d.x + 0.8 * d.radius * Math.cos(a), y: d.y - 0.8 * d.radius * Math.sin(a) };
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    this.dot(tip, 6, colour);
  }
}
