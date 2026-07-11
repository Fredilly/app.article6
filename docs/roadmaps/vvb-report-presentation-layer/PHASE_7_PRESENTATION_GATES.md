# Phase 7: Presentation Gates

## Scope

evaluatePresentationGate and evaluatePresentationReportGate are pure,
generic release-safety contracts downstream of the immutable Phase 6
ReportPresentationObject. They inspect packaged values only. They do not
search documents, select evidence, infer applicability, derive conformance, or
classify draft findings.

## Input contract

The per-object gate accepts one typed PresentationGateInput containing a strict
Phase 6 ReportPresentationObject and optional typed review state. The Phase 6
object itself remains unchanged. It must pass the strict Phase 6 runtime validator, including finalized-row metadata,
typed applicability/conformance/draft-finding results, preserved accepted and
rejected evidence, provenance, and supported presentation version.

The report-level gate accepts a readonly array of Phase 6 objects and adds
generic duplicate-row, same-requirement conclusion, and methodology/version
consistency checks. It does not add project- or methodology-specific rules.
An empty report is invalid and fails closed.

## Output contract

The result uses these release states:

- PRE_VALIDATION_RELEASE_READY
- INTERNAL_REVIEW_ONLY
- BLOCKED

It also reports a cross-row outcome:

- PASS when at least one typed methodology/version or composite-requirement comparison succeeds;
- WARNING when a real typed cross-row warning exists (not from pending review);
- BLOCKED when a cross-row contradiction exists;
- NOT_EVALUATED when fewer than two comparable rows exist or typed comparison data is unavailable.

PENDING_REVIEW produces INTERNAL_REVIEW_ONLY but preserves the actual computed
crossRowOutcome (normally NOT_EVALUATED for a single pending-review row).

An empty report returns BLOCKED with the typed empty_report blocker. A blocked
result is fail-closed and cannot be interpreted as release-ready. Gate results,
presentations, warnings, blockers, and nested values are deep-cloned and deeply
frozen.

## Gate decision table

| Gate | Pass condition | Blocking condition |
| --- | --- | --- |
| Presentation validity | Strict Phase 6 object shape | Malformed, extra, blocked, or unsupported result shape |
| Finalization traceability | Row ID, finalization actor, timestamp, and basis are present | Any traceability value is absent or invalid |
| Review history | Non-empty review history reference | Missing or blank reference |
| Applicability/conclusion consistency | APPLICABLE rows do not conclude NOT_APPLICABLE; NOT_APPLICABLE rows conclude NOT_APPLICABLE | APPLICABLE produces NOT_APPLICABLE, or NOT_APPLICABLE produces a different conclusion |
| Evidence sufficiency | CONFORMS has accepted evidence with provenance | CONFORMS has no accepted evidence |
| Search linkage | Evidence provenance document has searchCoverage.searched === true | searched is false despite accepted or rejected evidence |
| Provenance | Every evidence item has a matching canonical provenance entry | Evidence provenance is orphaned |
| Version identity | Same methodology ID has one rulebook version | Same methodology ID carries conflicting versions |
| Review state | Current or unavailable review state | Reopened, superseded, or stale state |
| Cross-row consistency | Unique row IDs and consistent generic identities | Duplicate rows, conflicting conclusions, methodology drift |

ACTION_REQUIRED may preserve missing or insufficient evidence. FOUND alone
never proves CONFORMS; the Phase 3 explicit support result and this gate's
accepted-evidence check are both required.

## Typed blockers

Blockers are PresentationGateBlock values with a deterministic category and
the affected row ID where available. Structural shape failures use
invalid_presentation_object. Release-safety failures retain specific
finalization_identity_missing, review_history_missing, applicability,
contract-version, evidence, search, provenance, review-state, and cross-row
categories.

## Authority boundary and non-goals

The result uses only pre-validation language. It does not claim VVB approval,
validation, verification, issuance, closure, or formal authority. This phase
does not migrate fixtures, implement report or UI consumers, create PDFs,
change Quick Check or Evidence Map semantics, rename legacy statuses, alter
gold truth, or implement methodology-specific release rules. Project facts,
assumptions, and accepted-versus-rejected reliability conflicts are
NOT_EVALUATED until a typed upstream contract provides them; prose fields are
never interpreted by this gate. Phase 8 remains the next roadmap phase.
