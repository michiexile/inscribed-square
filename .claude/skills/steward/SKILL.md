---
name: steward
description: Drive a pull request in this repo to green - which CI jobs exist, their local equivalents, and how proactive to be.
---

# Steward

## CI jobs and local equivalents

| CI job (`.github/workflows/ci.yml`) | Local command                                         |
| ----------------------------------- | ----------------------------------------------------- |
| typecheck                           | `npm run typecheck`                                   |
| lint (ESLint and Prettier)          | `npm run lint` (fix formatting with `npm run format`) |
| test (Vitest)                       | `npm test`                                            |
| build (Vite)                        | `npm run build`                                       |

`npm run check` runs all four in CI's order. Run it before every push.

`.github/workflows/pages.yml` deploys `main` to GitHub Pages; it does not run on pull requests.

## How proactive to be

- On a cloud session's own `claude/...` branch: reproduce a red check locally, fix it, show the same check passing, push.
- Never skip, disable or loosen a test or lint rule to get green.
- Keep each fix to what the failure needs; anything else noticed on the way is fixed in the same PR or filed as an issue.
