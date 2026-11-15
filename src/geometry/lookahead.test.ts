import { describe, expect, it } from 'vitest';
import { LeadTracker } from './lookahead';
import { MorphingCurve } from './morph';
import { findSquares } from './solver';
import { SquareTracker } from './tracker';

// Morph seed 1 (tracker.test.ts): 7 squares at 15 s, and a pair folds away between 16 s and 16.25 s.
const morph = new MorphingCurve(1);
const curveAt = (time: number) => morph.at(time);
const FRAME = 1 / 60;

describe('LeadTracker', () => {
  it('shows the same squares at the display time as a plain tracker would', () => {
    const start = findSquares(curveAt(15), { grid: 256 });
    const plain = new SquareTracker(curveAt, 15, start);
    const lead = new LeadTracker(curveAt, 15, start, 2);
    for (let t = 15 + FRAME; t <= 15.5; t += FRAME) {
      plain.advance(t);
      lead.advance(t);
    }
    const shown = lead.squares;
    expect(shown.map((q) => q.id)).toEqual(plain.squares.map((q) => q.id));
    for (let i = 0; i < shown.length; i++)
      expect(shown[i].square.centre.x).toBeCloseTo(plain.squares[i].square.centre.x, 2);
  });

  it('knows when a square will die before the display reaches it, and reports the death when it does', () => {
    // A plain tracker learns of the fold only when it happens; the lead tracker knows its time while it is still
    // ahead, which is what lets the player choose a long-lived square.
    const start = findSquares(curveAt(15), { grid: 256 });
    const plain = new SquareTracker(curveAt, 15, start);
    const lead = new LeadTracker(curveAt, 15, start, 2);
    let fold: { ids: number[]; time: number } | null = null;
    for (let t = 15 + FRAME; t <= 16.5 && !fold; t += FRAME) {
      const died = plain.advance(t);
      if (died.length) fold = { ids: died.map((d) => d.id), time: t };
    }
    expect(fold).not.toBeNull();
    // A second ahead of the fold, the lead tracker already has both deaths, within a frame.
    let t = 15;
    for (; t + FRAME <= fold!.time - 1; t += FRAME) lead.advance(t + FRAME);
    for (const id of fold!.ids) expect(lead.deathOf(id)).toBeCloseTo(fold!.time, 1);
    expect(lead.squares.map((q) => q.id)).toEqual(expect.arrayContaining(fold!.ids));
    // Survivors of the fold have no known death inside the lead.
    for (const q of lead.squares) if (!fold!.ids.includes(q.id)) expect(lead.deathOf(q.id)).toBeUndefined();
    // When the display passes the fold, the pair is reported dead and gone.
    const died: number[] = [];
    for (; t + FRAME <= fold!.time + 0.1; t += FRAME) died.push(...lead.advance(t + FRAME).map((d) => d.id));
    expect(died.sort()).toEqual([...fold!.ids].sort());
    expect(lead.squares.some((q) => fold!.ids.includes(q.id))).toBe(false);
  });

  it('with no lead behaves exactly like a plain tracker', () => {
    const start = findSquares(curveAt(15), { grid: 256 });
    const plain = new SquareTracker(curveAt, 15, start);
    const lead = new LeadTracker(curveAt, 15, start, 0);
    for (let t = 15 + FRAME; t <= 16.5; t += FRAME) {
      expect(lead.advance(t).map((d) => d.id)).toEqual(plain.advance(t).map((d) => d.id));
      expect(lead.squares.map((q) => q.id)).toEqual(plain.squares.map((q) => q.id));
    }
  });
});
