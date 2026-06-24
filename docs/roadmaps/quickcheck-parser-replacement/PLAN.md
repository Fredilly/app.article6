# Quick Check Parser Replacement Roadmap

## Goal

Replace Quick Check's fragile raw-text / regex-based PDF extraction with a higher-fidelity parser while keeping Article6 evidence judgment intact.

The parser should improve document structure, reading order, headings, sections, tables, and page provenance.

The parser must not decide final answer status.

## Core principle

Parsing is plumbing.

Evidence judgment is the product.

Docling, PyMuPDF, or any future parser may produce better structured document input, but Article6 still owns:

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

Status: `done` — PR [#794](https://github.com/Fredilly/app.article6/pull/794)

- `ParserAdapter` boundary exists.
- Current raw-text extractor is wrapped as an adapter.
- `ParsedDocument` shape exists and normalizes into the existing evidence path.
- Existing Quick Check behavior unchanged.
- No external parser dependency added.

### Phase 0B: Experimental Parser Adapters

Status: `done` — PR [#797](https://github.com/Fredilly/app.article6/pull/797)

- **PyMuPDF adapter** (`QUICK_CHECK_PARSER=pymupdf`): primary successful Phase 0B adapter.
- **Docling adapter** (`QUICK_CHECK_PARSER=docling`): optional/unavailable-safe.
- `current-extractor` remains the default.
- Both adapters fall back to `current-extractor` on failure.
- 55+ tests covering both adapters, fallback paths, runtime init.

### Phase 0C: Parser Bakeoff Scorecard

Status: `done` — PR [#801](https://github.com/Fredilly/app.article6/pull/801)

- Compared `current-extractor` vs PyMuPDF on real messy carbon PDFs.
- PyMuPDF: 9 tables, 7 headings (vs current-extractor: 0 tables, 15 headings).
- Docling unavailable (expected).
- Both parsers pass strict eval corpus with 0 regressions.
- Bakeoff evidence captured in `docs/quickcheck/parser-bakeoff-scorecard.json`.

### Phase 0D: Default Parser Switch Decision

Status: `done`

- Default parser remains `current-extractor` (PyMuPDF available as opt-in).
- PyMuPDF adapter is available but not promoted to default — decision can be revisited.

### Phase 1: Evidence Compiler v2 — Noise Context Detection

Status: `done` — PR [#804](https://github.com/Fredilly/app.article6/pull/804)

- `EvidenceSpan` now carries: stable spanId, normalized/ original text, page number, sectionId, heading, headingPath, sectionPath, blockType, parserSource, parserAdapterId, documentFamily signal, table metadata, layout metadata, confidence, charStart/charEnd.
- **Noise contexts**: header, footer, toc, source-caption (excluded); contact, reference (limited).
- Context-aware detection only flags short standalone lines; body paragraphs are not mislabeled.
- Eval corpus: 100% first-pass with both default and PyMuPDF parsers.

### Phase 2: Family-Aware ProjectFactContract v2 — Host-Country Hardening

Status: `done` — PR [#805](https://github.com/Fredilly/app.article6/pull/805)

- Forbidden section contexts: methodology, baseline, monitoring, leakage, additionality, stakeholder, appendix, annex, references, citations.
- Forbidden noise contexts: header, footer, toc, source-caption, reference.
- Preferred sections: project overview, title, location.
- Methodology-code/version-string preamble rejection.
- 11 regression tests for weak/ambiguous country match rejection.
- Exemption: preamble check allows valid country names starting with articles (e.g. "The Gambia").
- Geo-reference heading no longer banned (preferred host-country context).

## Current phase

### Phase 3: Hierarchical Section + Table Index

Branch: `feat/qc-section-table-index-v2`

Goal: Use parser-preserved hierarchy and table structure to improve section/table retrieval.

Expected outcome:

- better baseline retrieval
- better additionality retrieval
- better monitoring retrieval
- better leakage retrieval
- better table-backed evidence retrieval
- router still validates final evidence

## Next phases

### Phase 4: Evidence Sufficiency Validators

Branch: `feat/qc-evidence-sufficiency-validators`

Goal: Improve Article6 judgment by requiring check-specific evidence sufficiency before returning `answered`.

Expected outcome:

- additionality validator
- baseline scenario validator
- monitoring validator
- weak related evidence becomes `unclear`
- unsupported evidence becomes `no_evidence`
- no fake answers

### Phase 5: Eval Corpus + CI Gate

Branch: `feat/qc-parser-evidence-ci-gate`

Goal: Lock parser and evidence improvements into CI.

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
