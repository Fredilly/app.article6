# Roadmaps Summary

This file is generated from roadmap SSOT JSON. Do not edit manually.

Roadmap reset: only explicitly active items drive what's next; historical PR numbers stay preserved for context.
Active lanes: verification-factory.
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
