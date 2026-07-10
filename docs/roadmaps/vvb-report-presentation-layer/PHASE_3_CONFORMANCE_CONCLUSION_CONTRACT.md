# Phase 3: Conformance Conclusion Contract

## Scope

`deriveConformanceConclusion` is a pure, centralized contract downstream of the
Phase 2 Evidence Map dependency gate. It consumes a candidate row, a validated
Phase 5 applicability result, and explicit assessment inputs and derives only `CONFORMS`, `ACTION_REQUIRED`,
`NOT_APPLICABLE`, or `NOT_ASSESSED`.

It does not calculate assessments from evidence counts, quotes, search flags,
reason text, client actions, or upstream status alone. It does not create draft
findings or choose a finding type; those are Phase 4 concerns.

## Input contract

The row input is `unknown` and is first passed to
`validateEvidenceMapDependency`. A row must therefore be a complete finalized
Evidence Map row. The second input is the successful or blocked result from
`deriveApplicability`; a successful result must preserve the same row ID and
match the row's canonical applicability state. The remaining assessment input is:

```ts
type ConformanceAssessmentInput = Readonly<{
  requirementSupport: "SUPPORTED" | "NOT_SUPPORTED" | "NOT_EVALUATED";
  searchCoverageAssessment:
    | "ADEQUATE" | "INADEQUATE" | "NOT_REQUIRED" | "NOT_EVALUATED";
  provenanceAssessment: "COMPLETE" | "INCOMPLETE" | "NOT_EVALUATED";
  versionIdentityAssessment:
    | "MATCHED" | "NOT_REQUIRED" | "MISMATCHED" | "UNRESOLVED";
  contradictionAssessment: "NONE" | "BLOCKING" | "NOT_EVALUATED";
}>;
```

These are explicit decision inputs. Later gates may calculate them; Phase 3
only consumes them.

Version identity is coupled to the row's methodology identity: a non-null
methodology requires `MATCHED`, while a null methodology permits
`NOT_REQUIRED`. `NOT_REQUIRED` for a non-null methodology and `MATCHED` for a
null methodology are inconsistent and fail closed with typed blockers.

## Output contract

The result is a discriminated union. Positive results contain the Evidence Map
row ID and a fixed basis. `NOT_ASSESSED` contains a deterministic ordered list
of typed block records. Dependency blocks retain the exact Phase 2 reason.
No result contains `draftFindingType` or a draft finding record.

```ts
type ConformanceConclusionResult =
  | { conclusion: "CONFORMS"; evidenceMapRowId: string;
      basis: "supported_applicable_requirement" }
  | { conclusion: "ACTION_REQUIRED"; evidenceMapRowId: string;
      basis: "applicable_requirement_not_supported" }
  | { conclusion: "NOT_APPLICABLE"; evidenceMapRowId: string;
      basis: "explicit_upstream_not_applicable" }
  | { conclusion: "NOT_ASSESSED"; evidenceMapRowId: string | null;
      blockedBy: readonly ConformanceConclusionBlock[] };
```

## Decision table

| Conditions after the Phase 2 gate | Conclusion |
| --- | --- |
| Dependency blocked, malformed assessments, unsupported status, unknown applicability, unevaluated support, unsafe version/provenance/contradiction, conflicting support/status, or inadequate/unevaluated required search | `NOT_ASSESSED` |
| Successful matching explicit `NOT_APPLICABLE` applicability result, safe version identity, complete provenance, and no blocking contradiction | `NOT_APPLICABLE` |
| `APPLICABLE`, `SUPPORTED`, adequate or not-required search, complete provenance, safe version, no contradiction, and upstream `FOUND` or `answered` | `CONFORMS` |
| `APPLICABLE`, `NOT_SUPPORTED`, the same safe gates, and upstream `FOUND`, `UNCLEAR`, `MISSING`, `answered`, `unclear`, or `no_evidence` | `ACTION_REQUIRED` |

For rows with a methodology identity, “safe version” means `MATCHED`. For rows
whose methodology is explicitly null, “safe version” means `NOT_REQUIRED`.

`FOUND` or `answered` alone never conforms. Supported `UNCLEAR`, `MISSING`,
`unclear`, or `no_evidence` fails closed because the explicit inputs conflict.
Missing or unclear evidence never means `NOT_APPLICABLE`.

## Fail-closed behavior and boundaries

Malformed applicability or assessment values, unknown upstream statuses, incomplete or
unevaluated provenance, mismatched or unresolved version identity, blocking or
unevaluated contradiction review, unknown applicability, and insufficient
search coverage produce `NOT_ASSESSED`. Dependency validation always runs first;
its reasons are preserved in validator order. Blocked applicability is propagated
as `NOT_ASSESSED`, and only a successful matching explicit `NOT_APPLICABLE`
applicability result can produce the `NOT_APPLICABLE` conclusion. Inputs are not
mutated.

Phase 4 may define `NIR_CANDIDATE`, `NCR_CANDIDATE`, `OFI_CANDIDATE`, and null
draft-finding outputs. Phase 3 does not implement those records, an
applicability decision engine, report/PDF/UI consumers, runtime wiring, or any
status renaming.
