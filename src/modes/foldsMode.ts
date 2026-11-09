import { type Banner, foldsBanner } from '../game/banner';
import type { Held } from '../game/control';
import { AvoidFolds, type FoldsState } from '../game/folds';
import type { SolveRequest, SolveResult } from '../game/solveWorker';
import { MorphingCurve } from '../geometry/morph';
import type { Polygon } from '../geometry/polygon';
import { type InscribedSquare, findSquares } from '../geometry/solver';
import { SquareTracker } from '../geometry/tracker';
import type { Renderer } from '../render';
import type { GameMode } from './mode';

/** Two live squares closer than this (centre or side, curve units) are drawn as a fold warning. */
const WARN_GAP = 0.3;
/** Shortest interval between background solves, in milliseconds. */
const SOLVE_INTERVAL_MS = 150;
/** How long a square that just folded away stays on screen, fading out, in milliseconds. */
const FADE_MS = 600;

/**
 * Avoid Folds: the curve morphs; the player latches onto an inscribed square and scores while they stay on it. The
 * tracker follows every square each frame, and a worker's full solves add squares born at folds.
 */
export class FoldsMode implements GameMode {
  curve: Polygon;
  private readonly morph: MorphingCurve;
  private readonly tracker: SquareTracker;
  private game: AvoidFolds;
  private state: FoldsState = { phase: 'searching', square: null, graceLeft: 0 };
  private readonly worker: Worker | null;
  private solving = false;
  private lastSolve = -Infinity;
  /** Morph time in seconds, and the wall clock time of the last frame. */
  private time = 0;
  private last: number | null = null;
  /** Curves by morph time, so the tracker's sub-steps and the frame share one build. */
  private cache = new Map<number, Polygon>();
  private fading: { square: InscribedSquare; at: number }[] = [];
  private best = 0;

  constructor(
    readonly seed: number,
    private readonly tolerance: number,
    private readonly grace: number,
    private readonly label: string,
  ) {
    this.morph = new MorphingCurve(seed);
    this.curve = this.curveAt(0);
    this.tracker = new SquareTracker((t) => this.curveAt(t), 0, findSquares(this.curve));
    this.game = new AvoidFolds(tolerance, grace);
    try {
      this.worker = new Worker(new URL('../game/solveWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<SolveResult>) => this.adopt(e.data);
    } catch {
      this.worker = null;
    }
  }

  private curveAt(time: number): Polygon {
    let c = this.cache.get(time);
    if (!c) {
      c = this.morph.at(time);
      if (this.cache.size > 64) this.cache.clear();
      this.cache.set(time, c);
    }
    return c;
  }

  advance(now: number): void {
    // A long gap (a hidden tab, a stalled frame) advances the morph by at most 0.1 s, so the tracker never has to
    // bridge a jump it would need thousands of steps for.
    this.time += Math.min(0.1, Math.max(0, now - (this.last ?? now)) / 1000);
    this.last = now;
    this.curve = this.curveAt(this.time);
  }

  private adopt(result: SolveResult): void {
    this.solving = false;
    if (result.time <= this.tracker.time) this.tracker.adopt(result.squares, result.time);
  }

  private requestSolve(now: number): void {
    if (!this.worker || this.solving || now - this.lastSolve < SOLVE_INTERVAL_MS) return;
    this.solving = true;
    this.lastSolve = now;
    const request: SolveRequest = { seed: this.seed, time: this.time };
    this.worker.postMessage(request);
  }

  frame(r: Renderer, held: Held | null, now: number, reveal: boolean): boolean {
    const died = this.tracker.advance(this.time);
    this.requestSolve(now);
    const before = this.game.latched;
    this.state = this.game.update(held?.corners ?? null, held?.error ?? 0, this.tracker.squares, died, now);
    this.best = Math.max(this.best, this.game.score);
    for (const d of died) if (d.id === before) this.fading.push({ square: d.square, at: now });
    if (before !== null && this.game.latched === null) navigator.vibrate?.([30, 40, 30]);
    if (before === null && this.game.latched !== null) navigator.vibrate?.(40);

    r.curve(this.curve.vertices);
    if (reveal) {
      for (const q of this.tracker.squares)
        r.outline(q.square.corners, 'rgba(200, 160, 255, 0.7)', 1.5, [6, 6]);
    }
    this.fading = this.fading.filter((f) => now - f.at < FADE_MS);
    for (const f of this.fading) {
      r.outline(f.square.corners, `rgba(255, 90, 80, ${1 - (now - f.at) / FADE_MS})`, 3);
    }

    const on = this.state.square;
    if (on) {
      // A nearby partner means a fold is coming: the square shifts from green to red as the pair closes, and the
      // partner shows faintly so the player can see what is closing in.
      const danger = on.gap < WARN_GAP ? 1 - on.gap / WARN_GAP : 0;
      const colour = `hsl(${Math.round(120 * (1 - danger))}, 85%, 55%)`;
      const partner = this.tracker.squares.find((q) => q.id === on.partner);
      if (danger > 0 && partner) {
        r.outline(partner.square.corners, `rgba(255, 140, 60, ${0.2 + 0.6 * danger})`, 2, [4, 4]);
      }
      r.snapped(on.square.corners, colour, 0.15 + 0.2 * danger);
    } else if (held) {
      r.loose(this.curve, held.corners, held.free, held.error);
    }
    if (this.state.phase === 'lost') {
      const c = r.toScreen({ x: 0, y: 0 });
      r.ring(c, 30, this.state.graceLeft / this.grace, 'rgba(255, 90, 80, 0.9)');
    }
    return true;
  }

  hud(): string {
    const score = `${this.game.score.toFixed(1)} s held · ${this.game.saves} saved`;
    const best = this.best > 0 ? ` · best ${this.best.toFixed(1)} s` : '';
    const where = ` · ${this.label} · ${this.tracker.squares.length} squares`;
    switch (this.state.phase) {
      case 'searching':
        return `Find a square to start${where}`;
      case 'holding':
        return `${score}${where}`;
      case 'lost':
        return `${(this.state.graceLeft / 1000).toFixed(1)} s to find another · ${score}`;
      case 'over':
        return `Round over: ${score}${best}`;
    }
  }

  banner(): Banner | null {
    return foldsBanner(this.state, this.game.score, this.game.saves, this.best);
  }

  restart(): void {
    this.game = new AvoidFolds(this.tolerance, this.grace);
    this.state = { phase: 'searching', square: null, graceLeft: 0 };
  }

  released(): void {}

  dispose(): void {
    this.worker?.terminate();
  }
}
