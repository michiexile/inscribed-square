# Worklog: first phone playtest follow-up, 2026-11-01

## Report (Mikael)

Curve 992259: found two squares, could not reach a third. Two-corners made him rotate the phone a lot (#8);
drag-centre showed transitions between fits clearly but fine positioning was fiddly. Curves felt simple and
convex, and nearly every curve had one square.

## Diagnosis of curve 992259

- Solver at grid 128 and 512: exactly 1 square (side 1.343, centre (0.066, 0.008)).
- Grid 256 local minima of the two-corner max error: the true square (4 representations, 0.008–0.017 at grid
  resolution), then near-misses. Pattern search on them: best two-corner error 0.036, 0.038, 0.049, 0.054.
- Drag-centre near the first near-miss: best max-corner error 0.0227 at centre (0.059, -0.145). Four free corners
  spread the error, so it went under the old 0.03 tolerance, and `Hunt` counted it as a square "the solver missed".
  So the second find was a false positive and the third square does not exist.

## Changes

- `Hunt.check` now refines the held square with Newton and counts it only if a real inscribed square lies within
  2 × tolerance (centre and side); the found square is that exact square, and the game snaps onto it. Regression test
  uses the old curve's harmonics (the generator changed, so seed 992259 now gives a different curve).
- Tolerance raised from 0.03 to 0.05 (#5): with verification it only widens the snap, it can't admit near-misses.
- `randomCurve`: harmonics 2–7 with amplitudes summing to 0.55–0.85 (was 2–5, each 0.02–0.14), 360 vertices.
  Seeds 1–30, grid 128 vs 384 agree on every count: 1 square ×3, 3 ×14, 5 ×7, 7 ×5, 9 ×1. Solve time ~50–60 ms in
  Node (was ~35 ms at 240 vertices). Old seeds now map to different curves.
