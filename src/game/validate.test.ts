import { describe, expect, it } from 'vitest';
import { radialFourier } from '../geometry/fourier';
import { randomCurve } from '../geometry/random';
import { findSquares } from '../geometry/solver';
import { type FoldTrace, huntProblems, strandedFolds } from './validate';

const trace = (lifetimes: [number, number][], duration = 30): FoldTrace => ({
  duration,
  lifetimes: lifetimes.map(([born, died], i) => ({ id: i + 1, born, died })),
});

describe('strandedFolds', () => {
  it('reports a fold where every other square is about to die and the next is born too late', () => {
    // Squares 1 and 2 fold together at 10 s. Square 3 is alive then but dies at 10.5 s; square 4 is born at 14 s,
    // after the 3 s grace. A check that only asks "is another square alive?" passes this; the player is stranded.
    expect(
      strandedFolds(
        trace([
          [0, 10],
          [0, 10],
          [0, 10.5],
          [14, Infinity],
        ]),
        3,
        1,
      ),
    ).toEqual([10, 10, 10.5]);
  });

  it('accepts a fold when a square born within the grace lives long enough to hold', () => {
    const t = trace([
      [0, 10],
      [0, 10],
      [12, Infinity],
    ]);
    expect(strandedFolds(t, 3, 1)).toEqual([]);
    // Latching on at 12 s leaves the whole grace's worth of holding to spare; only a shorter grace strands it.
    expect(strandedFolds(t, 3, 2)).toEqual([]);
    expect(strandedFolds(t, 1.5, 1)).toEqual([10, 10]);
  });

  it('ignores deaths too close to the end of the run to judge', () => {
    expect(
      strandedFolds(
        trace(
          [
            [0, 29],
            [0, 29],
          ],
          30,
        ),
        3,
        1,
      ),
    ).toEqual([]);
  });
});

describe('huntProblems', () => {
  it('passes a curve with well-separated squares', () => {
    const curve = randomCurve(1);
    expect(huntProblems(curve, findSquares(curve), 0.05)).toEqual([]);
  });

  it('reports two squares the player cannot tell apart within the snap tolerance', () => {
    // Curve 28 (the old "Nine squares" level) has two squares 0.03 apart in centre and side.
    const curve = randomCurve(28);
    const problems = huntProblems(curve, findSquares(curve), 0.05);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/0\.03\d? apart/);
  });

  it('reports a degenerate curve, and an even count', () => {
    const circle = radialFourier([], 256);
    expect(huntProblems(circle, findSquares(circle), 0.05).join()).toMatch(/continuous family/);
    const curve = randomCurve(1);
    expect(huntProblems(curve, findSquares(curve).slice(1), 0.05).join()).toMatch(/even/);
  });
});
