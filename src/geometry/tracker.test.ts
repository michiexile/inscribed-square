import { describe, expect, it } from 'vitest';
import { MorphingCurve } from './morph';
import { type InscribedSquare, findSquares } from './solver';
import { SquareTracker } from './tracker';
import { dist } from './vec';

// Morph seed 1 (checked with grid 128 and 384, every 0.25 s): 3 squares until a pair is born between 7.75 s and
// 8 s, 7 squares at 15–16 s, and a pair folds away between 16 s and 16.25 s.
const morph = new MorphingCurve(1);
const curveAt = (time: number) => morph.at(time);
const solve = (time: number) => findSquares(curveAt(time), { grid: 256 });
const FRAME = 1 / 60;

/** Time at which the full solve's count changes inside [lo, hi], by bisection to within 2 ms. */
function countChange(lo: number, hi: number): number {
  const before = solve(lo).length;
  expect(solve(hi).length).not.toBe(before);
  while (hi - lo > 0.002) {
    const mid = (lo + hi) / 2;
    if (solve(mid).length === before) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const same = (a: InscribedSquare, b: InscribedSquare) =>
  dist(a.centre, b.centre) < 1e-4 && Math.abs(a.side - b.side) < 1e-4;

/** Runs the tracker frame by frame from `from` to `to`, recording when each square died. */
function run(tracker: SquareTracker, from: number, to: number): { id: number; time: number }[] {
  const deaths: { id: number; time: number }[] = [];
  for (let time = from + FRAME; time <= to; time += FRAME) {
    for (const d of tracker.advance(time)) deaths.push({ id: d.id, time });
  }
  return deaths;
}

describe('SquareTracker', () => {
  it('keeps every square, under the same id, through a stretch with no folds', () => {
    // Re-solving each frame and renumbering would pass a count check; it fails the identity check, which needs each
    // id's square to move only a little per frame.
    const tracker = new SquareTracker(curveAt, 9, solve(9));
    const ids = tracker.squares.map((q) => q.id);
    expect(ids).toHaveLength(5);
    let last = new Map(tracker.squares.map((q) => [q.id, q.square]));
    for (let time = 9 + FRAME; time <= 14; time += FRAME) {
      expect(tracker.advance(time)).toEqual([]);
      for (const q of tracker.squares) {
        expect(dist(q.square.centre, last.get(q.id)!.centre)).toBeLessThan(0.02);
      }
      last = new Map(tracker.squares.map((q) => [q.id, q.square]));
    }
    expect(tracker.squares.map((q) => q.id)).toEqual(ids);
    const truth = solve(tracker.time);
    expect(tracker.squares).toHaveLength(truth.length);
    for (const q of tracker.squares) expect(truth.some((t) => same(t, q.square))).toBe(true);
  });

  it('reports a pair dying together where the full solve loses two squares', () => {
    const fold = countChange(16, 16.25);
    const tracker = new SquareTracker(curveAt, 15.2, solve(15.2));
    expect(tracker.squares).toHaveLength(7);
    const deaths = run(tracker, 15.2, 16.6);
    expect(deaths).toHaveLength(2);
    for (const d of deaths) expect(Math.abs(d.time - fold)).toBeLessThan(0.05);
    expect(tracker.squares).toHaveLength(5);
  });

  it('kills both squares of a pair whose Newton steps land on the same square', () => {
    // Morph seed 1, frames from 25.5 s: one frame takes both squares of a folding pair onto the same square, so
    // Newton succeeds for both. Keeping them would follow one square under two ids until the next frame.
    const tracker = new SquareTracker(curveAt, 25.5, solve(25.5));
    const deaths: number[] = [];
    for (let i = 1; 25.5 + i * FRAME <= 26.2; i++) {
      deaths.push(...tracker.advance(25.5 + i * FRAME).map(() => i));
      const qs = tracker.squares;
      for (let a = 0; a < qs.length; a++)
        for (let b = a + 1; b < qs.length; b++) expect(same(qs[a].square, qs[b].square)).toBe(false);
    }
    expect(deaths).toHaveLength(2);
    expect(deaths[0]).toBe(deaths[1]);
  });

  it('warns of the fold: the dying pair draw together beforehand', () => {
    const fold = countChange(16, 16.25);
    const tracker = new SquareTracker(curveAt, 15.2, solve(15.2));
    run(tracker, 15.2, fold - 0.5);
    const early = Math.min(...tracker.squares.map((q) => q.gap));
    run(tracker, fold - 0.5, fold - 0.05);
    const pair = tracker.squares.filter((q) => q.gap < early / 2);
    expect(pair).toHaveLength(2);
    expect(pair[0].partner).toBe(pair[1].id);
    expect(pair[1].partner).toBe(pair[0].id);
  });

  it('adopts squares born at a fold from a later full solve, keeping the old ids', () => {
    const tracker = new SquareTracker(curveAt, 7, solve(7));
    const ids = tracker.squares.map((q) => q.id);
    expect(ids).toHaveLength(3);
    run(tracker, 7, 8.5);
    expect(tracker.squares).toHaveLength(3); // local tracking cannot see a birth
    // The background solve started at 8.3 s and reports its result at 8.5 s.
    const born = tracker.adopt(solve(8.3), 8.3);
    expect(born).toHaveLength(2);
    expect(tracker.squares).toHaveLength(5);
    expect(tracker.squares.slice(0, 3).map((q) => q.id)).toEqual(ids);
    const truth = solve(tracker.time);
    for (const q of tracker.squares) expect(truth.some((t) => same(t, q.square))).toBe(true);
    // Adopting the same solve again adds nothing.
    expect(tracker.adopt(solve(8.3), 8.3)).toEqual([]);
  });
});
