import { describe, expect, it } from 'vitest';
import { MorphingCurve } from '../geometry/morph';
import { findSquares } from '../geometry/solver';
import { GRACE_MS, TOLERANCE } from './feel';
import { LEVELS, fitHuntSeed, levelCurve, nextLevel, parseRoute, randomLevel, routeOf } from './levels';
import { foldTrace, foldsProblems, huntProblems } from './validate';

const COUNT_WORDS: Record<string, number> = { Three: 3, Five: 5, Seven: 7, Nine: 9, Eleven: 11 };

describe('levels', () => {
  it('round-trips every level and random curve through the URL hash', () => {
    for (const level of LEVELS) expect(parseRoute(routeOf(level))).toEqual(level);
    const random = { id: null, name: 'Random', mode: 'folds' as const, seed: 42 };
    expect(parseRoute(routeOf(random))).toEqual(random);
    expect(parseRoute(routeOf({ ...random, mode: 'hunt' }))).toEqual({ ...random, mode: 'hunt' });
  });

  it('reads the old #seed links as Square Hunt on that random curve', () => {
    expect(parseRoute('#992259')).toMatchObject({ mode: 'hunt', seed: 992259 });
  });

  it('opens the menu for an empty or unknown hash', () => {
    expect(parseRoute('')).toBeNull();
    expect(parseRoute('#nonsense')).toBeNull();
    expect(parseRoute('#folds/abc')).toBeNull();
  });

  it('has both modes, with distinct ids', () => {
    expect(new Set(LEVELS.map((l) => l.mode))).toEqual(new Set(['hunt', 'folds']));
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  it('gives every Avoid Folds level a fold within its first 20 seconds', () => {
    for (const level of LEVELS.filter((l) => l.mode === 'folds')) {
      const morph = new MorphingCurve(level.seed!);
      const counts = new Set<number>();
      // Stop at the first change: one fold is all the test needs, and each full solve costs tens of milliseconds.
      for (let time = 0; time <= 20 && counts.size < 2; time += 1)
        counts.add(findSquares(morph.at(time)).length);
      expect(counts.size, level.id!).toBeGreaterThan(1);
    }
  });

  it('gives every Square Hunt level more than one square to find', () => {
    for (const level of LEVELS.filter((l) => l.mode === 'hunt')) {
      expect(findSquares(levelCurve(level)).length, level.id!).toBeGreaterThan(1);
    }
  });

  it('validates every Square Hunt level: generic, squares told apart, the count its name says, and stable', () => {
    for (const level of LEVELS.filter((l) => l.mode === 'hunt')) {
      const curve = levelCurve(level);
      const squares = findSquares(curve);
      expect(huntProblems(curve, squares, TOLERANCE), level.id!).toEqual([]);
      expect(squares.length, level.id!).toBe(COUNT_WORDS[level.name.split(' ')[0]]);
      // A finer grid finds no square the default one missed (#6).
      expect(findSquares(curve, { grid: 512 }).length, level.id!).toBe(squares.length);
    }
  }, 60_000);

  it("never strands a player in the first minute of an Avoid Folds level, at the level's own speed", () => {
    // After every fold, some square is alive within the grace time and lives at least a second after it, both in
    // real seconds.
    for (const level of LEVELS.filter((l) => l.mode === 'folds')) {
      const speed = level.speed ?? 1;
      const trace = foldTrace(new MorphingCurve(level.seed), 60 * speed, 0.5);
      expect(foldsProblems(trace, speed, GRACE_MS / 1000, 1), level.id!).toEqual([]);
    }
  }, 240_000);

  it('makes Avoid Folds faster level by level', () => {
    const speeds = LEVELS.filter((l) => l.mode === 'folds').map((l) => l.speed ?? 1);
    expect(speeds[0]).toBe(1);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThan(speeds[i - 1]);
  });

  it('opens the campaign on a still curve, so the control is learnt before the curve moves', () => {
    expect(LEVELS[0].mode).toBe('hunt');
    expect(LEVELS[1].mode).toBe('hunt');
  });

  it('leads from each level to the next in campaign order, and from the last or a random curve to nothing', () => {
    for (let i = 0; i + 1 < LEVELS.length; i++) expect(nextLevel(LEVELS[i])).toBe(LEVELS[i + 1]);
    expect(nextLevel(LEVELS[LEVELS.length - 1])).toBeNull();
    expect(nextLevel(randomLevel('hunt', 7))).toBeNull();
  });

  it('gives every Avoid Folds level a goal, and asks for longer holds as the levels go on', () => {
    const goals = LEVELS.filter((l) => l.mode === 'folds').map((l) => l.goal);
    for (const g of goals) expect(g).toBeGreaterThan(0);
    for (let i = 1; i < goals.length; i++) expect(goals[i]!).toBeGreaterThanOrEqual(goals[i - 1]!);
    expect(randomLevel('folds', 3).goal).toBeUndefined();
  });

  it('moves a random Square Hunt seed on to the next curve that passes validation', () => {
    expect(fitHuntSeed(1)).toBe(1);
    const fitted = fitHuntSeed(28);
    expect(fitted).toBeGreaterThan(28);
    const curve = levelCurve({ id: null, name: 'Random', mode: 'hunt', seed: fitted });
    expect(huntProblems(curve, findSquares(curve), TOLERANCE)).toEqual([]);
  });
});
