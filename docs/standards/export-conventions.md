# Export Conventions

## Purpose

Define cross-export conventions for section ordering, terminology, and determinism. All export outputs must follow this convention unless explicitly documented otherwise.

## Scope

This convention applies to the five export outputs:
- Standard PDF (`/api/projects/[id]/export-pdf`)
- Premium PDF (`/api/projects/[id]/export-premium?format=pdf`)
- Premium ZIP / Verification Pack (`/api/projects/[id]/export-premium?format=zip`)
- Evidence Snapshot (JSON export)
- VVB Workpaper (audit pack route)
- Client Readiness Report

## Canonical Section Order

All exports must arrange sections in the following canonical order:

| Order | Section ID          | Section Title                | Present in               |
|-------|---------------------|------------------------------|--------------------------|
| 1     | `report-status`     | Report Status                | Standard PDF, Premium    |
| 2     | `project-info`      | Project Information          | Standard PDF, Premium    |
| 3     | `scope`             | Scope / Methodology Basis    | Standard PDF, Premium    |
| 4     | `evidence-reviewed` | Evidence Reviewed            | Standard PDF, Premium    |
| 5     | `findings-summary`  | Findings Summary             | Standard PDF             |
| 6     | `requirement-review`| Requirement Review           | Standard PDF, Premium    |
| 7     | `evidence-appendix` | Evidence Appendix            | Standard PDF             |
| 8     | `reviewer-decisions`| Reviewer Decisions           | Premium                  |
| 9     | `limitations`       | Limitations and Disclaimers  | Standard PDF, Premium    |
| 10    | `provenance`        | Provenance and Export Metadata | Standard PDF, Premium  |
| 11    | `coverage-matrix`   | Coverage Matrix              | Premium                  |

### Registry-specific overrides

When the `project.registry` is known, the sections may be relabeled to match registry conventions, but the order must remain canonical. For example:

- **UNFCCC**: Section 1 → "REPORT STATUS", Section 2 → "PROJECT AND METHODOLOGY IDENTIFICATION", Section 3 → "VERIFICATION SCOPE"
- **Verra / Gold Standard / Generic**: Section 1 → "REPORT STATUS", Section 2 → "PROJECT AND STANDARD", Section 3 → "METHODOLOGY BASIS"

This maps the canonical order to registry-specific terminology while preserving structure.

### Registry-specific section mapping

| Canonical ID            | UNFCCC label                     | Generic / Verra / GS label    | Premium label            |
|-------------------------|----------------------------------|-------------------------------|--------------------------|
| `report-status`         | REPORT STATUS                    | REPORT STATUS                 | Executive Summary        |
| `project-info`          | PROJECT AND METHODOLOGY IDENTIFICATION | PROJECT AND STANDARD      | Project Information      |
| `scope`                 | VERIFICATION SCOPE               | METHODOLOGY BASIS             | Methodology Sections     |
| `evidence-reviewed`     | MEANS OF VERIFICATION            | EVIDENCE REVIEWED             | Evidence Inventory       |
| `findings-summary`      | FINDINGS SUMMARY                 | (merged into REQUIREMENT REVIEW) | Extracted Facts      |
| `requirement-review`    | REQUIREMENT FINDINGS             | REQUIREMENT REVIEW             | Reviewer Decisions       |
| `evidence-appendix`     | EVIDENCE APPENDIX                | (omitted for generic)          | (omitted for premium)    |
| `reviewer-decisions`    | (omitted for UNFCCC)             | REVIEWER NOTES                 | Reviewer Decisions       |
| `limitations`           | LIMITATIONS                      | (merged into provenence section) | Limitations           |
| `provenance`            | PROVENANCE                       | PROVENANCE AND EXPORT METADATA | Provenance Chain         |
| `coverage-matrix`       | (omitted for standard)           | (omitted for standard)         | Coverage Matrix          |

### Manual review (VVB) section order

Manual review exports follow a separate convention:

