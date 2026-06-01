# Quick Check Document Pipeline

Status is sourced from `docs/roadmaps/quick-check-document-pipeline/phase-status.json`; docs must not drift.

Goal: move Quick Check from tactical heading/alias patching to a layered document pipeline with explicit parser, document-model, retrieval, evaluation, and eval boundaries.

## Why this lane exists

PR `#665` is the last tactical stabilization PR for Quick Check section matching and result display hardening.

After that point, Quick Check should stop absorbing one-off alias and edge-case patches into retrieval logic. The system needs a stable document pipeline so parser behavior, review-area routing, evidence sufficiency, and UI output no longer drift together.

The Article6 moat is not raw PDF extraction. The moat is methodology-aware evidence judgment on top of a parser-neutral document representation.

## Target pipeline

```text
uploaded document
-> parser adapter
-> Article6 canonical document model
-> section retrieval
-> evidence evaluation
-> UI output
-> eval harness
```

## Principles

- Do not build parser/vendor lock-in into Quick Check logic.
- Do not let retrieval and evidence sufficiency share one heuristic layer.
- Do not render raw extracted text directly in the UI.
- Do not add new Quick Check alias or edge-case patches after PR `#665` unless they are required for migration safety.
- Keep parser integration commodity; keep Article6 review judgment proprietary.

## Phase plan

### Phase 1 — Parser adapter boundary

Objective: add `src/lib/documentParsing/` and move the current extractor behind an adapter boundary without changing retrieval/evaluation behavior.

Scope:

- Add parser adapter types and registry.
- Keep the current extractor as adapter `current-extractor`.
- Route Phase 1 Quick Check parsing reads through the adapter boundary where safe.
- Do not start LiteParse in this phase.
- Do not refactor retrieval/evaluation in this phase.
- Do not add new section aliases or edge-case matcher patches in this phase.

Exit criteria:

- `src/lib/documentParsing/` exists with a parser-neutral contract.
- The current extractor is accessible only as an adapter implementation.
- Quick Check review-question code can consume parsed headings/sections through the adapter boundary without changing verdict logic.

### Phase 2 — Canonical Article6 document model

Objective: add `src/lib/documentModel/` as the single canonical document representation consumed by Quick Check.

Scope:

- Define canonical section, hierarchy, provenance, normalized title, cleaned body, display snippet, extraction flags, and confidence surfaces.
- Preserve raw extracted text separately for citations/debug.
- Keep parser adapters responsible only for parsing; they must not emit Article6 verdicts.

Exit criteria:

- Quick Check retrieval/evaluation no longer depends on parser-native section structures.
- Canonical document model is the only downstream input contract.

### Phase 3 — Retrieval / evaluation split

Objective: separate section retrieval from evidence sufficiency evaluation.

Scope:

- Retrieval returns ranked candidate sections plus reasons and confidence.
- Evaluation returns sufficiency status, missing signals, follow-up docs, and citations.
- Retrieval does not emit verdicts.
- Evaluation does not rediscover section relevance from scratch.

Exit criteria:

- Review-question routing and rubric judgment are independently testable.
- A retrieval change cannot silently change evidence sufficiency semantics.

### Phase 4 — Declarative review policy

Objective: move review-area behavior into typed JSON config validated by Zod.

Scope:

- Review-area aliases
- Preferred sections
- Negative sections
- Fallback rules
- Ranking boosts and penalties
- Required evidence signals
- Weak evidence signals

Exit criteria:

- Adding or changing review policy is primarily config work, not matcher patching.
- Config validation fails fast in CI when policy shape drifts.

### Phase 5 — Quick Check eval harness

Objective: gate changes with real fixture-backed retrieval and verdict expectations.

Scope:

- Real fixture corpus across methodology/document styles
- Expected retrieval outputs
- Expected verdict/status outputs
- Regression CLI and CI gate

Exit criteria:

- Quick Check pipeline changes are evaluated before merge.
- Known failures stop reappearing as tactical regressions.

### Phase 6 — Secondary parser adapter

Objective: add LiteParse as a second parser adapter after the boundary and document model are stable.

Scope:

- Implement LiteParse behind the same adapter contract.
- Keep canonical document model output stable.
- Keep retrieval/evaluation unchanged when switching adapters.
- Do not add tactical alias patches while introducing the adapter.

Exit criteria:

- Parser choice is swappable.
- Quick Check logic remains Article6-owned and parser-neutral.

## Out of scope for this lane

- OPA
- Drools
- Redis
- Event-driven infrastructure
- LLM-first scoring
- New Quick Check tactical alias patches after PR `#665`

## Execution order

1. Phase 1 — parser adapter boundary
2. Phase 2 — canonical document model
3. Phase 3 — retrieval / evaluation split
4. Phase 4 — declarative review policy
5. Phase 5 — eval harness
6. Phase 6 — secondary parser adapter

## Immediate next action

Continue Phase 6 by wiring LiteParse behind the existing parser adapter contract with env-based selection and safe fallback, while keeping canonical document model output stable, leaving retrieval/evaluation behavior unchanged, and avoiding new tactical alias patches.
