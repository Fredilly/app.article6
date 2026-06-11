# Quick Check EvidenceSpanIndex Goals

## Goal details

Detailed instructions for pending goals live in:

`docs/quickcheck/evidence-span-index-goal-details.md`

Agents must read that file before starting any pending goal.

## Operating rules

- Work through one goal at a time.
- Each goal must be its own PR.
- Do not start the next goal until the previous PR is merged into `main`.
- Before each new goal, start from latest `main`.
- Never push a new goal to an old merged PR branch.
- Patch an existing PR only for review fixes before that PR is merged.
- New goal after merge = new branch + new PR.
- Do not weaken eval thresholds.
- Do not add LLM calls.
- Do not change UI unless the goal explicitly says so.
- Do not mark roadmap items complete unless explicitly instructed.
- Router remains the only source of truth for `answered`, `unclear`, and `no_evidence`.
- Document Q&A remains presentation-only.

## Completed goals

- [x] Goal 1 — PR #753: Merge router single-source-of-truth refactor.
- [x] Goal 2 — PR #753: Remove dead duplicate fallback/status logic from Document Q&A.
- [x] Goal 3 — PR #754: Define the EvidenceSpanIndex typed contract.
- [x] Goal 4 — PR #755: Build the in-memory EvidenceSpanIndex implementation.
- [x] Goal 5 — PR #759: Route section questions through EvidenceSpanIndex.
- [x] Goal 7 — PR #765: Replace remaining lexical/raw search with index-backed retrieval.
- [x] Goal 8 — PR #766: Add regression tests for no fake answers.
- [x] Goal 9 — PR #767: Add visible/technical agreement gate.

## Pending goals

- [ ] Goal 6: Route table questions through EvidenceSpanIndex.
- [ ] Goal 10: Decide whether to use external search tooling.

## Validation rule

For implementation PRs, run:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run quickcheck:eval:corpus -- --strict
```

For docs-only PRs, report that no runtime code, tests, UI, or eval thresholds changed.
