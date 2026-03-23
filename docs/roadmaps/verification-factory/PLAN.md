# Verification Factory (Compounding Moat)

Status is sourced from `docs/roadmaps/verification-factory/phase-status.json`; this lane is now reset around customer validation. Only near-term customer-facing work is active, and deferred items stay documented without driving sequence.

## Current focus
- Close customer-facing judgment gaps.
- Improve customer-safe exports and shareable artifacts.
- Support pre-audit and review prep.
- Avoid speculative platform expansion.

## Deferred / not active now
- PR32 Midjourney-style preference capture.
- Features that require repeated usage across many customers.

## Always-optimizing pillars
1) Proof determinism: same inputs => identical outputs, forever.
2) Coverage compounding: every verification adds reusable coverage.
3) Time-to-verify compression: minutes, not hours.
4) Change-to-action clarity: deltas become tasks with ownership.
5) Feedback loop hardening: hard cases feed the model and checklist.

## North Star KPIs
- Verifier minutes per PR
  - Definition: median minutes from opening a PR to verified evidence pack.
  - Measurement: audit trail timestamps + export completion time.
  - Visible in: Audit Trail summary + CI artifact metadata.
- Coverage ratio
  - Definition: % of rules/sections with linked evidence or explicit "missing".
  - Measurement: trace.json coverage report + checklist gate.
  - Visible in: Verify header coverage chip + checklist panel.
- Determinism rate
  - Definition: % of verification exports that are byte-identical across reruns.
  - Measurement: CI snapshot diff gate + audit-pack verify.
  - Visible in: CI checks + audit-pack report.
- Change-to-task latency
  - Definition: median time from detected delta to task creation.
  - Measurement: delta log timestamps vs task creation timestamps.
  - Visible in: Delta pipeline UI + audit trail.
- Hard-case intake rate
  - Definition: % of failed/ambiguous cases that get logged and triaged.
  - Measurement: intake registry + checklist flags.
  - Visible in: Intake queue dashboard.

## PR22 - KPI SSOT + CI Snapshot + Proof/Coverage chip

### Goal
Define KPI SSOT and display proof/coverage indicators in the verifier surface.

### Key changes
- Add KPI SSOT schema and seed values in repo.
- Add CI snapshot that captures KPI metrics per build.
- Add proof + coverage chip in Verify header.

### KPI impact
- Establishes baseline for verifier minutes, coverage, determinism.

### Visible UI change to look for
- Verify header shows proof/coverage chips.

## PR23 - Eval harness Hard Set v0

### Goal
Introduce a deterministic evaluation harness and curated hard set.

### Key changes
- Add hard-set dataset with fixed inputs.
- Add eval runner with pass/fail criteria.
- Wire eval results into CI artifacts.

### KPI impact
- Improves determinism rate and exposes regressions.

### Visible UI change to look for
- No user-facing change; CI artifacts include eval summary.

## PR24 - Verifier minutes + checklist

### Goal
Make verification time visible and enforce a checklist gate.

### Key changes
- Add verification minutes capture in audit trail.
- Add checklist UI with required gates.
- Block exports if checklist incomplete.

### KPI impact
- Reduces verifier minutes and increases coverage ratio.

### Visible UI change to look for
- Checklist panel and a verifier minutes timer in Audit Trail.

## PR25 - Local run history (last N runs)

### Goal
Allow Verify to load and re-export prior runs for a method/version.

### Key changes
- Persist last N runs locally per method/version.
- Add run history selector and load controls.
- Allow re-export of a previously loaded run.

### KPI impact
- Improves auditability and repeatability of verification runs.

### Visible UI change to look for
- Verify shows a "Run history" section with Load actions.

## PR26 - Delta→Impact→Tasks pipeline

### Goal
Turn detected deltas into impact summaries and actionable tasks.

### Key changes
- Add delta classification and impact scoring.
- Generate tasks with owners and urgency.
- Persist task lifecycle in audit trail.

### KPI impact
- Lowers change-to-task latency.

### Visible UI change to look for
- Delta panel shows impact scores and task list.

## PR27 - Coverage ratchet + link resolver gates

### Goal
Prevent coverage regressions and enforce link integrity.

### Key changes
- Add coverage ratchet thresholds.
- Add link resolver gate in CI.
- Block merges on coverage drop or broken links.

### KPI impact
- Improves coverage ratio and determinism rate.

### Visible UI change to look for
- Coverage ratchet status in CI and Verify header.

