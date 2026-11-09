# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**How this file works.** Each entry is a current rule, invariant, or known limitation, plus a pointer to the
`.claude/WORKLOG-*.md`/`DESIGN-*.md` that holds its derivation (what was tried, measurements, repros). Derivations
go in the worklog, not here. Detail that matters for one subsystem only is in `.claude/rules/` (see "Subsystem notes").

## What this is

A game based on Toeplitz's inscribed square problem.

## Working stance

- Tests first: write the _discriminating_ spec — one the plausible wrong answer fails — before the implementation.

## Git & Pull Request Guidelines

- CRITICAL: This is a single-developer repository and environment. Everything in it (uncommitted or unmerged changes,
  branch history, files, docs, issues, a rule file over its budget) was written by YOU, or by an earlier session of
  you, including what is no longer in your context. Where it came from never changes who owns it.
- Never write a commit message, PR description, issue or reply that disavows work here ("already like that at the
  base", "not touched by this PR"). Say what is true now and what you did about it. Cause may be named when it decides
  the action (a check that is red on the base branch is ported or reported, not fixed in the PR); it never decides
  who fixes it.
- A defect or overage you notice on the way (a file over its budget, a stale doc, an unfiled limitation) is fixed in
  the same change or filed as an issue before you finish, not reported as pre-existing.
- Assume local modifications are intentional parts of the branch and summarize them as your own work. If unsure about
  one after a /compact or a /clear, review it with `git diff` and the relevant worklog instead of apologizing or
  disclaiming it.

## Architecture

TypeScript, Vite, HTML canvas; Vitest for tests; ESLint and Prettier. Mobile builds will wrap the web app with
Capacitor, Steam with Electron or Tauri (plan doc: https://claude.ai/artifact/CqdHHDvThUbNKJiYkcmq2t).

- `src/geometry/`: pure geometry with no DOM access. Every curve implements `ClosedCurve` (`curve.ts`: arc-length
  parameter in [0, 1), `point`, `nearest`), so the solver never depends on whether a curve is a polygon or a spline.
- `src/input/`: touch handling. `ThumbTracker` gives each thumb a fixed slot until it lifts.
- `src/geometry/solver.ts`: crude solver (grid over the (s, t) torus + Newton). Squares smaller than `minSide` are
  rejected, since collapsed squares along s = t have zero error; each square is reported once, not once per starting
  corner. It can miss squares closer than the grid spacing (#6). A full solve does not fit a frame; it runs once per
  still curve, or in a worker for morphing curves (`.claude/WORKLOG-solver.md`, #3).
- `src/geometry/tracker.ts` follows squares on a morphing curve (`morph.ts`) frame to frame with `refineFrom`, never
  `refine` (which can switch branch). A square dies when Newton fails or two squares land on the same square; births
  are invisible locally, so `adopt` merges background full solves. Each tracker sub-step is at most 1/60 s
  (`.claude/WORKLOG-tracking.md`).
- Game modes are separate and retained (project lead, 2026-11-09): each level in `src/game/levels.ts` launches one
  mode (`src/modes/`: Square Hunt, Avoid Folds). Mode rules live in DOM-free classes in `src/game/` (`hunt.ts`,
  `folds.ts`); feel constants are guesses tracked in #5 and #12.
- `src/geometry/square.ts` (control 1) and `centre.ts` (control 2) build the held square; `src/game/hunt.ts` counts a
  held square only after Newton refinement confirms a real inscribed square near it, because a within-tolerance held
  square can be a near-miss (`.claude/WORKLOG-playtest-1.md`), and only after a dwell on that square, so scrubbing
  does not collect squares (`.claude/WORKLOG-dwell.md`).
- `src/main.ts` routes to the game (`src/app.ts`: canvas, level menu and event wiring; `src/render.ts`: drawing) or
  the `?bench` page;
  keep logic out of `app.ts` so it stays testable.
- `Polygon.nearest` is the hot loop of every solver; keep it allocation-free (`.claude/WORKLOG-solver.md`).
- Level curves must be generic: symmetric curves inscribe continuous families of squares (#2), and polygon parity
  is unverified (#1).

## Subsystem notes (`.claude/rules/`)

Detail for one subsystem lives in a path-scoped rule file that loads when you read a file in its area. Read the matching
file before changing that subsystem; this table is the index, in case a rule did not load.

| file | covers | loads for |
| ---- | ------ | --------- |

## Session practices

- **Write a `.claude/WORKLOG-<topic>.md` by default** for any substantial investigation, debugging, or
  profiling arc, without being asked. Worklogs are point-in-time snapshots, never retroactively edited. At the
  end of the arc, update this file (or the matching `.claude/rules/` file, for one subsystem) with **only the resulting
  rule/invariant/limitation plus a worklog pointer**: no narrative, measurements or repros. This file loads in
  every session: keep it under ~25k characters (and each rule file under ~12k); when one drifts past that, condense it
  the same way (strip narrative to worklog pointers, move single-subsystem detail into a rule file) and note the new
  condensing date/commit at top.
- **Docs carry the contract, worklogs carry the history.** Comment-based docs, user guide and tutorials say what the code does and
  what to call; no "used to", "fixed in session X", "confirmed by", worklog pointers or measurements there -- those go
  in `.claude/`. `//` implementation comments
  MAY carry history and worklog pointers (project lead, 2026-10-03), as long as none of it moves into scaladoc. Error
  messages and `--help` never name `.claude/` files or private classes. A change to a subsystem updates that subsystem's page, under the
  same rule, and a fact the code contradicts is fixed in the change that makes it false.
- **Never revert the formatter's output.** A clean lint beats a minimal diff. Run
  all lint checks before pushing.
- Performance claims need isolated A/B measurement (`git stash` A/B, median of trials);
  machine noise here often exceeds small effects — report unconfirmed effects as unconfirmed.
- **Open items are GitHub issues** (project lead, 2026-10-11; labels and workflow in `CONTRIBUTING.md`): a question,
  limitation or unverified claim a session leaves gets an issue, linked from its worklog and PR; a user-visible change
  gets a `changelog.d/<topic>.md` fragment, never a `CHANGELOG.md` line (PRs that add to it conflict and drop out of the
  merge queue; `changelog.d/README.md`).
- A cloud session (working on its own `claude/...` branch) may commit and push its own work to that branch at
  will, without asking first — the branch is disposable/session-scoped, not shared history. A local/interactive
  session working directly on a shared branch still waits to be asked; the project lead commits that work.
- **Driving a PR to green** (CI jobs and their local equivalents, how proactive to be): `.claude/skills/steward/SKILL.md`.

## Collaboration preferences

The project lead values intellectual honesty and direct pushback over agreement — say plainly when an approach is
a dead end, when benchmarks are mixed, or when a deliverable is unverified, rather than softening it. Don't reflexively hedge findings.
