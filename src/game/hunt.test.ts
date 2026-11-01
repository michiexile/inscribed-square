import { describe, expect, it } from 'vitest';
import type { InscribedSquare } from '../geometry/solver';
import type { Corners } from '../geometry/square';
import { Hunt } from './hunt';

const square = (cx: number, cy: number, half: number): InscribedSquare => ({
  corners: [
    { x: cx - half, y: cy - half },
    { x: cx + half, y: cy - half },
    { x: cx + half, y: cy + half },
    { x: cx - half, y: cy + half },
  ],
  params: [0, 0.25, 0.5, 0.75],
  centre: { x: cx, y: cy },
  side: 2 * half,
});

const a = square(0, 0, 0.5);
const b = square(0.3, 0.1, 0.4);
const rotated = (c: Corners, k: number): Corners => [
  c[k % 4],
  c[(k + 1) % 4],
  c[(k + 2) % 4],
  c[(k + 3) % 4],
];

describe('Hunt', () => {
  it('matches a held square to the solver square with the same corners, from any starting corner', () => {
    const hunt = new Hunt([a, b], 0.03);
    expect(hunt.check(rotated(b.corners, 2), 0.01)).toBe(b);
    expect(hunt.found).toEqual([b]);
  });

  it('ignores a square whose error is above the tolerance', () => {
    const hunt = new Hunt([a, b], 0.03);
    expect(hunt.check(a.corners, 0.05)).toBeNull();
    expect(hunt.found).toEqual([]);
  });

  it('counts each square once however often it is held', () => {
    const hunt = new Hunt([a, b], 0.03);
    hunt.check(a.corners, 0.01);
    hunt.check(rotated(a.corners, 1), 0.02);
    expect(hunt.found).toHaveLength(1);
  });

  it('still counts a square the solver missed, so a player is never denied a real find', () => {
    const hunt = new Hunt([a], 0.03);
    const missed = square(-0.4, 0.2, 0.3);
    expect(hunt.check(missed.corners, 0.01)).not.toBeNull();
    expect(hunt.found).toHaveLength(1);
    expect(hunt.extra).toBe(1);
  });
});
