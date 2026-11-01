# Worklog: crude solver and static prototype (phase 2), 2026-11-01

## Formulation

- Control 1 square: corners A = γ(s), B = γ(t), C = B + R(B − A), D = A + R(B − A) with R = +90° rotation, so the
  square sits left of A → B and runs counter-clockwise. The square on the _right_ of s → t equals the left square of
  t → s, so one orientation over the whole (s, t) torus covers both; each inscribed square appears 4 times (once per
  starting corner), and the solver dedupes by centre and side.
- Collapsed squares along s = t have zero error. The solver excludes pairs closer than minSide / 2 on the grid and
  rejects refined squares smaller than minSide (default length / 50). Mutation check: dropping the minSide filter
  makes the obtuse-triangle test fail; dropping the dedupe makes both triangle tests fail.
- Refinement: Newton on (s, t, u, v) with residual (C − γ(u), D − γ(v)) ∈ R⁴, analytic Jacobian from
  `ClosedCurve.tangent`, backtracking line search. Converges on polygons because inscribed-square corners of a
  generic polygon lie inside edges, where γ is linear.
- Known-answer tests: a triangle inscribes exactly one square per side with both adjacent angles ≤ 90°
  (side a·h/(a+h)); acute → 3, obtuse → 1. Random generic Fourier curves (seeds 1–8) give odd counts (six 1s, two 3s).

## Performance (issue #3)

`Polygon.nearest` dominated: allocating `Vec` objects per segment cost ~110 ns/segment. Rewriting it over
precomputed `Float64Array` edge arrays, A/B by `git stash`, median of 7, three runs each (Node 22, cloud container):

|                                | before     | after        |
| ------------------------------ | ---------- | ------------ |
| 32768 nearest calls, 240-gon   | 833–884 ms | 30.5–31.6 ms |
| findSquares, grid 128, 240-gon | 887 ms     | 33–37 ms     |

`npm run bench` after the change (Node 22, cloud container, median ms; headless Chromium via `?bench` was within ~15%):

| vertices | grid 128 | grid 256 | grid 512 |
| -------- | -------- | -------- | -------- |
| 100      | 21       | 66       | 260      |
| 200      | 30       | 125      | 452      |
| 500      | 61       | 256      | 994      |

Conclusion so far: a full solve is fine once per static curve but does not fit a 16 ms frame even at grid 128 on a
desktop-class CPU, so the morphing phase needs per-frame local tracking (Newton from last frame's squares) with
full solves only occasionally. Phone numbers are still to be measured with `?bench` (issue #3 stays open).

Drag-centre fit (`fitSquareAtCentre`, 24×32 coarse grid + pattern search, 240-gon): ~4–5 ms per call in Node.
Phone cost unmeasured; draws are coalesced to one per animation frame.

## Open items

- #5: tolerance (0.03) and drag-centre stickiness (0.7) are guesses to settle in playtest.
- #6: the crude solver can miss squares closer than the grid spacing; the HUD reports player finds it missed.
- #2: on symmetric curves the solver returns an arbitrary sample of the continuous family (documented on `findSquares`).