| Order | Section ID          | Section Title                  |
|-------|---------------------|---------------------------------|
| 1     | `report-limitation` | Report Limitation               |
| 2     | `outcome`           | Outcome                         |
| 3     | `project-metadata`  | Project Metadata                |
| 4     | `findings-summary`  | Findings Summary                |
| 5     | `finding-details`   | Finding Details                 |
| 6     | `provenance`        | Provenance and Limitations      |

## Canonical Terminology

### Artifact naming

| Canonical term              | Also known as                  | Status          |
|-----------------------------|--------------------------------|-----------------|
| evidence fragment           | DocumentFragment, fragment     | **USE THIS**    |
| extracted fact              | fact                           | **USE THIS**    |
| candidate link              | link, evidence link            | **USE THIS**    |
| evidence inventory          | evidence register              | **USE THIS**    |
| coverage status             | reconciliation status          | **USE THIS**    |
| reviewer decision           | decision, review decision      | **USE THIS**    |
| provenance                  | metadata, audit trail          | **USE THIS**    |
| export timestamp            | export time, generated time    | **USE THIS**    |
| project locked at           | locked timestamp               | **USE THIS**    |
| evidence fragment reference | evidence ref, evidence link    | **USE THIS**    |

### Field names

| Canonical field              | Must use                       |
|------------------------------|--------------------------------|
| `exportedAt`                 | ISO-8601 timestamp of export   |
| `createdAt`                  | ISO-8601 creation timestamp    |
| `lockedAt`                   | ISO-8601 lock timestamp        |
| `generatedAt`                | ISO-8601 generation timestamp  |
| `schema_version`             | `evidence_snapshot.v1`         |
| `pipeline_version`           | semantic version               |
| `contentSha256`              | SHA-256 hex of content         |

### Labels in rendered output

| Context                      | Label                           |
|------------------------------|---------------------------------|
| Cover page timestamp         | "Generated {timestamp}"         |
| Provenance export timestamp  | "Export timestamp"              |
| Provenance locked timestamp  | "Locked"                        |
| Evidence references in findings | "Evidence references"        |

## Determinism

### Timestamp sourcing

All export timestamps must follow this precedence:

1. `exportTime` parameter (if provided by caller — allows deterministic override)
2. `project.lockedAt` (if the project is locked)
3. `project.createdAt` (fallback to creation time)
4. `'1970-01-01T00:00:00.000Z'` (last-resort fallback, never `new Date().toISOString()`)

### Schema versions

All exports must use a stable `schema_version` string that changes only when the schema changes. Current versions:

| Export              | Schema version               |
|---------------------|------------------------------|
| Standard PDF        | (no schema version header)   |
| Premium PDF         | (embedded in metadata)       |
| Premium ZIP         | `premium_export.v1`          |
| Evidence Snapshot   | `evidence_snapshot.v1`       |
| VVB Workpaper       | `vvb_workpaper.v1`           |
| Client Readiness    | `client_readiness.v1`        |

### Content hashing

Export content hashes must use SHA-256 of the canonical JSON representation of the payload (excluding the hash itself).

## Migration

### From current state

| File                              | Required change                                              |
|-----------------------------------|--------------------------------------------------------------|
| `src/lib/projects/exportPdf.ts`   | Replace `new Date().toISOString()` with project timestamp     |
| `src/lib/snapshot/export.ts`      | Replace `new Date().toISOString()` with snapshot `createdAt`  |
| `src/lib/evidence/export/pdfExporter.ts` | Replace `new Date().toISOString()` fallback with project timestamp |
| `src/lib/evidence/export/zipExporter.ts` | Verify timestamp precedence matches convention            |
| `src/lib/snapshot/builder.ts`     | `createdAt` uses current time (acceptable for a create operation) |

## Governance

- This document is the single source of truth for export conventions.
- Changes require a roadmap phase update and must be reflected in all five export outputs.
- New export outputs must follow these conventions unless explicitly exempted.
