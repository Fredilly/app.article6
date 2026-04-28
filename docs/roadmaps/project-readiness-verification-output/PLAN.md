# Project Readiness & Verification Output

SSOT: `docs/roadmaps/project-readiness-verification-output/phase-status.json`

This is the commercial sales-readiness roadmap for Article6. It folds the useful parts of the older overlapping lanes into one lane for project developer gap audits, VVB workpaper exports, public verification autopsies, white-label consultancy pilots, and rule encoding.

## Repo boundary

`app.article6` owns the workflow, UI, persistence, export execution, and public-safe packaging. It does not own methodology semantics, canonical rule contracts, or schema definitions. Those stay in the methodologies repo, with `traceable-rule-review-mvp` preserved as the technical foundation.

## Goal

Turn Article6 into a sellable pre-verification readiness system for project developers, consultancies, and VVBs without claiming formal verification, registry approval, or credit issuance.

The commercial output is:

1. A project readiness gap report for developers before VVB review.
2. A traceable draft workpaper / audit pack for VVBs.
3. A reusable public autopsy workflow for marketing and proof.
4. A repeatable rule encoding lane for new methodologies.

## Buyer outcomes

| Buyer | Outcome |
|---|---|
| Project developers | Know what is missing before paying a VVB. |
| VVBs | Receive cleaner evidence packages and traceable rule-by-rule workpapers. |
| Consultancies | Resell readiness checks under their own brand. |
| Methodology developers | Turn methods into reviewable rule/evidence contracts. |
| Public audience | See credible verification autopsies based on public documents. |

## Priority

truthfulness > client usefulness > compact UX > export polish > automation

## Non-goals

- No formal VVB opinion claims.
- No registry approval claims.
- No automatic credit issuance claims.
- No STAC auto-verification.
- No full agent platform.
- No heavy automated claim extraction before manual mapping works.
- No generic SaaS expansion before one paid readiness workflow works.
- No methodology-repo changes in this PR.

## What was folded in

The older lanes are preserved as history, but their useful pieces are folded into this roadmap instead of driving separate sequencing:

- `traceable-rule-review-mvp` remains the technical foundation.
- `requirement-coverage` contributes document intake and evidence reconciliation.
- `project-verification` contributes project-level aggregation and export framing.
- `verification-factory` contributes customer-validation and moat-export thinking.
- `phase-assurance-surface-mvp` contributes traceable evidence export and provenance discipline.

## Phases

### Phase 0 — Roadmap Consolidation

Status: next

Goal:
Collapse the useful parts of old roadmaps into one commercial roadmap.

Scope:
- Keep `traceable-rule-review-mvp` as the technical foundation.
- Fold relevant parts of `requirement-coverage`, `project-verification`, `verification-factory`, and `phase-assurance-surface-mvp`.
- Mark old overlapping lanes as archived, folded, or superseded where appropriate.
- Preserve repo boundaries:
  - `app.article6`: workflow, UI, persistence, export.
  - `article6-methodologies`: method schemas, evidence expectations, rule metadata.

Acceptance:
- One active commercial roadmap exists.
- Old lanes are not driving conflicting next steps.
- README/SUMMARY clearly identifies this roadmap as the sales-readiness lane.

### Phase 1 — PDD / Project Gap Intake

Status: planned

Goal:
Make uploaded project documents useful for project-developer readiness audits.

Scope:
- PDD upload/intake.
- Monitoring report upload/intake.
- Workbook upload/intake.
- Evidence inventory normalization.
- Page/section/fragment provenance.
- Manual fragment-to-rule linking.
- Missing/weak/present/not-applicable states.

Acceptance:
- A project file can be mapped to methodology rules.
- PDD fragments can link to one or more rule rows.
- Missing evidence is explicit, not hidden.
- Every gap has provenance or says source not supplied.

Output:
- Project evidence inventory.
- Rule-level document support map.

### Phase 2 — Method Evidence Contracts

Status: planned

Goal:
Define what each supported method expects so gaps can be detected honestly.

Repo:
`article6-methodologies`

Scope:
- Expected evidence per rule.
- PDD section expectations.
- Monitoring report expectations.
- Workbook field/calculation expectations.
- Human-judgment vs document-check vs calculable flags.
- AR-ACM0003 complete.
- At least one agriculture methodology complete.
- Encoding playbook for new methods.

Acceptance:
- AR-ACM0003 has enough expected evidence metadata for readiness scoring.
- One agriculture method has the same.
- App can distinguish missing evidence from unknown evidence expectations.
- CI proves schema compliance.

Output:
- Reviewable method packs.
- Rule encoding sprint foundation.

### Phase 3 — Readiness Gap Engine

Status: planned

Goal:
Turn project evidence + method expectations into a sellable readiness analysis.

