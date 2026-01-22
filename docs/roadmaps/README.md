# Roadmaps

Each roadmap lives at `docs/roadmaps/<slug>/` and must include:

- `PLAN.md`
- `phase-status.json`

If a PR is part of a roadmap, include a machine-parseable directive in the PR body.

**Gate:** any PR with a `phase:*` label must include this block or CI will fail.

Directive format:

```
### Roadmap-Update
- slug: <slug>
- items:
  - PR10: in_progress
```

Allowed statuses: planned | next | in_progress | done | blocked

On merge, automation updates `docs/roadmaps/<slug>/phase-status.json` and
regenerates `docs/projects/ROADMAP.md`. `in_progress` is fine while a PR is open,
but merged PR items are finalized to `done` automatically. Manual edits to those
files should be avoided.
