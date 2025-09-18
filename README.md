# Article 6 Evidence Explorer

This Next.js application provides a thin UI for the Article 6 methodologies engine. It forwards queries to the packaged engine runtime and renders deterministic evidence cards, including hashes and source paths for vendored PDFs.

## Getting started

```bash
npm install
npm run dev
```

The UI expects the engine to expose `POST /query` and `GET /health`. Configure the base URL through environment variables.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `ENGINE_URL` | ✅ | Base URL for the methodologies engine (e.g. `https://engine.example.com`). |
| `ENGINE_KEY` | ⛔️ | Optional bearer token that will be added as `Authorization: Bearer <ENGINE_KEY>` when proxying to the engine. |

When deploying to Vercel, set `ENGINE_URL` (and, if applicable, `ENGINE_KEY`) for both Preview and Production environments.

## API surface

### `/api/query`

Proxies evidence queries to the engine using `POST { "query": string }`. Supports both `GET /api/query?text=...` and `POST /api/query` requests. Responses stream the JSON payload returned by the engine, preserving status codes and field ordering.

### `/pdf/:id`

Returns metadata for vendored PDFs. Append `?download=1` to stream the PDF asset with `X-Sha256` and `X-Source-Path` headers. Metadata responses include:

```json
{
  "id": "sample",
  "title": "Sample PDF from Article 6",
  "sha256": "…",
  "sourcePath": "…",
  "downloadUrl": "/pdf/sample?download=1",
  "size": 1234
}
```

Vendored PDFs live under `public/pdfs/` with hashes tracked in `public/pdfs/index.json`.

## Verification workflow

1. `curl -X POST "$ENGINE_URL/query" -H 'Content-Type: application/json' -d '{"query":"carbon fraction 44/12"}'` – expect `engineTag`, `metrics`, and an ordered `results[]` array.
2. `curl "http://localhost:3000/api/query?text=carbon%20fraction%2044/12"` – JSON should match the direct engine response.
3. Compare any on-screen `sha256` to `META.json` for the methodology package. Use `/pdf/:id` to download evidence and verify the `X-Sha256` header.