Scope:
- Rule-level gap states:
  - present
  - weak
  - missing
  - not applicable
  - needs reviewer judgment
- Gap severity:
  - critical
  - major
  - minor
  - informational
- Evidence checklist per rule.
- Fix-it recommendation per gap.
- Reviewer override/rationale.

Acceptance:
- A developer can see why a project is not ready.
- A reviewer can override status with rationale.
- No gap is generated without a method expectation or reviewer rationale.
- Weak evidence is not presented as verified.

Output:
- Rule-level readiness matrix.
- Missing evidence checklist.
- Fix-it plan.

### Phase 4 — Client Readiness Report Export

Status: planned

Goal:
Produce the paid deliverable for project developers and consultancies.

Scope:
- PDF/HTML readiness report.
- Project summary.
- Methodology summary.
- Rule coverage matrix.
- Gap summary.
- Evidence checklist.
- Fix-it plan.
- Limitations and disclaimers.
- Technical audit pack appendix.

Acceptance:
- Report is readable by a non-technical project developer.
- Report does not claim formal verification.
- Export includes project-level synthesis.
- Export includes traceable technical appendix.
- Existing manifest/hash behavior remains intact.

Output:
- `48-hour Verification Readiness Report`
- Audit pack ZIP appendix

### Phase 5 — VVB Workpaper Export

Status: planned

Goal:
Make the same review data useful to VVBs.

Scope:
- VVB-facing draft workpaper.
- Rule review records.
- Evidence inventory.
- Reviewer notes.
- Audit trail.
- Source anchors.
- Registry-aware report sections.
- UNFCCC first.
- Verra and Gold Standard truthful fallback until supported.

Acceptance:
- VVB can inspect rule-by-rule basis.
- Draft report clearly says not a formal opinion.
- UNFCCC report is structured.
- Verra/Gold Standard do not masquerade as fully supported.

Output:
- Draft verification workpaper.
- JSON verification snapshot.
- Provenance bundle.

### Phase 6 — Public Autopsy Workflow

Status: planned

Goal:
Create proof and inbound interest from public project documents.

Scope:
- Select public PDD/project.
- Run readiness analysis.
- Redact sensitive/non-public fields.
- Generate public-safe autopsy report.
- Export screenshots / shareable summary.
- No defamatory language.
- Use “visible gaps from public documents,” not “project failed.”

Acceptance:
- One public forestry autopsy can be published.
- Report is safe to share.
- Findings are tied to public source excerpts.
- No unsupported accusation or registry conclusion.

Output:
- Forestry Verification Autopsy v1.
- Social/thread-ready summary.
- Lead magnet.

### Phase 7 — White-label Consultancy Pilot

Status: planned

Goal:
Let consultancies resell the readiness workflow.

Scope:
- Branded report cover.
- Consultancy logo/name.
- Limited hosted workspace.
- One-methodology setup.
- Export under consultancy brand.
- Clear pilot limits.

Acceptance:
- A consultancy can receive a branded readiness report.
- No multi-tenant enterprise build required.
- One pilot can be delivered manually-assisted.

Output:
- White-label readiness audit pilot.

### Phase 8 — Rule Encoding Sprint

Status: planned

Goal:
Make new methodology support a paid and repeatable service.

Repo:
`article6-methodologies`

Scope:
- Intake checklist for new methodology.
- Encode rules, sections, anchors.
- Expected evidence metadata.
- PDD/workbook/report expectations.
- CI schema validation.
- Export sample method pack.
- App smoke test.

Acceptance:
- One new method can be encoded in a repeatable process.
- Client receives method coverage summary.
- App can load method and show reviewable rules.

Output:
- Encoded methodology pack.
- Rule encoding report.
- App-ready method.

### Phase 9 — Pilot Sales Loop

Status: planned

Goal:
Convert the workflow into repeatable revenue.

Scope:
- Landing page.
- Payment CTA.
- Intake form.
- Outreach scripts.
- Public case study.
- Pilot tracker.
- Feedback loop from real audits into method contracts.

Acceptance:
- One project developer can buy a readiness audit.
- One consultancy can request white-label pilot.
- One VVB can review a sample workpaper.
- Feedback creates scoped follow-up tasks, not random feature creep.

Output:
- First paid readiness audit.
- First consultancy pilot.
- First VVB review conversation.

## Resurrected notes

These are intentionally preserved here as folded or superseded history, not erased:

- `project-verification`: project-level wrapper and export framing are subsumed into Phases 3 through 5.
- `verification-factory`: customer-safe exports, pilot loop, and moat export ideas are preserved as the commercial lane.
- `requirement-coverage`: document intake and reconciliation are preserved in Phase 1.
- `phase-assurance-surface-mvp`: traceability, evidence export, and provenance constraints continue to inform the foundation.

