# VVB Report Presentation Layer

## Goal

Build a generic pre-validation report presentation layer downstream of the Evidence Map. The layer formats and interprets finalized Evidence Map rows for client-facing readiness output without changing router semantics or claiming formal VVB authority.

## Phase 0 contract

The authoritative terminology and backward-compatibility contract is [Phase 0: Report Terminology Contract](./PHASE_0_TERMINOLOGY_CONTRACT.md). It defines additive downstream vocabulary only. It does not map existing statuses to presentation conclusions or change any runtime consumer.

The Phase 1 status inventory is [Phase 1: Status Consumer Audit](./PHASE_1_STATUS_CONSUMER_AUDIT.md). It records every repository consumer of the existing status families and introduces no runtime mapping or semantic change.

The Phase 2 structural dependency contract is [Phase 2: Evidence Map Dependency Contract](./PHASE_2_EVIDENCE_MAP_DEPENDENCY_CONTRACT.md). It validates only that finalized Evidence Map rows carry the explicit upstream dependencies required downstream; it does not map statuses or judge evidence, applicability, or search quality.

## Product architecture

Article6 has one core paid asset:

Evidence Map

The product flow is:

Quick Check / Evidence Audit
-> finalized Evidence Map rows
-> VVB Report Presentation Layer
-> Pre-Validation Readiness Report
-> future VVB-style workpaper export

The Evidence Map is the canonical source of truth for:
- report conclusions
- action items
- client actions
- draft finding records
- UI
- PDF exports

The presentation layer must not consume raw extractor, raw router, or unvalidated Quick Check output directly.

## Product definition

Core paid asset:
Evidence Map

Client-facing delivery:
Pre-Validation Readiness Report

Future professional delivery:
VVB-style draft workpaper export

The report is the container.
The Evidence Map is the content and source of truth.

## Evidence Map dependency

The VVB Report Presentation Layer may only consume finalized Evidence Map rows.

A finalized Evidence Map row must contain, at minimum:

- `rowId`
- `requirement`
- `methodology`
- `upstreamStatus`
- `applicabilityState`
- `acceptedEvidence`
- `rejectedEvidence`
- `assessmentReason`
- `clientAction`
- `searchCoverage`
- `sourceDocument`
- `evidenceProvenance`
- `finalizationState`
- `finalizationActorRef`
- `finalizedAt`
- `finalizationBasis`
- `reviewHistoryRef`
- `evidenceMapContractVersion`
- `reviewPolicyVersion`

[`PHASE_2_EVIDENCE_MAP_DEPENDENCY_CONTRACT.md`](./PHASE_2_EVIDENCE_MAP_DEPENDENCY_CONTRACT.md)
is authoritative for these field shapes and validation rules. This plan does not
duplicate the Phase 2 schema.

The report layer must never select evidence itself.

The report layer must never discard rejected evidence reasons.

The report layer must never infer a stronger conclusion than the Evidence Map row supports.

## Review governance and release control

The machine proposes an assessment. A reviewer may approve, edit, or reopen it. The
original machine proposal must remain traceable, and reviewer changes must preserve
a reason and a review-history reference. Finalized does not mean formally validated,
verified, or VVB-approved.

Client-facing release must fail closed when required review controls are incomplete.
Governance details should remain mostly hidden from the user interface. The minimal
reviewer interface focuses on evidence, reasoning, client action, approve, edit,
reopen, and history. The Evidence Map remains canonical, the presentation layer
remains downstream, and machine output remains distinguishable from reviewer-approved
output.

## Non-negotiable invariant

The VVB Report Presentation Layer is a downstream formatting and interpretation layer. It does not own evidence truth, routing truth, or rule-level judgment truth.

Article6 outputs are pre-validation readiness outputs. They do not constitute formal validation, verification, registry approval, or formally issued VVB findings.

## Report terminology

Conformance conclusions are separate from draft action or finding records. `CONFORMS` is not a finding type. The v1 report profile is `GENERIC_PRE_VALIDATION` only. Organization-specific profiles are deferred until the generic product is proven.

