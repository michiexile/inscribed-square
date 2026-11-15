import { describe, expect, it } from 'vitest';
import type { InscribedSquare } from '../geometry/solver';
import { type Corners, squareOnEdge } from '../geometry/square';
import type { TrackedSquare } from '../geometry/tracker';
import { AvoidFolds } from './folds';

const TOL = 0.05;
const GRACE = 3000;

/** An axis-aligned square of side 1 with its lower left corner at (x, 0). */
function square(x: number): InscribedSquare {
  const corners = squareOnEdge({ x, y: 0 }, { x: x + 1, y: 0 });
  return { corners, params: [0, 0.25, 0.5, 0.75], centre: { x: x + 0.5, y: 0.5 }, side: 1 };
}
const tracked = (id: number, x: number): TrackedSquare => ({
  id,
  square: square(x),
  gap: Infinity,
  partner: null,
});
const held = (x: number): Corners => square(x).corners;

describe('AvoidFolds', () => {
  it('scores only while the held square is latched onto a live square', () => {
    const game = new AvoidFolds(TOL, GRACE);
    const squares = [tracked(1, 0), tracked(2, 3)];
    expect(game.update(held(1.5), 0.3, squares, [], 0).phase).toBe('searching');
    expect(game.update(held(0.01), 0.01, squares, [], 1000).phase).toBe('holding');
    expect(game.score).toBe(0);
    game.update(held(0.01), 0.01, squares, [], 3000);
    expect(game.score).toBeCloseTo(2);
    expect(game.latched).toBe(1);
  });

  it('needs the held square within tolerance to latch, but lets it wander further once latched', () => {
    const game = new AvoidFolds(TOL, GRACE);
    const squares = [tracked(1, 0)];
    // Error above tolerance: no latch, even though the held square is close.
    expect(game.update(held(0.01), 0.06, squares, [], 0).phase).toBe('searching');
    expect(game.update(held(0.01), 0.01, squares, [], 100).phase).toBe('holding');
    // Latched: drifting 2.5 tolerances away (as the curve moves under the thumbs) still holds.
    expect(game.update(held(2.5 * TOL), 0.12, squares, [], 200).phase).toBe('holding');
    // Four tolerances away it lets go and the grace clock starts.
    const s = game.update(held(4 * TOL), 0.2, squares, [], 300);
    expect(s.phase).toBe('lost');
    expect(s.graceLeft).toBe(GRACE);
  });

  it('starts the grace clock when the latched square dies, even with its partner right beside it', () => {
    // A tracker-agnostic implementation that re-matches by position each frame would hop onto the partner, which is
    // within the release radius at the fold, and never notice the death.
    const game = new AvoidFolds(TOL, GRACE);
    game.update(held(0), 0, [tracked(1, 0), tracked(2, 0.02)], [], 0);
    expect(game.latched).toBe(1);
    const s = game.update(held(0), 0, [tracked(3, 5)], [tracked(1, 0), tracked(2, 0.02)], 500);
    expect(s.phase).toBe('lost');
    expect(game.latched).toBeNull();
    expect(game.score).toBeCloseTo(0.5);
  });

  it('counts a save when the player latches onto another square within the grace time', () => {
    const game = new AvoidFolds(TOL, GRACE);
    game.update(held(0), 0, [tracked(1, 0), tracked(2, 5)], [], 0);
    game.update(held(0), 0, [tracked(2, 5)], [tracked(1, 0)], 1000);
    expect(game.update(held(3), 0.5, [tracked(2, 5)], [], 2000).graceLeft).toBe(2000);
    expect(game.update(held(5), 0, [tracked(2, 5)], [], 3500).phase).toBe('holding');
    expect(game.saves).toBe(1);
    expect(game.score).toBeCloseTo(1); // the grace time itself scores nothing
  });

  it('ends the round when the grace time runs out, and the score stops', () => {
    const game = new AvoidFolds(TOL, GRACE);
    game.update(held(0), 0, [tracked(1, 0)], [], 0);
    game.update(null, 0, [tracked(1, 0)], [], 2000);
    expect(game.update(null, 0, [tracked(1, 0)], [], 4999).phase).toBe('lost');
    expect(game.update(null, 0, [tracked(1, 0)], [], 5000).phase).toBe('over');
    expect(game.update(held(0), 0, [tracked(1, 0)], [], 6000).phase).toBe('over');
    expect(game.score).toBeCloseTo(2);
  });

  it('clears the level once one round reaches the goal, and stops scoring there', () => {
    const game = new AvoidFolds(TOL, GRACE, 2);
    game.update(held(0), 0, [tracked(1, 0)], [], 0);
    expect(game.update(held(0), 0, [tracked(1, 0)], [], 1999).phase).toBe('holding');
    expect(game.update(held(0), 0, [tracked(1, 0)], [], 2100).phase).toBe('won');
    expect(game.update(held(0), 0, [tracked(1, 0)], [], 5000).phase).toBe('won');
    expect(game.score).toBe(2);
  });

  it('counts held time across saves towards the goal, but not the grace time', () => {
    const game = new AvoidFolds(TOL, GRACE, 2);
    game.update(held(0), 0, [tracked(1, 0), tracked(2, 5)], [], 0);
    game.update(held(0), 0, [tracked(2, 5)], [tracked(1, 0)], 1500);
    game.update(held(5), 0, [tracked(2, 5)], [], 4000);
    expect(game.update(held(5), 0, [tracked(2, 5)], [], 4400).phase).toBe('holding');
    expect(game.update(held(5), 0, [tracked(2, 5)], [], 4600).phase).toBe('won');
  });

  it('never clears without a goal', () => {
    const game = new AvoidFolds(TOL, GRACE);
    game.update(held(0), 0, [tracked(1, 0)], [], 0);
    expect(game.update(held(0), 0, [tracked(1, 0)], [], 1e7).phase).toBe('holding');
  });
});
