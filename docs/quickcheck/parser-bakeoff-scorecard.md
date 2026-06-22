# Parser Bakeoff Scorecard
Generated: 2026-06-22T03:40:24.738Z
Default parser: current-extractor
PDF fixtures: 2

## Parser Availability
- current-extractor: AVAILABLE
- pymupdf: AVAILABLE
- docling: UNAVAILABLE (python3 available but docling not installed)

## Per-PDF Metrics

### vcs-madre-de-dios-verification-report.pdf

- **current-extractor**:
  - pages: 80  |  rawText: 245595 chars  |  median/page: 3105
  - headings: 8  |  tables: 0  |  elements: 123
  - page provenance: 123/123  |  avg confidence: 0.852
  - hasPageBoundaries: true  |  hasBoundingBoxes: false  |  hasStructuredHeadings: true  |  hasTables: false
- **pymupdf**:
  - pages: 80  |  rawText: 245595 chars  |  median/page: 3105
  - headings: 6  |  tables: 8  |  elements: 86
  - page provenance: 86/86  |  avg confidence: 0.857
  - hasPageBoundaries: true  |  hasBoundingBoxes: true  |  hasStructuredHeadings: true  |  hasTables: true
- **docling**: ERROR — python3 available but docling not installed

  **Comparison:**
  - heading delta: -2
  - table delta: 8
  - element delta: -37
  - provenance delta: -37

### verra-generation-forest-verification.pdf

- **current-extractor**:
  - pages: 63  |  rawText: 152052 chars  |  median/page: 2403
  - headings: 15  |  tables: 0  |  elements: 107
  - page provenance: 107/107  |  avg confidence: 0.886
  - hasPageBoundaries: true  |  hasBoundingBoxes: false  |  hasStructuredHeadings: true  |  hasTables: false
- **pymupdf**:
  - pages: 63  |  rawText: 152052 chars  |  median/page: 2403
  - headings: 7  |  tables: 9  |  elements: 70
  - page provenance: 70/70  |  avg confidence: 0.860
  - hasPageBoundaries: true  |  hasBoundingBoxes: true  |  hasStructuredHeadings: true  |  hasTables: true
- **docling**: ERROR — python3 available but docling not installed

  **Comparison:**
  - heading delta: -8
  - table delta: 9
  - element delta: -37
  - provenance delta: -37

## Downstream Eval Corpus Comparison

- **current-extractor**: 7/7 fixtures passed
  - first-pass success: 100.0% (7/7)
  - fact accuracy: 100.0%
  - provenance correctness: 100.0%
  - hallucinated answer: 0.0% (0/34)
  - unsupported rejection: 100.0%
  - regressions: 0
- **pymupdf**: 7/7 fixtures passed
  - first-pass success: 100.0% (7/7)
  - fact accuracy: 100.0%
  - provenance correctness: 100.0%
  - hallucinated answer: 0.0% (0/34)
  - unsupported rejection: 100.0%
  - regressions: 0
- **docling**: UNAVAILABLE — python3 available but docling not installed
