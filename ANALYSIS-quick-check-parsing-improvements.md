# Quick Check Deterministic Parsing Pipeline — Analysis & Improvement Priorities

## How I Analyzed

1. **Read the eval corpus** (`phase6-eval-corpus.json`) — all 14 fixtures, their `failureReason` fields and `notes`.
2. **Read each fixture's actual document text** to understand real vs expected parsing output.
3. **Traced the full text-to-evidence pipeline:**
   - `currentExtractor.ts` — adapter that extracts sections from raw text
   - `quickCheckSectionExtractor.ts` — the core deterministic section/heading parser (996 lines)
   - `compileEvidenceDocument.ts` — builds `EvidenceSpan` blocks from raw text
   - `buildEvidenceSpanIndex.ts` — query-by-section/lexical matching
   - `buildSectionTableIndex.ts` — topic classification & exclusion logic
   - `sufficiencyValidators.ts` — TOC/preamble/boilerplate rejection
   - `noiseDetection.ts` — header/footer/source-caption filters
   - `deterministicRouter.ts` — fact→section→table→lexical routing order
   - `extractDocumentFacts.ts` — labeled-field extraction from spans
4. **Examined adapter alternatives:** `pymupdfAdapter.ts` (largely a passthrough to `currentExtractor` for text inputs) and `liteParse.ts`.
5. **Compared oracle expectations vs actual pipeline failure modes** from the 14 corpus fixtures.

---

## Current Known Weaknesses (in priority order)

### W1. TOC detection and elimination is unreliable

**Evidence from corpus:**
- `regression-toc-only-pdd.txt`: TOC with section headings but NO body text. The extractor detects the TOC block via `findTocBlockBounds()` but **only checks if the line starts with `\d+.\d+ ...`** pattern. In `regression-toc-only-pdd.txt`, the TOC lines are like `1. Project Description` (no leader dots) — the current heuristic `!/^(?:\d+(?:\.\d+)*|[A-Z]\.\d+)\s+[A-Z]/.test(trimmed)` fails to detect end of TOC body.
- The `isTocTitle()` function checks for `\.{4,}\s*\d+\s*$` (leader dots) but many real-world TOCs don't use leader dots.
- TOC detection in `findTocBlockBounds()` only matches literal `"table of contents"` or `"contents"` header. If the TOC header is on a page with a different prefix (e.g. "TABLE OF CONTENTS" mixed with boilerplate), it breaks.
- The TOC detection only finds **one** TOC block — multi-page TOCs are missed entirely.
- `pd-redd-v130-extracted.txt` (the full VCS PDD) has a TOC spanning pages 2-3 with section numbers, but the header repeats on every page making line-level detection context-dependent.

**Impact:** TOC entries leak into the heading index as real sections, producing false-positive evidence (section headings matched during section_topic routing but with no substantive body).

**Fix:** File: `src/lib/chat/quickCheckSectionExtractor.ts`, function `findTocBlockBounds()` (~line 111-147)
- Add multi-line TOC detection: scan sequences of lines matching `<section-number> <title> <page-number>` (even without leader dots)
- Add TOC suffix pattern to `stripTocSuffix()` that catches `^[A-Z]\d+ ... \d+$` format without dots
- Register detected TOC ranges so downstream evidence compilation (`compileEvidenceDocument.ts`) can mark spans inside them as `toc` block type, making them reliably `"excluded"` reliability
- **Cost:** Low (add ~20 lines of regex heuristics). **Benefit:** High — eliminates false-positive sections from 3/14 fixtures.

---

### W2. Section heading regex misses parenthesized heading patterns

**Evidence from corpus:**
- `pd_redd_v1_130-extracted.txt`: Uses `2.4 (Baseline Scenario)`, `2.5 (Additionality)`, `1.10 (Leakage)` — parenthesized headings
- `blue-nile-redd-extracted.txt`: Same pattern `2.4 (Baseline Scenario)`, `2.5 (Additionality)`, `1.10 (Leakage)`
- The `SECTION_HEADING_PAREN_RE` regex (`/^(?:[ \t]*(?:Section[ \t]+)?(\d+(?:\.\d+)*)[ \t]+\((.+)\))[ \t]*$/gm`) does match these, **but** it requires the line to END with the closing paren. If PDF extraction introduces trailing whitespace or page-numbers after the paren, the regex misses.

More critically: The `isLikelyHeadingCandidate()` check requires the title to have mixed-case long words or 2+ all-caps words. `"(Baseline Scenario)"` has 2 capitalized words — but the leading `(` can trip the regex anchor. And `"(Leakage)"` is only 8 chars — the title extraction clause `headingMatch[2]?.trim() ?? ""` may strip the parens, leaving just "Leakage" which then fails `isLikelyHeadingCandidate` because it's too short/simple.

