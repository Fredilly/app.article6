# Traceable Rule Review MVP

Status: `docs/roadmaps/traceable-rule-review-mvp/phase-status.json`.

## Goal

Turn the current methodology/checklist flow into a traceable rule review workspace. The product center is the **rule review record** — a defensible, auditable decision on each methodology rule with status, rationale, evidence reference, and provenance.

## Repo boundary

This roadmap owns **UI, workflow, persistence, and export execution**. It does NOT own methodology semantics, canonical rule contracts, or schema definitions. That is the methodologies repo.

Cross-reference: [methodologies roadmap](https://github.com/Fredilly/article6-methodologies/tree/main/docs/roadmaps/traceable-rule-review-mvp).

## How existing pieces fit

| Piece | Current state | Role in this roadmap |
|-------|--------------|---------------------|
| **Methods** | Manifest loads methodology packs (rules.json, rules.rich.json) via `/manifest` | Supply rule text, type, tags, section anchors to review panel |
| **Complex methods** | Version lineage, diff support (RC-S5) | Review panel shows version context; reviewers see what changed between versions |
| **AOI** | proofMap/aoi.ts, AOI apply + bbox | Scope STAC searches and evidence to project area |
| **STAC** | `/api/stac/search`, normalizeStacItems, extractStacArtifacts | Provide satellite support facts for eligible rules (not auto-verify) |
| **Projects** | Project CRUD, method-rules API, project detail page | Container for a verification; holds all rule reviews for a methodology |
| **Verification packs** | auditPack, buildAuditPack, verification snapshot | Export target — review records feed into the pack |
| **Quick Check** | Chat-based quick check flow | Entry point for ad-hoc rule checks; review panel is the structured upgrade |

## Priority

truthfulness > defensibility > clean repo boundaries > UX polish

## Phases

All five phases are strict. Each builds on the previous. Phase IDs and titles match the methodologies repo exactly.

---

## T-1 — Rule Review Record

### Goal

Build the core object: a traceable review record attached to every rule in a project.

### Deliverables

- Clicking a rule in the project view opens an inline review panel (not modal)
- Panel shows: full rule text, methodology source anchor (from `rules.rich.json` refs), status selector, rationale field, support reference field, evidence link field, provenance footer
- Status: Pending / Verified / Not Verified / Needs Follow-up
- Validation: Verified/Not Verified requires rationale + support reference (non-empty)
- Reviews persist via API endpoints (not just localStorage)
- Reserved placeholder area for STAC support facts (empty, dashed border)

### Existing pieces used

- `rules.json` / `rules.rich.json` — rule text, type, tags, section refs
- `RuleCard.tsx` — entry point, expand to review panel
- `projects/[id]/page.tsx` — project context
- `api/projects/method-rules/route.ts` — rule loading

### Files to create/modify

- `src/components/verify/RuleReviewPanel.tsx` (new)
- `src/app/api/reviews/route.ts` (new — CRUD)
- `src/app/api/reviews/[ruleId]/route.ts` (new)
- `src/lib/verify/reviewStore.ts` (new)
- `src/lib/verify/reviewValidation.ts` (new)
- `src/components/RuleCard.tsx` (modify — expand toggle)

### Visible UI change

Clicking a rule opens a review panel with rule text, rationale, and evidence fields — not just a status dropdown.

### Acceptance criteria

- [ ] Rule text from methodology data displayed in full
- [ ] Section/source anchor shown when available
- [ ] Status selector with 4 states
- [ ] Rationale required for non-pending
- [ ] Support reference required for non-pending
- [ ] Evidence link optional
- [ ] Provenance footer (reviewer, timestamp)
- [ ] Save disabled until validation passes
- [ ] Reviews persist via API across reloads
- [ ] Reserved STAC evidence area visible

---

## T-2 — Defensible Verification

### Goal

Every review decision is traceable by a third party. Reviews become defensible audit artifacts.

### Deliverables

- Evidence attachment: upload file or link URL per rule review
- Review audit trail: all status changes logged with who/when/what
- Blocking gate: cannot finalize project until all rules have status + rationale + support
- Review progress indicator: X of Y rules reviewed, % verified, open items
- Reviewer identity captured (from session or manual input)

### Existing pieces used

- `EvidenceWorkflowStepper.tsx` — evidence attachment patterns
- `lib/evidence/inventory.ts` — evidence tracking
- `lib/verify/runState.ts` — run state management
- `ProofCoverageChip.tsx` — coverage display patterns

### Visible UI change

Evidence can be attached to reviews. Progress bar shows review completion. Finalize is blocked until complete.

### Acceptance criteria

- [ ] File upload works (PDF, images, docs) per rule
- [ ] URL evidence links stored and displayed
- [ ] Audit trail: every status change logged with timestamp + reviewer
- [ ] Project finalize blocked until all rules have status + rationale + support
- [ ] Review progress visible (X/Y, %, open items list)

---

## T-3 — STAC / AOI Support Facts

### Goal

Satellite-relevant rules get automatic STAC support facts. AOI scopes the evidence. STAC is support, not auto-verification.

### Deliverables

- Rules tagged `monitoring`, `satellite`, or `remote-sensing` auto-trigger STAC search
- STAC panel shows: AOI overlap confirmation, temporal coverage, cloud stats, scene list (top 10)
- AOI from project scope feeds into STAC search
- STAC facts populate the reserved area from T-1 (no UI redesign)
- Clear labeling: "Supporting data — reviewer must assess sufficiency"

### Existing pieces used

- `api/stac/search/route.ts` — STAC search
- `lib/stac/normalizeStacItems.ts` — item normalization
- `lib/runs/selectLatestOkStacRunForActiveAoi.ts` — AOI-scoped runs
- `proofMap/aoi.ts` — AOI geometry

### Visible UI change

Satellite rules auto-show STAC scene data. AOI overlap is visible. Non-satellite rules show the reserved area as empty.

### Acceptance criteria

- [ ] STAC facts auto-populate for eligible rules only
- [ ] AOI overlap shown
- [ ] Temporal coverage displayed
- [ ] Cloud stats shown
- [ ] Top 10 scene IDs listed
- [ ] Non-satellite rules show empty reserved area (no STAC)
- [ ] Clear "supporting data" labeling — not auto-verified

---

## T-4 — Document and Workbook Support

### Goal

Upload project documents (PDD, monitoring reports, workbooks). Extract structured facts to support rule reviews.

### Deliverables

- Document upload: accept PDF, store in project
- Text extraction: extract text from uploaded PDFs
- Workbook ingestion: parse baseline/removals/leakage calculation spreadsheets
- Fact surfacing: extracted facts available in review panel as potential support references
- Quick Check integration: use document text as input for quick check flows

### Existing pieces used

- `lib/evidence/workbook.ts` — workbook parsing
- `lib/chat/quickCheckPdfExtractor.ts` — PDF text extraction
- `lib/chat/quickCheckResolver.ts` — resolution logic
- `lib/intake/storage.ts` — file storage patterns

### Visible UI change

Documents can be uploaded at project level. Extracted text and workbook values appear in review panel as suggestions.

### Acceptance criteria

- [ ] PDF upload at project level works
- [ ] Text extracted from uploaded PDFs
- [ ] Workbook (xlsx) parsing produces baseline/removals/leakage values
- [ ] Extracted facts visible in review panel
- [ ] Quick Check can use uploaded document text

---

## T-5 — Exportable Verification Output

### Goal

One-click export produces a complete verification opinion document. This is what VVBs pay for.

### Deliverables

- PDF export: "Verification Summary" with all rule reviews, status, rationale, evidence references, provenance
- JSON export: machine-readable verification snapshot (schema-validated)
- Provenance trail: full who/when/what chain in export
- Methodology context: rule source anchors preserved in export
- Project-level synthesis: aggregate all rule reviews into one opinion

### Existing pieces used

- `exports/auditPack.ts` — audit pack generation
- `lib/export/buildProvenanceTxt.ts` — provenance text
- `lib/export/assertVerificationSnapshotInvariants.ts` — snapshot validation
- `lib/verify/buildReviewSummary.ts` — review summary building
- `lib/pdf/metadata.ts` — PDF metadata

### Visible UI change

"Export Verification Summary" button produces a PDF covering every rule with full traceability. JSON export also available.

### Acceptance criteria

- [ ] PDF contains: methodology info, every rule with status/rationale/support, provenance chain
- [ ] JSON export passes schema validation
- [ ] Provenance trail includes reviewer, timestamp, commit hash
- [ ] Source anchors preserved in export
- [ ] Project-level synthesis aggregates all reviews

---

## What this roadmap excludes

- Enterprise SSO / multi-tenant (post-revenue)
- AI auto-verification (post-moat)
- Non-Article 6 methodologies
- Blockchain provenance
- Methodology semantics (owned by methodologies repo)
- Schema definitions (owned by methodologies repo)
