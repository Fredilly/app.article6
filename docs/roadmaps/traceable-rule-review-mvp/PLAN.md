# Traceable Rule Review MVP

SSOT: `docs/roadmaps/traceable-rule-review-mvp/phase-status.json`

## Repo boundary

This roadmap owns **UI, workflow, persistence, and export execution**. It does NOT own methodology semantics, canonical rule contracts, or schema definitions. That is the methodologies repo: [traceable-rule-review-mvp](https://github.com/Fredilly/article6-methodologies/tree/main/docs/roadmaps/traceable-rule-review-mvp).

## Goal

Turn the current methodology/checklist flow into a traceable rule review workspace. The product center is the **rule review record** — a defensible, auditable decision on each methodology rule with status, rationale, evidence reference, and provenance.

## How existing pieces fit

| Piece | Where it lives | Role in this roadmap |
|-------|---------------|---------------------|
| Methods | Manifest, `rules.json` / `rules.rich.json` | Supply rule text, type, tags, section anchors to review panel |
| Complex methods | Version lineage (RC-S5) | Review panel shows version context |
| AOI | `proofMap/aoi.ts`, `proofMap/aoiApply.ts` | Scope STAC searches and evidence to project area |
| STAC | `api/stac/search`, `lib/stac/normalizeStacItems` | Provide satellite support facts for eligible rules |
| Projects | `app/projects/`, `api/projects/` | Container for verification; holds all rule reviews |
| Verification packs | `exports/auditPack.ts`, `lib/export/buildProvenanceTxt.ts` | Export target — review records feed into the pack |
| Quick Check | `lib/chat/quickCheck*.ts` | Entry point for ad-hoc checks; review panel is the structured upgrade |

## Priority

truthfulness > defensibility > clean repo boundaries > UX polish

## PR body standard

For every PR related to this roadmap:

```
Roadmap: traceable-rule-review-mvp
Roadmap-Phase: <phase-id>
SSOT: docs/roadmaps/traceable-rule-review-mvp/phase-status.json
```

## Phases

### Phase 0 — Roadmap Contract Freeze

Lock the roadmap, phase sequence, repo boundaries, and SSOT conventions before any implementation begins.

- Both repos contain matching phase-status.json with identical phase IDs, titles, and order
- SSOT markers in PLAN.md and ROADMAP.md
- PR body standard documented
- Issue standard documented
- Phase-state discipline documented
- No parallel roadmap files for this stream

### Phase 1 — Rule Review Record

Build the core object: a traceable review record attached to every rule in a project.

- Clicking a rule opens an inline review panel (not modal)
- Panel: full rule text, source anchor, status, rationale, support reference, evidence link, provenance
- Status: Pending / Verified / Not Verified / Needs Follow-up
- Validation: non-pending requires rationale + support reference
- Reviews persist via API
- Reserved STAC evidence area (empty placeholder)

### Phase 2 — Defensible Verification

Every review decision traceable by a third party.

- Evidence attachment (file upload or URL link) per rule review
- Audit trail: all status changes logged with who/when/what
- Blocking gate: finalize blocked until all rules reviewed
- Review progress: X of Y rules, % verified, open items

### Phase 3 — AOI / STAC Support Facts

Satellite rules get automatic STAC support. AOI scopes evidence.

- Rules tagged `monitoring` auto-trigger STAC search
- STAC panel: AOI overlap, temporal coverage, cloud stats, top 10 scenes
- AOI from project scope feeds search
- STAC populates the reserved area from Phase 1
- Clear labeling: "Supporting data — reviewer must assess sufficiency"

### Phase 4 — Document and Workbook Support

Upload project documents. Extract structured facts for review support.

- Document upload: PDF, store in project
- Text extraction from uploaded PDFs
- Workbook ingestion: baseline/removals/leakage spreadsheets
- Extracted facts available in review panel as support references

### Phase 5 — Method Completeness (Target Methods)

Ensure enough methodologies are encoded and complete for pilot demos.

- AR-ACM0003 v02-0 fully reviewable (all rules, all sections)
- At least one agriculture methodology fully reviewable
- Methodology completeness indicator: X of Y rules reviewed
- Methodology switching works seamlessly

### Phase 6 — Exportable Verification Output

One-click export: what VVBs pay for.

- PDF: all rule reviews, status, rationale, evidence, provenance
- JSON: machine-readable verification snapshot (schema-validated)
- Provenance chain: full who/when/what
- Source anchors preserved in export
- Project-level synthesis: aggregate all reviews into one opinion

### Phase 7 — Pilot-Ready VVB Workflow

First paid pilot. Real methodology verification with an external VVB or project developer.

- Verification opinion: aggregate all rule reviews into one document
- Workbook auto-calculations (baseline, removals, leakage)
- Multi-methodology support
- Observer access (view, don't edit)
- Pricing positioned at $1,500-2,500 for first 5 pilots

## What this excludes

- Enterprise SSO / multi-tenant
- AI auto-verification
- Non-Article 6 methodologies
- Methodology semantics (owned by methodologies repo)
- Schema definitions (owned by methodologies repo)
