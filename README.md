# app.article6

## Environment

- Create a `.env.local` with at least `ENGINE_URL` pointing at the engine base URL (for example `https://engine.example.com`). Optionally set `ENGINE_BEARER` if the engine requires bearer authentication, `ENGINE_ADAPTER` to force `remote` or `demo` mode, `ENGINE_HEALTH_PATH` to probe a bespoke health endpoint (relative to the engine base), `NEXT_PUBLIC_ENGINE_TAG` to tweak the default UI label, and `NEXT_PUBLIC_ENABLE_AUDIT=true` to unlock the `/audit` dry-run workflow.
- The API route appends `/query` to the configured base, so the underlying service must expose `POST /query`.
  - If `ENGINE_ADAPTER=demo` (or `ENGINE_URL` is omitted), the internal demo adapter returns deterministic sample results sourced from `data/methodologies/META.json`.

### Vercel deployment

- This repository includes a `vercel.json` that only sets `NEXT_PUBLIC_ENGINE_TAG`; all runtime values should be injected via Vercel environment variables.
- Use `vercel env add` or the dashboard to assign `ENGINE_URL` for Preview and Production (they can differ per environment). If you prefer the internal demo adapter, set `ENGINE_ADAPTER=demo` and leave `ENGINE_URL` unset.
- If the engine requires auth, add `ENGINE_BEARER` via `vercel env add`; the API route reads it automatically when present.
- If an engine key is required, create `ENGINE_BEARER` via the dashboard or CLI; it is optional and read automatically by `/api/query`.
- Override `NEXT_PUBLIC_ENGINE_TAG` per-environment if you want the footer badge to differ between Preview/Production builds.
- Health badge: [![Production health](https://img.shields.io/website?url=https%3A%2F%2Fapp-article6-qpfr5uh8q-fredillys-projects.vercel.app%2Fapi%2Fhealth&label=Health)](https://app-article6-qpfr5uh8q-fredillys-projects.vercel.app/api/health)

### Preview protection & bypass cookie

If Vercel Preview Protection is enabled, mint a bypass cookie once per session and reuse it for subsequent API calls. Replace the placeholders below with your deployment URL and the configured `VERCEL_PROTECTION_BYPASS` secret:

```bash
DOMAIN=https://<project>.vercel.app
BYPASS_SECRET=<vercel-protection-bypass-secret>

# 1. Exchange the header for the signed cookie (saved to bypass.cookies).
curl -sS -D - -o /dev/null \
  -H "x-vercel-protection-bypass: ${BYPASS_SECRET}" \
  -c bypass.cookies \
  "${DOMAIN}/api/health"

# 2. Reuse the cookie for subsequent requests without sending the header again.
curl -sS -b bypass.cookies \
  -H "Content-Type: application/json" \
  -d '{"query":"hello world"}' \
  "${DOMAIN}/api/query"

# 3. The same cookie works for the UI as well.
curl -sS -b bypass.cookies "${DOMAIN}/"
```

The first request sets `__Secure-vercel-bypass` and Vercel accepts that cookie for all protected routes until it expires. You can inspect the store with `cat bypass.cookies` to verify the cookie was issued.



## Health monitoring

- `GET /api/health` returns `{ "status": "ok" | "degraded", "timestamp": iso, "engine": {...} }`. When `ENGINE_HEALTH_PATH` is defined, the route also performs that upstream check using the configured bearer header.
- Surface the status in project docs with a simple badge/text. Example:
  - `Health: https://<project>.vercel.app/api/health` &rarr; `status=ok` indicates the proxy and upstream are reachable.
- Preview deployments can reuse the bypass cookie from above before calling `/api/health` if protection is enabled.

## Metrics

- All API routes are wrapped with lightweight instrumentation that logs request counts and rolling p95 latency.
- Each request emits a line such as `[metrics] route=api/query:POST count=3 p95=120.5ms latest=85.7ms status=200`, which is visible locally and in Vercel function logs.
- Use these entries to confirm latency characteristics after deploying. The buffer keeps the most recent 200 samples per route for percentile calculations.
- Metrics are intentionally ephemeral and written to stdout only; persisting them would require an external sink (for example, shipping logs to Datadog or S3) and is deferred until we know we need historical retention.

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

## Demo surfaces

- `/` Chat landing — mobile-first chat experience with insights pane.
- `/audit` Dry-run audit workflow — upload PDFs, view anchors/hashes, check QA/QC.
- `/manifest` Searchable manifest — live health badge, tag-aware URLs, clipboard hashes, JSON export, and cross-version diffs on rule cards.
- `/registry/mock` Mock issuance — preview dummy tCO₂e issuance and balances for investor storytelling.

Implementation notes:

- The chat experience is optimised for mobile-first use with a minimal, card-based layout. On small screens the insights pane collapses behind the “Toggle insights” button; larger displays show messages and rule cards side-by-side.
- Result cards surface `section_title`, the matched excerpt, score badge, identifiers, references, and methodology chips (id + version) when available. Identical snippets are grouped automatically; expand a group to inspect every variant while retaining provenance (`id`, `refs`, `sha256`, methodology metadata). Engines returning `section_title`/`text` automatically populate the card header and body.
- Demo mode (`ENGINE_ADAPTER=demo`) produces meaningful preview cards so the interface stays demonstrable without the remote engine.

## Definition of done

Every release should satisfy the following UI checks before shipping:

- `/api/query` responds with a `200` payload that includes `results` (use the preview bypass cookie if protection is enabled).
- `/audit` loads (with `NEXT_PUBLIC_ENABLE_AUDIT=true`) and every surfaced number links to provenance — anchors resolve to the PDF viewer, hashes render, and the QA/QC checklist toggles.
- The health badge in this README renders `status=ok` for the current deployment.
- Lint (`npm run lint`) and tests (`npm run test`) pass using Node 20 (`.nvmrc`).

## Definition of done

Every release should satisfy the following UI checks before shipping:

- `/api/query` responds with a `200` payload that includes `results` (use the preview bypass cookie if protection is enabled).
- `/audit` loads (with `NEXT_PUBLIC_ENABLE_AUDIT=true`) and every surfaced number links to provenance — anchors resolve to the PDF viewer, hashes render, and the QA/QC checklist toggles.
- The health badge in this README renders `status=ok` for the current deployment.
- Lint (`npm run lint`) and tests (`npm run test`) pass using Node 20 (`.nvmrc`).
