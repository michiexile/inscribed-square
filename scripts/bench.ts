// Runs the solver benchmark in Node: npm run bench. The in-browser version is the game page with ?bench.
import { runBenchmark } from '../src/bench';

console.log('vertices  grid  trials  median ms  squares');
await runBenchmark(
  () => performance.now(),
  (r) =>
    console.log(
      `${String(r.vertices).padStart(8)}  ${String(r.grid).padStart(4)}  ${String(r.trials).padStart(6)}  ${r.medianMs.toFixed(1).padStart(9)}  ${String(r.squares).padStart(7)}`,
    ),
);