**Impact:** Missing baseline/additionality/leakage section headings in REDD/AFOLU PDDs that use VCS-style parenthesized numbering. This directly causes `no_evidence` for core sections on fixtures `real-pd-redd-v130` (short excerpt) and `real-blue-nile-redd`.

**Fix:** File: `src/lib/chat/quickCheckSectionExtractor.ts`, function `isLikelyHeadingCandidate()` (~line 79-85)
- Add a special case: if title is a single capitalized word with optional parens like `(Baseline)`, `(Leakage)`, `(Monitoring)`, `(Additionality)`, treat as valid
- Better approach: add an explicit allow-list of carbon-document section titles that bypass the normal heuristic
- File: `src/lib/chat/quickCheckSectionExtractor.ts`, function `isLikelyTopLevelSectionTitle()` (~line 51-77)
- Reduce `headingishWords.length / words.length < 0.6` to 0.5 — too strict for short parenthesized titles
- **Cost:** Low (~10 lines). **Benefit:** High — directly fixes 2 of 14 fixtures where sections vanish.

---

### W3. Section body extraction fails when body text is on a different page from heading

**Evidence from corpus:**
- `pd_redd_v1_130-extracted.txt`: `1.10 (Leakage)` heading is at line 48, but body text continues to line 54. The page break (`\f`) at line 24 (`Page 10 of 85`) means heading and body are on different pages. The `hasBodyTextAfter()` function checks if the next non-empty, non-heading line has text. But if there's ONLY a page break between heading and body (no non-empty line), it rejects the heading.
- The page-boundary logic in `currentExtractor.ts` splits on `\f` form feeds but `findHeadingsInContinuousText` and `hasBodyTextAfter` work on normalized text where `\f` is replaced with `\n`, so a `\f` can look like an empty line.
- The `hasBodyTextAfter()` function's logic: `const nextHeadingNum = extractHeadingNumberFromLine(trimmed)` — if the next line AFTER the heading is a page number or header/footer (which is then filtered by `stripHeaderFooterNoise`), it's invisible to the check, causing a false "no body text" rejection.

**Impact:** Section headings near page boundaries are dropped. For `pd_redd_v1_130-extracted.txt`, `1.10 (Leakage)` is detected heading but the body extraction says "no body text after heading" → section is excluded.

**Fix:** File: `src/lib/chat/quickCheckSectionExtractor.ts`, function `hasBodyTextAfter()` (~line 159-178)
- Before rejecting, strip page boundaries (`\f` → spaces) and re-check for body text
- Or: change the body-finding logic to scan across page boundaries instead of stopping at first `\f`
- File: `src/lib/chat/quickCheckSectionExtractor.ts`, function `normalizeText()` (~line 33-38)
- The `stripHeaderFooterNoise` function strips page numbers but the `\f` handling could lose paragraphs that follow a form-feed on the same logical heading
- **Cost:** Medium (~15-20 lines). **Benefit:** High — multi-page PDDs are the norm for real docs.

---

### W4. Pipe-delimited table content in extracted text destroys contiguous evidence

**Evidence from corpus:**
- `blue-nile-redd-extracted.txt`: Lines 14-20 contain a carbon pool table with pipe `|` formatting. Lines 30-36 contain a monitoring parameter table with pipe `|` formatting. Lines 42-46 contain a leakage table.
- The `detectBlockType()` function in `compileEvidenceDocument.ts` line 102: `if (/\|/.test(trimmed) || /\S(?:\s{2,}|\t)\S/.test(trimmed)) return "table";`
- This treats each pipe-delimited line as a standalone "table" block, **breaking paragraph continuation**. A section with `paragraph text | table row | more paragraph text` fragment the evidence stream into isolated `"table"` blocks with `reliability: "limited"`.
- The `"limited"` reliability causes downstream sufficiency validators to see only fragmented table cells instead of contiguous narrative, so `validateBaseline()` and `validateLeakage()` get short, calculation-like text.

**Impact:** The `real-blue-nile-redd` fixture explicitly documents this: "tables inside sections suppress evidence signal even when valid prose precedes them." The baseline_scenario question is expected to return `no_evidence` because the pipe-formatted table content fragments text and breaks evidence validation. But in many real documents, pipe content is just a simple CSV or markdown table embedded in a paragraph — treating every pipe-line as a standalone table block is too aggressive.

