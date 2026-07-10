# VVB Report Presentation Layer

## Goal

Build a generic pre-validation report presentation layer downstream of the Evidence Map. The layer formats and interprets finalized Evidence Map rows for client-facing readiness output without changing router semantics or claiming formal VVB authority.

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

- ruleId
- requirementReference
- requirementText
- internalStatus
- applicabilityStatus
- acceptedEvidence[]
- rejectedEvidence[]
- assessmentReason
- clientAction
- full provenance

The report layer must never select evidence itself.

The report layer must never discard rejected evidence reasons.

The report layer must never infer a stronger conclusion than the Evidence Map row supports.

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
  "draftFindingType": null | "NIR_CANDIDATE" | "NCR_RISK" | "OFI_CANDIDATE" | "CAR_CANDIDATE" | "CR_CANDIDATE" | "FAR_CANDIDATE",
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

## Mapping rules

FOUND with validated Evidence Map support:
- conformanceConclusion: CONFORMS
- draftFindingType: null
- draftFindingRecord: null

UNCLEAR with weak, incomplete, placeholder, or insufficient evidence:
- conformanceConclusion: ACTION_REQUIRED
- draftFindingType: NIR_CANDIDATE or CR_CANDIDATE
- draftFindingRecord required

MISSING with applicable mandatory requirement and adequate evidence-search coverage:
- conformanceConclusion: ACTION_REQUIRED
- draftFindingType: NCR_RISK or CAR_CANDIDATE
- draftFindingRecord required

Weak but non-blocking issue:
- conformanceConclusion: ACTION_REQUIRED
- draftFindingType: OFI_CANDIDATE or FAR_CANDIDATE
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

For `NIR_CANDIDATE` / `CR_CANDIDATE`:

"Additional information is required to determine whether a material discrepancy exists with respect to this requirement."

For `NCR_RISK` / `CAR_CANDIDATE`:

"The requirement is not demonstrated in the reviewed document evidence."

For `OFI_CANDIDATE` / `FAR_CANDIDATE`:

"This issue should be monitored or improved in a future reporting or verification period."

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

## Fixture rules

Do not null out weak evidence if weak evidence exists. Preserve its quote, page, section heading, section path, span ID, and source type in the Evidence Map and presentation object.

Do not mark placeholder text as FOUND. MISSING means no relevant document evidence was found, not that weak evidence was found.

## Phases

- Phase 0: Report Terminology Contract
- Phase 1: Status Consumer Audit
- Phase 2: Evidence Map Dependency Contract
- Phase 3: Conformance Conclusion Contract
- Phase 4: Draft Action/Finding Contract
- Phase 5: Applicability Contract
- Phase 6: Report Presentation Object
- Phase 7: Presentation Gates
- Phase 8: Fixture Expectation Migration
- Phase 9: Readiness Report and UI Consumers
- Phase 10: Deprecation Review

## Validation

For this roadmap-only change, run:

```bash
npm run roadmap:check
```

No implementation code, parser/router logic, or client-facing report UI should change as part of this roadmap update.
