# Assurance Surface MVP Roadmap

Status is sourced from `docs/roadmaps/phase-assurance-surface-mvp/phase-status.json`; docs must not drift.

## Goals (Definition of Done)

- Deterministic scoped exports: same inputs => byte-identical rule packs.
- Trace completeness in UI: each rule shown links to sections + evidence or explicitly shows "Missing evidence".
- Grounded UX: Map + Assistant are views over trace.json (no fuzzy heuristics).
- Human-in-the-loop: append-only review log included in exports + hashed in manifest.
- Explain change: in-app Audit Trail answers "what changed?" via manifest diffs.
- Threat model documented: trust boundaries + mitigations are explicit.

## PR12 - Evidence Map MVP (trace-driven)

### Scope
- "View Evidence Map" from method + version.
- Inputs: STAC URL (primary), optional uploaded GeoJSON AOI (secondary).
- Render: AOI + STAC layers, evidence list panel with linked rules from trace.json.
- Show Data Quality chips sourced from evidence metadata (coarse v1).

### Acceptance
- Selecting evidence highlights linked rules using trace.json only; unlinked evidence is explicit.
- Map becomes interactive <3s on a representative fixture STAC (smoke).
- Export "map snapshot" JSON is stable under canonicalization (no random ordering).
- No persistence/DB/workflows in MVP.

### Visible UI changes to look for
- Evidence Map entry point.
- Map renders + evidence panel.
- Evidence click highlights linked rules.

## PR13 - Grounded Method Assistant (guided prompts only)

### Scope
- Assistant panel with 4 fixed prompt buttons (guided only, no freeform).
- Structured response: Answer, Evidence (rule/section links), Assumptions (optional), Next actions.
- Only uses: META/rules/sections/trace/diff (no other sources).

### Acceptance
- No freeform input visible anywhere in the Assistant surface.
- Every response includes grounded Evidence linking to rule IDs and/or section anchors.
- Next actions route to Verify (list/map) and Export pack.
- Same prompt + same artifacts => identical output after canonicalization.

### Visible UI changes to look for
- Assistant panel shows 4 prompt buttons and no text box.
- Evidence lists clickable rule IDs + section anchors.
- Next actions appear as buttons (Open Verify / Add evidence / Export pack).

## PR14 - Rule-Scoped Evidence Pack + Append-Only Review Log

### Scope
- Rule view: "Download Evidence Pack" (rule-scoped).
- Pack includes: META, rules, sections, trace, review_log.jsonl, review_state.json, manifest.json.
- Review UI: add note, mark reviewed, mark approved.

### Acceptance
- Export same rule pack twice => byte-identical ZIP (CI gate).
- Manifest hashes validate every file; tampering fails verification.
- Review log is append-only; review_state derived from log.
- Pack includes enough trace context to review the rule, or flags missing data explicitly.

### Visible UI changes to look for
- Rule view download button.
- Review status chip + notes list.

## PR15 - Verifier Mode + Audit Trail + Rule Jump

### Scope
- Verifier Mode: read-only surfaces for review.
- Audit Trail tab: diff counts + top changed files + downloadable changes.json.
- Rule jump/search: fast navigation to rule id.

### Acceptance
- Verifier Mode disables write actions.
- Audit Trail counts match manifest diff artifact.
- Click path works: changed rule -> sections -> evidence -> download pack -> verify.
- Scripted smoke passes: open -> audit trail -> jump rule -> download pack -> verify.

### Visible UI changes to look for
- Verifier Mode toggle/link behavior.
- Audit Trail tab with counts + drilldowns.
- Rule jump/search UI.
