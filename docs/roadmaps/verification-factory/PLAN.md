# Verification Factory (Compounding Moat)

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
