# agentic-verification

Goal: make Article6 agent-ready by shipping stable contracts, safe execution, and attestable outputs while keeping the UI as a reference client, not the platform.

North-star: a deterministic "pre-audit verification run" that an agent can execute via API, producing a replayable, approval-gated audit pack with provenance.

Non-goals (for now):
- skill marketplace or third-party skill uploads
- customer dashboards or self-serve onboarding
- public pricing tiers

## PR36 — Agent primitives spec v1 (Method/Evidence/Run/Exception/Attestation/Approval)

Objective: Define canonical primitive contracts and lifecycle boundaries for agent-native verification.

Scope:
- Specify versioned schemas for Method, Evidence, Run, Exception, Attestation, and Approval.
- Define required identifiers, provenance fields, and immutability rules.
- Document allowed state transitions and contract invariants.

Acceptance:
- Primitive schemas validate machine-to-machine payloads.
- Lifecycle transitions are documented and covered by tests.
- Contracts are reusable across API, replay, and export flows.

Visible UI changes:
- None.

## PR37 — Skill package spec v1 (signed manifest + capability allowlist)

Objective: Standardize skill packaging with explicit trust and permission controls.

Scope:
- Define signed manifest format and verification requirements.
- Define capability allowlist model for runtime permissions.
- Specify metadata needed for provenance and policy checks.

Acceptance:
- Unsigned or malformed skill packages are rejected.
- Capability declarations are required and enforced.
- Manifest metadata supports audit and reproducibility.

Visible UI changes:
- None.

## PR38 — Execution sandbox + guardrails (scoped connectors, read-only default)

Objective: Enforce least-privilege execution behavior for agent actions.

Scope:
- Scope connector access to run-level authorization.
- Default connector access to read-only unless policy grants elevation.
- Add guardrails for unsafe command/data access patterns.

Acceptance:
- Unauthorized connector access is denied and auditable.
- Elevated write paths require explicit policy approval.
- Guardrail violations block run finalization.

Visible UI changes:
- None.

## PR39 — Attestation + replay (hash chain, replay run, diff outputs)

Objective: Make runs tamper-evident and replay-verifiable.

Scope:
- Add step/evidence/output hash chaining for run attestations.
- Add deterministic replay mode for completed runs.
- Add machine-readable output diffing between original and replayed runs.

Acceptance:
- Attestation includes verifiable chain integrity.
- Replay produces deterministic outputs for stable inputs.
- Output diffs are stored alongside run artifacts.

Visible UI changes:
- None.

## PR40 — Agent API v1 (startRun/submitEvidence/evaluate/getExceptions/exportAuditPack/attestRun)

Objective: Expose the core orchestration API for agentic verification.

Scope:
- Implement lifecycle endpoints for run start, evidence submit, evaluate, exceptions, export, and attest.
- Enforce request/response schemas bound to primitive contracts.
- Define auditable error semantics for validation and policy failures.

Acceptance:
- API supports complete pre-audit run orchestration.
- Endpoint contracts are versioned and documented.
- Integration tests cover success and rejection paths.

Visible UI changes:
- None.

## PR41 — Human approval gates (finalization state machine + override notes)

Objective: Require explicit human authorization at finalization boundaries.

Scope:
- Add finalization state machine with approval checkpoints.
- Require override notes with actor attribution.
- Persist approval and override events in immutable history.

Acceptance:
- Runs cannot finalize without required approvals.
- Overrides require notes and are audit-visible.
- State transitions remain policy-enforced and monotonic.

Visible UI changes:
- Minimal approval/status indicators.

## PR42 — Metering hooks (per-run, per-export, org usage ledger)

Objective: Instrument usage for billing readiness and operational observability.

Scope:
- Emit metering events per run and per export.
- Maintain org-level usage ledger with idempotent writes.
- Define stable usage dimensions for future pricing controls.

Acceptance:
- Billable actions emit deterministic metering records.
- Ledger is reconcilable by run/export identifiers.
- Retries do not double count usage.

Visible UI changes:
- None.

## PR43 — Pre-audit pack prep workflow v1 (end-to-end sellable unit)

Objective: Deliver a complete workflow that produces a pre-audit pack as a sellable unit.

Scope:
- Orchestrate run, evidence submit, evaluate, approval, and export steps.
- Define output bundle structure for handoff and audit review.
- Add reliability checks for missing artifacts and policy blockers.

Acceptance:
- Workflow runs end-to-end via API-only automation.
- Output pack is replay-verifiable and approval-gated.
- Failures map cleanly into the exceptions taxonomy.

Visible UI changes:
- Reference workflow visibility only.

## PR44 — Policy packs + house interpretations overlay (versioned)

Objective: Version policy logic and interpretation overlays for deterministic evaluation.

Scope:
- Define versioned policy pack format.
- Add house-interpretation overlay model with precedence rules.
- Bind runs to exact policy/overlay versions in provenance.

Acceptance:
- Runs record immutable policy and overlay versions.
- Evaluation is deterministic for fixed inputs and versions.
- Overlay conflicts are detected and surfaced with diagnostics.

Visible UI changes:
- None.

## PR45 — Exceptions taxonomy v1 + reviewer notes glue (standardized)

Objective: Standardize exception classes and reviewer-note linkage.

Scope:
- Define stable exception taxonomy codes and severities.
- Link reviewer notes to exception instances and lifecycle events.
- Enforce structured exception payloads across API and exports.

Acceptance:
- Exceptions consistently map to taxonomy codes and severities.
- Reviewer notes remain queryable and exportable.
- Consumers can rely on a stable exception schema.

Visible UI changes:
- Minimal exception labeling in reference views.
