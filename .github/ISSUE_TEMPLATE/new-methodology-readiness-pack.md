---
name: New Methodology Readiness Pack
about: Track the repeatable PR sequence for adding a new methodology readiness pack
title: "New methodology readiness pack: [METHODOLOGY_CODE]"
labels: enhancement
assignees: ''
---

## Methodology

- Code:
- Version:
- Registry/source:
- Target PDD fixture:

## Goal

Add a new methodology readiness pack using the existing contracts → audit engine → report renderer pattern.

## Checklist

- [ ] Add evidence contracts
- [ ] Add or normalize rule IDs
- [ ] Add real PDD fixture
- [ ] Run audit engine against fixture
- [ ] Confirm all methodology rules are represented
- [ ] Add reliable not-applicable reasons
- [ ] Add client-facing gap guidance
- [ ] Render report
- [ ] Check banned wording
- [ ] Generate internal preview or manual PDF output

## PR sequence

1. Evidence contracts
2. Evidence audit output
3. Professional report output
4. Internal preview/manual delivery path, if not already generic

## Carry-over rules

- Reuse the existing audit engine where possible.
- Reuse the report renderer pattern where possible.
- Do not rebuild methodology sync unless the methodology pack itself is missing or invalid.
- Do not add client self-service unless explicitly scoped.

## Acceptance criteria

- Every methodology rule appears in the audit output.
- Weak and missing items have client guidance.
- Not-applicable items have clear reasons.
- Evidence appendix includes quotes where available.
- Report uses client-safe readiness language only.
- Tests cover rule count, gap guidance, evidence appendix, and banned wording.

## Banned wording

Do not use:

- VVB-grade
- verified
- validation opinion
- assurance opinion
- all clear
- 100% pass
- rules passed
