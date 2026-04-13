# Project Verification

Status is sourced from `docs/roadmaps/project-verification/phase-status.json`; docs must not drift.

Goal: turn per-rule verification into per-project verification so a VVB can run one complete methodology check and produce a review-ready pack — the shortest path to a defensible $5K/verification offer.

## Product narrative

The app today can verify individual rules: pick a rule, link AOI, search satellite evidence, reconcile, finalize. This is strong per-rule work. But a VVB doesn't sell per-rule checks. They sell per-project verifications: "verify this Malawi Liwonde REDD+ project against AR-ACM0003."

The missing layer is project-level aggregation: collect N rule reviews into one verification, add document evidence alongside satellite, produce a single review-ready output.

## Current focus

- Add project-level wrapper that collects rule reviews into one verification
- Upgrade document intake beyond satellite-only evidence
- Make the review PDF something a VVB can hand to their client
- Prepare for Verra VM0007 rules (coming from article6-methodologies)

## Not active now

- Full automated claim extraction from documents (manual mapping first)
- Quantitative carbon calculation engine (track as future phase)
- Multi-methodology cross-referencing
- Team collaboration / approval workflows

## Always-optimizing pillars

1) Methodology-first workflow: requirements drive verification, not satellite browsing
2) Audit-grade provenance: every judgment traceable to source
3) Reviewer-ready output: exports a VVB can submit or defend
4) Deterministic: same inputs produce identical outputs

## North Star KPIs

- Rules verified per project
  - Definition: % of methodology rules with a completed review in a project verification
  - Measurement: project rule coverage / total rules in methodology
  - Visible in: project verification dashboard

- Evidence coverage ratio
  - Definition: % of rules with linked evidence (satellite + document)
  - Measurement: trace index coverage
  - Visible in: project verification header

- Verification pack completeness
  - Definition: does the exported pack have coverage matrix, evidence inventory, gap list, and draft opinion?
  - Measurement: export validation checklist
  - Visible in: export download page

- Verifier minutes per project
  - Definition: median time from project creation to finalized verification
  - Measurement: audit trail timestamps
  - Visible in: project history

## PV1 — Project-level wrapper

Objective: create a "project verification" object that collects multiple rule reviews into one cohesive verification.

### Key changes
- Add project model: method + version + project name + AOI + created/finalized timestamps
- Project view shows all rules in the methodology with their review status
- Coverage summary: X/Y rules verified, Z rules with evidence linked, N gaps
- Finalizing a project snapshots all rule reviews into one immutable artifact

### Visible UI change to look for
- New "Projects" page listing all verifications
- Each project shows method, coverage percentage, status (in-progress / finalized)

### Acceptance
- Can create a project tied to a specific methodology version
- Project view shows all rules with review status
- Can finalize a project, producing a combined snapshot

## PV2 — Document evidence intake

Objective: accept PDD and monitoring report uploads as first-class evidence alongside satellite imagery.

### Key changes
- Upload UI for PDF/DOCX documents
- Documents appear in evidence inventory with type label (PDD, monitoring report, workbook)
- Manual claim-to-rule mapping: reviewer links document sections to specific rules
- Document evidence shows up in requirement coverage alongside STAC evidence

### Visible UI change to look for
- Evidence inventory shows both satellite items and uploaded documents
- Rule detail view shows linked document fragments with page/section references

### Acceptance
- Can upload a PDF and see it in the evidence inventory
- Can link a document section to a specific rule
- Document links appear in coverage reconciliation

## PV3 — Verification pack PDF

Objective: produce a review-ready PDF that a VVB lead reviewer can hand to their team or client.

### Key changes
- Branded cover page with project name, method, date, verifier
- Requirement coverage matrix: every rule with status (verified / gap / not-checked)
- Evidence inventory table: all linked evidence with type, source, hash
- Gap summary: rules with missing or weak evidence, severity
- Draft verification opinion: narrative conclusion based on coverage
- Provenance appendix: commit hash, timestamps, export hash

### Visible UI change to look for
- Download button produces a multi-page PDF, not a plain-text summary
- PDF has tables, headers, page numbers

### Acceptance
- PDF includes all five sections (cover, coverage matrix, evidence inventory, gaps, opinion)
- PDF is downloadable from the project view
- PDF hash is recorded in the audit trail

## PV4 — Verra methodology support (upstream dependency)

Objective: wire the app to use Verra VM0007 rules once encoded in article6-methodologies.

### Key changes
- App loads VM0007 rules from the methodology pack
- Project verification works with VM0007 same as UNFCCC methods
- Methodology picker shows Verra methods as first-class options

### Visible UI change to look for
- Methodology browser shows Verra AFOLU methods alongside UNFCCC
- Can create a VM0007 project verification

### Acceptance
- VM0007 project verification flows end-to-end: create project, review rules, link evidence, finalize, export PDF

## PV5 — End-to-end demo case

Objective: one complete Verra forestry verification that proves the product works.

### Key changes
- Create synthetic or anonymized VM0007 project data (PDD, monitoring report, AOI)
- Run full project verification: all rules, satellite + document evidence
- Generate verification pack PDF
- Publish as demo case on the marketing site

### Visible UI change to look for
- Demo link on app.article6.org homepage
- "See a live verification" button opens a pre-populated project

### Acceptance
- One complete VM0007 verification with all rules reviewed
- PDF export is review-ready quality
- Demo is publicly accessible

## Delivery constraints

- Do not break existing per-rule verification workflow
- Keep the methodology repo as canonical source for covered methods
- Document intake is manual mapping first; automated extraction is a future phase
- PDF generation uses existing infrastructure (wkhtmltopdf or hand-built PDF)
