# Structured Metadata Pipeline Trace Report

## Executive Summary

**Verdict: The Codex concern is partially confirmed.** The PyMuPDF adapter **does produce structured output** (elementType, pageNumber, sectionPath, boundingBox, table structure), but two downstream points partially **flatten it back to regex-on-text** for heading/section logic, and the `compileEvidenceDocumentFromStructure` path **does** preserve structure while the `getStructuredQueryContext` fallback path **does not**. The PDF-backed path (`resolveStructuredQueryContext`) and the raw-text fallback path (`getStructuredQueryContext`) produce materially different evidence.

---

## Stage 0: Parser Selection

**File:** `src/lib/documentParsing/index.ts`
- Line 30-36: `resolveConfiguredDocumentParserAdapterId()` reads `process.env.QUICK_CHECK_PARSER`
- Line 16: Default adapter is `"pymupdf"` (defined as `DEFAULT_DOCUMENT_PARSER_ADAPTER_ID` in `types.ts` line 16)
- **Finding: QUICK_CHECK_PARSER is NOT set anywhere in production code** — only in tests. So by default, `pymupdf` is selected.
- **However**, the pymupdf adapter falls back to `currentExtractor` if anything goes wrong (no pdfFilePath, helper fails, etc.)

---

## Stage 1a: PyMuPDF Adapter (`parseText`)

**File:** `src/lib/documentParsing/adapters/pymupdfAdapter.ts`

### What it receives
- `input.pdfFilePath` (optional) and `input.rawText`
- A Python subprocess runs `scripts/pymupdf-parse.py` via `runPymupdfHelperSync`

### What it produces (in `mapPymupdfHelperJsonToParsedDocument`)
The helper JSON has:
- `raw_text` — flat text
- `pages[]` — each with `page_number`, `text`, `blocks[]` (with `bbox`)
- `headings[]` — each with `text`, `level`, `page_number`
- `tables[]` — each with `id`, `page_number`, `row_count`, `column_count`, `cells[]`

**Metadata preservation at this stage:**

| Field | Preserved? | Where |
|---|---|---|
| `elementType` | **Yes** | Lines 187-198 (heading), 206-217 (paragraph) — hardcoded but correct |
| `pageNumber` | **Yes** | Line 189 (from `heading.page_number`), Line 209 (from `pageItem.page_number`) |
| `sectionPath` | **Yes** | Lines 184-185 (built from synthetic sectionNumber via `buildSectionPath`) |
| `boundingBox` | **NO** | Lines 187-217 — elements do NOT include `boundingBox` from block-level bbox data |
| `table` structure | **Partial** | Lines 168-178 — `ParsedTable` is created with `id`, `pageNumber`, `columnCount`, `rowCount`, `cells[]` (row, col, text). But **NO `boundingBox`** on cells or table, and **NO `headerRowCount`**. Cell text only — no coordinates. |
| `headings[].sectionNumber` | **Lost on headingIndex** | Lines 279-282: final `headings` array has `sectionNumber: undefined` stripped out |

### CRITICAL FLATTENING POINTS (lines 223-224):
```ts
const sectionsByNumber = extractPddSections(rawText);   // ← regex on raw text!
const headingIndex = buildPddHeadingIndex(rawText);       // ← regex on raw text!
```
**Lines 223-224**: Even though `helperJson` contains structured headings with page numbers and levels, `extractPddSections` and `buildPddHeadingIndex` are **called on `rawText`** — the flat concatenated text with form feeds — completely ignoring the structured `helperJson.headings[]`. This means `sectionsByNumber` and `headingIndex` are built from scratch using regex (from `quickCheckSectionExtractor.ts`), duplicating work that PyMuPDF already did.

### `blocks` (lines 225-233):
```ts
const blocks = elements.map((element) => ({
  id: element.id,
  type: element.elementType === "heading" ? "heading" : "paragraph",
  text: element.text,
  normalizedText: element.normalizedText,
  pageNumber: element.pageNumber,
  headingLevel: element.headingLevel,
  sectionNumber: element.sectionNumber,
}));
```
**`blocks` preserves `sectionNumber`, `pageNumber`, `headingLevel`** but strips `sectionPath`, `boundingBox`, `table`, `confidence`, `sourceParser`.

### `pages` (line 158, 219-221):
```ts
const pages = splitRawTextIntoPages(rawText);  // just splits on \f
page.elements = elements.filter((e) => e.pageNumber === page.pageNumber);
```
Pages are built from raw text split on `\f`. Elements are assigned by page number, but **no block-level bbox is preserved** on the page level.

