# VM0007 Judgement Fixtures Roadmap

Status is sourced from `docs/roadmaps/vm0007-judgement-fixtures/phase-status.json`; docs must not drift.

## Goal

Improve VM0007 gap report accuracy by tightening rule-level judgment fixtures and contracts.

This roadmap focuses on the evidence and status layer, not production logic, not report UI redesign, and not client-facing outputs.

## Core Focus

- accepted evidence
- rejected evidence
- expected status
- weak / missing / not-applicable logic
- audit summary expectations
- report summary expectations

## Boundary

This lane is separate from Quick Check v2 Phase 7.

Do not mix judgment-fixture work into the Quick Check v2 parser / ingestion rebuild unless a later roadmap explicitly calls for that overlap.

## Phases

### Phase 0 — Roadmap Boundary

Define the scope of VM0007 judgment fixtures and lock the separation from production logic and Quick Check v2 Phase 7.

Phase 0 is documentation-only. It defines the contract for future fixture PRs before any Envira or PD_REDD fixture files are added.

#### Phase 0 Scope

- this lane is for VM0007 judgment fixtures only
- fixtures must use PDF truth, not current app output
- each fixture must encode accepted evidence
- each fixture must encode rejected weak or generic evidence
- weak evidence must stay `UNCLEAR`, not `FOUND`
- missing evidence must stay `MISSING`
- no production audit logic changes
- no report UI changes
- no client-facing report behavior changes
- no Quick Check v2 Phase 7 work

#### Future Fixture PR Contract

Every future fixture PR in this lane must:

- stay docs or fixture scoped unless a separate production-logic roadmap explicitly allows broader work
- identify the rule IDs covered by the fixture set
- state the PDF source of truth for each fixture set
- encode accepted evidence that is sufficient for the expected status
- encode rejected weak or generic evidence that must not upgrade a row to `FOUND`
- preserve `UNCLEAR` for weak evidence and `MISSING` for absent evidence
- define expected status per fixture
- define expected client action whenever status is weak or missing
- avoid using current app output as fixture truth

#### Acceptance For Future Fixture PRs

- fixture scope is limited to VM0007 judgment fixtures
- PDF truth is explicit
- accepted and rejected evidence are explicit
- status expectations are explicit
- weak evidence remains `UNCLEAR`
- missing evidence remains `MISSING`
- tests and CI are not weakened

### Phase 1 — Envira VM0007 Judgment Fixtures

Add and harden fixtures that capture Envira-specific VM0007 judgments, including:

- 5-10 rule-level judgment fixtures
- accepted evidence requirements
- rejected generic evidence examples
- at least one false-supported case
- at least one case where generic methodology/module-table evidence must not count as supported
- expected status for each fixture
- expected client action where status is weak or missing

### Phase 2 — PD_REDD VM0007 Judgment Fixtures

Add and harden fixtures for PD_REDD-style VM0007 judgments with the same evidence/status contract discipline.

### Phase 3 — Full 58-Rule Audit Fixture Shape

Envira VM0007 now has a reviewed full 58-rule audit fixture shape, but it is quarantined legacy REDD-MF / VM0007 v1.5 mismatch regression data, not validated VM0007 v1.8 truth. The historical split FOUND 30 / UNCLEAR 8 / MISSING 3 / N/A 17 remains preserved as regression evidence. Review included FOUND red-team pass, UNCLEAR/MISSING rescue check, R-1-0003 carbon-rights fix, fixture/test-only scope confirmation, `pr:gate`, and blind rebuild validation.

### Phase 4 — Report Fixture Layer

Add report-facing fixture expectations for summary sections, row grouping, and internal preview output. This layer remains quarantined historical fixture data until versioned re-audit confirms the VM0007 evidence map is truth-complete.

### Phase 5 — Client-Readiness Gate

Define the gate that keeps internal preview output distinct from any later client-ready reporting work.

## Non-Goals

- No production logic changes
- No report UI redesign
- No client-facing report changes
- No LLM final judgment
- No mixing into Quick Check v2 Phase 7
