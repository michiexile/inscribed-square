import { describe, expect, it } from 'vitest';
import { EditableCurve } from '../geometry/editable';
import { findSquares } from '../geometry/solver';
import { EditTracker, Steer, steerPick } from './steer';

describe('Steer', () => {
  it('wins once every target has folded away while the keeper lives', () => {
    const s = new Steer(1, [2, 3]);
    expect(s.update([2])).toBe('playing');
    expect(s.update([4])).toBe('playing');
    expect(s.update([3])).toBe('won');
    expect(s.update([1])).toBe('won');
  });

  it('loses when the keeper folds away, even if it takes the last target with it', () => {
    // Squares fold in pairs: pushing the keeper into the target kills both, which must not count as a win.
    const s = new Steer(1, [2]);
    expect(s.update([1, 2])).toBe('lost');
    expect(s.update([])).toBe('lost');
  });

  it('starts over with restart', () => {
    const s = new Steer(1, [2]);
    s.update([1]);
    s.restart();
    expect(s.state).toBe('playing');
    expect(s.update([2])).toBe('won');
  });
});

describe('EditTracker', () => {
  it('follows every square through small pushes, under the same ids', () => {
    const curve = EditableCurve.fromSeed(3);
    const et = new EditTracker(curve);
    const ids = et.tracker.squares.map((q) => q.id);
    for (let i = 0; i < 5; i++) expect(et.push(2, 0.002)).toEqual([]);
    expect(et.tracker.squares.map((q) => q.id)).toEqual(ids);
    const truth = findSquares(et.curve.polygon());
    expect(truth).toHaveLength(ids.length);
  });

  it('splits a big push into small steps, so a square is not lost by jumping', () => {
    const a = new EditTracker(EditableCurve.fromSeed(3));
    const b = new EditTracker(EditableCurve.fromSeed(3));
    a.push(2, 0.02);
    for (let i = 0; i < 5; i++) b.push(2, 0.004);
    expect(a.tracker.squares.map((q) => q.square.centre.x)).toEqual(
      b.tracker.squares.map((q) => expect.closeTo(q.square.centre.x, 6)),
    );
  });
});

describe('steerPick', () => {
  it('keeps the biggest square and targets one of the closest pair that leaves it out', () => {
    const squares = findSquares(EditableCurve.fromSeed(7).polygon());
    const pick = steerPick(squares)!;
    expect(squares[pick.keeper].side).toBe(Math.max(...squares.map((q) => q.side)));
    expect(pick.targets).toHaveLength(1);
    expect(pick.targets[0]).not.toBe(pick.keeper);
  });
});
