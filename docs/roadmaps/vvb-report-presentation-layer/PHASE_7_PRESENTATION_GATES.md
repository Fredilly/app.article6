# Phase 7: Presentation Gates

## Scope

evaluatePresentationGate and evaluatePresentationReportGate are pure,
generic release-safety contracts downstream of the immutable Phase 6
ReportPresentationObject. They inspect packaged values only. They do not
search documents, select evidence, infer applicability, derive conformance, or
classify draft findings.

## Input contract

The per-object gate accepts one ReportPresentationObject value. The value must
pass the strict Phase 6 runtime validator, including finalized-row metadata,
typed applicability/conformance/draft-finding results, preserved accepted and
rejected evidence, provenance, and supported presentation version.

The report-level gate accepts a readonly array of Phase 6 objects and adds
generic duplicate-row, same-requirement conclusion, and methodology/version
consistency checks. It does not add project- or methodology-specific rules.

## Output contract

The result is either a readonly presentation collection with
releaseReady=true and releaseState=PRE_VALIDATION_RELEASE_READY, or a readonly
presentation collection with releaseReady=false, releaseState=BLOCKED, and a
non-empty blockedBy collection. A blocked result is fail-closed and cannot be
interpreted as release-ready. Both result branches and their blocker
collections are immutable.

## Gate decision table

| Gate | Pass condition | Blocking condition |
| --- | --- | --- |
| Presentation validity | Strict Phase 6 object shape | Malformed, extra, blocked, or unsupported result shape |
| Finalization traceability | Row ID, finalization actor, timestamp, and basis are present | Any traceability value is absent or invalid |
| Review history | Non-empty review history reference | Missing or blank reference |
| Applicability consistency | Explicit successful applicability agrees with packaged conclusion | Unknown, mismatched, or contradictory applicability |
| Evidence sufficiency | CONFORMS has accepted evidence with provenance | CONFORMS has no accepted evidence |
| Search coverage | Applicable rows record completed search coverage | Required search is incomplete or unresolved |
| Provenance | Packaged provenance and evidence provenance remain traceable | Provenance is absent or malformed |
| Version identity | Methodology/version and contract versions are supported | Version identity is unresolved, mismatched, or unsupported |
| Review state | Current or unavailable review state | Reopened, superseded, or stale state |
| Cross-row consistency | Unique row IDs and consistent generic identities | Duplicate rows, conflicting requirement conclusions, or methodology drift |

ACTION_REQUIRED may preserve missing or insufficient evidence. FOUND alone
never proves CONFORMS; the Phase 3 explicit support result and this gate's
accepted-evidence check are both required.

## Typed blockers

Blockers are PresentationGateBlock values with a deterministic category and
the affected row ID where available. Categories cover invalid presentation,
finalization/review traceability, applicability/conformance inconsistency,
evidence/search/provenance failure, methodology or contract-version failure,
non-current review state, duplicate identity, conflicting requirement
conclusion, and inconsistent methodology identity.

## Authority boundary and non-goals

The result uses only pre-validation language. It does not claim VVB approval,
validation, verification, issuance, closure, or formal authority. This phase
does not migrate fixtures, implement report or UI consumers, create PDFs,
change Quick Check or Evidence Map semantics, rename legacy statuses, alter
gold truth, or implement methodology-specific release rules. Phase 8 remains
the next roadmap phase.
