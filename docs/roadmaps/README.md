# Roadmaps

Start here: `docs/roadmaps/SUMMARY.md`.

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

Allowed statuses: planned | next | active | in_progress | done | blocked | deferred | frozen | parked

On merge, automation updates `docs/roadmaps/<slug>/phase-status.json` and
regenerates `docs/roadmaps/SUMMARY.md`. `in_progress` is fine while a PR is open,
but merged PR items are finalized to `done` automatically. Manual edits to those
files should be avoided.
If no status changes are needed, the automation skips creating a bot PR.

Invariants:
- Roadmap slugs live only under `docs/roadmaps/`.
- `docs/projects/` must not contain folders that match roadmap slugs.
- Automation updates SSOT (`phase-status.json`) and regenerates SUMMARY.
