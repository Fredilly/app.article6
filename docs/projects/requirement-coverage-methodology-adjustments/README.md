# Requirement Coverage Methodology Adjustments

This note exists to keep RC3 and RC4 ownership explicit.

## Repo boundary

`app.article6` owns:
- workbook intake into evidence inventory and reconciliation
- monitoring report intake into evidence inventory and reconciliation
- linking evidence to requirement rows
- reconciliation state, verification state, exports, and UI behavior
- consumer-side loaders and compatibility tests for upstream methodology canon

`article6-methodologies` owns:
- canonical methodology artifacts and schemas
- `rules.json`, `sections.json`, `rules.rich.json`, `sections.rich.json`
- rich-field additions to methodology canon for covered methods
- sample methodology proving artifacts for canon changes

## Rule for RC3 and RC4

RC3 and RC4 are app workflow phases, but app is not the source of truth for methodology canon.

If RC3 or RC4 needs new `rules.rich` or `sections.rich` fields:
1. open the canon/schema change upstream in `article6-methodologies`
2. sync the methodology pack into `app.article6`
3. update only app consumer support, runtime behavior, and compatibility tests here

## App-side sync policy

Files under `public/methodologies/` are treated as synced vendor input, not hand-edited product code.

Normal app PRs must not edit:
- `public/methodologies/**`
- `public/_provenance/methodologies_PROVENANCE.json`
- mirrored rich schema files in `schemas/artifacts/` or `src/integrity/schemas/`

Approved sync path for vendored methodology pack updates:
- set `ALLOW_METHODOLOGY_SYNC=1`, or
- use a sync branch prefix:
  - `sync/methodologies-`
  - `chore/sync-methodologies-`
  - `chore/methodologies-sync-`

Schema changes are still upstream-owned even on sync branches.
