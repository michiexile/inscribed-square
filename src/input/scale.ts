/**
 * How many CSS pixels make one pixel of the intended phone layout. A touch browser that ignores the viewport tag,
 * such as Chrome on Android with "Desktop site" on, lays the page out about 980 px wide on a screen less than half
 * that, which shrinks every button, line and thumb offset. Then this is the layout width over the screen width;
 * otherwise it is 1. Only a coarse (touch) pointer qualifies, since a desktop window can be any width.
 */
export function uiScale(layoutWidth: number, screenWidth: number, coarsePointer: boolean): number {
  if (!coarsePointer || !(screenWidth > 0)) return 1;
  const ratio = layoutWidth / screenWidth;
  return ratio > 1.2 ? ratio : 1;
}

/** The curve fits in a square this many curve units across, as large as the screen's shorter side. */
export const CURVE_SPAN = 3.4;

/**
 * Where the curve's centre goes on the screen, in layout pixels from the top. On a tall screen the curve sits just
 * under the top bar (which ends `top` pixels down), so the space below it is free for the thumb that drags the
 * square; when there is no spare height it is centred.
 */
export function curveCentreY(width: number, height: number, top: number): number {
  const half = (Math.min(width, height) / CURVE_SPAN) * (CURVE_SPAN / 2);
  return Math.min(height / 2, top + half);
}