**Fix:** File: `src/lib/quickCheck/evidence/compileEvidenceDocument.ts`, function `detectBlockType()` (~line 94-105)
- Add a heuristic: if a pipe-delimited line is short (fewer than 2 pipes or < 40 chars) and surrounded by paragraph text, treat it as paragraph continuation rather than a table
- Better approach: implement a mini-table parser that groups consecutive pipe-delimited lines into a single table block, but allows the sections BEFORE and AFTER the table to remain as contiguous paragraph blocks
- Add `tableContiguous` mode: if a "table" block sits between two paragraph blocks in the same section, merge the paragraphs
- **Cost:** Medium (~30-40 lines). **Benefit:** Medium — fixes the table-fragmentation issue for document types that mix tables and prose.

---

### W5. Intro-element classification (heading vs paragraph) is too aggressive with short lines

**Evidence from corpus:**
- `currentExtractor.ts`, function `introLineElementType()` (~line 96-108): The critical rule is at line 106: `if (trimmed.length <= 140 && wordCount >= 2 && !STANDALONE_METHOD_LABEL_RE.test(trimmed)) return "heading";`
- This classifies ANY short line (≤140 chars, ≥2 words, not a method label) as a "heading". 
- In `pd_redd_v1_130-extracted.txt`, the intro lines include "Page 1 of 85" (classified as `paragraph` via `PAGE_MARKER_RE`), but also "VCS Version 4.2", "VM0007 REDD+ Methodology Modules", "Project Description Document: PD_REDD_v1_130" — the latter is correctly a title, but "VCS Version 4.2" gets classified as heading, polluting the heading index.
- In `regression-boilerplate-metadata.txt`, ALL lines are generic metadata — but lines like `Clean Development Mechanism` (18 chars, 3 words) are classified as headings.
- In `gs-luf-pdd-extracted.txt`, the first paragraph "Gold Standard for the Global Goals" is correctly a paragraph via the `Gold Standard` check, but "Host Country: Mozambique" should be a `field` — it IS matched by `FIELD_LIKE_LINE_RE` and correctly returned as `paragraph`. But the line is ALSO classified as `heading` by the length heuristic... wait, `FIELD_LIKE_LINE_RE` returns `paragraph` which takes precedence (the function checks title/paragraph FIRST before heading). So it's okay.

**Impact:** The intro paragraph classification creates spurious heading elements that leak into the evidence document heading index. This can cause `section_index` routing to find false-positive section matches.

**Fix:** File: `src/lib/documentParsing/adapters/currentExtractor.ts`, function `introLineElementType()` (~line 96-108)
- Tighten the heading heuristic: require either (a) mixed-case with capital first letter on short words, or (b) at least some lowercase letters in 5+ char words
- Add an exclusion set of common non-heading short lines: version strings, standard names, dates, document IDs
- Move FIELD_LIKE_LINE_RE check BEFORE the length-based heading check — field lines should never be classified as headings
- **Cost:** Low (~15 lines). **Benefit:** Medium — reduces false-positive headings in ~4 fixtures.

---

### W6. Repeated page-header/-footer content suppresses body-text detection in `compileEvidenceDocument.ts`

**Evidence from corpus:**
- `pd-redd-v130-extracted.txt`: Every page starts with `PROJECT DESCRIPTION: VCS` / `Version 3` / `v3.2 N` triplet — these are headers.
- `collectRepeatedPageEdgeLines()` in `compileEvidenceDocument.ts` (~line 181-200) correctly identifies these as repeated headers/footers (appearing ≥2 pages).
- However, the `detectBlockType()` function processes these headers as regular content first, inserting them into the evidence stream before `collectRepeatedPageEdgeLines()` runs. Since `collectRepeatedPageEdgeLines` uses the TEXT only, and the header/footer overlay happens AFTER block type detection, header lines that also match `FIELD_RE` or `SECTION_HEADING_RE` patterns can be misclassified.
- The `pageEdgeLines.headers` override at line 270-272 only catches exact line-text matches. If the page header is `PROJECT DESCRIPTION: VCS` on every page, it's caught. But if the first page has a slightly different header (no page number suffix), it slips through.

**Impact:** Headers and footers that look like real content pollute the evidence span index, causing false-positive section_heading or field spans. This is especially pernicious with VCS/Verra template documents where the page header IS `PROJECT DESCRIPTION: VCS` — a phrase that looks like a legitimate heading.

**Fix:** File: `src/lib/quickCheck/evidence/compileEvidenceDocument.ts`, function `buildCandidateBlocks()` (~line 234-347)
- Run `collectRepeatedPageEdgeLines()` FIRST, before any block type detection
- Override block type to "header"/"footer" for repeated page-edge lines BEFORE calling `detectBlockType()`, not after
- Add detection of header-like patterns at page edges even when the text varies slightly (e.g., `v3.2 N` where N differs)
- **Cost:** Low (~10 lines reordering + 10 lines pattern). **Benefit:** Medium — reduces noise in multi-page VCS docs.

---

