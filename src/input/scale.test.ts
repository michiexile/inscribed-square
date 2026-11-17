import { describe, expect, it } from 'vitest';
import { CURVE_SPAN, curveCentreY, uiScale } from './scale';

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

describe('curveCentreY', () => {
  it('lifts the curve to just under the top bar on a tall screen, leaving room for a thumb below', () => {
    // Pixel 7 portrait: 412 x 915 layout pixels, bar and HUD 110 px tall.
    const k = 412 / CURVE_SPAN;
    const cy = curveCentreY(412, 915, 110);
    expect(cy - (CURVE_SPAN / 2) * k).toBeGreaterThanOrEqual(110);
    expect(cy).toBeLessThan(915 / 2 - 50);
  });

  it('keeps the curve centred when there is no spare height', () => {
    expect(curveCentreY(915, 412, 60)).toBe(412 / 2);
    expect(curveCentreY(400, 420, 110)).toBe(420 / 2);
  });
});
