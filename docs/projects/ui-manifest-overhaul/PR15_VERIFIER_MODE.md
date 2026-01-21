# PR15 Verifier Mode

Verifier Mode is a lightweight, URL-driven view that surfaces audit context without changing core verification logic. It adds a visible Audit Trail panel when `mode=verify` is present in the query string.

## What gets logged
- Method selection (method code + version)
- Evidence inputs (AOI/GeoJSON hash, STAC URL when available)
- Rule jumps
- Evidence feature selections
- Audit Trail export SHA256

## What this does NOT claim
- No pass/fail verdicts
- No automated compliance assertions
- No new data ingestion or derived artifacts

## 60-second demo
1) Open `/m/AR-ACM0003/v/v02-0?tab=verify&mode=verify`
2) Toggle List/Map and jump to a rule
3) Upload an AOI and run STAC search
4) Open Audit Trail → Export JSON → Copy SHA256
