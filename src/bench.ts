import { randomCurve } from './geometry/random';
import { findSquares } from './geometry/solver';

export interface BenchRow {
  readonly vertices: number;
  readonly grid: number;
  readonly trials: number;
  readonly medianMs: number;
  readonly squares: number;
}

/**
 * Times the crude solver over polygon sizes 100, 200, 500 and grid sizes 128, 256, 512 (issue #3), reporting the
 * median of several trials. `onRow` sees each row as it finishes, so a slow device shows progress.
 */
export async function runBenchmark(
  now: () => number,
  onRow: (row: BenchRow) => void = () => {},
): Promise<BenchRow[]> {
  const rows: BenchRow[] = [];
  for (const vertices of [100, 200, 500]) {
    const curve = randomCurve(1, vertices);
    for (const grid of [128, 256, 512]) {
      const trials = grid >= 512 ? 3 : 5;
      const times: number[] = [];
      let squares = 0;
      for (let i = 0; i < trials; i++) {
        const t0 = now();
        squares = findSquares(curve, { grid }).length;
        times.push(now() - t0);
        // Yield so the browser can paint between trials.
        await new Promise((r) => setTimeout(r, 0));
      }
      times.sort((a, b) => a - b);
      const row = { vertices, grid, trials, medianMs: times[Math.floor(trials / 2)], squares };
      rows.push(row);
      onRow(row);
    }
  }
  return rows;
}
