# Parser Bakeoff Corpus — Phase 0C

Real messy carbon PDFs used for the Parser Bakeoff Scorecard.

## Corpus

| # | File | Size | Source | Pages | Tables (pymupdf) |
|---|------|------|--------|-------|-------------------|
| 1 | `verra-generation-forest-verification.pdf` | 1.6 MB | Desktop local copy, Verra VCU verification report | 63 | 9 |
| 2 | `vcs-madre-de-dios-verification-report.pdf` | 628 KB | Downloaded from CeroCO2 (Peru REDD) | 80 | 8 |

All files verified as real PDFs (`%PDF-` header). The two Generation Forest PDFs in the original download list were identical byte-for-byte duplicates; only one is retained.

## Downloads

- `verra-generation-forest-verification.pdf`: local copy from desktop (Verra verification report 2016–2021)
- `vcs-madre-de-dios-verification-report.pdf`: https://www.ceroco2.org/images/stories/documentos_proyectos/Peru/CCB_VERIF_REP_ENG_844_01JAN2014_31DEC2018.pdf

CDM URLs (cdm.unfccc.int) returned SSL errors and were excluded.
Gold Standard / JCM URLs were unreachable; may be added in future runs.

## Scorecard Output

- `docs/quickcheck/parser-bakeoff-scorecard.json` — machine-readable JSON
- `docs/quickcheck/parser-bakeoff-scorecard.md` — human-readable markdown

## Notes

- PDF files are NOT committed (listed in `.gitignore`).
- The bakeoff compares `current-extractor`, `pymupdf`, and `docling` (if available).
- `current-extractor` uses PyMuPDF-extracted raw text for page matching; `pymupdf` uses native PDF parsing.
- Docling remained unavailable on this system.