---

## Stage 1b: Fallback Path — Current Extractor

**File:** `src/lib/documentParsing/adapters/currentExtractor.ts`

### What it receives
- `input.rawText` only — the flat text, no PDF path

### What it produces
- Lines 206-207: `extractPddSections(rawText)` and `buildPddHeadingIndex(rawText)` — both regex-on-text
- Lines 208-214: Headings built from `headingIndex` results (regex-derived)  
- Lines 222-251: `introBlocks` and `blocks` built from regex-derived data
- Lines 253-293: `sectionElements` — elements from headingIndex with `sectionNumber`, `sectionPath` (regex-derived)
- Line 312: `tables: []` — **always empty** — no table structure preserved
- Line 328: `hasBoundingBoxes: false` — **never**

### Metadata at this stage:

| Field | Preserved? |
|---|---|
| `elementType` | Yes (lines 174-193, 265-289 — but heuristically determined) |
| `pageNumber` | Yes (from `\f` splits) |
| `sectionPath` | Yes (line 254, from regex-detected section numbers) |
| `boundingBox` | **No** — never set |
| `table` structure | **No** — tables array is always `[]` |

---

## Stage 2: `buildArticle6DocumentModel` / `buildDocumentStructure`

**File:** `src/lib/documentModel/buildArticle6DocumentModel.ts`

### What it receives
- `parsedDocument` (which has `elements[]`, `pages[]`, `tables[]`, `blocks[]`, `headings[]`, `headingIndex`, `sectionsByNumber`)

### Metadata preservation in blocks (lines 97-147):

```ts
const blockSource = parsedElements.length > 0
  ? parsedElements.map((element) => ({
      id: element.id,
      type: element.elementType,           // ← preserved
      ...
      pageNumber: element.pageNumber,      // ← preserved
      headingLevel: element.headingLevel,  // ← preserved
      sectionNumber: element.sectionNumber, // ← preserved
      sectionPath: element.sectionPath,    // ← preserved
      boundingBox: element.boundingBox,    // ← preserved (but empty in pymupdf!)
      table: element.table,                // ← preserved
      confidence: element.confidence,      // ← preserved
    }))
  : parsedDocument.blocks;
```
**When `elements[]` exists** (which both adapters produce), almost all metadata is carried through to `Article6DocumentBlock`.

**When `elements[]` is empty**, falls back to `parsedDocument.blocks` which is **missing** `sectionPath`, `boundingBox`, `table`, `confidence`, `sourceParser`.

### Metadata preservation in sections (lines 178-258):

**Two code paths:**

**Path A (lines 180-217):** If `headingIndex` is non-empty — uses `headingIndex` (from regex, not from structured elements!)
- Line 181: Iterates `headingIndex` — which is built via `buildPddHeadingIndex(rawText)` — regex-on-text
- Line 184-185: Uses `sectionsByNumber[sectionNumber]` — also from `extractPddSections(rawText)` — regex-on-text
- **This means even when elements have `sectionNumber` with page numbers, the section body is reconstructed by regex-splitting raw text**

**Path B (lines 218-258):** If `headingIndex` is empty — uses `parsedDocument.headings` (from adapter)
- Lines 222-226: Filters `parsedDocument.blocks` by `sectionNumber` to find body text
- **Also regex/text-based reconstruction**

| Field | Preserved? |
|---|---|
| `blocks[].pageNumber` | **Yes** (from element) |
| `blocks[].sectionPath` | **Yes** (from element) |
| `blocks[].boundingBox` | **Yes structurally** but **empty in data** for pymupdf path |
| `blocks[].table` | **Yes** (from element) |
| `sections[].pageNumber` | **No** — sections don't store page numbers. SourceRef always has `pageNumber: 1` for Path A |
| `sections[].titleRaw` | Comes from `headingIndex` (regex) not from structured element data |

---

## Stage 3: `compileEvidenceDocumentFromStructure`

**File:** `src/lib/quickCheck/evidence/compileEvidenceDocument.ts` (lines 536-653)

### What it receives
- `documentStructure` (Article6DocumentModel with blocks, sections, etc.)

### Metadata preservation:

