import { describe, expect, it } from 'vitest';
import { Polygon } from './polygon';
import { bestEdgeSquare, edgeSquare, squareOnEdge } from './square';

const unitSquare = new Polygon([
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]);

describe('squareOnEdge', () => {
  it('builds the square to the left of the edge a → b, corners in counter-clockwise order', () => {
    const [a, b, c, d] = squareOnEdge({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(a).toEqual({ x: 0, y: 0 });
    expect(b).toEqual({ x: 1, y: 0 });
    expect(c.x).toBeCloseTo(1);
    expect(c.y).toBeCloseTo(1);
    expect(d.x).toBeCloseTo(0);
    expect(d.y).toBeCloseTo(1);
  });
});

describe('edgeSquare', () => {
  it('has zero error when the free corners land on the curve', () => {
    // Corners at s = 0 and s = 0.25 are (0,0) and (1,0); the square to their left is the unit square itself.
    const sq = edgeSquare(unitSquare, 0, 0.25);
    expect(sq.error).toBeCloseTo(0);
    expect(sq.side).toBeCloseTo(1);
  });

  it('measures the error as the larger of the two free-corner distances', () => {
    // Reversed edge: the square hangs below the curve, free corners at (1,-1) and (0,-1), both 1 away.
    const sq = edgeSquare(unitSquare, 0.25, 0);
    expect(sq.distances[0]).toBeCloseTo(1);
    expect(sq.distances[1]).toBeCloseTo(1);
    expect(sq.error).toBeCloseTo(1);
  });
});

describe('bestEdgeSquare', () => {
  it('picks whichever of the two squares on the corner pair has the smaller error, whatever the thumb order', () => {
    expect(bestEdgeSquare(unitSquare, 0.25, 0).error).toBeCloseTo(0);
    expect(bestEdgeSquare(unitSquare, 0, 0.25).error).toBeCloseTo(0);
  });
});
