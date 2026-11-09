# Worklog: per-level morph speed for Avoid Folds, 2026-11-09

Mikael (2026-11-09): "we do want the option of speeding up the morph as a level increase move."

## Design

`Level.speed` (Avoid Folds only, default 1) is morph seconds per real second. `FoldsMode` advances its morph clock by
`morphStep(realDt, speed)`: real time capped at 0.1 s, then times the speed, so a stalled frame jumps at most 0.1 real
seconds' worth on any level. The morph itself, the tracker (sub-steps of 1/60 morph-second, so 3 per frame at 3×)
and the solve worker (morph time) are unchanged.

`foldsProblems(trace, speed, grace, hold)` judges grace and hold in real seconds, i.e. `grace·speed` and
`hold·speed` in morph time. `levels.test.ts` traces each level for 60 real seconds at its own speed.

## Measurements

120 s morph traces (solve every 0.25 s), stranded folds at grace 3 real s / hold 1 real s, and / hold 2 real s:

| seed | 1×  | 2×  | 3×  | 4×  | 6×  | 8×  | 12×  |
| ---- | --- | --- | --- | --- | --- | --- | ---- |
| 1    | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0  |
| 2    | 0/0 | 0/0 | 0/0 | 0/2 | 0/6 | 0/4 | 0/2  |
| 5    | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/18 |

(At high speeds the run end excludes more deaths, so those columns undercount.) With a 1 s hold nothing strands even at
12×: a faster morph also gives more morph time, and so more births, inside the grace. The stranding check does not
limit playable speeds; what does is how fast squares move and how long they live:

- Square centre speed, curve units per morph second (sampled every 0.5 s over 30 s): median 0.015–0.031, 90th
  percentile 0.038–0.051 (seeds 1, 2, 3, 5). The snap tolerance is 0.05.
- Median square life 5.7–8.6 morph seconds (seeds 1–5), 10th percentile 0.8–1.3.

## Levels

Drift 1× (seed 1), Undertow 1.5× (seed 2), Churn 2× (seed 5), new Rapids 3× (seed 3, the shortest median life).
The speeds are guesses (#12). Headless Chromium: the menu shows "Rapids · 3× speed", the level runs, no console
errors.

Cost: the folds level test traces 60 · speed morph seconds per level; the full `npm run check` test run went from
~20 s to ~46 s.