## Target presentation object

```json
{
  "internalStatus": "FOUND" | "UNCLEAR" | "MISSING",
  "applicabilityStatus": "APPLICABLE" | "NOT_APPLICABLE" | "NOT_ASSESSED",
  "conformanceConclusion": "CONFORMS" | "ACTION_REQUIRED" | "NOT_APPLICABLE" | "NOT_ASSESSED",
  "draftFindingType": null | "NIR_CANDIDATE" | "NCR_CANDIDATE" | "OFI_CANDIDATE",
  "reportProfile": "GENERIC_PRE_VALIDATION",
  "evidenceMapRowId": "string",
  "evidence": {
    "requirementReference": "string | null",
    "requirementQuote": "string | null",
    "documentReference": "string | null",
    "documentQuote": "string | null",
    "page": "number | null",
    "sectionHeading": "string | null",
    "sectionPath": "string[] | null",
    "spanId": "string | null",
    "sourceType": "string | null"
  },
  "draftFindingRecord": null | {
    "findingId": "string",
    "standardReference": "string | null",
    "documentReference": "string | null",
    "finding": "string",
    "clientResponse": null,
    "reviewerAssessment": "string",
    "closingRemarks": null
  }
}
```

Phase 6 must preserve, without independently interpreting, the following review and
provenance fields in the presentation object:

- `finalizationState`
- `finalizationActorRef`
- `finalizedAt`
- `finalizationBasis`
- `reviewHistoryRef`
- `evidenceMapContractVersion`
- `reviewPolicyVersion`
- `acceptedEvidence`
- `rejectedEvidence`
- `assessmentReason`
- `clientAction`
- `provenance`

The presentation object must distinguish machine-proposed and reviewer-finalized
data. It must not erase or replace the original Evidence Map decision, create a
second review-history system, or treat finalization metadata as formal VVB authority.

## Mapping rules

FOUND with validated Evidence Map support:
- conformanceConclusion: CONFORMS
- draftFindingType: null
- draftFindingRecord: null

UNCLEAR with weak, incomplete, placeholder, or insufficient evidence:
- conformanceConclusion: ACTION_REQUIRED
- draftFindingType: NIR_CANDIDATE
- draftFindingRecord required

MISSING with applicable mandatory requirement and adequate evidence-search coverage:
- conformanceConclusion: ACTION_REQUIRED
- draftFindingType: NCR_CANDIDATE
- draftFindingRecord required

Weak but non-blocking issue:
- conformanceConclusion: ACTION_REQUIRED
- draftFindingType: OFI_CANDIDATE
- draftFindingRecord required

Explicitly not applicable:
- conformanceConclusion: NOT_APPLICABLE
- draftFindingType: null
- draftFindingRecord: null

Not safely assessed:
- conformanceConclusion: NOT_ASSESSED
- draftFindingType: null
- draftFindingRecord: null

## Language rules

For `CONFORMS`:

"The reviewed document evidence is sufficient to demonstrate conformance with the requirement."

For `NIR_CANDIDATE`:

"Additional information is required to determine whether a material discrepancy exists with respect to this requirement."

For `NCR_CANDIDATE`:

"The requirement is not demonstrated in the reviewed document evidence."

For `OFI_CANDIDATE`:

"This issue should be monitored or improved in a future reporting or verification period."

## Canonical draft-finding rules

The generic presentation layer uses only `NIR_CANDIDATE`, `NCR_CANDIDATE`,
`OFI_CANDIDATE`, and `null` for `draftFindingType`.

- `null` means no draft finding.
- `CONFORMS` must produce `null`.
- `NOT_APPLICABLE` must produce `null`.
- `NOT_ASSESSED` must produce `null`.
- All non-null finding values are candidates only, never formally issued VVB findings.

Future organization or scheme profiles may translate generic candidates into CAR,
CL, CR, FAR, NCR, NIR, or other VVB terminology. Those profiles are deferred and
are not implemented in this roadmap.

## Sequencing

The implementation order must be:

