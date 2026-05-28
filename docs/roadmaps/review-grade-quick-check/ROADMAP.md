# Review-Grade Quick Check

Status is sourced from `docs/roadmaps/review-grade-quick-check/phase-status.json`; docs must not drift.

Goal: turn Quick Check from a requirement matcher / section router into an evidence-backed verification-readiness review engine.

## Product narrative

Quick Check today can route a review question to relevant PDD sections for VM0007. That is useful but shallow — it tells the user where to look, not what the document says or whether it passes.

A VVB or project developer uploading a PDD wants to know: "Does this document satisfy the methodology requirements for this review area?" The answer is not a section number; it is a verdict backed by extracted evidence, identified gaps, and recommended next documents.

The commercial value is evidence-backed readiness: a baseline review answers "Is the baseline justified?" with cited PDD excerpts, confidence signals, and a clear gap list — not "see section 2.4."

## Current focus

- Phase 0 (routing MVP) is active with PR 642: detect broad review questions, classify review area, route to VM0007 sections.
- Narrow first implementation to VM0007 baseline review question only.

## Not active now

- Multi-methodology section routing (phase 1 starts after VM0007 routing is stable)
- Evidence-backed verdicts and gap detection (phase 2+)
- Review area rubrics (phase 3+)
- Automated regression eval suite (phase 4+)
- Readiness note export (phase 5+)

## Phase 0 — Routing MVP

Objective: detect the user's intent (requirement match vs. review question), classify the review area, and route to relevant VM0007 PDD sections.

### Scope

- Broad question detection: "Does this PDD justify/explain/disclose/support/define/describe/identify...", "Is the baseline...", "Is additionality...", "Check the...", "Review the..."
- Review area classification: additionality, baseline, boundary, deviations, leakage, monitoring, right_of_use, general
- VM0007 section routing per review area
- Regression tests for detection, classification, and section routing
- UI: show classified review area, methodology, and relevant sections as badge chips
- Stale result clearing when review question changes

### Methodology dependency

None. Routing is purely client-side keyword and pattern matching.

### Exit criteria

- "Does this PDD support additionality under VT0001?" routes to additionality with sections 2.5, 2.4, 1.10
- "Does this PDD define the project area, leakage belt, and reference region?" routes to boundary with sections 2.3, 1.9
- "Does this PDD disclose methodology deviations..." routes to deviations with section 2.6
- Boundary/review questions do not show the "Multiple requirements could fit this claim" warning
- 42+ regression tests pass

## Phase 1 — Section extraction

Objective: extract and render the actual content of routed PDD sections so the user sees evidence, not just section numbers.

### Key changes

- Map section numbers (e.g. "2.4") to extracted PDF pages and text offsets
- Render section excerpts inline in the review-question result card
- Highlight detected methodology keywords within section content
- Handle sections that span multiple pages or are not found

### App responsibilities

- PDF page extraction already returns per-page text from `/api/quick-check/pdf-extract`
- Add section heading detection to split pages into section-granular content
- Match section numbers from routing to extracted content

### Exit criteria

- A VM0007 baseline review question shows inline excerpts from sections 2.4, 2.5, and 1.10
- Missing sections display "Section not found" rather than empty space
- Section content updates when the user uploads a different PDD

## Phase 2 — Baseline evidence-backed review

Objective: produce evidence-backed verdicts for baseline review questions — supported, partial, or missing — with gap explanations.

### Key changes

- For baseline review questions, analyse extracted section content against baseline rubric criteria
- Produce a verdict: Supported (clear baseline justification), Partial (some justification, gaps remain), or Missing (no baseline justification found)
- Surface gap explanations referencing specific missing elements
- Recommend follow-up documents (e.g. "Upload a feasibility study to support the investment analysis")

### App responsibilities

- Build baseline rubric: expected evidence signals for a justified baseline scenario
- Wire evidence analysis pipeline to section content (currently analyses uploaded evidence, not sections)
- Verdict display with confidence indicator and gap list

### Exit criteria

- "Does this PDD justify the baseline?" returns a verdict backed by extracted section text
- Gap list references specific missing elements (e.g. "No investment analysis found in sections 2.4-2.5")
- Follow-up document recommendation is non-empty when gaps exist

## Phase 3 — Review area rubrics

Objective: define rubric criteria for each review area so every area gets evidence-backed verdicts, not just baseline.

### Key changes

- Define rubric per review area: boundary, additionality, leakage, monitoring, deviations, right_of_use
- Each rubric maps area keywords to expected evidence signals and minimum confidence thresholds
- Rubrics are maintainable data (not hardcoded) — add new areas by adding a rubric entry

### Exit criteria

- All 7 review areas return evidence-backed verdicts (not just baseline)
- Changing the review question to a different area produces a different verdict
- Rubric data is readable and extendable without code changes

## Phase 4 — Regression evaluation suite

Objective: build an automated eval harness so routing and verdict changes are caught before they ship.

### Key changes

- Eval harness reads known review questions + known PDDs, runs the full pipeline, records verdicts
- Labelled test cases: input (question + PDD) → expected output (review area, sections, verdict)
- CI gate: eval suite must pass before review-grade-quick-check PRs merge
- Regression detection: diff output between runs, alert on unexpected changes

### Exit criteria

- Eval harness runs from CLI with a single command
- 20+ labelled test cases covering all review areas and common PDDs
- CI blocks PRs that introduce routing or verdict regressions

## Phase 5 — Readiness note export

Objective: export the review result as a shareable readiness note.

### Key changes

- Readiness note includes: review area, methodology, sections reviewed, evidence-backed verdicts, gap list, recommended follow-up documents
- Export format: PDF or shareable link
- Note is timestamped and immutable once exported

### Exit criteria

- Export button appears on review-question result
- Exported note renders correctly with all sections populated
- Re-running the review produces a new note; old notes are preserved

## Sequencing

1. Phase 0 — Routing MVP (active, PR 642)
2. Phase 1 — Section extraction
3. Phase 2 — Baseline evidence-backed review
4. Phase 3 — Review area rubrics
5. Phase 4 — Regression evaluation suite
6. Phase 5 — Readiness note export

## Immediate next action

Merge PR 642, then start Phase 1: extract and render section content from uploaded PDD pages.
