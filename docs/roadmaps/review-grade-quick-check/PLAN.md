# Review-Grade Quick Check — Implementation Plan

Status SSOT: `docs/roadmaps/review-grade-quick-check/phase-status.json`

Repo boundary: this roadmap covers routing, section extraction, evidence-backed review, rubrics, eval, and export within `app.article6`. No upstream methodology encoding dependency — all work is client-side or app-side.

## PR body standard

Every PR in this roadmap must include the following directive block in its body:

```
### Roadmap-Update
- slug: review-grade-quick-check
- items:
  - <phase_id>: <status>
  - <PR_id>: <status>
```

Allowed statuses: planned | next | active | in_progress | done | blocked | deferred | frozen | parked

---

## Phase 0 — Routing MVP (active)

**PR 642**

Detect broad review questions, classify review area, route to VM0007 PDD sections. Narrow first implementation to VM0007 baseline review question only.

### Files

| File | Change |
|---|---|
| `src/lib/chat/quickCheckReviewQuestion.ts` | New module: ReviewArea, QuickCheckPath types, detectReviewPath(), classifyReviewArea(), resolveReviewSections(), VM0007 section routing map |
| `src/components/chat/QuickCheckPanel.tsx` | Add reviewQuestionResult state, short-circuit runQuickCheck for broad questions, render section routing UI, clear stale results on claim change |
| `tests/lib/quickCheckReviewQuestion.test.ts` | 42+ regression tests for detection, classification, section routing |

### PR body

```
### Roadmap-Update
- slug: review-grade-quick-check
- items:
  - phase_0_routing_mvp: active
  - PR642: active
```

---

## Phase 1 — Section extraction (done)

Extract and render actual PDD section content inline in the review-question result.

### Required changes

- Add section heading detection to split extracted PDF pages into section-granular content
  - Detect patterns like `1.10`, `2.4`, `Section 2.4` at line starts
  - Map section numbers to extracted text ranges
- Extend `ReviewQuestionResult.sectionContent` to hold extracted text per section
- Render section excerpts inline in the review-question result card
- Handle sections that span multiple pages or are not found in the uploaded PDD

### Files to create/modify

| File | Change |
|---|---|
| `src/lib/chat/quickCheckReviewQuestion.ts` | Wire sectionContent population from extracted pages |
| `src/lib/chat/quickCheckSectionExtractor.ts` | New — section heading detection and text mapping |
| `src/components/chat/QuickCheckPanel.tsx` | Render section excerpts inline |
| `tests/lib/quickCheckSectionExtractor.test.ts` | Section extraction tests |

---

## Phase 2 — Baseline evidence-backed review (done)

For baseline review questions, produce evidence-backed verdicts with gap explanations.

### Required changes

- Build baseline rubric: expected evidence signals for a justified baseline scenario
  - Investment analysis present
  - Barrier analysis present
  - Common practice test applied
  - Regulatory surplus considered
- Wire evidence analysis pipeline to section content
  - Currently `analyzeQuickCheckEvidence()` analyses uploaded evidence
  - Add path to analyse extracted section content against rubric criteria
- Verdict: Supported / Partial / Missing with confidence indicator
- Gap list referencing specific missing elements
- Follow-up document recommendation

### Files to create/modify

| File | Change |
|---|---|
| `src/lib/chat/quickCheckBaselineRubric.ts` | New — baseline rubric criteria and evaluation |
| `src/lib/chat/quickCheckReviewQuestion.ts` | Wire rubric evaluation into buildReviewQuestionResult |
| `src/components/chat/QuickCheckPanel.tsx` | Verdict + gap + follow-up UI rendering |
| `tests/lib/quickCheckBaselineRubric.test.ts` | Rubric evaluation tests |

---

## Phase 3 — Review area rubrics (planned)

Define rubric criteria for every review area so all areas get evidence-backed verdicts.

### Required changes

- Define rubric per review area: boundary, additionality, leakage, monitoring, deviations, right_of_use
- Each rubric maps area keywords to expected evidence signals and minimum confidence thresholds
- Make rubrics data-driven (JSON-configurable, not hardcoded)
- Wire all rubrics into the review pipeline

### Files to create/modify

| File | Change |
|---|---|
| `src/lib/chat/rubrics/index.ts` | New — rubric registry and data loader |
| `src/lib/chat/rubrics/baseline.json` | Baseline rubric data |
| `src/lib/chat/rubrics/boundary.json` | Boundary rubric data |
| `src/lib/chat/rubrics/additionality.json` | Additionality rubric data |
| ... | One JSON per review area |
| `src/lib/chat/quickCheckRubricEvaluator.ts` | New — generic rubric evaluator |
| `tests/lib/rubrics/` | Per-rubric test cases |

---

## Phase 4 — Regression evaluation suite (planned)

Automated eval harness that runs known review questions against known PDDs and detects regressions.

### Required changes

- Eval harness: CLI script that reads test cases (question + PDD), runs pipeline, records verdict
- Labelled test cases: input → expected output (review area, sections, verdict)
- CI integration: eval gate before merge
- Regression diff: compare current output to baseline, alert on unexpected changes

### Files to create/modify

| File | Change |
|---|---|
| `scripts/eval/run-review-eval.mjs` | New — eval harness CLI |
| `tests/eval/review-cases/` | Labelled test cases |
| `.github/workflows/review-eval.yml` | CI eval gate |

---

## Phase 5 — Readiness note export (planned)

Export the review-question result as a shareable readiness note (PDF or link).

### Required changes

- Readiness note data model: review area, methodology, sections, verdicts, gaps, follow-ups
- Export button on review-question result
- PDF generation with branded template
- Immutable note storage (once exported, preserved)

### Files to create/modify

| File | Change |
|---|---|
| `src/lib/chat/quickCheckReadinessNote.ts` | New — note data model and builder |
| `src/app/api/quick-check/export-readiness-note/route.ts` | New — PDF export API |
| `src/components/chat/QuickCheckPanel.tsx` | Export button UI |
| `tests/lib/quickCheckReadinessNote.test.ts` | Note builder tests |

---

## Exclusion list

This roadmap explicitly excludes:

- Full multi-methodology section extraction (scope-limited to VM0007 for MVP)
- Auto-verification or automated rule review (human review remains the product)
- Quantitative carbon calculations (track as separate workstream)
- Team collaboration or approval workflows
- Integration with external VVB tools or APIs