**Blocks → EvidenceSpans mapping (lines 552-643):**
```ts
const spans = input.documentStructure.blocks.flatMap((block) => {
  const blockType = inferStructureBlockType(block, { treatAsTitle });
  // ...
  const sectionPath = buildStructureSectionPath(block, documentStructure); // lines 504-518
  const headingPath = headingPathBySectionId.get(block.sectionId) ?? [];
  const heading = headingPath[headingPath.length - 1] ?? ...;
  
  // Table metadata preserved:
  const table = blockType === "table" ? {
    tableId: block.table?.id,
    caption: block.table?.caption,
    rowCount: block.table?.rowCount,
    columnCount: block.table?.columnCount,
    headerRowCount: block.table?.headerRowCount,
    cells: block.table ? buildEvidenceTableCells({...}) : undefined,
    limitedProvenance: !hasNativeTableMetadata,
  } : undefined;
```

| Field | Preserved? |
|---|---|
| `page` | **Yes** — `block.pageNumber ?? null` (line 625) |
| `sectionId` | **Yes** — `block.sectionId` (line 630) |
| `heading` | **Yes** — built from section heading path (line 573) |
| `headingPath` | **Yes** — from section hierarchy (lines 568-572) |
| `sectionPath` | **Yes** — from `buildStructureSectionPath` (line 567) |
| `sourceBlockId` | **Yes** — `block.id` (line 634) |
| `table` | **Yes** — if block has table metadata (lines 574-589) |
| `boundingBox` | **Yes** — in `layout.boundingBox` (line 613) |
| `reliability` | **Yes** — computed from block type (lines 590-594) |

**BUT** the `layout.limitedProvenance` is set to `true` when `!block.boundingBox` (line 615), which is **always true for PyMuPDF blocks** since boundingBox is never populated by the adapter.

### Contrast with `compileEvidenceDocument` (lines 520-534):
The legacy `compileEvidenceDocument` takes `rawText` and runs regex-based `buildCandidateBlocks()` which re-detects everything from scratch — this is the **true flattening path** and is **NOT used** by `compileEvidenceDocumentFromStructure`.

---

## Stage 4: `buildSectionTableIndex`

**File:** `src/lib/quickCheck/indexing/buildSectionTableIndex.ts`

### What it receives
- `documentStructure` and `evidenceDocument`

### This stage is meta-indexing:

**`buildSectionTree` (line 111-210):**
- Iterates `documentStructure.sections` (lines 142-158) and `evidenceDocument.spans` (lines 160-177)
- Uses `span.sectionId`, `span.headingPath`, `span.sectionPath`, `span.page` — all from the structured evidence
- **Metadata is preserved through this stage** as long as the upstream preserved it

**`buildTableIndex` (lines 212-266):**
- Filters `evidenceDocument.spans` by `blockType === "table"`
- Preserves all table cell metadata including `boundingBox`, `pageNumber`, `sourceTableId`
- **Metadata preserved** through to `TableCellReference[]`

**`buildSectionTopicMap` (lines 333-376):**
- Uses `sectionTree.nodesById` and `documentStructure.sections` body text
- **Runs regex pattern matching** (`TOPIC_PATTERNS` at lines 15-26) on section heading, headingPath, and body text
- This is **intentional** — topic classification is inherently keyword/regex-based regardless of parser

---

## Stage 5: Router Context — Comparison of Two Paths

### Path A: `resolveStructuredQueryContext` (PDF-backed, server-only)

**File:** `src/lib/chat/quickCheckStructuredQuery.ts`

**Lines 14-104:**
- Calls `parseDocumentText({ rawText, pdfFilePath })` — goes through PyMuPDF adapter with the actual PDF
- Calls `buildArticle6DocumentModel()` — preserves structured metadata
- Calls `compileEvidenceDocumentFromStructure()` — preserves structured metadata
- Calls `buildProjectFactContract()` — uses evidence spans with section paths

**Metadata preserved through the entire pipeline.**

### Path B: `getStructuredQueryContext` (raw-text, fallback)

**File:** `src/lib/chat/quickCheckReviewQuestion.ts`

**Lines 50-77:**
- Calls `parseDocumentText({ rawText })` — **no pdfFilePath**, so even the pymupdf adapter falls back to `currentExtractor` (line 357 of pymupdfAdapter.ts)
- Current extractor produces **no tables**, **no bounding boxes**, and derives headings/sections via regex
- Effectively the same as just running regex on raw text

### When each path is used:

`resolveStructuredQueryContext` (StructuredQuery.ts, lines 14-109):
- Line 15: checks `if (pdfRef)` — only used when a PDF reference is available
- Line 108: falls back to `getStructuredQueryContext(rawPddText)` if no PDF ref

