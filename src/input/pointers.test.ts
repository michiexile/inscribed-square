import { describe, expect, it } from 'vitest';
import { ThumbTracker } from './pointers';

describe('ThumbTracker', () => {
  it('assigns the first two pointers to thumbs 0 and 1 and ignores a third', () => {
    const t = new ThumbTracker();
    expect(t.down(7, { x: 1, y: 1 })).toBe(0);
    expect(t.down(9, { x: 2, y: 2 })).toBe(1);
    expect(t.down(11, { x: 3, y: 3 })).toBeNull();
    expect(t.thumbs()).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('keeps thumb 1 in its slot when thumb 0 lifts', () => {
    // An array-of-active-pointers implementation would shift thumb 1 into slot 0 here,
    // swapping which corner the remaining finger controls.
    const t = new ThumbTracker();
    t.down(7, { x: 1, y: 1 });
    t.down(9, { x: 2, y: 2 });
    t.up(7);
    expect(t.thumbs()).toEqual([null, { x: 2, y: 2 }]);
    t.move(9, { x: 5, y: 5 });
    expect(t.thumbs()).toEqual([null, { x: 5, y: 5 }]);
  });

  it('refills the freed slot with the next new pointer', () => {
    const t = new ThumbTracker();
    t.down(7, { x: 1, y: 1 });
    t.down(9, { x: 2, y: 2 });
    t.up(7);
    expect(t.down(12, { x: 4, y: 4 })).toBe(0);
    expect(t.thumbs()).toEqual([
      { x: 4, y: 4 },
      { x: 2, y: 2 },
    ]);
  });

  it('ignores moves and lifts from pointers it never accepted', () => {
    const t = new ThumbTracker();
    t.down(7, { x: 1, y: 1 });
    t.down(9, { x: 2, y: 2 });
    t.down(11, { x: 3, y: 3 });
    t.move(11, { x: 8, y: 8 });
    t.up(11);
    expect(t.thumbs()).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });
});
