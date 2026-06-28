# Quick Check v2 Roadmap

> Status is sourced from `docs/roadmaps/quickcheck-v2/phase-status.json`; docs must not drift.
>
> Status: Phase 0 done (PR #847). Next: Phase 1 — Envira ingestion (PR #846).
> v1 is frozen for critical fixes only.
> PR #839 is parked/superseded.

## Core Goal

Given any normal carbon project PDD, Quick Check v2 produces evidence-backed answers for six structured checks:

1. Host country
2. Methodology
3. Baseline scenario
4. Additionality
5. Leakage
6. Stakeholder consultation

Wrong answers must trace to one layer. No scoring. No LLM final answers. No Blob-dependent test path.

## Rollback Line (Conceptual)

Do not roll back the app. Roll back the *analysis path design* to before the Blob/extraction maze:

### Cut from v2

| Feature | Why |
|---------|-----|
| Blob-dependent test/analysis path | Introduced upload → ref → resolve → cold start → staleness. v2 reads canonical JSON locally. |
| Browser regex extraction | Not a reliable evidence source. |
| Router candidates for structured checks | Router is for open-ended Q&A, not fact lookups. |
| scoreSentenceForLabel / scoreCandidateText | Heuristic tower that grows per-PDD. v2 has zero scoring. |
| LLM final answers | LLM may suggest later but never determines FOUND. |
| Descendant section sweeping | `.includes()` sectionPath matching pulls all children. v2 uses direct body only unless explicit. |
| Multi-phase validateCheckInternal switchboard | Each check is a clean priority chain, not a 5-phase maze. |
| Poisoned gold fixtures | "of" as expected host_country is wrong. Gold comes from PDF, not current output. |

### Keep from v1 ideas

- Fact contract extraction
- Evidence spans with quote/page/section provenance
- Section tree
- found / unclear / missing status concept
- Regression test corpus (structure only — rebuild content from PDF truth)

## Status Overview

```json
{
  "v2": {
    "phase": "planning",
    "envira": "not started",
    "pipeline": "PDF → canonical JSON → section tree → evidence spans → answer → status"
  },
  "v1": {
    "status": "frozen",
    "allowed_changes": "critical production fixes only",
    "pr_839": "parked — superseded by v2",
    "pr_831_833_etc": "do not replicate Blob/extraction patterns in v2"
  }
}
```

## Phases

### Phase 0: Freeze v1

**Goal:** Stop adding debt to v1.

**Actions:**
- Park PR #839 (not mergeable — encodes broken answers and production hacks)
- No new fixtures, validators, scoring rules, LLM replacement, Blob changes, router behavior for v1
- v1 stays live for production; v2 is the clean rebuild path

**Path:** `src/lib/quickCheck/` — frozen

### Phase 1: Ingestion Only (PR #1)

**Branch:** `v2/ingestion-envira`

**Goal:** Parse Envira Amazonia into deterministic canonical extracted JSON. No answers yet.

**Path:** `src/lib/quickCheckV2/ingestion/`

**Output shape per block:**

```
spanId: string
page: number
text: string
blockType: string (heading | body | table | footer | header)
sectionHeading: string
sectionPath: string[]
source: "primary" | "fallback"
```

**Tests:** `tests/lib/quickCheckV2/envira-ingestion.test.ts`

Required strings with correct page/span/section provenance:

- "Acre, Brazil"
- "VM0007: REDD Methodology Modules"
- "conversion to pasture"
- "cattle ranching"
- "simple cost analysis"
- "carbon finance" / "VCU revenue"
- "Leakage emissions"
- "41 families"
- "FPIC"
- "grievance"

**Hard constraints:**
- No answer extraction
- No found/unclear/missing status
- No LLM
- No router
- No scoring
- No Blob dependency in tests
- No fake page 1 for everything

**Acceptance:** Extraction is deterministic. Tests fail if key strings disappear or lose provenance.

```json
{
  "phase_1_ingestion": {
    "status": "not_started",
    "branch": "v2/ingestion-envira",
    "test_document": "Envira Amazonia",
    "required_assertions": [
      "Acre, Brazil", "VM0007: REDD Methodology Modules",
      "conversion to pasture", "cattle ranching",
      "simple cost analysis", "carbon finance / VCU revenue",
      "Leakage emissions", "41 families", "FPIC", "grievance"
    ],
    "forbidden": ["answers", "status", "LLM", "router", "scoring", "Blob"],
    "acceptance": "deterministic extraction with real page/span/section provenance"
  }
}
```

### Phase 2: Section Tree + Evidence Spans (PR #2)

**Goal:** Turn extracted JSON into a clean section tree and evidence span index.

**Key behavior:** Direct body text under exact section heading. No descendant sweeping by default. `.includes()` sectionPath matching that pulls all children is forbidden.

**Acceptance:** For each of the six checks, v2 can return the top evidence span with correct section heading.

```json
{
  "phase_2_section_tree": {
    "status": "not_started",
    "depends_on": "phase_1",
    "constraint": "direct body only, no descendant sweeping",
    "acceptance": "top evidence span per check with correct section"
  }
}
```

### Phase 3: Evidence Retrieval — Six Checks (PR #3)

**Goal:** For each structured check, retrieve evidence using fixed source priority:

1. Valid fact contract candidate
2. Exact section direct body
3. Controlled raw-text fallback (unclear unless strong provenance)
4. LLM suggestion only, not final (not yet implemented)

**Check-specific behavior:**

| Check | Priority | Expected Envira Evidence |
|-------|----------|--------------------------|
| host_country | factContract.hostCountry → projectLocation/title scan | "Acre, Brazil" |
| methodology | methodologyPrimary → exact methodology section | "VM0007: REDD Methodology Modules" |
| baseline_scenario | exact Baseline Scenario section direct body | "conversion to pasture / cattle ranching" |
| additionality | exact Additionality section → investment/barrier evidence | "simple cost analysis / carbon finance required" |
| leakage | exact Leakage section direct body | "activity shifting + market effects leakage / LK-ASP + LK-ME" |
| stakeholder_consultation | stakeholder / local consultation section | "41 families / FPIC / grievance" |

**Hard constraints:**
- No router candidates for these six checks
- No scoring / term bonuses / PDD-specific phrase boosts
- No raw text fallback as FOUND without valid provenance

```json
{
  "phase_3_evidence_retrieval": {
    "status": "not_started",
    "depends_on": "phase_2",
    "forbidden": ["router_candidates", "scoring", "term_bonuses", "pdd_specific_boosts"],
    "source_priority": ["fact_contract", "exact_section", "raw_text_fallback", "llm_suggestion"],
    "acceptance": "each check returns correct Envira evidence with quote/page/section/span"
  }
}
```

### Phase 4: Tiny Answer Extractors (PR #4)

**Goal:** Turn evidence spans into short structured answers.

**Expected Envira answers:**

| Check | Expected Answer |
|-------|----------------|
| host_country | Brazil |
| methodology | VM0007 REDD Methodology Modules / REDD-MF |
| baseline_scenario | conversion to pasture / cattle ranching |
| additionality | carbon finance required; no financial return without VCS/VCU revenue |
| leakage | activity shifting and market-effects leakage assessed under LK-ASP and LK-ME |
| stakeholder_consultation | 41 families visited; FPIC/grievance process discussed |

**Hard constraints:**
- No generic answer-anything summarizer
- No LLM final answers
- No current-output-as-truth
- Answer must come from selected evidence

```json
{
  "phase_4_answer_extractors": {
    "status": "not_started",
    "depends_on": "phase_3",
    "forbidden": ["generic_summarizer", "llm_final", "current_output_as_truth"],
    "acceptance": "Envira produces correct short answers from selected evidence"
  }
}
```

### Phase 5: Status Validator (PR #5)

**Goal:** Boring deterministic status logic.

**Rules:**
- FOUND = answer + quote + page + section + span exist
- UNCLEAR = related evidence exists but answer is incomplete
- MISSING = no usable evidence

**Constraint:** Validators do not search, rank, or invent fallback answers. They only judge evidence already selected.

```json
{
  "phase_5_status_validator": {
    "status": "not_started",
    "depends_on": "phase_4",
    "rules": {
      "FOUND": "answer + quote + page + section + span",
      "UNCLEAR": "related evidence but incomplete",
      "MISSING": "no usable evidence"
    },
    "constraint": "validators judge only, do not search or rank"
  }
}
```

### Phase 6: Gold Envira Fixture (PR #6)

**Goal:** Freeze Envira as the first true v2 gold fixture.

**Gold record must include:**
- expected answer
- expected status
- gold quote
- page
- section path
- span id
- known junk to reject

**Rule:** Gold is PDF truth, not current app output. Never encode known wrong output as expected.

**Fails if:**
- Brazil becomes "of"
- methodology uses module/tool boilerplate only
- additionality returns only "tool is applied"
- baseline picks calculation/emissions section instead of scenario
- leakage lacks actual leakage assessment
- stakeholder lacks real consultation evidence
- page/section/span provenance disappears

```json
{
  "phase_6_gold_envira": {
    "status": "not_started",
    "depends_on": "phase_5",
    "document": "Envira Amazonia",
    "rule": "gold is PDF truth, not current output",
    "fail_conditions": [
      "host_country_of", "methodology_boilerplate_only", "additionality_tool_only",
      "baseline_wrong_section", "leakage_no_assessment", "stakeholder_no_evidence",
      "missing_provenance"
    ]
  }
}
```

### Phase 7+: Add PDFs Slowly

**Rule:** Only add a new PDF if it introduces a structural/evidence failure mode Envira does not cover.

**Examples of valid new failure modes:**
- CDM PDD (different document structure)
- AR-only PDD (different baseline logic)
- Small-scale PDD (negligible leakage section)
- PDD where host country appears only in metadata table, not in location text

**Each new PDF is one PR.** The PR must state:
- new failure mode
- why Envira does not cover it
- expected gold evidence
- whether code changed and why any change is generic

```json
{
  "phase_7_add_pdfs": {
    "status": "not_started",
    "depends_on": "phase_6",
    "threshold": "new failure mode not covered by Envira",
    "rule": "one PDF per PR, must state new failure mode"
  }
}
```

## Anti-Debt Rules

These are enforced at code review and CI for all v2 PRs.

### Rule 1: One layer per PR

A PR may touch only one pipeline layer. If it touches multiple layers, reject it.

### Rule 2: No scoring

Forbidden: `scoreSentenceForLabel`, `scoreCandidateText`, phrase bonuses, PDD-specific weights.

If evidence selection is wrong, fix extraction, section matching, or source priority.

### Rule 3: No PDD-specific code

Forbidden: `if Envira`, `if slash-and-burn`, `if oil palm`, `if this document title`.

Allowed: "exact Baseline Scenario beats Baseline Emissions", "valid country names can be extracted from project location/title/header".

### Rule 4: No current-output-as-gold

Gold comes from the PDF, not from what the app currently returns.

Bad: `expected host_country = "of"`
Good: `expected host_country = "Brazil"`, `rejected_junk = ["of"]`

### Rule 5: Extraction before intelligence

If extraction/page/section/span is wrong, stop. Do not patch validators or answer extractors until ingestion is correct.

### Rule 6: No silent fallback as FOUND

Every answer must know its source: `fact_contract`, `exact_section`, `raw_text_fallback`, `llm_suggestion`.

Only validated fact/section evidence can become FOUND.

### Rule 7: LLM is suggestion only

LLM may propose candidate evidence later, but it cannot set FOUND. Must pass deterministic validation first.

### Rule 8: Corpus is a tripwire, not training data

Add PDFs only to represent new failure modes, not for volume.

### Rule 9: Every PR simplifies or isolates

Each PR must answer: what layer does this prove? What complexity did it remove?

### Rule 10: Visible acceptance matters

Every functional PR must state the visible product effect. If no visible effect, prove a lower-layer artifact (extracted JSON, evidence spans).

## Key Structural Decisions

### Test path uses local canonical JSON, not Blob

v2 tests read from `tests/fixtures/quickCheckV2/` — local files only. No Blob refs, no upload state, no serverless memory.

This eliminates the upload → ref → resolve → cold start → staleness chain.

### Pipeline shape

```
PDF ──→ canonical extracted JSON ──→ section tree ──→ evidence spans ──→ answer ──→ status
         (deterministic artifact)        (no scoring)     (6 checks)      (short)    (boring)
```

### Branch structure

```
main
  └── feat/qc-production-pdf-audit (frozen v1)
         └── v2/ingestion-envira (PR #1)
                └── v2/section-tree (PR #2)
                       └── v2/evidence-retrieval (PR #3)
                              └── v2/answer-extractors (PR #4)
                                     └── v2/status-validator (PR #5)
                                            └── v2/gold-envira (PR #6)
                                                   └── v2/add-cdm-pdd (PR #7+)
```

### Status JSON convention

Each phase has a status block at the end of its section. Update the top-level status block on PR merge.

## Verdict Summary

```
Freeze v1.
Park PR #839.
Start v2 from scratch in src/lib/quickCheckV2/.
One layer per PR.
One PDF (Envira) until phase 6.
No scoring. No LLM. No Blob. No PDD-specific hacks.
```
