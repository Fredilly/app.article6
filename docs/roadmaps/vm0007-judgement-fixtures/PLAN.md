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

Stabilize the full audit fixture structure for all 58 VM0007 rules so the report can be tested against a complete rule set.

### Phase 4 — Report Fixture Layer

Add report-facing fixture expectations for summary sections, row grouping, and internal preview output.

### Phase 5 — Client-Readiness Gate

Define the gate that keeps internal preview output distinct from any later client-ready reporting work.

## Non-Goals

- No production logic changes
- No report UI redesign
- No client-facing report changes
- No LLM final judgment
- No mixing into Quick Check v2 Phase 7
