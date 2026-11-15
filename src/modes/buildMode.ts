import { type Banner, buildBanner } from '../game/banner';
import { type BuildCount, buildCount } from '../game/build';
import type { CountRequest, CountResult } from '../game/countWorker';
import { EditTracker, pullToward } from '../game/steer';
import { EditableCurve } from '../geometry/editable';
import type { Polygon } from '../geometry/polygon';
import { findSquares } from '../geometry/solver';
import type { Vec } from '../geometry/vec';
import type { Renderer } from '../render';
import type { GameMode } from './mode';

/** Shortest interval between background counts while dragging, in milliseconds. */
const COUNT_INTERVAL_MS = 200;

/**
 * Build a Curve: the player drags the curve toward their finger to reshape it. A worker counts the squares while they
 * drag, and a full solve counts them when the finger lifts; the level is won when that count is the target and
 * settled.
 */
export class BuildMode implements GameMode {
  curve: Polygon;
  private edit: EditTracker;
  private finger: Vec | null = null;
  private result: BuildCount;
  private readonly start: EditableCurve;
  readonly target: number;
  private readonly worker: Worker | null;
  private sent = 0;
  private busy = false;
  private lastSent = -Infinity;
  /** The latest background count while dragging, or null when none is newer than the last full count. */
  private live: BuildCount | null = null;

  constructor(
    seed: number,
    target: number | undefined,
    private readonly tolerance: number,
    private readonly label: string,
  ) {
    this.start = EditableCurve.fromSeed(seed);
    this.edit = new EditTracker(this.start);
    this.curve = this.start.polygon();
    const squares = this.edit.tracker.squares.map((q) => q.square);
    this.target = target ?? squares.length + 2;
    this.result = buildCount(this.curve, squares, this.target, tolerance);
    try {
      this.worker = new Worker(new URL('../game/countWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<CountResult>) => this.counted(e.data);
    } catch {
      this.worker = null;
    }
  }

  private counted(result: CountResult): void {
    this.busy = false;
    if (result.id !== this.sent || this.finger === null) return;
    this.live = buildCount(this.curve, result.squares, this.target, this.tolerance);
  }

  private requestCount(now: number): void {
    if (!this.worker || this.busy || now - this.lastSent < COUNT_INTERVAL_MS) return;
    this.busy = true;
    this.lastSent = now;
    const request: CountRequest = { id: ++this.sent, harmonics: this.edit.curve.harmonics };
    this.worker.postMessage(request);
  }

  pointer(p: Vec | null): void {
    this.finger = p;
  }

  advance(now: number): void {
    const p = this.finger;
    if (!p || this.result.met) return;
    if (!pullToward(this.edit, p)) return;
    this.curve = this.edit.curve.polygon();
    this.requestCount(now);
  }

  frame(r: Renderer): boolean {
    r.curve(this.curve.vertices);
    const colour = this.result.met ? 'rgba(102, 220, 120, 0.8)' : 'rgba(200, 160, 255, 0.6)';
    for (const q of this.edit.tracker.squares)
      r.outline(q.square.corners, colour, 2, this.result.met ? [] : [6, 4]);
    return this.finger !== null;
  }

  /** Counts the squares with a full solve and follows them from here. */
  released(): void {
    this.finger = null;
    this.live = null;
    const squares = findSquares(this.curve);
    this.edit = new EditTracker(this.edit.curve, squares);
    this.result = buildCount(this.curve, squares, this.target, this.tolerance);
  }

  hud(): string {
    const shown = this.live ?? this.result;
    const unsure = shown.settled ? '' : ' (two are about to merge)';
    const lift = this.live?.met ? ' · lift to check' : '';
    return `${shown.count} squares${unsure} · make ${this.target}${lift} · ${this.label}`;
  }

  started(): boolean {
    return this.edit.curve !== this.start;
  }

  cleared(): boolean {
    return this.result.met;
  }

  banner(): Banner | null {
    return buildBanner(this.result);
  }

  restart(): void {
    this.edit = new EditTracker(this.start);
    this.curve = this.start.polygon();
    this.result = buildCount(this.curve, findSquares(this.curve), this.target, this.tolerance);
  }

  dispose(): void {
    this.worker?.terminate();
  }
}
