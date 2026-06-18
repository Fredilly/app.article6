# Quick Check Eval-Driven Learning Loop

Status is sourced from `docs/roadmaps/quickcheck-eval-learning/phase-status.json`; docs must not drift.

Goal: make Quick Check improve from real PDD/document failures through controlled gold fixtures, regression tests, selector fixes, and strict eval gates. Production may collect corrections, but only reviewed fixtures and PRs may change behavior.

## Product narrative

Every uploaded PDD that produces a wrong answer is a wasted signal. Today the eval corpus contains a small hand-picked set of fixtures and the CI gate enforces no regressions — but nothing captures failures from real documents and turns them into permanent guardrails.

The eval-driven learning loop closes that gap: when a real PDD exposes a selector weakness, the failure becomes a gold fixture, the selector rule is tightened, and the full corpus gates the fix. Over time the corpus grows to cover the real document distribution, not just the curated sample. Each correction makes the system permanently smarter.

The commercial value is compounding reliability: every document tested becomes a permanent guardrail, and selector quality improves with volume without risky online learning or model fine-tuning.

## Core rules

- Use the existing `evalCorpus` system. Do not build a parallel fixture runner.
- Do not start with UI feedback. Start with fixtures and the runner.
- Do not add model fine-tuning. Do not add LLM calls.
- Do not weaken thresholds. Strict eval must remain strict.
- Do not write production corrections directly to repo files.
- Do not mark any roadmap item done until implemented and validated.
- Start every implementation PR from latest main. One goal per PR.
- Production may collect corrections; only reviewed fixtures and PRs may change selector behavior.

## Current focus

Goal 0 (Roadmap and PR boundary) is active. No implementation has begun.

## Not active now

- All implementation goals (Goals 1–8)
- Selector fixes
- Correction export UI
- Active corpus reporting

## Goal 0 — Roadmap and PR boundary

**Goal ID:** `qcel-0-roadmap-boundary`

Objective: create roadmap files and clearly separate this work from any in-flight selector PR.

### Scope

- Create `docs/roadmaps/quickcheck-eval-learning/roadmap.md`
- Create `docs/roadmaps/quickcheck-eval-learning/phase-status.json`
- All goals listed with `not_started` status

### Exit criteria

- `roadmap.md` exists with full goal list and rules
- `phase-status.json` exists with all goals in `not_started` state
- No production code changed

---

## Goal 1 — Extend existing eval corpus metadata

**Goal ID:** `qcel-1-eval-corpus-metadata`

Objective: extend the existing `evalCorpus` fixture schema so it can represent correction/learning metadata without replacing the current runner.

### Scope

- `src/lib/quickCheck/evalCorpus/types.ts`
- `src/lib/quickCheck/evalCorpus/manifest.ts`

### Key changes

- Add minimal metadata fields: `failureReason` and `expectedAnswer` where needed
- Preserve backward compatibility with all existing fixtures
- Zod validation must still pass for existing manifests
- No parallel runner, no new test framework

### Exit criteria

- Existing corpus types extended only where necessary
- All existing fixtures load and validate without changes
- `npm test` passes
- Existing `npm run quickcheck:eval` still works

---

## Goal 2 — Add Taisei PDD gold fixture

**Goal ID:** `qcel-2-taisei-gold-fixture`

Objective: the Taisei China PDD becomes a gold regression fixture in the existing eval corpus. This is the first fixture driven by a real selector failure.

### Scope

- Add Taisei PDD fixture to `tests/fixtures/quick-check/`
- Use existing standard question IDs where available

### Expected values

| Check ID | Expected answer |
|----------|----------------|
| `host_country` | People's Republic of China |
| `methodology` | ACM0010 Version 02 |
| `baseline_scenario` | Baseline III, urine treated in anaerobic lagoon while dried manure is used as organic fertilizer |
| `additionality` | Project is additional because the baseline differs from the proposed CDM activity and the NPV comparison supports the CDM case |
| `leakage` | Leakage covers land application of treated manure outside the project boundary; net N2O/CH4 leakage is not considered because negative |

### Key constraints

