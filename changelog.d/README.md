# Changelog fragments

Each user-visible change adds one file here, `changelog.d/<topic>.md`, instead of editing `CHANGELOG.md`.
Separate files never conflict between branches, so pull requests do not block each other on the changelog.

A fragment is one or a few Markdown bullet points, written for players, saying what changed:

```markdown
- Two thumbs can now each drag a corner along the curve.
```

At release time the fragments are concatenated into `CHANGELOG.md` under the new version and deleted.
