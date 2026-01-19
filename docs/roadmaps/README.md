# Roadmaps

Each roadmap lives at `docs/roadmaps/<slug>/` and must include:

- `PLAN.md`
- `phase-status.json`

If a PR is part of a roadmap, include the roadmap metadata in the PR title or body:

- Preferred title format: `[RM:<slug>]` and item like `PR10` in the title
- Or in the body:
  - `Roadmap: <slug>`
  - `Roadmap-Item: PR10`

If a PR declares a roadmap slug/item, the PR must update the matching
`docs/roadmaps/<slug>/phase-status.json` entry to `in-progress` or `merged`.
