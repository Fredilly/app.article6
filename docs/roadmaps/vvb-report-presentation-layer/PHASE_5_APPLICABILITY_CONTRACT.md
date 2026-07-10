# Phase 5: Applicability Contract

## Scope

`deriveApplicability` is the generic, pure gate between a finalized Evidence Map
row and conformance conclusion. It makes applicability an explicit assessment;
it never derives applicability from evidence, search, status, or text.

Implementation: `src/lib/evidence/applicabilityContract.ts`

Focused contract test: `tests/lib/evidence/applicabilityContract.test.ts`

## Input contract

The candidate is `unknown` and is validated first with
`validateEvidenceMapDependency`. The explicit assessment is:

```ts
type ApplicabilityAssessmentInput = Readonly<{
  decision: "APPLICABLE" | "NOT_APPLICABLE" | "NOT_EVALUATED";
  decisionBasis: string | null;
}>;
```

`APPLICABLE` and `NOT_APPLICABLE` require non-empty basis text.
`NOT_EVALUATED` is an explicit blocked decision and does not require a basis.
The row's finalized `applicabilityState` is canonical; a successful assessment
must match it exactly.

## Output contract

Successful outputs preserve the Evidence Map row ID:

```ts
{ applicability: "APPLICABLE"; evidenceMapRowId: string;
  basis: "explicit_applicable_decision" }
{ applicability: "NOT_APPLICABLE"; evidenceMapRowId: string;
  basis: "explicit_not_applicable_decision" }
```

Blocked output is:

```ts
{ applicability: "NOT_ASSESSED"; evidenceMapRowId: string | null;
  blockedBy: readonly ApplicabilityContractBlock[] }
```

The result is typed, deterministic, and does not mutate either input.

## Decision table

| Finalized row state | Explicit assessment | Result |
| --- | --- | --- |
| `APPLICABLE` | `APPLICABLE` plus basis | `APPLICABLE` |
| `NOT_APPLICABLE` | `NOT_APPLICABLE` plus basis | `NOT_APPLICABLE` |
| `UNKNOWN` | any decision | `NOT_ASSESSED` |
| any state | missing/malformed decision | `NOT_ASSESSED` |
| any state | `NOT_EVALUATED` | `NOT_ASSESSED` |
| any state | supported decision without basis | `NOT_ASSESSED` |
| state and supported decision disagree | supported decision | `NOT_ASSESSED` |

`MISSING`, `UNCLEAR`, `answered`, `unclear`, and `no_evidence` remain upstream
values. They cannot create `NOT_APPLICABLE`. Search failure, insufficient
support, absent quotes, and empty evidence arrays likewise cannot create it.

## Typed blockers and conformance integration

The contract preserves Phase 2 dependency blockers and otherwise returns typed
blockers for invalid assessment, not-evaluated decisions, missing basis, unknown
row state, and row/decision mismatch.

`deriveConformanceConclusion` now consumes the validated applicability result.
It preserves row identity checks, rejects malformed or mismatched applicability
results, propagates blocked applicability as `NOT_ASSESSED`, and only allows the
successful matching `NOT_APPLICABLE` result to produce the Phase 3
`NOT_APPLICABLE` conclusion. A successful `APPLICABLE` result continues through
the existing support, coverage, provenance, version, and contradiction gates.

## Explicit non-goals

This phase does not change Quick Check statuses, routing, extraction, evidence
selection, fixtures, reviewed gold truth, UI, reports, PDFs, methodology logic,
organization profiles, or formal VVB authority language. It does not decide
whether a requirement is applicable; it only validates an explicit decision.
Phase 6 and Phase 7 are not implemented.
