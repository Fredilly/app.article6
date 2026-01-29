# Demo Tickets

## Severity
- Blocker: demo cannot proceed or core flow is broken.
- High: major flow broken or data loss risk.
- Medium: partial flow broken, workaround exists.
- Low: minor UX issues or polish gaps.

## Required fields (every ticket)
- severity
- surface
- observed
- expected
- repro (at least one step)
- artifacts (optional but recommended)

## 15-second logging workflow
1) Repro quickly.
2) Run `npm run ticket:new -- --severity ...` with short, factual text.
3) Add artifacts (screenshot, JSON export) if you have them.

Example:
```
npm run ticket:new -- \
  --severity high \
  --surface "Verify > AOI upload" \
  --observed "Multi-feature upload proceeds without warning." \
  --expected "Upload rejects multi-feature AOI with clear error." \
  --repro "Open Verify" \
  --repro "Upload a FeatureCollection with two features" \
  --artifact "aoi-multi.geojson" \
  --artifact "screenshot.png"
```

## Artifacts
- Screenshots: `.png` or `.jpg`
- Exports: `.json` (e.g., `run.json`, `audit-pack.json`)
- Use short filenames and list them via `--artifact`.
