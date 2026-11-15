import { describe, expect, it } from 'vitest';
import { MorphingCurve } from '../geometry/morph';
import { PredictGame, type Round, foldRound, roundSearch } from './predict';

// Morph seed 1 (tracker.test.ts): 7 squares at 15 s, a pair folds away between 16 s and 16.25 s, and no square dies
// between 9 s and 14 s.
const morph = new MorphingCurve(1);

describe('foldRound', () => {
  it('freezes the curve before a fold and names the pair that folds away', () => {
    const round = foldRound(morph, 15, 1)!;
    expect(round).not.toBeNull();
    expect(round.squares.length).toBeGreaterThanOrEqual(4);
    expect(round.dying).toHaveLength(2);
    for (const id of round.dying) expect(round.squares.map((q) => q.id)).toContain(id);
    expect(round.foldAt).toBeGreaterThan(16);
    expect(round.foldAt).toBeLessThan(16.3);
  });

  it('finds no round where nothing folds soon after', () => {
    expect(foldRound(morph, 9, 1.5)).toBeNull();
  });

  it('finds no round where the fold comes much sooner than the warning time', () => {
    // A question asked a moment before the fold would show the pair already on top of each other.
    expect(foldRound(morph, 15.95, 2)).toBeNull();
  });
});

const round = (dying: number[]): Round => ({ time: 0, squares: [], dying, foldAt: 1 });
const of = (rounds: Round[], goal: number) => new PredictGame(rounds.length, (i) => rounds[i], goal);
const game3 = () => of([round([1, 2]), round([3, 4]), round([5, 6])], 2);

describe('PredictGame rounds', () => {
  it('builds each round only when it is reached, once', () => {
    const built: number[] = [];
    const game = new PredictGame(3, (i) => (built.push(i), round([1, 2])), 1);
    expect(built).toEqual([]);
    void game.round;
    void game.round;
    expect(built).toEqual([0]);
    game.answer(1);
    game.next();
    void game.round;
    expect(built).toEqual([0, 1]);
  });
});

describe('PredictGame', () => {
  it('counts an answer right if it names either square of the folding pair', () => {
    const game = game3();
    expect(game.answer(2)).toBe(true);
    game.next();
    expect(game.answer(5)).toBe(false);
    game.next();
    expect(game.answer(6)).toBe(true);
    expect(game.score).toBe(2);
  });

  it('takes one answer per round', () => {
    const game = of([round([1, 2]), round([3, 4])], 1);
    game.answer(9);
    expect(game.answer(1)).toBe(false);
    expect(game.score).toBe(0);
  });

  it('clears the level only when the last round is done with enough right', () => {
    const game = of([round([1, 2]), round([3, 4])], 2);
    game.answer(1);
    expect(game.cleared).toBe(false);
    game.next();
    expect(game.phase).toBe('asking');
    game.answer(3);
    game.next();
    expect(game.phase).toBe('done');
    expect(game.cleared).toBe(true);
  });

  it('ends without clearing when too few answers were right', () => {
    const game = of([round([1, 2]), round([3, 4])], 2);
    game.answer(1);
    game.next();
    game.answer(9);
    game.next();
    expect(game.phase).toBe('done');
    expect(game.cleared).toBe(false);
  });
});

describe('roundSearch', () => {
  it('finds valid rounds in order of time, the same ones for the same seed', () => {
    const a = roundSearch(morph, 1.5, 42);
    const b = roundSearch(morph, 1.5, 42);
    const rounds = [a(), a(), a()];
    expect(rounds.map((r) => r.time)).toEqual([b(), b(), b()].map((r) => r.time));
    for (let i = 1; i < rounds.length; i++) expect(rounds[i].time).toBeGreaterThan(rounds[i - 1].time);
    for (const r of rounds) expect(foldRound(morph, r.time, 1.5)).not.toBeNull();
  });
});
