import { type Banner, steerBanner } from '../game/banner';
import { EditTracker, Steer, pullToward, steerPick } from '../game/steer';
import { EditableCurve } from '../geometry/editable';
import type { Polygon } from '../geometry/polygon';
import { findSquares } from '../geometry/solver';
import type { Vec } from '../geometry/vec';
import type { Renderer } from '../render';
import type { GameMode } from './mode';

/**
 * Steer the Curve: the player drags the curve toward their finger to reshape it. The tracker follows every square
 * through each change; the level is won when the red target squares have folded away and the gold keeper has not.
 */
export class SteerMode implements GameMode {
  curve: Polygon;
  private edit!: EditTracker;
  private steer!: Steer;
  private finger: Vec | null = null;
  private readonly start: EditableCurve;
  private readonly keeperIndex: number;
  private readonly targetIndices: readonly number[];

  constructor(
    seed: number,
    keeper: number | undefined,
    targets: readonly number[] | undefined,
    private readonly label: string,
  ) {
    this.start = EditableCurve.fromSeed(seed);
    const squares = findSquares(this.start.polygon());
    const pick = keeper === undefined || !targets ? steerPick(squares) : { keeper, targets: [...targets] };
    this.keeperIndex = pick?.keeper ?? 0;
    this.targetIndices = pick?.targets ?? [];
    this.curve = this.start.polygon();
    this.reset();
  }

  private reset(): void {
    this.edit = new EditTracker(this.start);
    this.curve = this.start.polygon();
    // The tracker numbers the starting squares from 1 in solver order.
    this.steer = new Steer(
      this.keeperIndex + 1,
      this.targetIndices.map((t) => t + 1),
    );
  }

  pointer(p: Vec | null): void {
    this.finger = p;
  }

  advance(): void {
    const p = this.finger;
    if (!p || this.steer.state !== 'playing') return;
    const died = pullToward(this.edit, p);
    if (!died) return;
    this.steer.update(died);
    this.curve = this.edit.curve.polygon();
  }

  frame(r: Renderer): boolean {
    r.curve(this.curve.vertices);
    for (const q of this.edit.tracker.squares) {
      if (q.id === this.steer.keeper) r.snapped(q.square.corners, 'hsl(45, 90%, 55%)', 0.2);
      else if (this.steer.targets.includes(q.id)) r.outline(q.square.corners, '#ff5a50', 3);
      else r.outline(q.square.corners, 'rgba(200, 210, 220, 0.35)', 1.5, [5, 5]);
    }
    return this.finger !== null;
  }

  hud(): string {
    const left = this.steer.left;
    return `${left} red square${left === 1 ? '' : 's'} left · ${this.label}`;
  }

  started(): boolean {
    return this.edit.tracker.time > 0;
  }

  cleared(): boolean {
    return this.steer.state === 'won';
  }

  banner(): Banner | null {
    return steerBanner(this.steer.state);
  }

  restart(): void {
    this.reset();
  }

  released(): void {
    this.finger = null;
  }

  dispose(): void {}
}
