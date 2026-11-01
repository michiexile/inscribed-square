# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**How this file works.** Each entry is a current rule, invariant, or known limitation, plus a pointer to the
`.claude/WORKLOG-*.md`/`DESIGN-*.md` that holds its derivation (what was tried, measurements, repros). Derivations
go in the worklog, not here. Detail that matters for one subsystem only is in `.claude/rules/` (see "Subsystem notes").

## What this is

A game based on Toeplitz's inscribed square problem.

## Working stance

- Tests first: write the *discriminating* spec — one the plausible wrong answer fails — before the implementation.

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

## Subsystem notes (`.claude/rules/`)

Detail for one subsystem lives in a path-scoped rule file that loads when you read a file in its area. Read the matching
file before changing that subsystem; this table is the index, in case a rule did not load.

| file | covers | loads for |
|---|---|---|

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
  merge queue; `changelog.d/README.md`, `WORKLOG-changelog-fragments.md`).
- A cloud session (working on its own `claude/...` branch) may commit and push its own work to that branch at
  will, without asking first — the branch is disposable/session-scoped, not shared history. A local/interactive
  session working directly on a shared branch still waits to be asked; the project lead commits that work.
- **Driving a PR to green** (CI jobs and their local equivalents, how proactive to be): `.claude/skills/steward/SKILL.md`.


## Collaboration preferences

The project lead values intellectual honesty and direct pushback over agreement — say plainly when an approach is
a dead end, when benchmarks are mixed, or when a deliverable is unverified, rather than softening it. Don't reflexively hedge findings.
