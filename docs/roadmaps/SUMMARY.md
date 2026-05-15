# Roadmaps Summary

This file is generated from roadmap SSOT JSON. Do not edit manually.

Roadmap reset: only explicitly active items drive what's next; historical PR numbers stay preserved for context.
Active lanes: verification-factory, project-readiness-verification-output, project-verification, requirement-coverage, safe-learning-intake-pipeline, standard-registry-wiring, traceable-rule-review-mvp.
Frozen lanes: agentic-verification.


## data-integrity-exports

Status SSOT: `docs/roadmaps/data-integrity-exports/phase-status.json`
Details: `docs/roadmaps/data-integrity-exports/PLAN.md`

1) PR7: Done (PR #318)
2) PR8: Done (PR #313)
3) PR9: Done (PR #314)
4) PR10: Done (PR #320)
5) PR11: Done (PR #323)

## phase-assurance-surface-mvp

Status SSOT: `docs/roadmaps/phase-assurance-surface-mvp/phase-status.json`
Details: `docs/roadmaps/phase-assurance-surface-mvp/PLAN.md`

1) PR12 — Evidence Map MVP (trace-driven): Done (PR #326)
2) PR13 — Grounded Method Assistant (guided prompts only): Done (PR #340)
3) PR14 — Rule-Scoped Evidence Pack + Append-Only Review Log: Done (PR #345)
4) PR14.1 — Audit Pack Verification Semantics + Runtime Provenance: Done (PR #346)
5) PR15 — Verifier Mode + Audit Trail + Rule Jump: Done (PR #347)
6) PR16 — CI Hardening + Self-Upgrading Deps: Done (PR #348)
7) PR17 — Derived MRV artifacts + hashes (future): Done (PR #429, #432)

## verifier-moat

Status SSOT: `docs/roadmaps/verifier-moat/phase-status.json`
Details: `docs/roadmaps/verifier-moat/PLAN.md`

1) PR18 — Shrink Method UI to Read | Verify + demote tools: Done (PR #355)
2) PR19 — CI hardening (align with PR16): Done (PR #358)
3) PR20 — Trail inside audit pack + strict verify: Done (PR #369)
4) PR21 — Share link (optional): Done (PR #373)

### verification-factory

Status SSOT: `docs/roadmaps/verification-factory/phase-status.json`
Details: `docs/roadmaps/verification-factory/PLAN.md`

Lane status: Active
Customer-validation roadmap. Only near-term customer-facing work is active; historical items remain documented but do not drive sequencing.

Current focus:
- Close customer-facing judgment gaps
- Improve customer-safe exports and shareable artifacts
- Support pre-audit and review prep
- Avoid speculative platform expansion

Not active now:
- Precedent memory until repeated customer usage proves it is worth building now
- Features that depend on repeated multi-customer usage patterns

1) PR22 — KPI SSOT + CI Snapshot + Proof/Coverage chip: Done (PR #397)
2) PR23 — Eval harness Hard Set v0: Done (PR #391)
3) PR24 — Verifier minutes + checklist: Done (PR #394)
4) PR25 — Local run history (last N runs): Done (PR #405)
5) PR26 — Delta→Impact→Tasks pipeline: Done (PR #407)
6) PR27 — Coverage ratchet + link resolver gates: Done (PR #411)
7) PR28 — Flywheel v1: Outcomes + Moat export: Done (PR #387)
8) PR29 — Pilot loop + hard-case intake: Done (PR #414)
9) PR30 — Make coverage actionable (real rule IDs): Done (PR #427)
10) PR31 — Baseline uplift discipline: Done (PR #436)
11) PR32 — Pairwise evidence preference events (Midjourney-style): Done (PR #445)
12) PR33 — Adjudication templates + Promote to Gold labels: Active — Active because it closes customer-facing judgment gaps in live review workflows.
13) PR34 — Precedent matching (case-law memory): Parked — Parked until repeated customer usage shows precedent memory is worth building now.
14) PR35 — Investor-safe Moat Export v2 (redacted): Next — Next because customer-safe redacted exports directly support live sharing and review.

## agentic-verification

Status SSOT: `docs/roadmaps/agentic-verification/phase-status.json`
Details: `docs/roadmaps/agentic-verification/PLAN.md`

Lane status: Frozen
Preserved as future optional work; not part of the current active customer-validation roadmap.

Not active now:
- This lane is frozen for now
- Future agent platform work remains documented but does not drive current build priority