1. Evidence Map row contract
2. Accepted and rejected evidence retention
3. Evidence Map UI/source-of-truth layer
4. VVB Report Presentation Layer
5. Pre-Validation Readiness Report
6. PDF/export
7. Future VVB-style workpaper profile

Gap/readiness report implementation remains downstream of the presentation-layer contract and gates. The report and UI must consume Evidence Map-backed presentation objects rather than inventing their own labels or selecting evidence.

## Phase 7: Presentation Gates

In addition to applicability, evidence sufficiency, and search-coverage gates, Phase
7 defines these governance and release-safety gates:

- finalized-row traceability gate
- review-history-reference gate
- contract-version gate
- reopened-or-superseded-row gate
- cross-row consistency gate
- release-readiness gate

Cross-row consistency outcomes are `PASS`, `WARNING`, `BLOCKED`, and
`NOT_EVALUATED`. Blocking or warning conditions include conflicting methodology
versions; conflicting project locations or dates; contradictory applicability
decisions; incompatible assumptions; and evidence treated as reliable in one row
and rejected as unreliable in another.

Blocking contradictions prevent client-facing release. Missing finalization or
review metadata fails closed. Reopened or superseded rows cannot support release.
UI components must not duplicate or bypass gate logic. Internal preview may still be
allowed when client release is blocked. Do not use `VALIDATED`, `VERIFIED`,
`APPROVED_BY_VVB`, or equivalent authority language.

Release states are:

- `PRE_VALIDATION_RELEASE_READY`
- `INTERNAL_REVIEW_ONLY`
- `BLOCKED`

## Phase 9: Readiness Report and UI Consumers

Phase 9 includes a minimal reviewer workflow. The primary row view exposes only:

- requirement
- accepted evidence
- rejected evidence where relevant
- system assessment
- assessment reason
- client action
- approve
- edit
- reopen
- view history

Technical metadata remains hidden by default under history or details. Approving,
editing, or reopening must not silently overwrite prior state. Reviewer edits require
a reason. Reopening invalidates the previous release-ready state. Client report
export must check the centralized release gate; internal report preview may remain
available when release is blocked. Do not design organization-specific VVB workflows
or implement the UI in this roadmap-only PR.

Client-facing report release requires:

- required rows finalized
- complete finalization trace metadata
- complete provenance
- required contract versions
- no blocking cross-row contradictions
- no reopened or superseded supporting rows
- presentation gates passed
- required pre-validation disclaimer present

## Phase 10: Deprecation Review

Organization-specific profiles and terminology deprecation remain blocked until the
generic reviewer workflow is proven, the release gate is proven, and a controlled
pilot with qualified validation or verification professionals has been completed.

## Fixture rules

Do not null out weak evidence if weak evidence exists. Preserve its quote, page, section heading, section path, span ID, and source type in the Evidence Map and presentation object.

Do not mark placeholder text as FOUND. MISSING means no relevant document evidence was found, not that weak evidence was found.

## Phases

- Phase 0: Report Terminology Contract — done
- Phase 1: Status Consumer Audit — done
- Phase 2: Evidence Map Dependency Contract — done
- Phase 3: Conformance Conclusion Contract — next
- Phase 4: Draft Action/Finding Contract — planned
- Phase 5: Applicability Contract — planned
- Phase 6: Report Presentation Object — planned
- Phase 7: Presentation Gates — planned
- Phase 8: Fixture Expectation Migration — planned
- Phase 9: Readiness Report and UI Consumers — planned
- Phase 10: Deprecation Review — planned

## Validation

For this contract-only change, run:

```bash
npx jest tests/lib/evidence/evidenceMapDependencyContract.test.ts --runInBand
npm run lint
npm run typecheck
npm run roadmap:check
```

No runtime governance implementation, reviewer UI, audit-event database, permission
system, report implementation, PDF changes, status mappings, conformance
implementation, draft finding implementation, fixtures, gold-truth changes, router
or Quick Check changes, separate roadmap, or phase renumbering should change as part
of this roadmap-only PR. No parser/router logic, client-facing report UI, report
output, PDF output, fixture, or gold truth should change.
