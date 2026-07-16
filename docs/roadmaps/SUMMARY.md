# Roadmaps Summary

This file is generated from roadmap SSOT JSON. Do not edit manually.

Roadmap reset: only explicitly active items drive what's next; historical PR numbers stay preserved for context.
Active lanes: verification-factory, project-readiness-verification-output, review-grade-quick-check, project-verification, quick-check-document-pipeline, quickcheck-v2, requirement-coverage, review-grade-evidence-intelligence, safe-learning-intake-pipeline, standard-registry-wiring, traceable-rule-review-mvp, vm0007-evidence-map-mvp, vm0007-judgement-fixtures, vm0007-version-cleanup, vvb-report-presentation-layer.
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

## review-grade-quick-check

Status SSOT: `docs/roadmaps/review-grade-quick-check/phase-status.json`
Details: `docs/roadmaps/review-grade-quick-check/PLAN.md`

Lane status: Active
Turn Quick Check from a requirement matcher / section router into an evidence-backed verification-readiness review engine. Phased path from routing to readiness note export.

Not active now:
- Regression evaluation suite (phase 4+)
- Readiness note export (phase 5+)

1) PR642: Done (PR #640, #641, #642)

## interactive-evidence-review-mvp

Status SSOT: `docs/roadmaps/interactive-evidence-review-mvp/phase-status.json`
Details: `docs/roadmaps/interactive-evidence-review-mvp/PLAN.md`

1) RC0 — Roadmap contract: Done
2) RC1 — Readable interactive workspace: Done
3) RC2 — Accuracy benchmark: Done
4) RC3 — Generic accuracy improvements: Done
5) RC4 — Guided reviewer interaction: Active
6) RC5 — Unseen-PDD validation: Planned
7) RC6 — Stellar MVP release: Planned

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

## quick-check-document-pipeline

Status SSOT: `docs/roadmaps/quick-check-document-pipeline/phase-status.json`

Lane status: Active
Move Quick Check from tactical section-matching patches to a layered document pipeline with explicit parser, document-model, retrieval, evaluation, UI, and eval boundaries.

Not active now:
- Additional Quick Check tactical alias patches


## quickcheck-eval-learning

Status SSOT: `docs/roadmaps/quickcheck-eval-learning/phase-status.json`
Details: `docs/roadmaps/quickcheck-eval-learning/ROADMAP.md`

Lane status: Done
Make Quick Check improve from real PDD/document failures through controlled gold fixtures, regression tests, selector fixes, and strict eval gates. Production may collect corrections, but only reviewed fixtures and PRs may change behavior.


## quickcheck-parser-replacement

Status SSOT: `docs/roadmaps/quickcheck-parser-replacement/phase-status.json`
Details: `docs/roadmaps/quickcheck-parser-replacement/PLAN.md`


## quickcheck-v2

Status SSOT: `docs/roadmaps/quickcheck-v2/phase-status.json`
Details: `docs/roadmaps/quickcheck-v2/PLAN.md`

Lane status: Active
Rebuild Quick Check from clean ingestion up. PDF → canonical JSON → section tree → evidence spans → answer → status. One layer per PR. No scoring. No LLM finals. No Blob test dependency.

Current focus:
- Phase 5 done + Phase 6 done.

1) RC0 — Roadmap and SSOT boundary: Done — PLAN.md + phase-status.json exist at correct SSOT path. Delivered by PR #847. No production code changed.
2) RC1 — Envira ingestion only — canonical extracted JSON: Done — Ingestion pipeline at src/lib/quickCheckV2/ingestion/ creates deterministic canonical JSON from Envira (PR #846). 10 key strings with correct page/span/section provenance. Heading detection handles mixed-case + dotted patterns. No answers. No scoring. No Blob.
3) RC2 — Section tree and evidence spans: Done — Section tree from canonical JSON + evidence span index. Direct body under exact heading only. Each of six checks returns best evidence span with quote/page/section/spanId. Delivered by PR #852. No answers. No status. No scoring. No LLM.
4) RC3 — Evidence retrieval for six structured checks: Done — Fixed source priority: fact contract → exact section → raw text fallback. No router candidates. No scoring.
5) RC4 — Tiny answer extractors: Done — Check-specific extractors. Answers from selected evidence only. No LLM finals.
6) RC5 — Boring deterministic status validator: Done — FOUND = answer + quote + page + section + span. Validators judge only, do not search/rank.
7) RC6 — Gold Envira fixture: Done — Gold is PDF truth, not current output. Includes expected answer, quote, page, section, span ID, known junk to reject.
8) RC7 — Add PDFs slowly by new failure mode only: Planned — Each new PDF introduces a failure mode Envira does not cover. One PDF per PR.

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

