# Worklog: dwell before a find counts, 2026-11-01

Report (Mikael, after #9): in drag-centre mode he could scrub the centre wildly across the screen and collect every
square. Cause: #9 made finds snap at tolerance 0.05 and count on the first frame, so one frame passing over a
square's snap region was enough.

Change: `Hunt.hold(corners, error, now)` replaces `check`. A snapped square must be held on the same square for
`DWELL_MS = 500` ms (any frame off it restarts); the game draws a progress ring and keeps animating during the dwell.
Tests: a sweep that sits on a square 3 frames in 10 for 2 s collects nothing; a steady hold reports progress and
counts at the dwell; switching squares restarts. Headless Chromium: 120 scrub moves over curve 28 found 0 of 9,
then a steady hold found 1. The 500 ms value is a feel guess (#5).
