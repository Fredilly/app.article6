# Export Conventions

## Purpose

This document is the SSOT for Phase 8 export standardization in `app.article6`.

It defines:
- canonical terminology
- canonical section ordering
- deterministic timestamp sourcing
- migration guidance for existing export consumers

## In Scope

The conventions apply to these export surfaces:
- Standard PDF: `/api/projects/[id]/export-pdf`
- Premium evidence export: `/api/projects/[id]/export-premium`
- Evidence snapshot export
- Verification pack / audit pack: `/api/exports/audit-pack`
- Client readiness report export
- VVB workpaper export

## Canonical Terminology

Use these terms consistently in rendered output and export metadata:

| Canonical term | Replace variants like |
|---|---|
| evidence fragment | fragment, document fragment |
| extracted fact | fact |
| candidate link | evidence link, link |
| evidence inventory | evidence register |
| coverage status | reconciliation status |
| reviewer decision | decision, review decision |
| provenance | metadata, audit trail |
| export timestamp | export time, generated time |
| project locked at | locked timestamp |
| evidence fragment reference | evidence ref, evidence link |

## Canonical Section Order

Section order is normalized per export surface in code at
`src/lib/export/conventions.ts`.

The core order is:
1. Project information
2. Evidence inventory
3. Evidence fragments
4. Extracted facts
5. Candidate links
6. Coverage matrix
7. Reviewer decisions
8. Provenance and export metadata

Rendered reports may include registry-specific or export-specific headings, but
the underlying order must stay consistent with the surface definition in code.

## Determinism

Export timestamps must use this precedence:
1. explicit `exportTime` from the caller
2. `project.lockedAt`
3. `project.createdAt`
4. `1970-01-01T00:00:00.000Z`

Do not use `new Date().toISOString()` as a fallback inside export builders.

Snapshot exports use the captured snapshot timestamp instead of wall-clock export time.

## Schema Versions

Current schema/version contracts:
- `premium_export.v1`
- `evidence_snapshot.v2`
- `article6.proof_audit_pack.v1`
- `client_readiness.v1`
- `vvb_workpaper.v1`

## Migration Path

Existing export consumers should:
1. read `exportConventions` or `export_conventions` metadata when present
2. prefer `exportedAt` / `generated_at` from the export payload over local generation time
3. treat section order as declared metadata, not inferred from file ordering
4. preserve canonical terminology in downstream renderers and importers

## Governance

- Code-level SSOT: `src/lib/export/conventions.ts`
- Documentation SSOT: this file
- Any future export surface must declare its section order and terminology through the shared conventions module
