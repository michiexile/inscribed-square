import { runBenchmark } from './bench';

/** Replaces the page with the solver benchmark table, filled in row by row as each measurement finishes. */
export async function showBenchmark(): Promise<void> {
  document.body.innerHTML = `
    <main class="bench">
      <h1>Solver benchmark</h1>
      <p>Median time for one full solve, per polygon size and grid size. Keep the screen on until it says done.</p>
      <table>
        <thead><tr><th>Vertices</th><th>Grid</th><th>Trials</th><th>Median ms</th><th>Squares</th></tr></thead>
        <tbody></tbody>
      </table>
      <p id="status">Running…</p>
    </main>`;
  const body = document.querySelector('tbody')!;
  await runBenchmark(
    () => performance.now(),
    (r) => {
      const tr = document.createElement('tr');
      for (const v of [r.vertices, r.grid, r.trials, r.medianMs.toFixed(1), r.squares]) {
        const td = document.createElement('td');
        td.textContent = String(v);
        tr.append(td);
      }
      body.append(tr);
    },
  );
  document.querySelector('#status')!.textContent = `Done. ${navigator.userAgent}`;
}
