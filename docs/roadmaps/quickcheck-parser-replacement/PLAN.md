# Quick Check Parser Replacement Roadmap

## Goal

Replace Quick Check's fragile raw-text / regex-based PDF extraction with a higher-fidelity parser, starting with Docling, while keeping Article6 evidence judgment intact.

The parser should improve document structure, reading order, headings, sections, tables, and page provenance.

The parser must not decide final answer status.

## Core principle

Parsing is plumbing.

Evidence judgment is the product.

Docling or any future parser may produce better structured document input, but Article6 still owns:

- EvidenceDocument
- EvidenceSpanIndex
- quote validation
- ProjectFactContract
- section/table retrieval
- deterministic router
- no fake answers
- eval corpus

## Completed

### Phase 0A: Parser Adapter Boundary

Status:

`done`

PR:

`#794`

Outcome:

- `ParserAdapter` boundary exists.
- Current raw-text extractor is wrapped as an adapter.
- `ParsedDocument` shape exists.
- `ParsedDocument` normalizes into the existing evidence path.
- Existing Quick Check behavior remains unchanged.
- No external parser dependency was added.
- Router remains final authority.
- UI was not changed.
- Eval thresholds were not weakened.

## Current phase

### Phase 0B: Docling Experimental Adapter

Branch:

`feat/qc-docling-adapter`

Goal:

Add Docling as an experimental parser adapter behind a feature flag.

Expected outcome:

- Docling adapter exists.
- Current raw-text adapter remains default.
- Docling can parse a PDF into `ParsedDocument`.
- Docling output normalizes into the existing `DocumentStructure` / `EvidenceDocument` path.
- No router behavior change.
- No UI change.
- No default parser switch yet.

Success criteria:

- Existing tests still pass.
- Existing strict eval corpus still passes.
- Docling adapter can be tested locally or in controlled mode.
- No answer status is decided by Docling.
- No evidence judgment is bypassed.

## Next phases

### Phase 0C: Parser Bakeoff Scorecard

Branch:

`feat/qc-parser-bakeoff`

Goal:

Compare current raw-text adapter vs Docling on frozen carbon PDFs.

Score:

- project title extraction
- host country extraction
- methodology extraction
- document family signals
- heading preservation
- section hierarchy
- additionality section retrieval
- baseline section retrieval
- monitoring section retrieval
- leakage section retrieval
- table extraction
- page provenance
- quote validation compatibility
- latency
- failure rate

Expected outcome:

- JSON scorecard generated.
- No default parser switch yet.
- No eval threshold weakening.

### Phase 0D: Default Parser Switch Decision

Branch:

`feat/qc-parser-default-decision`

Goal:

Switch default parser only if Docling beats the current adapter on frozen PDFs and does not weaken Quick Check reliability.

Expected outcome:

- Docling becomes default only if bakeoff evidence supports it.
- Raw-text adapter remains available as fallback.
- Rollback path exists.
- Strict eval corpus passes.

### Phase 1: Evidence Compiler v2

Branch:

`feat/qc-evidence-compiler-v2`

Goal:

Use better parser structure to improve canonical evidence spans.

Expected outcome:

- better page provenance
- better section provenance
- better heading hierarchy
- better span typing
- better table/cell provenance where available
- router behavior remains controlled

### Phase 2: Family-Aware ProjectFactContract v2

Branch:

`feat/qc-project-fact-contract-v2`

Goal:

Improve project title, host country, and methodology extraction using document-family-aware rules.

Expected outcome:

- CDM PDD extraction improves
- VCS/Verra PD extraction improves
- Gold Standard extraction improves
- confidence/provenance remains required

### Phase 3: Hierarchical Section + Table Index

Branch:

`feat/qc-section-table-index-v2`

Goal:

Use parser-preserved hierarchy and table structure to improve section/table retrieval.

Expected outcome:

- better baseline retrieval
- better additionality retrieval
- better monitoring retrieval
- better leakage retrieval
- better table-backed evidence retrieval
- router still validates final evidence

### Phase 4: Evidence Sufficiency Validators

Branch:

`feat/qc-evidence-sufficiency-validators`

Goal:

Improve Article6 judgment by requiring check-specific evidence sufficiency before returning `answered`.

Expected outcome:

- additionality validator
- baseline scenario validator
- monitoring validator
- weak related evidence becomes `unclear`
- unsupported evidence becomes `no_evidence`
- no fake answers

### Phase 5: Eval Corpus + CI Gate

Branch:

`feat/qc-parser-evidence-ci-gate`

Goal:

Lock parser and evidence improvements into CI.

Expected outcome:

- frozen parser bakeoff fixtures
- strict eval corpus remains enforced
- visible/router agreement remains enforced
- no fake-answer regressions pass

## Rules

- One phase per PR.
- Start each phase from latest `main`.
- Do not start next phase before previous phase merges.
- Do not add LLM final-answer generation.
- Do not let parser output decide `answered`, `unclear`, or `no_evidence`.
- Do not bypass quote validation.
- Do not change UI unless the phase explicitly says so.
- Do not weaken eval thresholds.
- Keep raw-text adapter as fallback until default parser switch is proven.
