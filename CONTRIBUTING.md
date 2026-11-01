# Contributing

## Setup

Requires Node 22.

```sh
npm ci
npm run dev      # dev server, reachable from a phone on the same network
npm run check    # typecheck, lint, tests and build: what CI runs
npm run format   # apply Prettier
npm run bench    # time the solver in Node
```

Open the game with `?bench` (for example `https://michiexile.github.io/inscribed-square/?bench`) to time the solver
on a phone.

## Workflow

- Work on a branch and open a pull request against `main`. CI must be green before merging.
- Tests first: write a test that a plausible wrong implementation fails, then the implementation.
- A user-visible change adds a fragment in `changelog.d/` (see `changelog.d/README.md`), never a line in `CHANGELOG.md`.
- Open questions, known limitations and unverified claims are GitHub issues, linked from the pull request.

## Issue labels

- `math`: a mathematical claim the game relies on that needs checking.
- `solver`: the geometry solver.
- `design`: game design and controls.
- `bug`: something that behaves wrongly.

## Deploys

Every push to `main` deploys the game to GitHub Pages at `https://michiexile.github.io/inscribed-square/`.
