# Manifest behavior and health indicators

## Engine modes
- **static**: default when `ENGINE_URL` is not set. All manifest responses are served from the bundled `public/manifest/index.json` dataset. The health endpoint reports `engineUrl` as `static` in this mode.
- **engine**: enabled when `ENGINE_URL` is defined (or `ENGINE_ADAPTER` is `remote`). Requests proxy to the external engine and enrich responses with local manifest data. The health payload surfaces the configured engine base URL.

## `/api/manifest` query parameters
- `?all=1` forces the route to return the full manifest without filtering.
- Without `?all=1`, the route treats the `q` search parameter as a free-form filter and, if no results match, it falls back to the full manifest (`all=1`).

## Caching directives
- Both `/api/manifest` and `/api/manifest/health` export `revalidate = 0` and `dynamic = 'force-dynamic'` to disable Next.js static caching.
- Internal fetches (manifest lookups and the health probe) explicitly use `{ cache: 'no-store' }` to guarantee fresh reads.

## API fallback chain
1. Try the remote engine manifest when running in engine mode.
2. If the remote request fails or returns an unexpected payload, log the error and fall back to the static manifest bundle.
3. When filtering (`q` without `all=1`), return the filtered list; otherwise serve all entries.

## CI guardrails
- Automated checks should ensure `/api/manifest?all=1` returns an array with a minimum population (current threshold: > 0 items in unit tests, higher thresholds may be enforced in environment-specific guards).
- Fail builds if the manifest endpoint returns too few results or malformed responses.

## Health endpoint and UI badge
- `/api/manifest/health` reuses the same data source as `/api/manifest?all=1`, exposing `{ count, updatedAt, engineUrl }`.
- The footer badge fetches the health payload client-side with `cache: 'no-store'` and renders `Manifest: {count} · {hh:mm}`. When data is unavailable it displays `Manifest: —`.
