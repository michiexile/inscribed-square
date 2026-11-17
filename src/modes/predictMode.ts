import { type Banner, predictBanner } from '../game/banner';
import { type Card, cardLayout } from '../game/cards';
import { FORECAST_PREVIEW } from '../game/feel';
import { type PastFrame, PredictGame, type Round, foldRound, lookBack, roundSearch } from '../game/predict';
import type { Corners } from '../geometry/square';
import { CURVE_SPAN } from '../input/scale';
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
const LINGER_MS = 1500;
/** The loop pauses this long on the round itself, in real seconds. */
const PREVIEW_HOLD = 1;
/** The fold plays at this fraction of real time, so the pair can be watched closing in. */
const REPLAY_SPEED = 0.5;
/** How long the flash where the pair vanished lasts, in milliseconds. */
const FLASH_MS = 700;
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
  /** Where and when (real milliseconds) the folding pair vanished, once it has. */
  flash: { at: Vec; time: number } | null;
}

interface Asking {
  readonly round: Round;
  readonly frames: readonly PastFrame[];
  readonly startedAt: number;
}

/**
 * Fold Forecast: a morphing curve plays up to a moment before a fold, over and over, and each of its squares gets a
 * lettered card. The player taps the card of a square they think folds away next; then the curve plays on through
 * the fold in slow motion, showing only their pick and the pair that folds, and the next round starts.
 */
