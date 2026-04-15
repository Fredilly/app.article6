# Verifiable Review Record

Status is sourced from `docs/roadmaps/verifiable-review-record/phase-status.json`.

## Goal

Ship a paid verification service ($1.5-2.5K/pilot, scaling to $5K) where VVBs can load a methodology, review every rule with traceable rationale and evidence, and export a defensible verification summary. The product unit is not the rule card — it's the **traceable review record**.

## What we're building

A methodology-aware review workspace with traceable rule-by-rule support and full provenance. Built for VVBs and Article 6 focal points who need to move from weeks of manual review to hours with an auditable trail.

Do not call this a checklist.

## What shipped already

Quick Check + Methods + Projects + per-rule verify + STAC runs. Solid foundation, but feels like a demo, not a paid service. The gap: no rationale capture, no evidence reference, no provenance on review decisions.

## Pricing ladder

- First 5 pilots: $1,500-2,500 per full methodology verification
- After 3 case studies showing 60-70% time savings: raise to $5K
- VVBs charge $50-100K/engagement — we save them weeks

## Sequencing

Phases are strict. Each phase builds on the previous. Do not skip ahead.

Methodology repo (article6-methodologies) runs in parallel — see [complete-methodology-coverage](https://github.com/Fredilly/article6-methodologies/tree/main/docs/roadmaps/complete-methodology-coverage) roadmap for encoding work.

---

## VRR-1 — Rule Review Surface (Week 1)

### Goal

Build the monetizable object: a traceable review record attached to every rule.

### Deliverables

- Clicking any rule card expands to show a review panel (inline, not modal)
- Panel shows: full rule text, methodology source anchor, status selector, rationale field, support reference field, evidence link field, provenance footer, reserved evidence area
- Status cannot be set to Verified/Not Verified without rationale + support reference (validation)
- Reviews persist in localStorage (Phase 2 migrates to API)

### Key changes

- New `src/components/verify/RuleReviewPanel.tsx` — the review surface
- New `src/lib/verify/reviewStore.ts` — localStorage persistence
- New `src/lib/verify/reviewValidation.ts` — validation logic
- Modify `src/components/RuleCard.tsx` — add expand toggle + render panel
- Tests for validation logic

### Visible UI change to look for

Clicking a rule opens or reveals a proper review panel with rule text, rationale, and evidence fields — not just a status dropdown.

### Acceptance criteria

- [ ] Rule text from `rules.json` is displayed in full
- [ ] Section/source anchor shown when available
- [ ] Status: Pending / Verified / Not Verified / Needs Follow-up
- [ ] Rationale required for non-pending status
- [ ] Support reference required for non-pending status
- [ ] Evidence link optional
- [ ] Provenance footer: reviewer, timestamp
- [ ] Save disabled until validation passes
- [ ] Review persists across page reloads
- [ ] Reserved evidence panel placeholder visible

---

## VRR-2 — Defensibility Layer (Week 2)

### Goal

Reviews become defensible. Enforce traceability on every decision.

### Deliverables

- Backend review persistence (API endpoints, not just localStorage)
- Evidence attachment (upload file or link URL)
- STAC auto-support for satellite-relevant rules only (AOI overlap, temporal coverage, cloud stats, scene list)
- Review audit trail: who changed what, when
- Blocking gate: cannot finalize project without all rules reviewed

### Key changes

- New `src/app/api/reviews/route.ts` — CRUD for reviews
- New `src/app/api/reviews/[ruleId]/route.ts` — single review endpoint
- STAC integration in review panel (only for rules tagged `satellite`, `remote-sensing`, or `monitoring`)
- Modify `RuleReviewPanel.tsx` — add evidence upload, STAC facts display
- New `src/components/verify/EvidenceAttachment.tsx` — upload/link component
- Review summary aggregation: show % reviewed, % verified, open items

### Visible UI change to look for

STAC facts auto-populate for satellite rules. Evidence can be attached. Review progress is visible.

### Acceptance criteria

- [ ] Reviews persist server-side via API
- [ ] File upload works (PDF, images, docs)
- [ ] URL evidence links work
- [ ] STAC facts appear for satellite-relevant rules automatically
- [ ] STAC shows: AOI overlap, temporal coverage, cloud stats, scene IDs
- [ ] STAC is support facts, NOT auto-verification
- [ ] Review audit trail records all status changes with timestamps
- [ ] Project finalize blocked until all rules have status + rationale + support

---

## VRR-3 — Full Methodology Coverage + Export (Week 3)

### Goal

All AR-ACM0003 rules covered. One-click export produces a verification summary.

### Deliverables

- All rules from AR-ACM0003 v02-0 loadable and reviewable (not just R-1-0001)
- Methodology completeness indicator: "12 of 15 rules reviewed"
- PDF export: Verification Summary with all review records
- JSON export: machine-readable verification snapshot
- Document ingestion MVP: upload PDD fragments, extract basic facts

### Key changes

- Ensure manifest loads all rules from methodology packs
- New `src/lib/export/verificationSummary.ts` — build summary from reviews
- PDF generation (wkhtmltopdf or raw HTML — see existing pdf/ patterns)
- New `src/components/verify/ExportButton.tsx`
- Document upload + basic text extraction (Phase 4 adds structured extraction)

### Visible UI change to look for

"Export Verification Summary" button produces a PDF with every rule, its review status, rationale, and evidence references.

### Acceptance criteria

- [ ] All AR-ACM0003 v02-0 rules visible and reviewable
- [ ] Methodology completeness: X of Y rules reviewed
- [ ] PDF export contains: methodology info, every rule with status/rationale/support, provenance
- [ ] JSON export passes schema validation
- [ ] Document upload accepts PDFs, stores them
- [ ] Basic text extraction from uploaded PDFs available in review panel

---

## VRR-4 — Pilot-Ready MVP (Weeks 4-5)

### Goal

First paid pilot. Real methodology verification with an external VVB or project developer.

### Deliverables

- Project-level synthesis: aggregate all rule reviews into one "Article 6 Verification Opinion"
- Synthetic workbook → auto calculations (baseline, removals, leakage)
- Multi-methodology support: AR-ACM0003 + at least one agriculture methodology
- Role-based access: reviewer vs. observer views
- Pilot pricing page or onboarding flow

### Key changes

- New `src/lib/verify/verificationOpinion.ts` — project-level synthesis
- Workbook calculation engine (baseline, uplift, leakage formulas)
- Multi-methodology routing (load correct rules.json per methodology)
- Simple auth or share-link for observer access
- Landing page / pricing messaging update

### Visible UI change to look for

"Generate Verification Opinion" produces a single document covering the entire project. Multiple methodologies work.

### Acceptance criteria

- [ ] Verification Opinion report covers all reviewed rules
- [ ] Workbook calculations produce correct baseline/removals/leakage
- [ ] At least 2 methodologies loadable (AR-ACM0003 + agriculture)
- [ ] Observer can view but not edit reviews
- [ ] At least 1 external pilot completed
- [ ] Pricing positioned at $1,500-2,500 for first 5 pilots

---

## Always-optimizing

1. **Truthfulness > defensibility > UX polish** — in that order
2. A rule is not meaningfully verified without: status + rationale + support + provenance
3. STAC is support facts, never auto-verification
4. Every review decision must be traceable by a third party
5. Ship fast, iterate on feedback — do not over-engineer before pilots

## What this roadmap deliberately excludes

- Enterprise SSO / multi-tenant (post-revenue)
- AI auto-verification (post-moat)
- Mobile app (desktop-first for reviewers)
- Non-Article 6 methodologies (stay focused)
- Blockchain provenance (nice-to-have, not required for $5K)
