# Quick Check Evidence Search Tooling Decision

## Status

Proposed — Goal 10

## Context

Quick Check currently uses an in-memory `EvidenceSpanIndex` that wraps
existing `EvidenceDocument`, `ProjectFactContract`, and `SectionTableIndex`.
All lexical/fallback retrieval was moved into this index in Goal 7 (PR #765).

The index works correctly for the current corpus (7 fixtures, 56 questions)
and produces zero visible/Technical disagreements at 100% agreement rate.
However, the index performs linear-span scanning for lexical queries, which
would not scale to larger documents or many concurrent requests.

## Options considered

### 1. Stay with current in-memory EvidenceSpanIndex

| Factor | Assessment |
|--------|-----------|
| Implementation cost | Already done (PRs #754, #755, #759, #764, #765) |
| Deployment cost | None |
| Testability | Excellent — all tests pass, deterministic output |
| Provenance safety | Excellent — evidenceSpanIds map directly to document spans |
| Eval impact | All strict thresholds pass at 100% |
| Operational complexity | Zero — no external dependency |
| Scalability | Linear scan per query; adequate for single-document upload |

### 2. Postgres full-text search (tsvector / tsquery)

| Factor | Assessment |
|--------|-----------|
| Implementation cost | Medium — requires Postgres instance, schema migration, tokenization tuning |
| Deployment cost | Medium — Postgres already in stack for production data |
| Testability | Good — Postgres in CI is feasible |
| Provenance safety | Good — can store span IDs alongside indexed text |
| Eval impact | Unknown — scoring differences may change ranking |
| Operational complexity | Medium — new index maintenance, migration scripts |
| Scalability | Excellent — Postgres FTS scales well |

### 3. pgvector / sqlite-vec (embedding-based)

| Factor | Assessment |
|--------|-----------|
| Implementation cost | High — requires embedding model, vector pipeline |
| Deployment cost | High — embedding inference latency/cost |
| Testability | Medium — embeddings are non-deterministic |
| Provenance safety | Low — vector similarity ≠ quote validation |
| Eval impact | High risk — would require rethinking the eval approach |
| Operational complexity | High — embedding API, vector storage, re-indexing |
| Scalability | Excellent for semantic search |

### 4. Typesense / Meilisearch

| Factor | Assessment |
|--------|-----------|
| Implementation cost | High — new service, API integration, schema design |
| Deployment cost | High — separate service to run and monitor |
| Testability | Medium — needs running service in CI |
| Provenance safety | Medium — can index span metadata alongside text |
| Eval impact | Unknown — different tokenization/scoring |
| Operational complexity | High — service monitoring, failover, latency |
| Scalability | Excellent |

## Recommendation

**Stay with the in-memory EvidenceSpanIndex for now.**

Rationale:

1. **Current scale fits.** Quick Check processes one uploaded document
   at a time (typically 10–200 pages). Linear span scanning is adequate.

2. **All evals pass at 100%.** Changing the retrieval layer risks
   regressions in fact extraction, provenance correctness, unsupported
   rejection, and visible/Technical agreement — all currently at 100%.

3. **The router is the differentiator.** Quick Check's value is not
   in search recall — it's in deterministic evidence validation,
   methodology-rule matching, and quote provenance. A faster search
   layer does not improve those.

4. **Provenance safety.** The current index returns evidenceSpanIds
   that map directly to document spans. External search tools would
   need to preserve this mapping, adding integration risk.

5. **Revisit when scale demands it.** If Quick Check moves to
   multi-document corpus search or indexed retrieval across hundreds
   of projects, Postgres FTS (option 2) is the natural next step
   since Postgres is already in the deployment stack.

## Decision

**Conditionally accepted.** Stay with in-memory EvidenceSpanIndex.
Reconsider Postgres FTS when one of these triggers fires:

- Average document size exceeds 500 pages
- Per-query latency exceeds 50ms
- More than 3 concurrent users
- Multi-document corpus search is needed

## Validation

This is a docs-only change. No runtime code, tests, UI, or eval
thresholds changed.
