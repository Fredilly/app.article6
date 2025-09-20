# app.article6

## Environment

- Create a `.env.local` with at least `ENGINE_URL` pointing at the engine base URL (for example `https://engine.example.com`). Optionally set `ENGINE_BEARER` if the engine requires bearer authentication, `ENGINE_ADAPTER` to force `remote` or `demo` mode, and `NEXT_PUBLIC_ENGINE_TAG` to tweak the default UI label.
- The API route appends `/query` to the configured base, so the underlying service must expose `POST /query`.
  - If `ENGINE_ADAPTER=demo` (or `ENGINE_URL` is omitted), the internal demo adapter returns deterministic sample results sourced from `data/methodologies/META.json`.

### Vercel deployment

- This repository includes a `vercel.json` that only sets `NEXT_PUBLIC_ENGINE_TAG`; all runtime values should be injected via Vercel environment variables.
- Use `vercel env add` or the dashboard to assign `ENGINE_URL` for Preview and Production (they can differ per environment). If you prefer the internal demo adapter, set `ENGINE_ADAPTER=demo` and leave `ENGINE_URL` unset.
- If the engine requires auth, add `ENGINE_BEARER` via `vercel env add`; the API route reads it automatically when present.
- If an engine key is required, create `ENGINE_BEARER` via the dashboard or CLI; it is optional and read automatically by `/api/query`.
- Override `NEXT_PUBLIC_ENGINE_TAG` per-environment if you want the footer badge to differ between Preview/Production builds.

## Vendored PDFs

- Place the methodologies snapshot under `data/methodologies`. The server expects a `META.json` array alongside the PDFs (for example `data/methodologies/pdfs/...`).
- Each metadata entry should include: `id`, `sha256`, an optional `sourcePath`, and a relative path to the PDF (`pdf`/`file`/`filename`). Example:

```json
[
  {
    "id": "baseline-carbon-44-12",
    "sha256": "<sha256-hex>",
    "sourcePath": "methodologies/baseline-carbon-44-12.pdf",
    "pdf": "pdfs/baseline-carbon-44-12.pdf"
  }
]
```
- The `/pdf/:id` route resolves the metadata, streams the vendored PDF, and emits `X-SHA256` and `X-Source-Path` headers for verification.

## UI

- The chat experience is optimised for mobile-first use with a minimal, card-based layout. On small screens the insights pane collapses behind the “Toggle insights” button; larger displays show messages and rule cards side-by-side.
- Result cards surface `section_title`, the matched excerpt, score badge, identifiers, and references when available. Identical snippets are grouped automatically; expand a group to inspect every variant while retaining provenance (`id`, `refs`, `sha256`). Engines returning `section_title`/`text` automatically populate the card header and body.
- Demo mode (`ENGINE_ADAPTER=demo`) produces meaningful preview cards so the interface stays demonstrable without the remote engine.
