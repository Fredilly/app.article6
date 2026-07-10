# Phase 2: Evidence Map Dependency Contract

## Scope

This contract defines the minimum structural dependency surface for a finalized Evidence Map row to enter the future presentation layer. The Evidence Map remains the canonical source of evidence truth. This module does not create a report-specific evidence model, choose evidence, or map statuses to presentation conclusions.

Implementation: `src/lib/evidence/evidenceMapDependencyContract.ts`

Focused contract test: `tests/lib/evidence/evidenceMapDependencyContract.test.ts`

## Minimum row contract

`EvidenceMapRow` requires these fields. Required absence is represented explicitly: accepted/rejected evidence and provenance are arrays, methodology may be explicit `null` when it is not applicable to the row, and client action may be explicit `null` when no action is required.

| Field | Required shape | Phase 2 meaning |
| --- | --- | --- |
| `rowId` | non-empty string | Stable Evidence Map row identity. |
| `requirement` | `requirementId`, `requirementReference`, `requirementText`, all non-empty strings | Requirement identity and source requirement text. |
| `methodology` | `{ methodologyId, rulebookVersion }` or explicit `null` | Methodology identity/version when applicable; `null` is an explicit not-required value. No version matching is judged here. |
| `upstreamStatus` | non-empty string | Preserved upstream value. The contract does not rename, normalize, or reinterpret it. |
| `applicabilityState` | `APPLICABLE`, `NOT_APPLICABLE`, or `UNKNOWN` | Explicit applicability state representation only. Phase 2 does not decide whether the state is correct. |
| `acceptedEvidence` | array of evidence records | Accepted evidence is retained exactly. `[]` is valid. |
| `rejectedEvidence` | array of evidence records | Rejected evidence and rejection reasons are retained exactly. `[]` is valid. |
| `assessmentReason` | non-empty string | Existing upstream explanation for the row assessment. |
| `clientAction` | non-empty string or explicit `null` | Existing upstream client action. `null` is valid; omission is not. |
| `searchCoverage` | `{ searched, searchedDocumentIds, notes }` | Explicit search-coverage carrier. The validator checks shape only; it does not judge coverage adequacy. |
| `sourceDocument` | `{ documentId, documentName, contentSha256 }` | Source-document identity. Name and hash may be explicit `null`; document ID may not be absent. |
| `evidenceProvenance` | array of provenance records | Provenance records reuse canonical `EvidenceSpan` coordinates (`docId`, `page`, `sectionPath`, `spanId`) and carry section/source labels. `[]` is structurally explicit. |
| `finalizationState` | `draft`, `finalized`, or `unknown` | Only `finalized` is eligible for the presentation dependency boundary. |

Accepted evidence records contain an `evidenceId`, exact `quote`, and provenance. Rejected records contain the same fields plus a non-empty `rejectionReason`. The validator preserves these records and their arrays without mutation or copying.

## Dependency gate

```ts
validateEvidenceMapDependency(candidate: unknown):
  | { ready: true; row: EvidenceMapRow }
  | { ready: false; blockedBy: EvidenceMapDependencyBlockReason[] }
```

The ready result returns the validated row unchanged. The blocked result returns one or more typed reasons. The reason union is exhaustive:

```text
row_not_finalized
missing_row_identity
missing_requirement_identity
missing_methodology_identity
missing_methodology_version
missing_upstream_status
missing_applicability_state
missing_accepted_evidence_field
missing_rejected_evidence_field
missing_assessment_reason
missing_client_action_field
missing_search_coverage_field
missing_source_document_identity
missing_provenance
```

Malformed evidence records, partial methodology identity, incomplete search coverage, incomplete source identity, and incomplete provenance are blocked under their corresponding dependency reason. The validator does not infer omitted values or turn malformed values into `null`, empty arrays, or unknown states.

## Explicit Phase 2 boundary

The gate checks dependency completeness only. It does not:

- map `FOUND`, `UNCLEAR`, `MISSING`, `answered`, `unclear`, or `no_evidence`;
- produce `CONFORMS`, `ACTION_REQUIRED`, `NOT_APPLICABLE`, or `NOT_ASSESSED`;
- produce `NCR_RISK`, `NIR`, or draft finding records;
- judge evidence sufficiency, applicability correctness, search coverage adequacy, or methodology version matching;
- select, discard, rewrite, or downgrade evidence;
- change Quick Check, Evidence Map, report, PDF, UI, fixture, gold-truth, parser, router, or existing status behavior.

Those concerns remain dependencies for later roadmap phases. Phase 3 may define presentation conclusions only after this structural dependency boundary is available.