1) PR36 — Agent primitives spec v1 (Method/Evidence/Run/Exception/Attestation/Approval): Done (PR #438)
2) PR37 — Skill package spec v1 (signed manifest + capability allowlist): Frozen — Frozen with the lane; preserved as future optional work.
3) PR38 — Execution sandbox + guardrails (scoped connectors, read-only default): Frozen — Frozen with the lane; preserved as future optional work.
4) PR39 — Attestation + replay (hash chain, replay run, diff outputs): Frozen — Frozen with the lane; preserved as future optional work.
5) PR40 — Agent API v1 (startRun/submitEvidence/evaluate/getExceptions/exportAuditPack/attestRun): Frozen — Frozen with the lane; preserved as future optional work.
6) PR41 — Human approval gates (finalization state machine + override notes): Frozen — Frozen with the lane; preserved as future optional work.
7) PR42 — Metering hooks (per-run, per-export, org usage ledger): Frozen — Frozen with the lane; preserved as future optional work.
8) PR43 — Pre-audit pack prep workflow v1 (end-to-end sellable unit): Frozen — Frozen with the lane; preserved as future optional work.
9) PR44 — Policy packs + house interpretations overlay (versioned): Frozen — Frozen with the lane; preserved as future optional work.
10) PR45 — Exceptions taxonomy v1 + reviewer notes glue (standardized): Frozen — Frozen with the lane; preserved as future optional work.

## project-readiness-verification-output

Status SSOT: `docs/roadmaps/project-readiness-verification-output/phase-status.json`
Details: `docs/roadmaps/project-readiness-verification-output/PLAN.md`

Lane status: Active
Commercial sales-readiness lane for project developer gap audits, VVB workpaper exports, public verification autopsies, white-label consultancy pilots, and rule encoding. `traceable-rule-review-mvp` remains the technical foundation.

Current focus:
- Phase 5 is active: a separate VVB-facing draft workpaper export now reuses review rows, readiness gaps, evidence references, and provenance without claiming verifier authority
- Next build: deepen registry-aware workpaper coverage and provenance detail without overstating Article6 as a verifier or claiming registry approval
- Keep `traceable-rule-review-mvp` as the technical foundation for review records and exports
- Preserve app-vs-methodologies boundaries while preparing sellable verification outputs

Not active now:
- Formal VVB verification claims
- Registry approval claims
- Credit issuance claims
- Methodology-repo changes in this app repo

1) PR542: Done (PR #542)
2) PR555: Done (PR #555)

## project-verification

Status SSOT: `docs/roadmaps/project-verification/phase-status.json`
Details: `docs/roadmaps/project-verification/ROADMAP.md`

Lane status: Active
Turn per-rule verification into per-project verification. Add document intake, upgrade PDF exports, wire Verra methodology support. Shortest path to a defensible $5K/verification offer.

Current focus:
- Add project-level wrapper that collects rule reviews into one verification
- Upgrade document intake beyond satellite-only evidence
- Make the review PDF something a VVB can hand to their client
- Prepare for Verra VM0007 rules (upstream dependency on article6-methodologies)

Not active now:
- Full automated claim extraction from documents (manual mapping first)
- Quantitative carbon calculation engine (track as future phase)
- Multi-methodology cross-referencing
- Team collaboration / approval workflows

1) RC1 — Project-level wrapper: Next — Create a project verification object that collects multiple rule reviews into one cohesive verification with coverage summary and finalization.
2) RC2 — Document evidence intake: Planned — Accept PDD and monitoring report uploads as first-class evidence. Manual claim-to-rule mapping alongside satellite evidence.
3) RC3 — Verification pack PDF: Planned — Review-ready PDF with branded cover, coverage matrix, evidence inventory, gap summary, and draft verification opinion.
4) RC4 — Verra methodology support: Planned — Wire app to use Verra VM0007 rules once encoded upstream. Depends on article6-methodologies VF1-VF3.
5) RC5 — End-to-end demo case: Planned — One complete VM0007 forestry verification with synthetic data, full rule coverage, and review-ready PDF export.

## requirement-coverage

Status SSOT: `docs/roadmaps/requirement-coverage/phase-status.json`
Details: `docs/roadmaps/requirement-coverage/ROADMAP.md`

Lane status: Active
Primary product direction. Methodology-to-evidence reconciliation becomes the default workflow before validation, verification, or diligence.

Current focus:
- Build spreadsheet/workbook intake on top of the evidence inventory foundation
- Keep the methodology repo canonical for covered methods
- Bring workbook evidence into the coverage workflow with stable intake structure
- Keep current verification/export flows working while reconciliation expands

