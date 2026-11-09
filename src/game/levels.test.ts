import { describe, expect, it } from 'vitest';
import { MorphingCurve } from '../geometry/morph';
import { findSquares } from '../geometry/solver';
import { LEVELS, levelCurve, parseRoute, routeOf } from './levels';

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
      for (let time = 0; time <= 20; time += 1) counts.add(findSquares(morph.at(time)).length);
      expect(counts.size, level.id!).toBeGreaterThan(1);
    }
  });

  it('gives every Square Hunt level more than one square to find', () => {
    for (const level of LEVELS.filter((l) => l.mode === 'hunt')) {
      expect(findSquares(levelCurve(level)).length, level.id!).toBeGreaterThan(1);
    }
  });
});
