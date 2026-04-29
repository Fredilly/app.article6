# Roadmaps

Start here: `docs/roadmaps/SUMMARY.md`.

Each roadmap lives at `docs/roadmaps/<slug>/` and must include:

- `PLAN.md` or `ROADMAP.md`
- `phase-status.json`

If a PR is part of a roadmap, include a machine-parseable directive in the PR body.

Current commercial sales-readiness lane: `project-readiness-verification-output`.

**Gate:** any PR with a `phase:*` label must include this block or CI will fail.

Directive format:

```
### Roadmap-Update
- slug: <slug>
- items:
  - RC5: in_progress
  - PR10: in_progress
```

Allowed statuses: planned | next | active | in_progress | done | blocked | deferred | frozen | parked

Use `RC<n>` to update a roadmap phase directly when the SSOT is phase-based, and
use `PR<n>` when the roadmap tracks explicit PR items. On merge, automation
updates `docs/roadmaps/<slug>/phase-status.json` and regenerates
`docs/roadmaps/SUMMARY.md`. `in_progress` is fine while a PR is open, but merged
items are finalized to `done` automatically. Manual edits to those files should
be avoided.
If no status changes are needed, the automation skips creating a bot PR.

Invariants:
- Roadmap slugs live only under `docs/roadmaps/`.
- `docs/projects/` must not contain folders that match roadmap slugs.
- Automation updates SSOT (`phase-status.json`) and regenerates SUMMARY.
