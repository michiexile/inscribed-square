# Worklog: level validation (phase 4, part 2), 2026-11-09

Follows `WORKLOG-robust-solver.md`. Plan gate for phase 4: every generated level passes validation; no unreachable
states.

## Square Hunt

`huntProblems(curve, squares, minGap)` (`src/game/validate.ts`): not degenerate, odd count, and no two squares
closer than `minGap` = `TOLERANCE` (0.05) by `squareGap` (larger of centre distance and side difference). Below the
snap tolerance, a held square can be within tolerance of both, so the player cannot tell them apart.

Smallest gap on the shipped levels (grid 128): hunt-1 0.229, hunt-2 0.076, hunt-3 0.058, hunt-4 (seed 28) **0.030**.
So "Nine squares" failed: two of its squares 0.03 apart. Moved to seed 51 (9 squares, gap 0.085, same count at grid
512). Other candidates found: 163 (11 squares, gap 0.053), 190 and 219 (9 squares).

Random curves 1–200: gap quantiles (min, 2%, 5%, 10%, 25%, 50%) = 0.006, 0.007, 0.016, 0.035, 0.069, 0.120; 28 of
200 below 0.05. `fitHuntSeed` moves a random Square Hunt seed to the next valid one (one full solve per tried seed,
~45 ms in Node).

`levels.test.ts` also checks each level's name matches its count and that grid 512 finds the same count. Mutation
check: putting hunt-4 back on seed 28 fails it ("two squares only 0.030 apart").

## Avoid Folds

`foldTrace(morph, duration, solveEvery)` runs the tracker at 60 fps and adopts a full solve every `solveEvery`
seconds, recording each square's birth (no earlier than its adoption) and death. `strandedFolds(trace, grace, hold)`
lists deaths after which no other square is alive within `grace` seconds and then lives `hold` more seconds.

Unit tests use hand-built traces (a check that only asks "is another square alive?" fails the first).

On the real levels it never fires. 60 s traces, solve every 0.5 s, seeds 1 / 2 / 5 (13 / 16 / 18 deaths):

| grace, hold | stranded  |
| ----------- | --------- |
| 3 s, 1 s    | 0 / 0 / 0 |
| 1 s, 3 s    | 0 / 0 / 0 |
| 0.5 s, 5 s  | 0 / 0 / 2 |
| 0.25 s, 8 s | 2 / 6 / 8 |

120 s traces with a solve every 0.25 s (seeds 1–5): 0 stranded at 3 s / 1 s and at 3 s / 3 s; median square life
5.7–8.6 s. A 120 s trace at 0.25 s solves costs ~21 s in Node, so CI runs 60 s at 0.5 s (~5 s per level).

Conclusion: at the current morph speed the survivor guarantee is far from binding. Parity plus 3–9 live squares
means a rescue square always exists. The validator becomes a real constraint only if morphs speed up (#12 floats
per-level speed). Losing in Avoid Folds today comes from the player not finding a square in time, never from there
being none.

## Not validated

- Random Avoid Folds curves (`#folds/<seed>`): a trace is too slow to run at level start. The morph construction keeps
  every harmonic above zero, so it never passes through a symmetric shape (#2), and the table above shows how far
  the stranding check is from binding.
- Random Square Hunt curves get the grid-128 checks only, not the grid-512 comparison (~600 ms in Node, more on a
  phone). #6 tracks the solver limit that comparison guards against.