## review-grade-evidence-intelligence

Status SSOT: `docs/roadmaps/review-grade-evidence-intelligence/phase-status.json`
Details: `docs/roadmaps/review-grade-evidence-intelligence/PLAN.md`

Lane status: Active
Define and implement an app-side project export standard covering uploads, evidence inventory, fragments, extracted facts, candidate links, coverage matrix, reviewer decisions, provenance, and premium PDF/ZIP exports. The export must be beautiful enough to sell, structured enough to defend, and conservative enough to trust.

Current focus:
- Maintain the export-conventions contract across new export surfaces
- Responsive UI QA for reconciliation and decision badges

Not active now:
- Quick Check extraction edge case tests (done)
- Refactoring extraction or export code — documentation and planning only in RC0-RC1
- Changes to canonical methodology metadata or pack encoding
- Unbounded AI classification, auto-verification, or final evidence sufficiency decisions

1) RC0 — Review-grade project export standard definition: Done
2) RC1 — Deterministic evidence extraction foundation: Done
3) RC2 — Evidence inventory reconciliation: Done
4) RC3 — Reviewer decision records with provenance: Done
5) RC4 — Premium PDF/ZIP export with full provenance: Done
6) RC5 — Verification pack integration with evidence intelligence: Done
7) RC6 — Evidence quality and coverage metrics: Done
8) RC7 — Evidence snapshot and comparison: Done
9) RC8 — Export standardization and cross-export consistency: Done

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
All phases complete. Verra and Gold Standard wired into the app through a standard-aware path. UNFCCC remains unchanged. Standard-specific composers implemented using canonical pack metadata.

Not active now:
- Adding Verra/Gold Standard placeholder methods to the manifest
- Changes to methodology pack data or encoding pipeline
- Formal validation/verification claims for non-UNFCCC registries

1) RC0 — Contract and boundaries: Done
2) RC1 — Pack/manifest consumption: Done
3) RC2 — Standard-grouped method picker: Done
4) RC3 — Project detail registry badge: Done
5) RC4 — Generic standard-aware export composer: Done
6) RC5 — Premium PDF wording and design: Done
7) RC6 — QuickCheck standard detection hardening: Done
8) RC7 — Standard-specific composers: Done

## traceable-rule-review-mvp

Status SSOT: `docs/roadmaps/traceable-rule-review-mvp/phase-status.json`
Details: `docs/roadmaps/traceable-rule-review-mvp/PLAN.md`

Lane status: Active
Turn per-rule verification into a traceable rule review workspace. The product center is the review record, not the checklist. 8-phase path to paid VVB pilots.

Current focus:
- Phases 1-5 and Phase 7 (evidence snapshot) are complete
- Phase 6 exportable verification output is next priority
- Phase 7: Evidence snapshot and comparison — timeline and diff view in project overview

Not active now:
- STAC auto-verification (support facts only, not auto-verify)
- AI-assisted review (post-moat)
- Multi-methodology cross-referencing (Phase 5+)


## vm0007-evidence-map-mvp

Status SSOT: `docs/roadmaps/vm0007-evidence-map-mvp/phase-status.json`
Details: `docs/roadmaps/vm0007-evidence-map-mvp/PLAN.md`

Lane status: Active
Persist and display the machine-proposed VM0007 v1.8 58-rule Evidence Map draft.

1) RC1 — 58-rule draft Evidence Map and UI: Active
2) RC2 — reviewer finalization and readiness report wiring: Planned

## vm0007-judgement-fixtures

Status SSOT: `docs/roadmaps/vm0007-judgement-fixtures/phase-status.json`
Details: `docs/roadmaps/vm0007-judgement-fixtures/PLAN.md`

Lane status: Active
Build a progressively improving VM0007 v1.8 Evidence Map using PDF-backed machine proposals, reviewed truth, explicit corrections, and generic retrieval/router improvements.

Current focus:
- Phase 6 complete: canonical system prompt and new-PDD playbook delivered by PR #994.
- Phase 7 complete: Marcondes truth intake and v1.7/v1.8 reconciliation delivered by PR #1012.
- Phase 8 active: the first generic applicability increment reduced Marcondes machine-versus-gold mismatches from 15 to 11 by preventing unrelated scope exclusions from producing N/A.

Not active now:
- Production logic changes in truth-intake PRs
- Quick Check extraction or routing changes
- Report UI redesign
- Client-facing report changes
- LLM final judgment
- Formal validation, verification, or VVB authority claims

