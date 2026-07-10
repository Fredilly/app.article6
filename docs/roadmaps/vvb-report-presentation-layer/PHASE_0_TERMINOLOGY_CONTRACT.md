# Phase 0: Report Terminology Contract

This document is the authoritative terminology and backward-compatibility contract for the future generic pre-validation presentation layer.

## Presentation profile

The only generic presentation profile is:

`GENERIC_PRE_VALIDATION`

Organization-specific profiles are not part of this contract.

## Presentation conclusions

The allowed downstream presentation conclusions are:

- `CONFORMS`
- `ACTION_REQUIRED`
- `NOT_APPLICABLE`
- `NOT_ASSESSED`

These are presentation vocabulary only. Phase 0 does not define or implement mappings from existing statuses to these conclusions. Mapping requires the Phase 1 consumer audit and later presentation contracts.

## Draft finding terminology

The allowed draft finding terminology is:

- `NCR_RISK`
- `NIR`
- `NONE`

These terms describe readiness-oriented draft output. They do not represent findings issued by a validator, verifier, registry, or other formal authority.

## User-facing language

The presentation layer may use:

- Draft finding
- Draft action
- Finding candidate
- Pre-validation conclusion
- Readiness assessment
- Client action required

The language must make clear that the output is preparatory and subject to professional review.

## Prohibited authority claims

The application must not claim that it:

- issued a finding
- closed a finding
- validated a finding or project
- verified a finding or project
- formally approved a finding
- issued a formal VVB finding
- granted registry approval

The application may describe a draft finding, finding candidate, draft action, or readiness assessment. It must not present those as completed formal authority decisions.

## Backward compatibility

The existing statuses and semantics remain unchanged:

```text
FOUND
UNCLEAR
MISSING
answered
unclear
no_evidence
```

They must not be renamed, replaced, reinterpreted, migrated, or deprecated by the presentation layer. No existing consumer is switched to the new terms by this contract.

The boundary is:

```text
Existing status → preserved upstream value
New terminology → additive downstream presentation value
```

The new terminology coexists with the existing system until the explicit Phase 10 deprecation review approves any change. Phase 0 creates no compatibility adapter because no runtime consumer requires one.

## Explicit non-goals

This contract does not change or implement:

- Quick Check routing or status semantics
- Evidence Map behavior
- Existing report output
- PDF generation
- UI labels
- fixtures or gold truth
- gap reports
- finding mapping logic
- applicability logic
- organization-specific profiles
- runtime consumers