- Fixture includes expected answer, quote anchors, page, and section hints
- Running the fixture *before* selector fixes must produce a clear failure report
- Failure report must document wrong-span behavior (e.g. "host_country matched broad topic section instead of Host Party field")

### Exit criteria

- Taisei fixture added to existing eval corpus
- Baseline failure report captured (documented, not necessarily automated — runs before Goal 3)
- Failure identifies wrong-span sources for each of the five checks

---

## Goal 3 — Fix five core selectors against Taisei

**Goal ID:** `qcel-3-core-selector-fixes`

Objective: the five core Quick Check answers select authoritative spans, not broad topic matches. Each selector targets the specific PDD section/field that defines that fact.

### Scope

- Host country selector
- Methodology selector
- Baseline scenario selector
- Additionality selector
- Leakage selector

### Selector targets

| Check | Must prefer |
|-------|-------------|
| Host country | Host Party / structured location fields |
| Methodology | B.1 title/reference of methodology |
| Baseline scenario | The identified baseline scenario in B.4 |
| Additionality | B.5 and NPV/additionality reasoning |
| Leakage | The actual Leakage section, not generic applicability text |

### Exit criteria

- Taisei fixture passes all five checks
- Old corpus does not regress (all existing fixtures still pass)
- `npm run quickcheck:eval:corpus -- --strict` passes
- No threshold weakened

---

## Goal 4 — Add representative messy PDD fixture pack

**Goal ID:** `qcel-4-messy-pdd-fixture-pack`

Objective: the corpus covers multiple real document patterns, not only Taisei. Systematic coverage reduces blind spots in selector behavior.

### Fixture types

- Clean PDD
- Old CDM PDD
- Messy OCR PDD
- Table-heavy PDD
- Appendix-heavy PDD
- Repeated-header PDD
- CAR/CL/commentary-heavy document

### Exit criteria

- 5 to 10 representative fixtures added
- Each fixture has expected answer, page, quote, and failure reason
- `npm run quickcheck:eval:corpus -- --strict` passes
- Old corpus does not regress

---

## Goal 5 — Add correction export JSON

**Goal ID:** `qcel-5-correction-export-json`

Objective: the Quick Check UI can export a correction candidate as JSON without changing production behavior. This is the safe capture mechanism — a human downloads the JSON and submits it for review.

### Scope

- Quick Check answer card UI component
- Export button per answer card

### Exported fields

```json
{
  "documentId": "...",
  "documentName": "...",
  "documentType": "...",
  "methodologyId": "...",
  "checkId": "...",
  "currentAnswer": "...",
  "currentStatus": "...",
  "currentQuote": "...",
  "currentPage": 0,
  "currentSection": "...",
  "evidenceSpanIds": ["..."],
  "correctedAnswer": "...",
  "correctedQuote": "...",
  "correctedPage": 0,
  "correctedSection": "...",
  "confidence": 0.0,
  "failureReason": "..."
}
```

### Key constraints

- No server-side production file writes
- No automatic behavior changes from exported corrections
- Export is a client-side JSON download (no persistent storage)

### Exit criteria

- Each answer card shows an export button
- Exported JSON contains all required fields
- Export does not change any production selector behavior
- Verified: no files written to repo or server during export

---

## Goal 6 — Add learning queue and promotion workflow

**Goal ID:** `qcel-6-learning-queue`

Objective: candidate corrections can be reviewed before becoming gold fixtures. This is the manual triage step that prevents bad corrections from entering the eval corpus.

### Scope

- Documentation only (no code required)

### Learning queue format

Create `docs/roadmaps/quickcheck-eval-learning/LEARNING_QUEUE.md` or equivalent with entries like:

```
## Queue item: Taisei — host_country wrong span

- **Wrong answer:** Japan
- **Correct answer:** People's Republic of China
- **Wrong quote/page:** "Japan and China are both Parties to the Kyoto Protocol" (page 2)
- **Correct quote/page:** "Host Party: People's Republic of China" (page 1, section A.3)
- **Failure reason:** Broad keyword match; selector matched "China" in a generic paragraph instead of the structured Host Party field
- **Likely selector fix:** Prefer section A.3 / "Host Party" pattern over free-text keyword match
- **Priority:** high
- **Status:** promoted (Goal 2 fixture, Goal 3 fix)
```

