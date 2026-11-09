import { describe, expect, it } from 'vitest';
import { uiScale } from './scale';

describe('uiScale', () => {
  it('scales up a touch page laid out wider than the screen, as Chrome does with "Desktop site" on', () => {
    // Mikael's phone in desktop mode: the page was laid out 980 px wide on a 412 px wide screen.
    expect(uiScale(980, 412, true)).toBeCloseTo(980 / 412);
  });

  it('leaves a phone page laid out at the screen width alone', () => {
    expect(uiScale(412, 412, true)).toBe(1);
    // Scroll bars and rounding can make the two differ a little.
    expect(uiScale(420, 412, true)).toBe(1);
  });

  it('leaves a desktop with a mouse alone, even in a window narrower or wider than the screen', () => {
    expect(uiScale(1400, 1920, false)).toBe(1);
    expect(uiScale(2560, 1280, false)).toBe(1);
  });
});
