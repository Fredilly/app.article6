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
- Integrity hardening (no drift):
  - Add manifest with per-file SHA256.
  - Enforce "no extra files" in pack (manifest is authoritative).
  - Define bundle integrity fields explicitly (zip hash vs runs hash) so values match reality.
  - Add CI/verify step so integrity drift cannot regress.
- Rule/Section ↔ Evidence bindings in export:
  - Each evidence item includes linked rule IDs + section anchors + short justification.
- Append-only review log inside export:
  - reviewer, timestamp, decision, notes (append-only semantics).
- Adds evidence/rule/section binding file in the export.
- Adds append-only review_log.json in the export.
- Export remains self-verifying via manifest + verifier gate.

### Acceptance
- Export same rule pack twice => byte-identical ZIP (CI gate).
- Manifest hashes validate every file; tampering fails verification.
- Review log is append-only; review_state derived from log.
- Pack includes enough trace context to review the rule, or flags missing data explicitly.
- Integrity semantics: zip_sha256 + manifest.json + no extras.
- verify-audit-pack is the gate.

### Audit Pack Verification
- Verification is defined as:
  - `manifest.json` per-file SHA256 matches file bytes, and
  - strict inventory: zip contains no files not listed in the manifest
- `zip_sha256` is optional; the manifest is the authoritative integrity model
- `generated_at` is intentionally fixed to a constant (epoch) to keep exports deterministic and diff-free

```bash
npm run verify:audit-pack -- ~/Desktop/audit-pack.zip
```

### Visible UI changes to look for
- Rule view download button.
- Review status chip + notes list.

## PR14_1 - Audit Pack Verification Semantics + Runtime Provenance

### Scope
- Document audit-pack verification semantics (manifest + no extras).
- Clarify deterministic `generated_at` (fixed epoch).
- Add runtime provenance fields (node/platform/arch) in bundle metadata.

### Acceptance
- Docs explicitly define verification semantics and deterministic timestamps.
- Exported pack includes runtime provenance fields without breaking verify.

## PR15 - Verifier Mode + Audit Trail + Rule Jump

### Scope
- Verifier Mode: read-only surfaces for review.
- Audit Trail tab: diff counts + top changed files + downloadable changes.json.
- Rule jump/search: fast navigation to rule id.
- Verifier UI renders rule↔evidence bindings (click evidence → see linked rules/sections).
- "Jump to rule" and "Jump to section" from verifier surface.
- Display audit trail + provenance summary (pack hash, app git sha, methodology pack provenance).
- Verifier proposes next actions (add evidence / open verify / export pack) but stays guided (no freeform).

### Acceptance
- Verifier Mode disables write actions.
- Audit Trail counts match manifest diff artifact.
- Click path works: changed rule -> sections -> evidence -> download pack -> verify.
- Scripted smoke passes: open -> audit trail -> jump rule -> download pack -> verify.

## PR20 - Trail inside audit pack + strict verify

### Scope
- Include `trail.jsonl` in every audit pack export (always present).
- Verify is strict: manifest required, no extras, all hashes match, trail is valid JSONL.

### Acceptance
- Tampering with trail.jsonl fails verification.
- Removing trail.jsonl fails verification.
- verify-audit-pack reports clear file + reason on failure.

### Visible UI changes to look for
- Verifier Mode toggle/link behavior.
- Audit Trail tab with counts + drilldowns.
- Rule jump/search UI.

## PR16 - CI Hardening + Self-Upgrading Deps

### Scope
- Unified CI entrypoint (`npm run ci`) with lint/typecheck/test/build.
- pr-gate runs the unified CI command only.
- Pre-push hook runs lint + typecheck.
- Renovate weekly self-upgrades for patch/minor.

### Acceptance
- CI uses the unified script; duplicated steps removed.
- Pre-push hook is fast and blocks lint/typecheck regressions.
- Renovate config merges patch/minor when CI is green.

## PR17 - Derived MRV artifacts + hashes (future)

### Scope
- Include derived outputs (cloud mask/composites, indices, change maps, uncertainty/QC).
- Hash all derived files and include in manifest.
- Keep compute deterministic and replayable.
