/** A rectangle in layout pixels. */
export interface Area {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A square card in layout pixels: its top-left corner and side. */
export interface Card {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/** Space kept clear at the sides of the area and between cards, in layout pixels. */
const MARGIN = 16;
const GAP = 12;
/** Cards smaller than this are too small to read or tap, in layout pixels. */
const MIN_SIZE = 64;

/**
 * Lays out `n` equal square cards in `area`, in rows, choosing the number of columns that makes them largest, and
 * centring the grid. Empty when even the best layout would make cards too small.
 */
export function cardLayout(n: number, area: Area): Card[] {
  const inner = { width: area.width - 2 * MARGIN, height: area.height };
  let best = { cols: 1, size: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min((inner.width - (cols - 1) * GAP) / cols, (inner.height - (rows - 1) * GAP) / rows);
    if (size > best.size) best = { cols, size };
  }
  const size = Math.floor(best.size);
  if (size < MIN_SIZE) return [];
  const { cols } = best;
  const rows = Math.ceil(n / cols);
  const gridWidth = cols * size + (cols - 1) * GAP;
  const gridHeight = rows * size + (rows - 1) * GAP;
  const left = area.x + (area.width - gridWidth) / 2;
  const top = area.y + (area.height - gridHeight) / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: left + (i % cols) * (size + GAP),
    y: top + Math.floor(i / cols) * (size + GAP),
    size,
  }));
}
