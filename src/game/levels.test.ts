import { describe, expect, it } from 'vitest';
import { MorphingCurve } from '../geometry/morph';
import { findSquares } from '../geometry/solver';
import { GRACE_MS, TOLERANCE } from './feel';
import {
  LEVELS,
  fitHuntSeed,
  isHeld,
  levelCurve,
  nextLevel,
  parseRoute,
  randomLevel,
  routeOf,
} from './levels';
import { EditableCurve } from '../geometry/editable';
import { buildCount } from './build';
import { FORECAST_PREVIEW } from './feel';
import { foldRound, lookBack } from './predict';
import { EditTracker, Steer } from './steer';
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

  it('has every mode, with distinct ids', () => {
    expect(new Set(LEVELS.map((l) => l.mode))).toEqual(
      new Set(['hunt', 'folds', 'count', 'choice', 'predict', 'steer', 'build']),
    );
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  it('gives every morphing level a fold within its first 20 seconds', () => {
    for (const level of LEVELS.filter((l) => isHeld(l.mode))) {
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

  it("never strands a player in the first minute of a morphing level, at the level's own speed", () => {
    // After every fold, some square is alive within the grace time and lives at least a second after it, both in
    // real seconds.
    for (const level of LEVELS.filter((l) => isHeld(l.mode))) {
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

  it('validates every Odd One Out level like Square Hunt, with a name that gives no count away', () => {
    const counts = LEVELS.filter((l) => l.mode === 'count');
    expect(counts.length).toBeGreaterThan(0);
    for (const level of counts) {
      const curve = levelCurve(level);
      const squares = findSquares(curve);
      expect(huntProblems(curve, squares, TOLERANCE), level.id!).toEqual([]);
      expect(squares.length, level.id!).toBeGreaterThan(3);
      expect(findSquares(curve, { grid: 512 }).length, level.id!).toBe(squares.length);
      expect(level.name, level.id!).not.toMatch(/\d|three|five|seven|nine|eleven/i);
    }
  }, 60_000);

  it('plays two Square Hunt levels, whose names show odd counts, before the first Odd One Out level', () => {
    const first = LEVELS.findIndex((l) => l.mode === 'count');
    expect(LEVELS.slice(0, first).filter((l) => l.mode === 'hunt').length).toBeGreaterThanOrEqual(2);
  });

  it('round-trips random Odd One Out curves through the URL hash', () => {
    const random = randomLevel('count', 42);
    expect(parseRoute(routeOf(random))).toEqual(random);
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
    for (const mode of ['folds', 'choice'] as const) {
      const goals = LEVELS.filter((l) => l.mode === mode).map((l) => l.goal);
      expect(goals.length, mode).toBeGreaterThan(0);
      for (const g of goals) expect(g, mode).toBeGreaterThan(0);
      for (let i = 1; i < goals.length; i++) expect(goals[i]!, mode).toBeGreaterThanOrEqual(goals[i - 1]!);
    }
    expect(randomLevel('folds', 3).goal).toBeUndefined();
  });

  it('keeps at least three squares alive on every Lifelines curve, so a fold always leaves a choice', () => {
    for (const level of LEVELS.filter((l) => l.mode === 'choice')) {
      const morph = new MorphingCurve(level.seed);
      const speed = level.speed ?? 1;
      for (let real = 0; real < 60; real += 2)
        expect(findSquares(morph.at(real * speed)).length, `${level.id} at ${real} s`).toBeGreaterThanOrEqual(
          3,
        );
    }
  }, 60_000);

  it('stores Fold Forecast rounds that are all real rounds, with a reachable goal', () => {
    const levels = LEVELS.filter((l) => l.mode === 'predict');
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) {
      expect(level.rounds!.length, level.id!).toBeGreaterThanOrEqual(5);
      expect(level.goal!, level.id!).toBeLessThanOrEqual(level.rounds!.length);
      const morph = new MorphingCurve(level.seed);
      for (const t of level.rounds!)
        expect(foldRound(morph, t, level.warning!), `${level.id} at ${t}`).not.toBeNull();
    }
  }, 60_000);

  it('shows the folding pair closing in during the motion before every Fold Forecast question', () => {
    // The motion is the cue: if the pair drifted apart while it played, the question would be a pure guess.
    for (const level of LEVELS.filter((l) => l.mode === 'predict')) {
      const morph = new MorphingCurve(level.seed);
      for (const t of level.rounds!) {
        const round = foldRound(morph, t, level.warning!)!;
        const frames = lookBack(morph, round, FORECAST_PREVIEW);
        const gap = (f: (typeof frames)[number]) => {
          const [a, b] = round.dying.map((id) => f.squares.get(id));
          if (!a || !b) return Infinity;
          return Math.max(...a.map((p) => Math.min(...b.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))));
        };
        expect(gap(frames.at(-1)!), `${level.id} at ${t}`).toBeLessThan(gap(frames[0]));
      }
    }
  }, 60_000);

  it('asks Fold Forecast questions earlier, so harder, as the levels go on', () => {
    const warnings = LEVELS.filter((l) => l.mode === 'predict').map((l) => l.warning!);
    for (let i = 1; i < warnings.length; i++) expect(warnings[i]).toBeGreaterThan(warnings[i - 1]);
  });

  it('can clear every Steer the Curve level by its stored hint, and the hint is needed', () => {
    const levels = LEVELS.filter((l) => l.mode === 'steer');
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) {
      const curve = EditableCurve.fromSeed(level.seed);
      const squares = findSquares(curve.polygon());
      const steer = new Steer(
        level.keeper! + 1,
        level.targets!.map((t) => t + 1),
      );
      const et = new EditTracker(curve, squares);
      const { psi, delta, steps } = level.hint!;
      for (let i = 0; i < steps && steer.state === 'playing'; i++) steer.update(et.push(psi, delta));
      expect(steer.state, level.id!).toBe('won');
    }
  });

  it('can clear every Build a Curve level by its stored hint, from a curve that starts off target', () => {
    const levels = LEVELS.filter((l) => l.mode === 'build');
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) {
      let curve = EditableCurve.fromSeed(level.seed);
      expect(findSquares(curve.polygon()).length, level.id!).not.toBe(level.goal);
      const { psi, delta, steps } = level.hint!;
      for (let i = 0; i < steps; i++) curve = curve.pushed(psi, delta);
      const polygon = curve.polygon();
      expect(buildCount(polygon, findSquares(polygon), level.goal!, TOLERANCE).met, level.id!).toBe(true);
    }
  });

  it('plays an Avoid Folds level before the first Lifelines level, which adds a choice to it', () => {
    const first = LEVELS.findIndex((l) => l.mode === 'choice');
    expect(LEVELS.slice(0, first).some((l) => l.mode === 'folds')).toBe(true);
  });

  it('moves a random Square Hunt seed on to the next curve that passes validation', () => {
    expect(fitHuntSeed(1)).toBe(1);
    const fitted = fitHuntSeed(28);
    expect(fitted).toBeGreaterThan(28);
    const curve = levelCurve({ id: null, name: 'Random', mode: 'hunt', seed: fitted });
    expect(huntProblems(curve, findSquares(curve), TOLERANCE)).toEqual([]);
  });
});
