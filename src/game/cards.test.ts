import { describe, expect, it } from 'vitest';
import { cardLayout } from './cards';

describe('cardLayout', () => {
  it('fits every card in the space under the curve, in rows of up to three, without overlap', () => {
    for (const n of [2, 4, 5, 6, 7, 9]) {
      const cards = cardLayout(n, { x: 0, y: 520, width: 412, height: 380 });
      expect(cards).toHaveLength(n);
      for (const c of cards) {
        expect(c.x).toBeGreaterThanOrEqual(16);
        expect(c.x + c.size).toBeLessThanOrEqual(412 - 16);
        expect(c.y).toBeGreaterThanOrEqual(520);
        expect(c.y + c.size).toBeLessThanOrEqual(900);
      }
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const [a, b] = [cards[i], cards[j]];
          const apart =
            a.x + a.size <= b.x || b.x + b.size <= a.x || a.y + a.size <= b.y || b.y + b.size <= a.y;
          expect(apart).toBe(true);
        }
    }
  });

  it('fills a tall area beside the curve as well', () => {
    const cards = cardLayout(5, { x: 600, y: 80, width: 300, height: 500 });
    for (const c of cards) expect(c.x).toBeGreaterThanOrEqual(616);
    expect(cards[0].size).toBeGreaterThanOrEqual(96);
  });

  it('makes cards big enough to tap on a phone', () => {
    expect(cardLayout(6, { x: 0, y: 520, width: 412, height: 380 })[0].size).toBeGreaterThanOrEqual(96);
  });

  it('has no cards when there is no room for them', () => {
    expect(cardLayout(5, { x: 0, y: 380, width: 900, height: 20 })).toEqual([]);
  });
});
