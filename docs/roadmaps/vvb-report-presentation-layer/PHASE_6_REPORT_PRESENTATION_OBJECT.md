# Phase 6: Report Presentation Object

## Scope

`createReportPresentationObject` is a pure packaging contract downstream of the
finalized Evidence Map and the Phase 3–5 validated results. It creates one
generic immutable pre-validation presentation object. It does not calculate any
judgment.

Implementation: `src/lib/evidence/reportPresentationObject.ts`

Focused contract test: `tests/lib/evidence/reportPresentationObject.test.ts`

## Input contract

The function accepts four values:

```ts
createReportPresentationObject(
  candidate: unknown,
  applicabilityResult: unknown,
  conformanceConclusion: unknown,
  draftFindingResult: unknown,
): ReportPresentationResult
```

The candidate must pass `validateEvidenceMapDependency`. The other values must
be valid outputs of the applicability, conformance, and draft-finding
contracts. Every successful value must preserve the same Evidence Map row ID.
Blocked applicability or conformance results are not packageable.

## Presentation object schema

```ts
type ReportPresentationObject = Readonly<{
  profile: "GENERIC_PRE_VALIDATION";
  evidenceMapRowId: string;
  requirement: EvidenceMapRequirementIdentity;
  methodology: EvidenceMapMethodologyIdentity | null;
  upstreamStatus: string;
  applicabilityResult: ApplicabilityResult;
  conformanceConclusion: ConformanceConclusionResult;
  draftFindingResult: DraftFindingResult;
  acceptedEvidence: readonly EvidenceMapAcceptedEvidence[];
  rejectedEvidence: readonly EvidenceMapRejectedEvidence[];
  assessmentReason: string;
  clientAction: string | null;
  searchCoverage: EvidenceMapSearchCoverage;
  sourceDocument: EvidenceMapSourceDocumentIdentity;
  evidenceProvenance: readonly EvidenceMapEvidenceProvenance[];
  finalizationActorRef: string;
  finalizedAt: string;
  finalizationBasis: string;
  reviewHistoryRef: string;
  evidenceMapContractVersion: string;
  reviewPolicyVersion: string;
  presentationContractVersion: "v1";
  machineProposalTraceability: MachineProposalTraceability | null;
}>;
```

No separate machine-proposal record is available at this contract boundary, so
`machineProposalTraceability` is explicitly `null`. The field is reserved for
traceability supplied by a later upstream contract and is not inferred here.

The output is deep-cloned and deeply frozen. Inputs are never mutated. The
applicability result, including its decision basis, is retained; conformance
and draft-finding results are packaged without recalculation.

## Blocked result schema

```ts
type ReportPresentationResult =
  | { ready: true; presentation: ReportPresentationObject }
  | {
      ready: false;
      conclusion: "NOT_ASSESSED";
      evidenceMapRowId: string | null;
      blockedBy: readonly ReportPresentationBlock[];
    };
```

Dependency blockers retain their Phase 2 reason. Applicability, conformance,
and draft-finding blockers retain the typed upstream blocker as their reason.
Malformed results, row mismatches, contradictory applicability/conformance,
blocked upstream results, and draft-finding/conclusion contradictions fail
closed deterministically.

## Identity and evidence preservation rules

The candidate row ID is the canonical identity. Applicability, conformance, and
candidate draft-finding record IDs must match it. Accepted evidence, rejected
evidence and rejection reasons, provenance, source-document identity, review
metadata, versions, assessment reason, client action, and upstream status are
copied exactly. The packaging contract never searches for, selects, discards,
rewrites, or reclassifies evidence.

Draft findings remain only `NIR_CANDIDATE`, `NCR_CANDIDATE`, `OFI_CANDIDATE`, or
`null`. A presentation object contains no issued, approved, closed, validated,
or verified finding state.

## Authority boundaries and explicit non-goals

This phase does not infer applicability, derive conformance, assess evidence,
classify findings, replace the Evidence Map, or create a second source of truth.
It does not implement report UI, PDFs, runtime consumers, fixture migration,
release gates, methodology-specific logic, formal VVB authority, or Phase 7.