`buildReviewQuestionResult` (ReviewQuestion.ts, lines 253-336):
- Line 263-264: uses `structuredQueryContext` if provided, otherwise falls back to `getStructuredQueryContext`
- **In production, this is likely the raw-text fallback path** since `structuredQueryContext` is only injected in specific server-action contexts

---

## Definitive Metadata Loss Points

| # | File:Line | What Happens | Severity |
|---|---|---|---|
| 1 | `pymupdfAdapter.ts:158` | `pages` are built by splitting `rawText` on `\f` — loses original PyMuPDF page objects' block-level bbox, element layout, and font info | **High** |
| 2 | `pymupdfAdapter.ts:187-217` | Elements are constructed from `helperJson.headings[]` and `helperJson.pages[].text` but `boundingBox` is never populated from the block-level bbox data in `helperJson.pages[].blocks[].bbox` | **High** |
| 3 | `pymupdfAdapter.ts:223` | `extractPddSections(rawText)` — runs full regex-on-text heading detection on the flat `rawText`, ignoring the structured headings from PyMuPDF | **Critical** |
| 4 | `pymupdfAdapter.ts:224` | `buildPddHeadingIndex(rawText)` — rebuilds heading index from scratch via regex on raw text | **Critical** |
| 5 | `pymupdfAdapter.ts:279-282` | `headings` array has `sectionNumber: undefined` — structured section number stripped from final heading output | **Medium** |
| 6 | `pymupdfAdapter.ts:225-233` | `blocks` mapped from elements — strips `sectionPath`, `boundingBox`, `table`, `confidence`, `sourceParser` | **Medium** |
| 7 | `currentExtractor.ts:206-207` | By design: extractor operates only on raw text — no tables, no bounding boxes, no structured metadata | **Inherent** |
| 8 | `buildArticle6DocumentModel.ts:181-217` | Even when elements have structured `sectionNumber`, sections are rebuilt from regex-derived `headingIndex` and `sectionsByNumber` | **High** |
| 9 | `buildArticle6DocumentModel.ts:184-185` | `sectionsByNumber[sectionNumber]` is the regex-split raw text, not the structured element text | **Medium** |
| 10 | `pymupdfAdapter.ts:168-178` | Table cells have no `boundingBox` — the PyMuPDF helper JSON's block-level bbox data is not mapped to cell bounding boxes | **Medium** |

---

## Key Findings Summary

1. **The PyMuPDF adapter DOES produce structured output** — `elements[]` with `elementType`, `pageNumber`, `sectionNumber`, `sectionPath`, `headingLevel`, and `tables[]` with structure. But `boundingBox` is never populated.

2. **Despite having structured output, the adapter immediately runs regex-on-text extractors** (`extractPddSections`, `buildPddHeadingIndex` at pymupdfAdapter.ts:223-224) on the flat raw text. These are stored as `sectionsByNumber` and `headingIndex` on the ParsedDocument, and downstream `buildArticle6DocumentModel` **prefers these regex-derived indices** over the structured elements for section construction.

3. **`buildArticle6DocumentModel` (lines 180-217) uses `headingIndex` (regex) to build sections**, even though structured elements with `sectionNumber` exist. The structured element data is only used for `blocks[]` — not for section hierarchy.

4. **The PDF-backed path (`resolveStructuredQueryContext`) vs. the raw-text path (`getStructuredQueryContext`)** differ significantly:
   - PDF path: PyMuPDF adapter → structured elements → TableIndex with real spans
   - Raw-text path: falls back to currentExtractor → no tables → no bounding boxes → all regex

5. **`compileEvidenceDocumentFromStructure`** is the point where structured metadata is genuinely preserved into `EvidenceSpan[]` — it correctly carries `pageNumber`, `sectionId`, `heading`, `headingPath`, `sectionPath`, `table`, `boundingBox`, and `confidence` from `Article6DocumentBlock`.

6. **The biggest structural waste**: PyMuPDF identifies structured headings (with level, page_number) in the Python helper script, but `mapPymupdfHelperJsonToParsedDocument` ignores this and re-runs regex-on-text on the concatenated raw text. The structured heading data is used only for the `elements[]` array (where it's mapped 1:1) and then ignored for section building.

7. **`boundingBox` is the biggest gap**: The PyMuPDF helper JSON has `pages[].blocks[].bbox` data, but it's never mapped into `ParsedElement.boundingBox`. This makes `hasBoundingBoxes: true` in the quality report a **misleading claim** — bounding boxes are declared present but never populated.
