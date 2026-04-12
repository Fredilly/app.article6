# OpenDataLoader Quick Check

## Goal

Use `@opendataloader/pdf` for Quick Check PDF extraction without changing the product flow or making the first-run UI more complex.

## Why

The existing Quick Check parser is intentionally lightweight and heuristic. It is fast enough for local demos, but it does not provide reliable reading order, structured extraction, or strong handling for real-world PDFs. OpenDataLoader gives us a better parser path while preserving local fallback behavior.

## Spec

- Keep the current Quick Check UX and evidence flow unchanged.
- Run OpenDataLoader only on the server.
- Send uploaded PDF bytes from the browser to a dedicated extraction route.
- Continue deriving Quick Check facts from extracted text so the UI contract stays stable.
- Fall back to the current heuristic parser whenever OpenDataLoader or Java is unavailable.
- Surface a warning when fallback happens so the extraction remains honest.

## Integration Shape

- Client: resolve PDF bytes from IndexedDB, post them to `/api/quick-check/pdf-extract`.
- Server: write bytes to a temp file, call `@opendataloader/pdf`, read `text` and `json` outputs, normalize to plain text.
- Analysis: reuse existing fact derivation and methodology mention extraction.
- Fallback: if the route fails, use the current `extractPdfText(...)` path and include a warning.

## Non-Goals

- No OCR rollout in this PR.
- No hybrid backend in this PR.
- No changes to Dashboard, Methods, Manifest, or non-Quick-Check flows.
- No schema migration of Quick Check result objects.
