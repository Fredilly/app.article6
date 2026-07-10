# Phase 4: Draft Action/Finding Contract

## Scope

`deriveDraftFinding` is a pure contract downstream of a finalized Evidence Map
row and a Phase 3 `ConformanceConclusionResult`. It consumes an explicit draft
classification and produces either no candidate or one generic pre-validation
candidate. It never creates a formally issued finding and does not select,
copy, or rewrite evidence.

## Input contract

The row is validated with `validateEvidenceMapDependency`. The Phase 3 result
must be structurally valid and, when it carries a row ID, must identify the
same row. The explicit assessment input is:

```ts
type DraftFindingAssessmentInput = Readonly<{
  draftFindingType:
    | "NIR_CANDIDATE"
    | "NCR_CANDIDATE"
    | "OFI_CANDIDATE"
    | null;
  findingBasis: string | null;
  reviewerAssessment: string | null;
}>;
```

`null` is an explicit decision that no candidate is proposed. A candidate
requires non-empty basis and reviewer-assessment text. The contract does not
derive classification from `FOUND`, `UNCLEAR`, `MISSING`, `answered`,
`unclear`, or `no_evidence`.

## Output contract

Valid non-candidate output is exactly:

```ts
{
  draftFindingType: null;
  draftFindingRecord: null;
}
```

Valid candidate output contains an immutable generic record:

```ts
{
  findingId: string;
  profile: "GENERIC_PRE_VALIDATION";
  evidenceMapRowId: string;
  requirementId: string;
  conformanceConclusion: "ACTION_REQUIRED";
  draftFindingType: "NIR_CANDIDATE" | "NCR_CANDIDATE" | "OFI_CANDIDATE";
  findingBasis: string;
  clientResponse: null;
  reviewerAssessment: string;
  closingRemarks: null;
}
```

The record preserves row and requirement identity but contains no accepted
evidence, rejected evidence, or provenance. The Evidence Map remains the one
evidence truth model.

## Decision table

| Phase 3 conclusion and explicit classification | Result |
| --- | --- |
| `CONFORMS`, `NOT_APPLICABLE`, or `NOT_ASSESSED` with a valid explicit assessment | Null candidate |
| `ACTION_REQUIRED` with explicit `null` classification | Null candidate |
| `ACTION_REQUIRED` with explicit `NIR_CANDIDATE` | NIR candidate record |
| `ACTION_REQUIRED` with explicit `NCR_CANDIDATE` | NCR candidate record |
| `ACTION_REQUIRED` with explicit `OFI_CANDIDATE` | OFI candidate record |
| Invalid, contradictory, incomplete, unsafe, or mismatched inputs | Null candidate plus typed blockers |

The contract does not decide whether a case is missing mandatory evidence,
requires clarification, or is a weak non-blocking issue. Those judgments must
arrive through the explicit classification input. In particular, status alone
never chooses NCR, NIR, or OFI.

## Fail-closed behavior and boundaries

Dependency failures preserve the exact Phase 2 reasons. Invalid Phase 3
results, row-ID mismatches, invalid or missing classification data, missing
basis or reviewer assessment, and formal authority language return null with
deterministically ordered typed blockers. Inputs are not mutated.

`NIR_CANDIDATE`, `NCR_CANDIDATE`, and `OFI_CANDIDATE` are generic draft
candidate vocabulary only; they are not formally issued VVB findings. Phase 4
does not implement runtime consumers, UI, reports, PDFs, fixtures, routing,
Quick Check changes, applicability, or Phase 5 logic.
