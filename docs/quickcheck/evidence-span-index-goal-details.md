# Quick Check EvidenceSpanIndex Goal Details

## Operating rules

- Use this file only for the current pending goal.
- Do not work on multiple goals in one PR.
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

---

# Goal 5: Route section questions through EvidenceSpanIndex

## Status

Pending

## Branch

`feat/evidence-span-index-section-routing`

## Goal

Make section-style Quick Check questions use `EvidenceSpanIndex` for candidate retrieval.

Section-style questions include:

- What does the document say about leakage?
- What does the document say about monitoring?
- What does it say about additionality?
- What is the baseline scenario?
- What does the document say about safeguards?
- What does the document say about environmental impacts?
- What does the document say about stakeholder consultation?

## End result

Section questions retrieve candidate evidence spans from `EvidenceSpanIndex`.

The router still validates the evidence.

The router still decides final status:

- `answered`
- `unclear`
- `no_evidence`

Document Q&A still only displays the router result.

## Required flow

Section-style question  
→ Query intent identifies section/topic need  
→ EvidenceSpanIndex returns section candidate spans  
→ Router validates candidates  
→ Router decides final status  
→ Document Q&A displays router result

## Acceptance criteria

- Section-style questions use `EvidenceSpanIndex` candidates.
- Router remains the only final status decision-maker.
- Document Q&A remains presentation-only.
- Every answered section question has `evidenceSpanIds`.
- Every answered section question has quote/page/section provenance.
- Unsupported section questions return `no_evidence`.
- Existing fact questions still work.
- Existing country/location behavior still passes.
- Existing Phase 6 evals pass.
- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm test` passes.
- `npm run quickcheck:eval:corpus -- --strict` passes.
- No thresholds weakened.

## Do not

- Do not let `EvidenceSpanIndex` produce final answers.
- Do not let `EvidenceSpanIndex` produce final statuses.
- Do not reintroduce Document Q&A scoring.
- Do not bypass the router.
- Do not change UI.
- Do not add LLM calls.
- Do not mark roadmap items done.
- Do not weaken eval thresholds.

---

# Goal 6: Route table questions through EvidenceSpanIndex

## Status

Pending

## Branch

`feat/evidence-span-index-table-routing`

## Goal

Make table-backed questions retrieve table evidence through `EvidenceSpanIndex`.

## End result

Questions that need table evidence return table-backed candidate spans or cells with provenance.

The router validates table-backed evidence and decides final status.

Document Q&A only displays the router result.

## Acceptance criteria

- Table questions use `EvidenceSpanIndex` candidates.
- Table candidates include table id where available.
- Table candidates include row/cell provenance where available.
- Table candidates include `evidenceSpanIds` where available.
- Router validates table-backed evidence.
- No answer is returned without validated evidence.
- Router remains the only final status decision-maker.
- Document Q&A remains presentation-only.
- Typecheck, lint, npm test, and strict eval pass.
- No thresholds weakened.

## Do not

- Do not make table retrieval bypass the router.
- Do not invent table evidence.
- Do not add LLM table interpretation.
- Do not change UI.
- Do not mark roadmap items done.
- Do not weaken evals.

---

# Goal 7: Replace remaining lexical/raw search with index-backed retrieval

## Status

Pending

## Branch

`feat/evidence-span-index-fallback-retrieval`

## Goal

Remove remaining homemade keyword/raw text retrieval paths from router internals.

All fallback retrieval should go through `EvidenceSpanIndex`.

## End result

Quick Check no longer has duplicate raw-text or lexical candidate builders outside the evidence/index layer.

The router receives candidates from:

- `ProjectFactContract`
- `SectionIndex`
- `TableIndex`
- `EvidenceSpanIndex`

The router validates candidates and decides final status.

## Acceptance criteria

- No direct raw text evidence search outside parser/evidence compiler/index layer.
- No duplicate lexical candidate builders.
- Router gets fallback candidates from `EvidenceSpanIndex`.
- Every answered result has `evidenceSpanIds`.
- Every answered result has validated quote/page/section provenance.
- Unsupported questions still return `no_evidence`.
- Document Q&A remains presentation-only.
- Typecheck, lint, npm test, and strict eval pass.
- No thresholds weakened.

## Do not

- Do not remove provenance.
- Do not weaken quote validation.
- Do not reintroduce visible-answer scoring.
- Do not let `EvidenceSpanIndex` decide final status.
- Do not change UI.
- Do not add LLM calls.
- Do not mark roadmap items done.

---

# Goal 8: Add regression tests for no fake answers

## Status

Pending

## Branch

`test/quickcheck-no-fake-answers`

## Goal

Lock in refusal behavior for unsupported questions.

Quick Check must not answer when the uploaded document does not support the question.

## End result

Unsupported questions reliably return `no_evidence`.

Document Q&A cannot promote unsupported answers.

Router cannot answer without validated evidence.

## Test examples

Add unsupported-question coverage for:

- marine biodiversity offsets
- tax credits
- political risk insurance
- unrelated legal requirements
- unrelated project technologies
- anything not present in the uploaded document

## Acceptance criteria

- Unsupported questions return `no_evidence`.
- Document Q&A cannot promote unsupported answers.
- Router cannot answer without `evidenceSpanIds`.
- Router cannot answer without validated quotes.
- Tests cover at least 3 unsupported question types.
- Tests cover at least one unsupported fact-style question.
- Tests cover at least one unsupported section-style question.
- Typecheck, lint, npm test, and strict eval pass.
- No thresholds weakened.

## Do not

- Do not weaken unsupported rejection thresholds.
- Do not add generic fallback answers.
- Do not add LLM guesses.
- Do not change UI copy unless required by tests.
- Do not mark roadmap items done.

---

# Goal 9: Add visible/technical agreement gate

## Status

Pending

## Branch

`test/quickcheck-visible-router-agreement-gate`

## Goal

Make router/display disagreement impossible to sneak back into CI.

## End result

CI fails when visible answer status and router status drift.

The visible answer must stay derived from RouterResult.

## Acceptance criteria

- `visibleAnswerAgreementRate` remains enforced.
- Disagreement threshold is explicit.
- CI fails on router/display disagreement.
- Tests prove Document Q&A follows RouterResult.
- Tests prove Document Q&A cannot independently promote `no_evidence`.
- Tests prove Document Q&A cannot independently downgrade `answered`.
- Typecheck, lint, npm test, and strict eval pass.
- No thresholds weakened.

## Do not

- Do not loosen the agreement threshold.
- Do not hide disagreements from metrics.
- Do not allow Document Q&A to independently derive status.
- Do not change UI.
- Do not add LLM calls.
- Do not mark roadmap items done.

---

# Goal 10: Decide whether to use external search tooling

## Status

Pending

## Branch

`docs/evidence-search-tooling-decision`

## Goal

Write a short technical decision document comparing search/index options.

Do not implement a new search dependency yet.

## End result

A decision document exists comparing whether Quick Check should stay with the in-memory EvidenceSpanIndex for now or later adopt an external/indexed search layer.

Compare:

- current in-memory EvidenceSpanIndex
- Postgres full-text search
- pgvector
- SQLite FTS
- sqlite-vec
- Typesense / Meilisearch if relevant

## Acceptance criteria

- Decision doc added.
- Compares implementation cost.
- Compares deployment cost.
- Compares testability.
- Compares provenance safety.
- Compares eval impact.
- Compares operational complexity.
- Makes one recommendation.
- No runtime behavior change.
- No router behavior change.
- No Document Q&A behavior change.
- Typecheck passes if required by CI.
- npm test passes if required by CI.

## Do not

- Do not add a database dependency in this PR.
- Do not add vector search in this PR.
- Do not add Typesense or Meilisearch in this PR.
- Do not change router behavior.
- Do not change Document Q&A behavior.
- Do not mark roadmap items done.
- Do not weaken evals.

---

# Validation commands

For implementation PRs, run:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run quickcheck:eval:corpus -- --strict
```

For docs-only PRs, report that no runtime code, tests, UI, or eval thresholds changed.
