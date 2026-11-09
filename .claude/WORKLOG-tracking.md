# Worklog: morphing curves, square tracking and Avoid Folds (phase 3), 2026-11-09

## Morph

`MorphingCurve(seed)`: harmonics 2–7, each amplitude a_k(τ) = base_k · (1 + 0.5 sin(ω_k τ + ψ_k)), with
ω_k ∈ [0.1, 0.3] rad/s and phases drifting at ±0.05–0.2 rad/s. The bases sum to 0.85 / 1.5, so the amplitude sum
never exceeds 0.85 (simple) and every harmonic stays above 0.016 (no rotational symmetry, #2). No renormalisation:
that keeps the vertex speed bound analytic (`maxSpeed`, about 0.13–0.17 curve units/s on seeds 1–5).

Square count every 1 s over 120 s, grid 128: count changes 19–31 times per seed (seeds 1–5), so a fold happens about
every 4–6 s somewhere on the curve. Seed 1 every 0.25 s for 20 s agreed between grid 128 and grid 384 at every
sample (3 → 5 at 7.75–8 s, 7 → 5 at 16–16.25 s; these are the test fixtures).

## Tracker

`SquareTracker.advance`: Newton (`refineFrom`, which starts from all four parameters) on each square, in sub-steps of
at most 1/60 s. `refine` with u, v recomputed by nearest point is not good enough here: it can pick the far branch.

Long runs, seeds 1–3, 120 s at 60 fps, with a full solve adopted every 0.5 s (Node):

- 0.08–0.09 ms per frame for `advance` (3–9 squares).
- Track count vs full solve, compared at every adoption: 1 mismatch in 720 comparisons.
- Death causes: Newton failure (most), collision (two squares landing on the same square: 1–2 per run). A jump to a
  distant square (centre moved > 0.05 in one step) never happened, so the jump check was dropped. Too-small: never.
- Unpaired deaths (one square dying alone) happen 2–6 times per run. The one inspected (seed 1, 48.40 s) was genuine:
  a pair was born less than 0.3 s before the fold, between adoptions, and one of the new pair folded with the tracked
  square, leaving its sibling. To the player this looks like the square hopping a short distance; the grace window
  covers it.

Fold test: the tracker's two deaths land within 0.05 s of the time a grid-256 full solve loses two squares (bisected
to 2 ms). Mutation check: dropping the collision rule fails the collision test (one square under two ids for a frame);
dropping the gap update fails the warning test.

## Game

`AvoidFolds` (pure, `src/game/folds.ts`): latch at error ≤ tolerance and centre/side within 2 × tolerance; stay
latched within 3 × tolerance; the latched square's death or slipping off starts a 3 s grace; latching again after a
fold-death counts a save. Score is seconds latched.

`FoldsMode` runs the morph clock (capped at 0.1 s per frame, so a hidden tab doesn't ask the tracker for thousands of
steps), the tracker, and a module worker (`solveWorker.ts`) that full-solves the current time at most every 150 ms;
results are carried forward and adopted.

Headless Chromium, level Drift, drag-centre held still on a square from t = 0: latched immediately, held 11.1 s while
births took the count from 3 to 5 and the warning turned the square orange, then lift → grace countdown → round
over. No console errors.

## Levels

Per Mikael (2026-11-09): Square Hunt and Avoid Folds are separate retained modes; each level launches one. `levels.ts`
holds the list and the URL routes (`#hunt-2`, `#folds/123`; old `#123` links open Square Hunt on that random curve).
The fixed default curve is gone: it had one square (playtest 1), and the start page is now the level menu.

## Open items

- #12: morph speed, grace time, latch slack, warning gap and solve rate are guesses.
- #6: a square the full solver misses can't be latched until a later solve finds it.