export class PredictMode implements GameMode {
  readonly tapOnly = true;
  curve: Polygon;
  private readonly morph: MorphingCurve;
  private game: PredictGame;
  private asking: Asking | null = null;
  private playback: Playback | null = null;
  private cards: { id: number; card: Card }[] = [];

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
    if (this.game.phase === 'asking') return this.drawAsking(r, round, now);
    return this.drawPlayback(r, round, now);
  }

  private colourOf(round: Round, id: number): string {
    return COLOURS[round.squares.findIndex((q) => q.id === id) % COLOURS.length];
  }

  private letterOf(round: Round, id: number): string {
    return String.fromCharCode(65 + round.squares.findIndex((q) => q.id === id));
  }

  /** Loops the motion up to the round, with every square faint on the curve and clear on its own card. */
  private drawAsking(r: Renderer, round: Round, now: number): boolean {
    if (this.asking?.round !== round)
      this.asking = { round, frames: lookBack(this.morph, round, FORECAST_PREVIEW), startedAt: now };
    const { frames, startedAt } = this.asking;
    const loop = FORECAST_PREVIEW + PREVIEW_HOLD;
    const into = (((now - startedAt) / 1000) % loop) / FORECAST_PREVIEW;
    const frame = frames[Math.min(frames.length - 1, Math.round(into * (frames.length - 1)))];
    this.curve = this.morph.at(frame.time);
    r.curve(this.curve.vertices);
    r.ctx.globalAlpha = 0.5;
    for (const [id, corners] of frame.squares) r.outline(corners, this.colourOf(round, id), 1.5);
    r.ctx.globalAlpha = 1;
    this.layoutCards(r, round);
    for (const { id, card } of this.cards) {
      const corners = frame.squares.get(id);
      this.drawCard(r, card, round, id, corners ?? null, this.colourOf(round, id), 2);
    }
    return true;
  }

  /** Places the cards under the curve on a tall screen, else beside it. */
  private layoutCards(r: Renderer, round: Round): void {
    const screen = this.curve.vertices.map((v) => r.toScreen(v));
    const bottom = Math.max(...screen.map((p) => p.y)) + 12;
    const right = Math.max(...screen.map((p) => p.x)) + 12;
    const { width, height } = r.size;
    const n = round.squares.length;
    const below = cardLayout(n, { x: 0, y: bottom, width, height: height - bottom });
    const beside = cardLayout(n, { x: right, y: 0, width: width - right, height });
    const best = (below[0]?.size ?? 0) >= (beside[0]?.size ?? 0) ? below : beside;
    this.cards = best.map((card, i) => ({ id: round.squares[i].id, card }));
  }

  /** One square's card: the curve drawn small and faint, the square on it, and its letter. */
  private drawCard(
    r: Renderer,
    card: Card,
    round: Round,
    id: number,
    corners: Corners | null,
    border: string,
    width: number,
    dim = false,
  ): void {
    r.ctx.globalAlpha = dim ? 0.3 : 1;
    r.panel(card.x, card.y, card.size, border, width);
    const k = card.size / CURVE_SPAN;
    const c = { x: card.x + card.size / 2, y: card.y + card.size / 2 };
    const inCard = r.within((p) => ({ x: c.x + p.x * k, y: c.y - p.y * k }));
    inCard.curve(this.curve.vertices, 'rgba(224, 230, 235, 0.45)', 1);
    if (corners) inCard.outline(corners, this.colourOf(round, id), 2.5);
    r.label({ x: card.x + 14, y: card.y + 14 }, this.letterOf(round, id), this.colourOf(round, id));
    r.ctx.globalAlpha = 1;
  }

  /**
   * Plays the morph on from the round through the fold in slow motion, showing only the pick and the pair that folds,
   * then a flash where the pair vanished. Returns true while it needs frames.
   */
  private drawPlayback(r: Renderer, round: Round, now: number): boolean {
    if (!this.playback) {
      const tracker = new SquareTracker(
        (t) => this.morph.at(t),
        round.time,
        round.squares.map((q) => q.square),
      );
      this.playback = { tracker, startedAt: now, flash: null };
    }
    const playback = this.playback;
    const { tracker, startedAt } = playback;
    const end = round.foldAt + 0.3;
    const time = Math.min(end, round.time + (REPLAY_SPEED * (now - startedAt)) / 1000);
    // The tracker numbers squares from 1 in the order given, the same order as the round's squares.
    const idOf = (q: TrackedSquare) => round.squares[q.id - 1].id;
    const before = new Map(tracker.squares.map((q) => [idOf(q), q.square]));
    tracker.advance(time);
    const alive = new Set(tracker.squares.map(idOf));
    if (!playback.flash && round.dying.every((id) => !alive.has(id))) {
      const last = round.dying.map((id) => before.get(id)!.centre);
      playback.flash = { at: { x: (last[0].x + last[1].x) / 2, y: (last[0].y + last[1].y) / 2 }, time: now };
    }
    this.curve = this.morph.at(time);
    r.curve(this.curve.vertices);
    const picked = this.game.last?.id;
    const fade = Math.max(0, 1 - (now - startedAt) / 400);
    for (const q of tracker.squares) {
      const id = idOf(q);
      const shown = round.dying.includes(id) || id === picked;
      if (!shown && fade === 0) continue;
      r.ctx.globalAlpha = shown ? 1 : 0.6 * fade;
      r.outline(
        q.square.corners,
        this.colourOf(round, id),
        shown ? 3.5 : 1.5,
        id === picked && !round.dying.includes(id) ? [8, 6] : [],
      );
    }
    r.ctx.globalAlpha = 1;
    if (playback.flash) {
      const age = (now - playback.flash.time) / FLASH_MS;
      if (age < 1) {
        const at = r.toScreen(playback.flash.at);
        r.ctx.globalAlpha = 1 - age;
        r.ring(at, 12 + 60 * age, 1, '#ffffff');
        r.ctx.globalAlpha = 1;
      }
    }
    for (const { id, card } of this.cards) {
      const corners = tracker.squares.find((q) => idOf(q) === id)?.square.corners ?? null;
      const dying = round.dying.includes(id);
      const border = dying ? '#66dc78' : id === picked ? '#ff5a50' : '#2a333b';
      this.drawCard(
        r,
        card,
        round,
        id,
        corners,
        border,
        dying || id === picked ? 3 : 1,
        !dying && id !== picked,
      );
    }
    if (time < end) return true;
    const finishedAt = startedAt + ((end - round.time) / REPLAY_SPEED) * 1000;
    if (now - finishedAt < LINGER_MS) return true;
    this.playback = null;
    this.game.next();
    return true;
  }

  tap(p: Vec): void {
    if (this.game.phase !== 'asking') return;
    const hit = this.cards.find(
      ({ card }) => p.x >= card.x && p.x <= card.x + card.size && p.y >= card.y && p.y <= card.y + card.size,
    );
    if (!hit) return;
    this.game.answer(hit.id);
    navigator.vibrate?.(this.game.last?.right ? 40 : [30, 40, 30]);
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
    this.asking = null;
    this.playback = null;
  }

  released(): void {}

  dispose(): void {}
}
