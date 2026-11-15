import { type Banner, predictBanner } from '../game/banner';
import { PredictGame, type Round, foldRound, roundSearch } from '../game/predict';
import { MorphingCurve } from '../geometry/morph';
import type { Polygon } from '../geometry/polygon';
import { SquareTracker, type TrackedSquare } from '../geometry/tracker';
import type { Vec } from '../geometry/vec';
import type { Renderer } from '../render';
import type { GameMode } from './mode';

/** How many rounds a random curve plays, and how many must be right. */
const RANDOM_ROUNDS = 5;
const RANDOM_GOAL = 3;
const RANDOM_WARNING = 2;
/** How long the result of a round stays after its fold has played out, in milliseconds. */
const LINGER_MS = 1200;
/** How close a tap must be to a letter to pick it, in layout pixels. */
const TAP_RADIUS = 32;
/** Letters closer than this are pushed apart, in layout pixels. */
const BADGE_GAP = 30;
const COLOURS = [
  '#4fc3f7',
  '#ffb74d',
  '#ba68c8',
  '#81c784',
  '#f06292',
  '#fff176',
  '#4db6ac',
  '#a1887f',
  '#90a4ae',
];

interface Playback {
  readonly tracker: SquareTracker;
  readonly startedAt: number;
}

/**
 * Fold Forecast: a morphing curve stops just before a fold, with every square lettered. The player taps the letter of
 * a square they think folds away next; then the curve plays on through the fold, and the next round starts.
 */
export class PredictMode implements GameMode {
  readonly tapOnly = true;
  curve: Polygon;
  private readonly morph: MorphingCurve;
  private game: PredictGame;
  private playback: Playback | null = null;
  private badges: { id: number; at: Vec; corner: Vec }[] = [];

  constructor(
    readonly seed: number,
    private readonly warning: number | undefined,
    private readonly times: readonly number[] | undefined,
    private readonly goal: number | undefined,
    private readonly label: string,
  ) {
    this.morph = new MorphingCurve(seed);
    this.game = this.newGame();
    this.curve = this.morph.at(this.game.round!.time);
  }

  private newGame(): PredictGame {
    const warning = this.warning ?? RANDOM_WARNING;
    const times = this.times;
    if (times) {
      return new PredictGame(times.length, (i) => foldRound(this.morph, times[i], warning)!, this.goal ?? 0);
    }
    const search = roundSearch(this.morph, warning, this.seed);
    return new PredictGame(RANDOM_ROUNDS, () => search(), this.goal ?? RANDOM_GOAL);
  }

  advance(): void {}

  frame(r: Renderer, _held: unknown, now: number): boolean {
    const round = this.game.round;
    if (!round) {
      r.curve(this.curve.vertices);
      return false;
    }
    if (this.game.phase === 'asking') {
      this.curve = this.morph.at(round.time);
      r.curve(this.curve.vertices);
      this.drawAsking(r, round);
      return false;
    }
    return this.drawPlayback(r, round, now);
  }

  private colourOf(round: Round, id: number): string {
    return COLOURS[round.squares.findIndex((q) => q.id === id) % COLOURS.length];
  }

  private drawAsking(r: Renderer, round: Round): void {
    this.badges = [];
    for (const q of round.squares) {
      const colour = this.colourOf(round, q.id);
      r.outline(q.square.corners, colour, 2);
      const top = q.square.corners.map((p) => r.toScreen(p)).reduce((a, b) => (b.y < a.y ? b : a));
      const at = { x: top.x, y: top.y - 20 };
      while (this.badges.some((b) => Math.hypot(b.at.x - at.x, b.at.y - at.y) < BADGE_GAP)) at.x += BADGE_GAP;
      this.badges.push({ id: q.id, at, corner: top });
    }
    // A letter pushed aside from its corner keeps a thin line back to it, so it still points at its square.
    this.badges.forEach((b, i) =>
      r.badge(b.at, String.fromCharCode(65 + i), this.colourOf(round, b.id), b.corner),
    );
  }

  /** Plays the morph on from the frozen time through the fold, in real time. Returns true while it needs frames. */
  private drawPlayback(r: Renderer, round: Round, now: number): boolean {
    if (!this.playback) {
      const tracker = new SquareTracker(
        (t) => this.morph.at(t),
        round.time,
        round.squares.map((q) => q.square),
      );
      this.playback = { tracker, startedAt: now };
    }
    const { tracker, startedAt } = this.playback;
    const end = round.foldAt + 0.4;
    const time = Math.min(end, round.time + (now - startedAt) / 1000);
    // The tracker numbers squares from 1 in the order given, the same order as the round's squares.
    const idOf = (q: TrackedSquare) => round.squares[q.id - 1].id;
    tracker.advance(time);
    this.curve = this.morph.at(time);
    r.curve(this.curve.vertices);
    const picked = this.game.last?.id;
    for (const q of tracker.squares) {
      const id = idOf(q);
      const dying = round.dying.includes(id);
      const colour = dying ? '#ff5a50' : this.colourOf(round, id);
      r.outline(q.square.corners, colour, id === picked ? 5 : 2, dying ? [] : [6, 4]);
    }
    if (time < end) return true;
    const finishedAt = startedAt + (end - round.time) * 1000;
    if (now - finishedAt < LINGER_MS) return true;
    this.playback = null;
    this.game.next();
    return true;
  }

  tap(p: Vec): void {
    if (this.game.phase !== 'asking') return;
    let best: { id: number; d: number } | null = null;
    for (const b of this.badges) {
      const d = Math.hypot(b.at.x - p.x, b.at.y - p.y);
      if (d < TAP_RADIUS && (!best || d < best.d)) best = { id: b.id, d };
    }
    if (best) {
      this.game.answer(best.id);
      navigator.vibrate?.(this.game.last?.right ? 40 : [30, 40, 30]);
    }
  }

  hud(): string {
    const n = Math.min(this.game.index + 1, this.game.length);
    return `Round ${n} of ${this.game.length} · ${this.game.score} right · ${this.label}`;
  }

  started(): boolean {
    return this.game.index > 0 || this.game.phase !== 'asking';
  }

  cleared(): boolean {
    return this.game.cleared;
  }

  banner(): Banner | null {
    return predictBanner(this.game);
  }

  restart(): void {
    this.game = this.newGame();
    this.playback = null;
  }

  released(): void {}

  dispose(): void {}
}
