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