1) RC0 — Roadmap Boundary: Done — Define a boundary-only contract for VM0007 judgment fixtures: PDF truth over current output, accepted and rejected evidence requirements, UNCLEAR/MISSING discipline, no production or UI changes, and clear acceptance criteria for future fixture PRs. Delivered by PR #895.
2) RC1 — Envira VM0007 Judgment Fixtures: Done — Added 5-10 Envira VM0007 judgment fixtures with explicit accepted evidence, rejected generic evidence examples, false-supported coverage, and expected statuses plus client actions where weak or missing. Delivered by PR #897.
3) RC2 — PD_REDD VM0007 Judgment Fixtures: Done — Added PD_REDD VM0007 fixture coverage using the same judgment contract discipline, including accepted evidence, rejected weak or generic evidence, and explicit FOUND / UNCLEAR / MISSING / N/A expectations.
4) RC3 — Full 58-Rule Audit Fixture Shape: Blocked — Envira VM0007's reviewed full 58-rule audit fixture is quarantined legacy REDD-MF / VM0007 v1.5 mismatch data. The historical FOUND 30 / UNCLEAR 8 / MISSING 3 / N/A 17 split remains preserved as a regression fixture, but it is not validated VM0007 v1.8 truth.
5) RC4 — Report Fixture Layer: Blocked — Report fixture output remains quarantined historical regression data. Report summary expectations and internal preview output are fixture-driven and testable, but the legacy Envira report fixture is not client-ready truth and is pending versioned re-audit. Historical delivery is preserved as PR #914.
6) RC5 — Client-Readiness Gate: Done — The internal-preview/client-readiness boundary is documented and legacy mismatch fixtures remain quarantined; no legacy Envira output is promoted as VM0007 v1.8 truth.
7) RC6 — Evidence Map Learning Contract: Done — Defined the repeatable two-PR cycle for VM0007 evidence-map learning and delivered the canonical system prompt plus new-PDD playbook in PR #994.
8) RC7 — Marcondes VM0007 v1.8 Evidence Map Truth Intake: Done — Intake Marcondes REDD+ as the completed VM0007 v1.8 truth case while reconciling the internal v1.7/v1.8 discrepancy, preserving raw 58-row output, counting only explicitly reviewed rows as gold, and delivering the result in PR #1012.
9) RC8 — Marcondes Generic System Improvement: Active — Use reviewed Marcondes truth to classify and fix reusable shared-system failures. The first Phase 8 increment added rule-subject alignment for broad carbon-pool and GHG-source scope exclusions, reducing active machine-versus-gold mismatches from 15 to 11; Phase 8 remains active.
10) RC9 — Review and Gold Promotion Tooling: Planned — Make partial review and correction generation easy while preserving machine proposal, reviewer correction, final truth, and explicit gold coverage separately.
11) RC10 — Second Unseen VM0007 v1.8 PDD: Planned — Run the same truth-intake and generic-improvement cycle on an unseen eligible VM0007 v1.8 PDD to prove generalization and prevent regressions.

## vm0007-version-cleanup

Status SSOT: `docs/roadmaps/vm0007-version-cleanup/phase-status.json`

Lane status: Active
Phase 6 Forward Path is complete: contaminated VM0007 evidence-map/report roadmap states are quarantined, mismatched VM0007 versions are blocked from normal evidence, report, PDF, and client-readiness trust paths, the legacy Envira fixture remains pending versioned re-audit, and a normalized VM0007 v1.8 path can pass the version lock without building a full project Evidence Map.

Current focus:
- Keep Envira quarantined as a blocked legacy REDD-MF / VM0007 v1.5 mismatch regression case
- Keep the existing quote/page/section integrity gates intact
- Phase 1-6 cleanup and roadmap-correction work is done

Not active now:
- Envira quarantine
- Report/PDF blocking
- Gate strengthening
- Roadmap correction
- Forward-path expansion

1) RC1 — Phase 1: Version Lock: Done — VM0007 version identity is enforced before evidence audit; missing or mismatched PDD-declared methodology versions hard block with BLOCKED_VERSION_MISMATCH, while legitimate VM0007 v1.8 may proceed.
2) RC2 — Phase 2: Envira Quarantine: Done — Preserve Envira as a legacy v1.5 mismatch regression fixture, not validated truth.
3) RC3 — Phase 3: Report and PDF Blocking: Done — Prevent mismatched versions from producing normal evidence maps, reports, PDFs, or readiness claims.
4) RC4 — Phase 4: Gate Strengthening: Done — Add tests and gates so mismatches cannot produce judgments, reports, PDFs, or client-readiness output.
5) RC5 — Phase 5: Roadmap Correction: Done — Correct contaminated done states, mark VM0007 evidence-map work pending versioned re-audit, and preserve the legacy Envira fixture as quarantined historical regression data rather than validated VM0007 v1.8 truth.
6) RC6 — Phase 6: Forward Path: Done — A normalized VM0007 v1.8 PDD path can pass the version lock while the legacy Envira v1.5 mismatch fixture remains blocked, without building a full project Evidence Map.

