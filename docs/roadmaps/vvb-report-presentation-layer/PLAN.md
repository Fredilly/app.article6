# VVB Report Presentation Layer

## Goal

Make Quick Check outputs resemble real VVB report outputs without changing router semantics.

## Non-Negotiable Invariant

The deterministic router and Quick Check v2 status validator remain the truth gates.
The VVB layer is not allowed to upgrade, rescue, reinterpret, or relabel weak evidence as `CONFORMS`.

Real VVB reports separate:
1. checklist or narrative conformance conclusions
2. formal finding/request records

Satisfied requirements are documented as conformance, not as findings.
Action items are documented as NCR, NIR, OFI, CAR, CR, or FAR records.

## Phases

## Real report pattern observed

SCS VCS reports use finding records like:

- NCR {id} dated {date}
- NIR {id} dated {date}
- OFI {id} dated {date}
- Standard Reference
- Document Reference
- Finding
- Client Response
- Auditor Response
- Closing Remarks

CCB and TÜV-style reports also use checklist conclusions:

- Conformance - Y
- Conformance - NA
- Draft Concl
- Final Concl
- CAR
- CR
- FAR
- ✓

## Non-negotiable correction

CONFORMS is not a finding type.

Use:

```json
{
  "internalStatus",
  "conformanceConclusion",
  "findingType",
  "findingRecord"
}
```

not:

```json
{
  "vvbFindingType": "CONFORMS"
}
```

## Target presentation object

```json
{
  "internalStatus": "FOUND" | "UNCLEAR" | "MISSING",
  "applicabilityStatus": "APPLICABLE" | "NOT_APPLICABLE" | "NOT_ASSESSED",
  "conformanceConclusion": "CONFORMS" | "ACTION_REQUIRED" | "NOT_APPLICABLE" | "NOT_ASSESSED",
  "findingType": null | "NIR" | "NCR" | "OFI" | "CAR" | "CR" | "FAR",
  "reportProfile": "SCS_VCS" | "SCS_CCB" | "TUV_VCS_CCB" | "GENERIC_PRE_AUDIT",
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
  "findingRecord": {
    "findingId": "string",
    "standardReference": "string | null",
    "documentReference": "string | null",
    "finding": "string",
    "clientResponse": null,
    "auditorResponse": "string",
    "closingRemarks": null
  }
}
```

## Mapping rules

FOUND with complete validated evidence:
- conformanceConclusion: CONFORMS
- findingType: null
- findingRecord: null

UNCLEAR with weak, incomplete, placeholder, or insufficient evidence:
- conformanceConclusion: ACTION_REQUIRED
- findingType: NIR or CR depending on report profile
- findingRecord required

MISSING with applicable mandatory requirement and adequate search coverage:
- conformanceConclusion: ACTION_REQUIRED
- findingType: NCR or CAR depending on report profile
- findingRecord required

Weak but non-blocking issue:
- conformanceConclusion: ACTION_REQUIRED
- findingType: OFI or FAR depending on report profile
- findingRecord required

Explicitly not applicable:
- conformanceConclusion: NOT_APPLICABLE
- findingType: null
- findingRecord: null

Not safely assessed:
- conformanceConclusion: NOT_ASSESSED
- findingType: null
- findingRecord: null

## Language rules

For CONFORMS:

"The reviewed document evidence is sufficient to demonstrate conformance with the requirement."

For NIR / CR:

"Additional information is required to determine whether a material discrepancy exists with respect to this requirement."

For NCR / CAR:

"The requirement is not demonstrated in the reviewed document evidence."

For OFI / FAR:

"This issue should be monitored or improved in a future reporting or verification period."

For NOT_APPLICABLE:

"This requirement is not applicable to the reviewed project context."

For NOT_ASSESSED:

"The system cannot safely assess this requirement from the reviewed evidence."

## Fixture rules

Do not null out weak evidence if weak evidence exists.

If the PDD says:
"This section is under development"

then fixture should preserve:
- quote
- page
- sectionHeading
- sectionPath
- spanId
- sourceType

and expected status should usually be:
- internalStatus: UNCLEAR
- conformanceConclusion: ACTION_REQUIRED
- findingType: NIR or CR

Do not mark placeholder text as FOUND.

MISSING should mean no relevant document evidence was found, not that weak evidence was found.

## Gap report sequencing

Do not start gap report implementation until this presentation boundary exists.

The gap report must consume:
- internalStatus
- conformanceConclusion
- findingType
- evidence
- findingRecord

The gap report must not invent its own VVB label mapping.

## Validation

Every implementation PR after this roadmap must run:

```bash
git status --short
npx tsc --noEmit
npm run lint
npm run roadmap:check
npm run pr:gate
```

For the roadmap-only PR, run:

```bash
npm run roadmap:check
```

Then report:
- files changed
- roadmap check result
- git status --short
- confirmation that no implementation files changed

## Risks

* Risk: FOUND is treated as a display synonym for CONFORMS before all provenance and sufficiency gates are checked.
* Mitigation: add a CONFORMS eligibility contract and tests before any UI/report/gap report migration.
