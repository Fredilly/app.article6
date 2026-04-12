# Quick Check PDF Extraction

## Goal

Make PDF text extraction work inside Vercel serverless functions without Java or external services.

## Why

The existing Quick Check parser is intentionally lightweight and heuristic. It works for some fixtures, but it is not the best default extractor for real PDFs. The previous Java-based plan was not deployable on Vercel, so the simpler fix is to use `pdf-parse` in the Node route and keep the heuristic parser only as a backup.

## Spec

- Keep the current Quick Check UX and evidence flow unchanged.
- Run `pdf-parse` inside the existing Node route on Vercel.
- Send uploaded PDF bytes from the browser to a dedicated extraction route in the app.
- Continue deriving Quick Check facts from extracted text so the UI contract stays stable.
- Fall back to the current heuristic parser only when `pdf-parse` cannot extract usable text.

## Integration Shape

- Client: resolve PDF bytes from IndexedDB, post them to `/api/quick-check/pdf-extract`.
- App route: parse the PDF with `pdf-parse`, then return normalized text to the client.
- Analysis: reuse existing fact derivation and methodology mention extraction.
- Fallback: if `pdf-parse` fails, reuse the current `extractPdfText(...)` path.

## Non-Goals

- No OCR rollout in this PR.
- No external extraction service.
- No Java dependencies.
- No changes to Dashboard, Methods, Manifest, or non-Quick-Check flows.