Not active now:
- Overbuilding spreadsheet or PDF parsing in the initial foundation PR
- Letting fallback raw methodology PDFs become the main path for covered methods
- Additional GIS formats before requirement coverage is stable

1) RC1 — Requirement coverage UI: Done — Define and render rule coverage rows with provenance, expected evidence, linked evidence, and reconciliation status.
2) RC2 — Evidence inventory: Done — Normalize evidence assets before deeper ingestion work.
3) RC3 — Spreadsheet/workbook intake: Done — Bring workbook evidence into the coverage workflow.
4) RC4 — Monitoring report intake: Done — Capture monitoring report evidence with stable provenance.
5) RC5 — PDD intake: Done — Ingest uploaded project design documentation into the app evidence inventory with stable section/page/fragment provenance and support one-to-many requirement linking.
6) RC6 — Methodology version diff / impact mode: Planned — Use canonical methodology version and diff metadata to identify coverage rows and linked evidence that may need review in the app.
7) RC7 — Fallback raw methodology PDF intake for uncovered methods: Planned — Enable lower-confidence fallback raw methodology PDF intake only for uncovered methods while preserving canonical methodology outputs as the default for covered methods.
8) RC8 — Additional GIS formats later: Deferred — Defer broader GIS intake until reconciliation fundamentals are stable.

## safe-learning-intake-pipeline

Status SSOT: `docs/roadmaps/safe-learning-intake-pipeline/phase-status.json`
Details: `docs/roadmaps/safe-learning-intake-pipeline/PLAN.md`

Lane status: Active
Safe learning intake lane for redacted local learning cases, central untrusted intake, consent gating, triage, reviewed promotion, and downstream product/eval improvements. Manual Review local learning cases from PR #568 are the starting point.

Current focus:
- Phase 0 is done: local untrusted learning-case foundation exists in app.article6
- Phase 1 is the next recommended implementation: server-side untrusted intake with strict separation from reviewed/promoted records
- Keep all user-entered learning data untrusted by default
- Do not let intake data directly update rules, models, evals, scores, prompts, or public claims

Not active now:
- Automatic training
- Automatic promotion
- Methodology-rule updates from user-entered learning data
- Public claims from private intake


## standard-registry-wiring

Status SSOT: `docs/roadmaps/standard-registry-wiring/phase-status.json`
Details: `docs/roadmaps/standard-registry-wiring/PLAN.md`

Lane status: Active
Wire Verra and Gold Standard into the app through a safe, incremental, standard-aware path. UNFCCC remains unchanged. The app consumes methodology metadata from the pack/manifest. Standard-specific composers come later, after the generic standard-aware path works.

Current focus:
- Freeze app-side expectations for provider, category, method code, version, display name, registry/standard label, and artifact paths (Phase 0)
- Ensure the app consumes canonical manifest from the methodology pack, not hand-stitched entries (Phase 1)

Not active now:
- Verra-specific or Gold Standard-specific report composers
- Adding Verra/Gold Standard placeholder methods to the manifest
- Changes to methodology pack data or encoding pipeline
- Formal validation/verification claims for non-UNFCCC registries

1) RC0 — Contract and boundaries: In progress
2) RC1 — Pack/manifest consumption: Planned
3) RC2 — Standard-grouped method picker: Planned
4) RC3 — Project detail registry badge: Planned
5) RC4 — Generic standard-aware export composer: Planned
6) RC5 — Premium PDF wording and design: Planned
7) RC6 — QuickCheck standard detection hardening: Planned
8) RC7 — Standard-specific composers (future): Planned

## traceable-rule-review-mvp

Status SSOT: `docs/roadmaps/traceable-rule-review-mvp/phase-status.json`
Details: `docs/roadmaps/traceable-rule-review-mvp/PLAN.md`

Lane status: Active
Turn per-rule verification into a traceable rule review workspace. The product center is the review record, not the checklist. 8-phase path to paid VVB pilots.

Current focus:
- Phases 1-4 are complete: review panel, audit trail, finalize gate, AOI/STAC support, and document/workbook support are in place
- Phase 5 is now in progress for method completeness across the target demo methods
- PR #546 added the readiness-gap engine core as backend derivation only, with no visible Verify UI change yet
- Next work: wire derived readiness facts into Verify and reviewer-facing export surfaces

Not active now:
- STAC auto-verification (support facts only, not auto-verify)
- AI-assisted review (post-moat)
- Multi-methodology cross-referencing (Phase 5+)