### W7. Section heading regex is line-anchored but PDF extraction can concatenate lines

**Evidence from corpus:**
- `envira-amazonia-vm0007-extracted.txt`: `4.3  MonitoringPlan` — note no space between "Monitoring" and "Plan". The `SECTION_HEADING_RE` expects `(\d+(?:\.\d+)*)[ \t]*[.:]?[ \t]+(.+)` — the `[ \t]+` requires whitespace between number and title. But "4.3  MonitoringPlan" has TWO spaces, which should match. However, `isLikelyHeadingCandidate` rejects it because `MonitoringPlan` has `word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+()-]+$/g, "")` — but `MonitoringPlan` is one word, so `words.length` is 1, and the function requires 2+ words at top of `isLikelyTopLevelSectionTitle`.
- In `real-pd-redd-v130` (short excerpt), `1.9  Project Boundary` — this IS correctly matched because `Project Boundary` splits into 2 words.
- But what about `4.3  MonitoringPlan`? It's 1 word (12 chars) — `isLikelyTopLevelSectionTitle` returns false because `words.length > 8` is not hit (it's 1), but the check falls through to `headingishWords.length / words.length < 0.6` which is `0/1 = 0 < 0.6` → false. Then `!hasMixedCaseLongWord && allCapsLongWordCount < 2` — `hasMixedCaseLongWord` = true (`MonitoringPlan` has mixed case, 12 chars), so this returns true! So `isLikelyTopLevelSectionTitle` returns true... but only because `hasMixedCaseLongWord` is true. This is an accidental pass.

**Impact:** Fragile heading detection. Minor PDF extraction artifacts (concatenated words, missing spaces, extra punctuation) cause valid section headings to be silently dropped.

**Fix:** File: `src/lib/chat/quickCheckSectionExtractor.ts`, function `isLikelyTopLevelSectionTitle()` (~line 51-77)
- Add a word-splitting pre-pass for CamelCase words like `MonitoringPlan` → `Monitoring Plan`
- Or: for section numbers that look like carbon-document standards (A.1, B.4, 1.x, 4.x, etc.), use a more relaxed title check
- Add the camelCase split in `cleanExtractedDisplayText()` or a new function before heading matching
- **Cost:** Low (~8-10 lines). **Benefit:** Low-Medium — edge case but catches common PDF extraction artifacts.

---

## Summary: Ranked Improvement Recommendations

| # | Weakness | File(s) | Impacted Fixtures | Lines Changed | Complexity | Benefit |
|---|----------|---------|-------------------|---------------|------------|---------|
| **1** | TOC detection misses non-dotted TOC entries & multi-page TOCs | `quickCheckSectionExtractor.ts` | 3/14 (toc-only-pdd, pd-redd-v130-full, blue-nile) | ~20 | Low | High |
| **2** | Parenthesized headings like `2.4 (Baseline Scenario)` rejected by heuristic | `quickCheckSectionExtractor.ts` | 2/14 (pd_redd_v1_130, blue-nile-redd) | ~10 | Low | High |
| **3** | Section body text lost across page breaks (heading on page N, body on N+1) | `quickCheckSectionExtractor.ts` | 2/14 (pd_redd_v1_130, pd-redd-v130-full) | ~20 | Medium | High |
| **4** | Pipe-delimited table lines fragment contiguous section evidence | `compileEvidenceDocument.ts` | 2/14 (blue-nile-redd, envira) | ~35 | Medium | Medium |
| **5** | Intro classification tags short lines as headings too aggressively | `currentExtractor.ts` | 3/14 (boilerplate, methodology-preamble, blue-nile) | ~15 | Low | Medium |
| **6** | Page header/footer detection runs too late (after block analysis) | `compileEvidenceDocument.ts` | 2/14 (pd-redd-v130-full) | ~20 | Low | Medium |
| **7** | CamelCase word concatenation from PDF extraction breaks heading detection | `quickCheckSectionExtractor.ts` | 1/14 (envira) | ~10 | Low | Low-Med |

### Net estimated accuracy improvement from top 3 fixes: **significant** — would fix ~5 of the 14 eval fixtures that currently have section-index failures.

### Recommended implementation order:
1. **Fix W1+W2** (TOC + parenthesized headings) — same file, same function family, ~30 combined lines
2. **Fix W3** (page-boundary body loss) — moderate effort, biggest single-fixture impact
3. **Fix W5** (intro classification) — easy, prevents heading pollution
4. **Fix W4** (table fragmentation) — more complex but opens up table-heavy docs
5. **Fix W6+W7** (header timing + CamelCase) — polish

The current-extractor is the right baseline to improve — it's deterministic, has no failing dependencies, and the pymupdf adapter falls back to it for text inputs anyway.