## PR28 - Flywheel v1: Outcomes + Moat export

### Goal
Start compounding moat now by capturing per-rule outcomes + exporting append-only moat logs.

### Key changes
- Outcome widget on rule modal (status/rationale/time + attach snapshot hash)
- Local append-only moat logs (index + outcomes)
- Opt-in anonymized export bundle

### KPI impact
- Up dataset ownership (first-party verification traces + labels)
- Down cycle time (reuse "last known good" evidence pack patterns)
- Up provability (snapshots + outcomes are replayable)

### Visible UI change to look for
- Rule modal shows "Outcome" section + Save
- Verify page has "Export moat" + opt-in toggle

## PR29 - Pilot loop + hard-case intake

### Goal
Create a pilot loop and formal hard-case intake.

### Key changes
- Add intake registry for hard cases.
- Add pilot review cadence and checklist integration.
- Surface backlog in dashboard.

### KPI impact
- Increases hard-case intake rate and feedback loop strength.

### Visible UI change to look for
- Intake queue dashboard and pilot cadence indicator.

## Verification Factory v2

## PR30 - Make coverage actionable (real rule IDs)

### Goal
Resolve coverage denominators to real rule IDs so coverage gaps are actionable.

### Scope
- Resolve rule IDs from manifest + rules.json for coverage reporting.
- Emit debug lists of covered/uncovered rule IDs.
- Keep ratio computation stable.

### Non-goals
- No new UI surfaces.
- No changes to coverage math.

### Acceptance criteria
- Coverage debug output lists real rule IDs.
- Uncovered list contains real rule IDs with reasons.
- Coverage ratio unchanged from prior computation.

### Visible UI change to look for
- No UI; CI-only.

## PR31 - Baseline uplift discipline

### Goal
Make raising coverage baselines a consistent, low-friction habit.

### Scope
- Define a baseline uplift checklist and cadence.
- Add a lightweight baseline update workflow.
- Track uplift history in SSOT metadata.

### Non-goals
- No automated baseline changes.
- No new verification logic.

### Acceptance criteria
- Baseline uplift steps documented and repeatable.
- Baseline updates recorded with owner + rationale.
- CI ratchet continues to block regressions.

### Visible UI change to look for
- No UI; CI-only.

## PR32 - Pairwise evidence preference events (Midjourney-style)

### Goal
Capture pairwise evidence preferences to guide ranking and QA.

### Scope
- Add a pairwise preference event schema.
- Store preference events in the local registry.
- Provide a minimal capture UI in Verify.

### Non-goals
- No model training.
- No external integrations.

### Acceptance criteria
- Users can record a preference between two evidence items.
- Events are persisted locally and exportable.
- Preference capture is deterministic and auditable.

### Visible UI change to look for
- Verify shows a simple pairwise preference prompt.

## PR33 - Adjudication templates + Promote to Gold labels

### Goal
Standardize adjudication outcomes and tag gold-standard evidence.

### Scope
- Define adjudication templates (approve/reject/needs more).
- Add "Promote to Gold" tagging for evidence items.
- Persist adjudication decisions in the audit trail.

### Non-goals
- No permissions or role management.
- No external labeling tools.

### Acceptance criteria
- Adjudication templates are selectable and saved.
- Gold labels are visible on tagged evidence.
- Decisions appear in audit trail exports.

### Visible UI change to look for
- Evidence cards show adjudication actions and gold labels.

## PR34 - Precedent matching (case-law memory)

### Goal
Surface similar prior cases to speed verification decisions.

### Scope
- Define precedent matching metadata in snapshots.
- Add a lightweight local index of prior cases.
- Show top matches for the active rule.

### Non-goals
- No server-side search.
- No ML embeddings.

### Acceptance criteria
- Prior cases can be linked to the active rule.
- Top matches render with links to evidence.
- Matches are deterministic given the local index.

### Visible UI change to look for
- Verify shows a "Precedents" panel with top matches.

## PR35 - Investor-safe Moat Export v2 (redacted)

### Goal
Export redacted moat bundles suitable for investor review.

### Scope
- Add redaction rules for sensitive evidence.
- Produce a v2 moat export bundle.
- Include redaction manifest in the export.

### Non-goals
- No changes to existing v1 exports.
- No external sharing workflows.

### Acceptance criteria
- Redacted export omits sensitive fields.
- Export includes redaction manifest and hash.
- Export passes existing determinism checks.

### Visible UI change to look for
- Export action includes a "Redacted v2" option.