## vvb-report-presentation-layer

Status SSOT: `docs/roadmaps/vvb-report-presentation-layer/phase-status.json`
Details: `docs/roadmaps/vvb-report-presentation-layer/PLAN.md`

Lane status: Active
Add a generic pre-validation presentation layer downstream of finalized Evidence Map rows, without changing Quick Check router semantics or claiming formal VVB authority.

Current focus:
- Phase 0 terminology and compatibility contract is complete
- Phase 1 status consumer audit is complete
- Phase 2 Evidence Map dependency contract is complete
- Phase 3 Conformance Conclusion Contract is complete
- Phase 4 Draft Action/Finding Contract is complete
- Phase 5 Applicability Contract is complete
- Phase 6 Report Presentation Object is complete
- Phase 7 Presentation Gates are complete
- Phase 8 Fixture Expectation Migration is complete
- Phase 9 Readiness Report and UI Consumers is complete
- Phase 10 Deprecation Review is next
- Review traceability and release controls are explicit downstream requirements
- Keep the Evidence Map upstream and canonical
- Keep the Pre-Validation Readiness Report and UI downstream

Not active now:
- Router status renames
- Fixture migration is complete
- Gap report implementation
- Organization-specific report profiles
- Formal verifier authority claims

1) RC0 — Phase 0: Report Terminology Contract: Done — Define additive pre-validation language, canonical NIR_CANDIDATE, NCR_CANDIDATE, OFI_CANDIDATE, and null draft-finding values, prohibited formal-authority claims, and preservation of existing statuses without mappings.
2) RC1 — Phase 1: Status Consumer Audit: Done — Audit every producer, storage boundary, transformation, comparison, filter, display, fixture, analytics, and test consumer of FOUND, UNCLEAR, MISSING, answered, unclear, and no_evidence without changing runtime semantics.
3) RC2 — Phase 2: Evidence Map Dependency Contract: Done — Add a generic pure dependency gate requiring finalized Evidence Map row identity, requirement and methodology identity, upstream status, applicability state, accepted and rejected evidence, assessment reason, client action, search coverage, source-document identity, and evidence provenance without mapping or judging them.
4) RC3 — Phase 3: Conformance Conclusion Contract: Done — Consume explicit assessment inputs after the Phase 2 dependency gate to derive CONFORMS, ACTION_REQUIRED, NOT_APPLICABLE, or fail-closed NOT_ASSESSED without creating draft findings.
5) RC4 — Phase 4: Draft Action/Finding Contract: Done — Consume a Phase 3 conclusion and explicit classification to produce only generic NIR_CANDIDATE, NCR_CANDIDATE, OFI_CANDIDATE, or null without selecting evidence or claiming formal authority.
6) RC5 — Phase 5: Applicability Contract: Done — Require a basis-backed explicit applicability decision matching the canonical Evidence Map row; block missing, unknown, contradictory, or unevaluated applicability without changing upstream status semantics.
7) RC6 — Phase 6: Report Presentation Object: Done — Package finalized Evidence Map rows and validated applicability, conformance, and draft-finding results into one immutable generic presentation object with preserved evidence, provenance, review metadata, versions, and identity checks.
8) RC7 — Phase 7: Presentation Gates: Done — Prevent unsupported conclusions and draft finding candidates through applicability, evidence sufficiency, and search-coverage gates, plus finalized-row traceability, review-history, contract-version, reopened-or-superseded-row, cross-row consistency, and fail-closed release-readiness gates.
9) RC8 — Phase 8: Fixture Expectation Migration: Done — Migrate reviewed fixture truth through finalized Evidence Map rows and the Phase 2–7 presentation contracts while preserving accepted and rejected evidence, provenance, statuses, and legacy consumers.
10) RC9 — Phase 9: Readiness Report and UI Consumers: Done — Implement downstream Pre-Validation Readiness Report and UI consumers using only finalized Phase 6 presentation objects and Phase 7 gate results, with fail-closed reviewer metadata and internal preview when client release is blocked.
11) RC10 — Phase 10: Deprecation Review: Next — Review old labels and organization-specific profiles only after the generic reviewer workflow and release gate are proven through a controlled pilot with qualified validation or verification professionals.
