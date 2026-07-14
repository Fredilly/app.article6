# Interactive Evidence Review MVP

Status SSOT: `docs/roadmaps/interactive-evidence-review-mvp/phase-status.json`

## Goal

A reviewer can efficiently inspect, compare, correct, approve, and finalize every VM0007 rule while machine accuracy improves measurably without hiding or changing reviewed truth.

## Priority

truthfulness > reviewer usability > measurable accuracy > visual polish

## Roadmap contract

- One focused phase or failure mode per PR.
- Machine proposal and reviewed truth stay separate in every UI and export surface.
- Missing, unclear, rejected, and contradictory evidence must remain visible.
- Reviewed truth is never overwritten by presentation code.
- Accuracy changes require evaluation evidence.
- No project-specific production logic.
- Existing review, persistence, report, and finalization semantics must remain backward compatible.

## Phase table

| Phase | Title | Status | Gate |
|---|---|---|---|
| 0 | Roadmap contract | Active | Roadmap files validate and no production code changes |
| 1 | Readable interactive workspace | Next | A reviewer can scan all 58 rows and understand an expanded row without visual confusion |
| 2 | Accuracy benchmark | Planned | Highest-impact generic failure modes are ranked and reproducible |
| 3 | Generic accuracy improvements | Planned | Accuracy improves without fixture regressions |
| 4 | Guided reviewer interaction | Planned | A reviewer can complete all 58 decisions without leaving the Evidence Map |
| 5 | Unseen-PDD validation | Planned | The same workflow works without project-specific fixes |
| 6 | Stellar MVP release | Planned | Upload → review → finalize → trustworthy pre-validation output works end to end |

## Phase details

### Phase 0 — Roadmap contract

Lock scope, phase order, invariants, and SSOT.

**Scope**

- Define the roadmap boundary for this app repo.
- Keep the roadmap compact enough to validate mechanically and read quickly.
- Make the phase order explicit so follow-on PRs do not drift.

**Invariants**

- Machine proposal and reviewed truth remain separate.
- Reviewed truth is preserved, not inferred back from the proposal.
- No production code changes belong in this phase.
- No fixture, parser, or reviewer logic changes belong in this phase.

**Gate**

- Roadmap files validate.
- No production code changes are introduced.

### Phase 1 — Readable interactive workspace

Make the Evidence Map readable and scannable without losing detail.

**Scope**

- Fix duplicated or overlapping rule identifiers.
- Compact rows so the 58-rule surface is readable at a glance.
- Keep search and filters interactive.
- Add expand/collapse for rule details.
- Use preview plus “Show full evidence” for long quotes.
- Make requirement, assessment, evidence, gap, and action hierarchy explicit.
- Keep the experience responsive and keyboard accessible.

**Gate**

- A reviewer can scan all 58 rows and understand an expanded row without visual confusion.

### Phase 2 — Accuracy benchmark

Measure where machine proposals diverge from reviewed Marcondes truth.

**Scope**

- Compare machine proposal against reviewed Marcondes truth.
- Measure evidence state, applicability, reviewer outcome, evidence selection, provenance, contradictions, and actions.
- Produce a reproducible failure taxonomy.
- Establish baseline metrics for the generic failure modes that matter most.

**Gate**

- Highest-impact generic failure modes are ranked and reproducible.

### Phase 3 — Generic accuracy improvements

Improve the machine proposal generically, without adding Marcondes-specific production rules.

**Scope**

- Fix retrieval omissions.
- Reduce weak or boilerplate false support.
- Improve applicability and N/A reasoning.
- Improve ranking, accepted/rejected evidence, provenance, contradictions, and finding strength.
- Keep the changes generic across VM0007 rather than encoding project-specific behavior.

**Gate**

- Accuracy improves without fixture regressions.

### Phase 4 — Guided reviewer interaction

Make correction and approval work efficient for the reviewer.

**Scope**

- Next unresolved rule navigation.
- Accept or reject individual evidence.
- Edit applicability, support, outcome, finding, gap, and client action.
- Require reasons for corrections.
- Preserve save, approve, reopen, history, and finalization semantics.

**Gate**

- A reviewer can complete all 58 decisions without leaving the Evidence Map.

### Phase 5 — Unseen-PDD validation

Prove the workflow works on another VM0007 case and one additional unseen VM0007 v1.8 PDD.

**Scope**

- Review Maya as the second VM0007 case.
- Test one additional unseen VM0007 v1.8 PDD.
- Capture only generic new failure modes.
- Do not add project-specific fixes just to make a single unseen document pass.

**Gate**

- The same workflow works without project-specific fixes.

### Phase 6 — Stellar MVP release

Finish the product-quality release once the workflow and accuracy are stable.

**Scope**

- Improve typography, spacing, navigation, and comparison experience.
- Finalize Evidence Map export.
- Keep UI, report, JSON, and PDF truth parity.
- Add client-release safeguards.

**Gate**

- Upload → review → finalize → trustworthy pre-validation output works end to end.
