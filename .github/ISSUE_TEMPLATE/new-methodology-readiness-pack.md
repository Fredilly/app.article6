---
name: New Methodology Evidence Contract Pack
about: Track the repeatable work for adding evidence contracts and report support for a new methodology
title: "New methodology evidence contract pack: [METHODOLOGY_CODE]"
labels: enhancement
assignees: ''
---

## Methodology target

- Methodology code:
- Version:
- Registry/source:
- Methodology PDF/source link:
- Rule count expected:
- Test PDD fixture:

## Goal

Add evidence-contract support for this methodology so the existing audit engine and report renderer can assess a real PDD without rebuilding core logic.

## PR 1: Evidence contracts

- [ ] Add contract registry entry for this methodology
- [ ] Add stable rule IDs / normalization
- [ ] Map each rule to required evidence
- [ ] Add evidence type expectations, such as map, table, quote, calculation, eligibility statement, monitoring parameter, baseline rationale, leakage explanation
- [ ] Add section hints / likely PDD locations
- [ ] Add not-applicable conditions where the methodology allows them
- [ ] Add tests that confirm all expected rules have contracts

## PR 2: Evidence audit engine coverage

- [ ] Reuse the existing audit engine
- [ ] Run the methodology contracts against a real PDD fixture
- [ ] Confirm every rule appears in audit output
- [ ] Confirm statuses are client-safe: supported, weak, missing, not applicable
- [ ] Confirm weak/missing rules include gap and clientAction text
- [ ] Confirm not-applicable rules include a clear reason
- [ ] Confirm evidence quotes come only from selected PDD spans

## PR 3: Report support

- [ ] Reuse the existing professional report renderer pattern
- [ ] Show methodology code, version, project snapshot, rule count, summary, gaps, action list, full audit table, evidence appendix
- [ ] Confirm evidence appendix includes quotes where available
- [ ] Confirm missing evidence uses a safe fallback instead of invented quotes
- [ ] Confirm banned wording is not present

## Optional PR 4: Internal delivery

- [ ] Add internal preview route or report entry point, if not already generic
- [ ] Add print-friendly layout / manual PDF export path
- [ ] Do not build client self-service unless separately scoped

## Speedrun checklist

- [ ] Contracts complete
- [ ] Rule IDs normalized
- [ ] Real PDD fixture added
- [ ] Audit output covers all rules
- [ ] Weak/missing guidance present
- [ ] N/A reasons present
- [ ] Report renders all rules
- [ ] Evidence appendix works
- [ ] Banned wording test passes
- [ ] Internal preview/export path exists or is tracked separately

## Do not do

- Do not rebuild methodology sync unless the pack itself is missing or invalid
- Do not change core audit engine unless a reusable bug is found
- Do not invent evidence
- Do not mark weak/missing rules as passed
- Do not add client self-service unless explicitly scoped

## Banned wording

Do not use:

- VVB-grade
- verified
- validation opinion
- assurance opinion
- all clear
- 100% pass
- rules passed

## Acceptance criteria

- A future developer can follow this issue and know exactly what to build for a new methodology
- Evidence contracts are separated from audit engine work
- Report support is separated from core evidence extraction
- The methodology can be added using the same pattern proven by VM0007