### Promotion workflow

1. Candidate JSON exported from UI (Goal 5)
2. Added to `LEARNING_QUEUE.md` for review
3. Reviewer confirms the corrected answer, quote, and page
4. Reviewer identifies the likely selector fix
5. Candidate promoted to gold fixture in `tests/fixtures/quick-check/`
6. Selector fix implemented and gated by full eval corpus
7. Queue item marked as promoted

### Exit criteria

- `LEARNING_QUEUE.md` exists with structured entry format
- Promotion workflow documented and usable
- Candidate corrections require manual review before becoming gold fixtures

---

## Goal 7 — Add active corpus report

**Goal ID:** `qcel-7-active-corpus-report`

Objective: the eval report shows weak spots so fixture creation can be prioritized. Instead of guessing which document types or check IDs need more coverage, the report surfaces the data.

### Key changes

- Extend the eval corpus runner to produce a categorized report
- Report weakest check IDs by provenance correctness
- Report weakest document types by unclear/no_evidence rate
- Report weakest methodology contexts
- Group provenance correctness and unclear/no_evidence rates by category

### Report output (conceptual)

```
## Weakest check IDs
| Check ID          | Provenance | Unclear rate |
|-------------------|------------|--------------|
| leakage           | 72%        | 18%          |
| baseline_scenario | 80%        | 12%          |

## Weakest document types
| Type              | Provenance | Unclear rate |
|-------------------|------------|--------------|
| table-heavy       | 65%        | 25%          |
| messy OCR         | 78%        | 15%          |

## Weakest methodologies
| Methodology       | Provenance | Unclear rate |
|-------------------|------------|--------------|
| ACM0001           | 70%        | 22%          |
```

### Key constraints

- No threshold weakening — report is informational, not a gate change
- Existing strict thresholds remain in CI

### Exit criteria

- Categorized report available via CLI (e.g. `npm run quickcheck:eval:report`)
- Report shows weakest check IDs, document types, and methodology contexts
- Provenance correctness and unclear/no_evidence rates grouped by category

---

## Goal 8 — Define future check pack process

**Goal ID:** `qcel-8-future-check-packs`

Objective: new Quick Check items are added in small packs only after the core checks are stable. This prevents broad expansion from degrading reliability.

### Scope

- Documentation only (no code required)

### Check pack format

Each new check pack must include:

1. **Check ID and question text**
2. **Preferred sections** — which PDD sections/fields contain the authoritative answer
3. **Rejected noisy sources** — which sections/patterns must be ignored (e.g. generic applicability text, commentary, CAR/CL notes)
4. **Evidence requirements** — minimum evidence signals needed for `answered` status
5. **At least one gold fixture** — in the eval corpus, with expected answer, quote, page, and section

### Key constraints

- No broad check expansion until existing core checks pass strict eval
- New checks are added in packs of 3–5, each with fixtures
- Each pack gets its own fixture set and regression gating

### Exit criteria

- Check pack format documented
- New check addition process documented (fixture → selector → eval gate → merge)
- No broad expansion before core checks are stable

---

## Sequencing

1. **Goal 0** — Roadmap and PR boundary (active)
2. **Goal 1** — Extend existing eval corpus metadata
3. **Goal 2** — Add Taisei PDD gold fixture
4. **Goal 3** — Fix five core selectors against Taisei
5. **Goal 4** — Add representative messy PDD fixture pack
6. **Goal 5** — Add correction export JSON
7. **Goal 6** — Add learning queue and promotion workflow
8. **Goal 7** — Add active corpus report
9. **Goal 8** — Define future check pack process

## Validation (per implementation goal)

Every implementation goal must pass:

```
npx tsc --noEmit
npm run lint
npm test
npm run quickcheck:eval:corpus -- --strict
```

## Immediate next action

Complete Goal 0: create roadmap files. No production code changes.
