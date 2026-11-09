# Worklog: robust solver, part 1 (phase 4), 2026-11-09

Scope decided by Mikael (2026-11-09): the full phase 4 now, without waiting for the 3 to 5 person playtest. This
worklog covers the solver half (#6 close pairs, #2 degeneracy); level validation follows in its own PR.

## Close pairs (#6)

Repro: `MorphingCurve(1).at(33.15)` has 5 squares; grid 128 found 4, and at `at(24.75)` grid 512 found 6 of 7 (grid
128 happened to get all 7). The missing square sits 0.003–0.007 from its partner in every parameter, under one grid
cell, so the two share one grid local minimum and Newton from it finds only one. Random curve 131: two of its three
squares differ by about 0.001 per parameter, an eighth of a cell; grids 128 and 256 found 2.

Tried, in order:

1. Signed free-corner distances (new `ClosedCurve.signedDistance`) and a per-triangle zero test on the main grid,
   seeding Newton at each interpolated zero. At grid 128 both interpolated zeros of the 33.15 pair sit nearer the
   same square and Newton lands there from both. Did not fix the repro on its own.
2. A 16×16 sub-grid with the triangle test around every square found, window ±2 grid cells. Fixes 33.15 and 24.75;
   not curve 131 (pair under a sub-cell).
3. Zooming further (window ÷4 per level, up to 4 levels) while the count is even. Fixes 131. Parity is only a valid
   trigger on generic curves; on a symmetric curve with dozens of squares the zoom is skipped (`MAX_ZOOM_SQUARES`),
   otherwise a circle took 100 s.

Then, with 2 and 3 in place, the main-grid triangle seeding (1) was removed: on the 720 + 200 sample set below it
changed nothing, and timing with and without it was within noise. The main grid is back to unsigned distances.

Mutation checks: dropping the zoom fails the fold-pair test and the curve-131 test; one zoom level only fails 131.

Odd-count sweep (a count that comes out even has certainly missed a square):

|                                              | old solver | new solver |
| -------------------------------------------- | ---------- | ---------- |
| morph seeds 1–3, every 0.25 s for 60 s (720) | 1 even     | 0 even     |
| `randomCurve` seeds 1–200                    | 5 even     | 0 even     |

Against grid 512 of the new solver on 340 curves (morph seeds 1–3 every 0.75 s, random seeds 1–100), both old and
new agreed everywhere: misses are rare, concentrated within ~0.1 s after a birth. Close to a birth (seed 1,
24.734–24.766 in 1 ms steps; 32.98–33.16 in 5 ms steps) the new solver returned odd counts at every sample.

Separation of a newborn pair on the 360-gon does not go to 0: tracking the pair back toward the birth time, it
levels off at about 1e-3 in parameter. Polygon folds happen when a corner crosses a vertex, not smoothly.

Cost, A/B against the old solver kept in a scratch module (Node 22, cloud container; median of 7 trials of
10 curves, three runs): old 41.3 / 40.6 / 40.5 ms, new 43.1 / 42.9 / 43.8 ms per solve. About +5%.

## Dedupe

Deduping by centre and side merged distinct squares on symmetric curves: a regular hexagon's three squares are 60°
turns of one another with the same centre and side, and the solver reported 1. `sameSquare` now also requires a
shared corner. The tracker's collision check uses it too.

## Degeneracy (#2)

`isDegenerate(curve, squares)`: a square is on a continuous family when the Jacobian has a null direction
(|J n| ≤ 1e-4 |J|) and Newton, started 4e-3 along it, converges to a square at least a third of that away instead of
back to the start. Flags a 256-gon circle, a regular octagon and a square; passes a smoothly perturbed circle, a
jittered octagon (both odd), random curves 1–4, a hexagon, and the near-fold curves above.

Not exercised: on every near-fold square tried, |J n| / |J| stayed at 5e-3 to 2e-2 (the polygon pair separation
floor above), so the fast exit returns before the Newton step; a mutation that skips the Newton step passes all
tests. The Newton step is there for smooth (spline) curves, where a fold's Jacobian is truly singular, and is
unverified until spline curves exist.

Jittering every vertex of a 256-gon circle by 2% gives 38–51 squares a grid step apart, with counts that change with
the grid and are often even. Such curves are unusable as levels; the level validator has to catch them by
comparing grids, since `isDegenerate` (correctly) passes them.

## Open items

- #6 stays open for the remaining limit: pairs under 1/250 of a grid cell, or two missed pairs at once. The level
  validator (next PR) compares grid 128 against grid 512 on every shipped level.
- #16: the `onFamily` Newton step and fold behaviour on smooth spline curves are unverified (above).
