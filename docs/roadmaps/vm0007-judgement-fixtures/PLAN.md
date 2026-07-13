# VM0007 Judgement Fixtures and Evidence Map Learning Roadmap

Status is sourced from `docs/roadmaps/vm0007-judgement-fixtures/phase-status.json`; docs must not drift.

## Goal

Build a progressively improving VM0007 v1.8 Evidence Map using PDF-backed machine proposals, reviewed truth, explicit corrections, and generic retrieval/router improvements.

This roadmap grows from the existing VM0007 judgment-fixture and gap-report accuracy work. It does not change production logic, Quick Check semantics, report UI styling, or client-facing outputs unless a later phase explicitly permits a shared-system improvement.

## Governing Documents

- [SYSTEM_PROMPT.md](./SYSTEM_PROMPT.md) - canonical agent rules
- [NEW_PDD_PLAYBOOK.md](./NEW_PDD_PLAYBOOK.md) - exact operator steps for adding a PDD

## Core Focus

- PDF-backed accepted and rejected evidence
- explicit reviewer truth and corrections
- applicability, provenance, search coverage, contradiction, and draft-finding assessments
- partial review coverage without treating unreviewed rows as truth
- generic retrieval, routing, and evidence-selection improvements
- regression protection across clean VM0007 v1.8 PDDs and quarantined version-mismatch fixtures

## Boundary

This lane remains separate from Quick Check v2 Phase 7. The learning cycle may consume persisted Evidence Map output, but it must not change Quick Check extraction or routing semantics through fixture work.

Envira's historical VM0007 v1.5 mismatch material remains quarantined regression data. It must never be rewritten as valid VM0007 v1.8 truth.

## Phases

### Phase 0 — Roadmap Boundary — done

Phase 0 is documentation-only. fixtures must use PDF truth, not current app output. Define the scope of VM0007 judgment fixtures and lock the separation from production logic and Quick Check v2 Phase 7. Delivered by PR #895.

### Phase 1 — Envira VM0007 Judgment Fixtures — done

Add and harden Envira-specific VM0007 judgment fixtures, including accepted evidence, rejected generic evidence, false-supported cases, expected statuses, and client actions. Delivered by PR #897.

### Phase 2 — PD_REDD VM0007 Judgment Fixtures — done

Add and harden PD_REDD-style VM0007 rule-level judgments using the same PDF-backed accepted/rejected evidence contract.

### Phase 3 — Full 58-Rule Audit Fixture Shape — blocked/quarantined

Preserve the Envira full 58-rule audit fixture as a quarantined legacy REDD-MF / VM0007 v1.5 mismatch regression case. The historical FOUND 30 / UNCLEAR 8 / MISSING 3 / N/A 17 split remains regression evidence only and is not VM0007 v1.8 truth.

### Phase 4 — Report Fixture Layer — blocked/quarantined

Preserve report-facing fixture expectations and internal preview coverage for the quarantined legacy Envira material. Do not present it as client-ready or truth-complete VM0007 v1.8 output. Historical delivery is preserved as PR #914.

### Phase 5 — Client-Readiness Gate — done

Keep internal preview output separate from later client-ready reporting work. This phase records the existing quarantine and gate boundary; it does not promote the legacy Envira material to client-ready truth.

### Phase 6 — Evidence Map Learning Contract — done

Define the repeatable two-PR cycle for safely improving the Evidence Map.

#### PR1: Truth intake

- validate methodology and version
- preserve untouched machine output
- review PDF-backed rows
- save accepted and rejected evidence
- record corrections
- allow partial review
- only reviewed rows count as gold
- make no production logic changes

#### PR2: Generic system improvement

- classify reusable failures
- improve shared retrieval, routing, evidence selection, or assessment logic
- never hardcode the project
- rerun all previous fixtures
- test one unseen eligible PDD

Delivered by PR #994 on branch `docs/vm0007-evidence-map-playbook`.

### Phase 7 — Marcondes VM0007 v1.8 Evidence Map Truth Intake — done

- Delivered by PR #1012 on branch `agent/marcondes-vm0007-truth-reconciliation`
- finalized all 58 VM0007 v1.8 rows with zero unreviewed rows
- preserved the raw 58-row machine output and source extraction
- stored reviewed truth, corrections, provenance, reviewer notes, `REVIEW.md`, and explicit reviewed rule IDs
- preserved the page 61 v1.7 wording and Tables 30/31 v1.8 declarations
- recorded the reconciled VM0007 v1.8 decision and rationale in metadata and `REVIEW.md`
- documented and regression-pinned the computed 15-row machine-versus-gold mismatch set

#### Phase 7 completion criteria

- page 61 v1.7 wording is preserved exactly
- Tables 30 and 31 v1.8 declarations are preserved exactly
- a reviewer records the reconciled methodology version and rationale
- the decision is stored in metadata and `REVIEW.md`
- unresolved conflict blocks gold promotion and Evidence Map truth claims
- no silent normalization is permitted
- after reconciliation, Marcondes may be marked version-qualified VM0007 v1.8 truth

### Phase 8 — Marcondes Generic System Improvement — active

- use the finalized 15-row Marcondes mismatch record as the regression baseline
- map each reusable failure class to the shared retrieval, routing, evidence-selection, applicability, provenance, contradiction, or finding layer responsible
- write failing generic regression coverage before changing shared behavior
- fix only reusable shared logic; never branch on Marcondes, project IDs, fixture text, or page numbers
- preserve frozen raw artifacts and explain any changed machine judgment against reviewed truth
- rerun Quick Check, Evidence Map, Marcondes, earlier judgment, and version-mismatch regressions
- leave the unseen VM0007 v1.8 PDD as the later generalization check

### Phase 9 — Review and Gold Promotion Tooling — planned

- make partial row review easy
- generate corrections automatically from machine-versus-reviewer differences
- promote only explicitly reviewed rows to gold
- preserve machine proposal, reviewer correction, and final truth separately
- provide coverage counts without treating unreviewed rows as failures or passes

### Phase 10 — Second Unseen VM0007 v1.8 PDD — planned

- intake an unseen eligible PDD
- run the same PR1/PR2 cycle
- prove Marcondes improvements generalize
- prevent regression across Marcondes, earlier judgment fixtures, and version-mismatch fixtures

## Fixture roles

- **Marcondes:** first forward VM0007 v1.8 Evidence Map learning case with an explicit internal v1.7/v1.8 discrepancy.
- **Envira:** quarantined methodology-version mismatch regression fixture.
- **PD_REDD:** existing rule-level judgment fixture set; do not claim full VM0007 v1.8 Evidence Map truth unless separately version-validated.
- **Future PDDs:** unseen VM0007 v1.8 generalization cases.

## Required Evidence Map truth artifacts

Every reviewed Evidence Map learning case should preserve, separately and traceably:

- raw machine output
- reviewed truth
- corrections
- `REVIEW.md`
- metadata
- `reviewedRuleIds` or equivalent
- accepted evidence
- rejected evidence and reason
- quote, page, section, and provenance
- applicability and basis
- assessment reason
- client action
- draft finding candidate
- reviewer notes
- review status

## Non-Goals

- No Quick Check status or extraction semantics changes
- No production changes in truth-intake PRs
- No project-specific or methodology-specific hardcoding in generic improvements
- No report styling redesign
- No formal validation, verification, or VVB authority language
- No rewriting of Envira legacy mismatch data as VM0007 v1.8 truth
