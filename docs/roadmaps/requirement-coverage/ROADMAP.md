# Requirement Coverage

Status is sourced from `docs/roadmaps/requirement-coverage/phase-status.json`; docs must not drift.

Goal: make methodology-to-evidence reconciliation the default workflow before validation, verification, or diligence.

## Product narrative

app.article6 should no longer behave primarily like a methodology/evidence viewer. The default job is:

1. Load a covered methodology version from the canonical methodology repo.
2. Render every requirement as a reconciliation row with methodology provenance.
3. Show what evidence is expected, what evidence is linked, and what is still missing or ambiguous.
4. Only then move into validation, verification, export, or diligence actions.

The methodology repo remains the canonical source for covered methods. Raw methodology PDF intake is a fallback path only for uncovered methods and must not become the default workflow for methods already covered in the pack.

## Phases

## RC1 — Requirement coverage UI

Objective: establish rule-by-rule reconciliation as the primary workspace.

Scope:
- Define a stable app-side requirement coverage row model.
- Render rule summary, section/page provenance, expected evidence types, linked evidence, and reconciliation status.
- Make missing and partial coverage explicit instead of hiding gaps behind browsing flows.

Acceptance:
- The app can represent a requirement coverage row without adding new ingestion engines.
- Statuses are explicit: `missing`, `partial`, `linked`, `needs-review`.
- Current method/version flows continue to work.

## RC2 — Evidence inventory

Objective: create a normalized inventory of evidence assets available for reconciliation.

Scope:
- Track uploaded/imported evidence with stable IDs, type labels, provenance, and link state.
- Separate inventory from adjudication so evidence can exist before it is linked to a requirement.

## RC3 — Spreadsheet/workbook intake

Objective: ingest structured workbook evidence into the inventory and reconciliation workflow.

Scope:
- Accept workbook metadata and tabsheets relevant to methodology requirements.
- Map workbook-derived records into expected evidence types.

## RC4 — Monitoring report intake

Objective: ingest monitoring report evidence into the same coverage workflow.

Scope:
- Preserve report provenance and reporting period metadata.
- Support requirement rows that expect monitoring narrative, metrics, or appendices.

## RC5 — PDD intake

Objective: ingest project design documentation as first-class evidence.

Scope:
- Capture section/page provenance for PDD claims.
- Support linking one PDD fragment to multiple requirements where appropriate.

## RC6 — Methodology version diff / impact mode

Objective: show how methodology changes affect requirement coverage and linked evidence.

Scope:
- Compare covered methodology versions.
- Identify rows whose evidence links or expected evidence types may need review after a diff.

## RC7 — Fallback raw methodology PDF intake for uncovered methods

Objective: support uncovered methods without making PDF parsing the main path for covered ones.

Scope:
- Allow raw PDF audit/intake only when the methodology repo does not already provide the method/version.
- Keep the fallback clearly labeled as lower-confidence and temporary.

Non-goals:
- Do not let raw PDFs become the primary path for covered methods.

## RC8 — Additional GIS formats later

Objective: broaden geospatial evidence intake after the reconciliation workflow is stable.

Scope:
- Add additional GIS formats only after the core requirement coverage workflow is proven.

## Triage of current work

### Keep

- Deterministic exports and manifest integrity work.
- Audit trail and provenance surfaces that explain what changed.
- Method/version diff capabilities that can feed impact mode.
- Coverage/debug/link-resolver discipline that protects against silent regressions.

### Fold into requirement-coverage

- Evidence map and evidence panel work should become supporting views for selected requirement rows, not the main narrative.
- Verifier checklist, run history, and delta-to-task work should start from unresolved or changed requirement coverage.
- Gold/adjudication/export features should operate on linked requirement rows and evidence inventory items.
- Pre-audit and review-prep flows should begin with reconciliation completeness rather than generic verification entry points.

### Scrap or defer

- Speculative platform expansion not needed for the reconciliation workspace now.
- Precedent/case-law memory until repeated real usage proves it is needed.
- Over-polish on chat, map, or assistant surfaces that does not improve requirement reconciliation.
- Heavy spreadsheet/PDF parsing in this PR beyond the minimum needed to support the view model.
