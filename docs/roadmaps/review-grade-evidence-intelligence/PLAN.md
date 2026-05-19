# Review-Grade Evidence Intelligence

Status SSOT: `docs/roadmaps/review-grade-evidence-intelligence/phase-status.json`

Tags for PR bodies and commit messages:
- `Roadmap: review-grade-evidence-intelligence`
- `Roadmap-Item: <phase_id>` (e.g. `Roadmap-Item: phase_0_standard_definition`)
- `SSOT: docs/roadmaps/review-grade-evidence-intelligence/phase-status.json`

## Goal

Define and implement an app-side project export standard that converts uploaded PDDs, workbooks, AOIs, and supporting evidence into a premium reviewer-ready export. The export must be:

- **Beautiful enough to sell** — professional-grade layout, typography, and information design
- **Structured enough to defend** — every claim traces to evidence with deterministic provenance
- **Conservative enough to trust** — no overclaiming of official registry verification or certification

The pipeline flows from upload through evidence inventory, fragments, extracted facts, candidate links, coverage matrix, reviewer decisions, and provenance into premium PDF and ZIP exports.

## Non-goals

- Refactoring extraction or export code — RC0 and RC1 are documentation and planning only
- Changes to canonical methodology metadata or pack encoding
- AI-assisted evidence classification or auto-verification — all extraction is deterministic
- Official registry verification or certification claims — all output is scoped as readiness review
- Replacing the existing UNFCCC-specific report composer or verification pack pipeline — they are extended, not replaced

## Key relationships

| Standard/Component | Location | Role in this roadmap |
|---|---|---|
| Review-grade project export standard | `docs/standards/review-grade-project-export-standard.md` | Defines the full pipeline from upload to premium export; all phases implement against this standard |
| Methodology pack | `config/methodologies_pack.json` -> `public/methodologies/` | Supplies canonical methodology sections, rules, expected evidence — consumed, not owned |
| Evidence inventory | `src/lib/evidence/` | Stores and normalizes uploaded evidence; extended by fragments and facts |
| Verification pack | `src/lib/projects/verificationReport.ts` | Existing export target; integrated with evidence intelligence in Phase 5 |
| QuickCheck | `src/lib/chat/quickCheckEvidence.ts` | Entry point for ad-hoc evidence analysis; evidence intelligence is the structured upgrade |

## Phase table

| Phase | Title | Status | Visible UI change |
|---|---|---|---|
| 0 | Review-grade project export standard definition | Done | None (documentation only) |
| 1 | Deterministic evidence extraction foundation | In progress | Evidence fragments and extracted facts appear in evidence inventory |
| 2 | Evidence inventory reconciliation | Planned | Coverage matrix shows reconciliation status per fragment |
| 3 | Reviewer decision records with provenance | Planned | Coverage matrix shows reviewer decisions with evidence links |
| 4 | Premium PDF/ZIP export with full provenance | Planned | Premium PDF and ZIP export options available |
| 5 | Verification pack integration with evidence intelligence | Planned | Verification pack includes evidence fragments and structured review data |
| 6 | Evidence quality and coverage metrics | Planned | Evidence quality badges and coverage progress bars |
| 7 | Evidence snapshot and comparison | Planned | Evidence snapshot comparison timeline and diff view |
| 8 | Export standardization and cross-export consistency | Planned | Consistent section ordering and terminology across all export formats |

## Phase details

### Phase 0 — Review-grade project export standard definition

Define the app-side project export standard covering uploads, evidence inventory, fragments, extracted facts, candidate links, coverage matrix, reviewer decisions, provenance, and premium PDF/ZIP exports. Create the standard document and roadmap plan.

**Acceptance criteria:**
- `docs/standards/review-grade-project-export-standard.md` exists and defines the full pipeline from upload to premium export
- Standard covers uploads, evidence inventory, fragments, extracted facts, candidate links, coverage matrix, reviewer decisions, provenance, and PDF/ZIP export
- Standard is honest about what is app-owned readiness-report logic vs canonical pack metadata
- Standard is conservative enough to trust: no overclaiming of official registry verification or certification

**Implementation details:**
- New file: `docs/standards/review-grade-project-export-standard.md`
- New file: `docs/roadmaps/review-grade-evidence-intelligence/PLAN.md` (this file)
- New file: `docs/roadmaps/review-grade-evidence-intelligence/phase-status.json`

### Phase 1 — Deterministic evidence extraction foundation

Implement deterministic extraction of evidence fragments from uploaded documents (PDDs, workbooks, monitoring reports). Extract facts and surface candidate links to methodology rules. All extraction must be deterministic and auditable, producing stable provenance hashes.

**Acceptance criteria:**
- Uploaded PDDs produce deterministic fragments with section/page provenance
- Uploaded workbooks produce deterministic fragments with sheet/cell provenance
- Extracted facts are stored with stable hashes for auditability
- Candidate rule links are surfaced from extracted content
- All extraction is deterministic: same input produces same output
- Existing upload and evidence inventory flows are preserved

**Visible UI change:** Evidence fragments and extracted facts appear in the evidence inventory alongside original uploads.

### Phase 2 — Evidence inventory reconciliation

Reconcile extracted evidence fragments and facts against the methodology coverage matrix. Surface unmatched evidence, missing coverage, and potential gaps. Enable reviewers to link evidence to rules with structured provenance.

**Acceptance criteria:**
- Evidence fragments are cross-referenced against methodology rule sections
- Unmatched evidence is surfaced for manual review
- Coverage gaps are identified from missing evidence links
- Reviewers can manually link evidence to rules with structured provenance
- Reconciliation is deterministic: same inputs produce same coverage state

**Visible UI change:** Evidence inventory shows reconciliation status per fragment: linked, unmatched, or gap.

### Phase 3 — Reviewer decision records with provenance

Build structured reviewer decision records attached to evidence-linked rules. Each decision carries status, rationale, evidence reference, and provenance. Enable the coverage matrix to reflect reviewer decisions alongside evidence reconciliation.

**Acceptance criteria:**
- Reviewer decisions are structured records with status, rationale, evidence reference, and provenance
- Decisions are linked to specific evidence fragments, not just rule IDs
- Coverage matrix reflects reviewer decisions alongside evidence reconciliation
- Decision history is preserved and auditable
- Existing review panel and decision flows are extended, not replaced

**Visible UI change:** Coverage matrix shows reviewer decisions per rule with evidence links and provenance.

### Phase 4 — Premium PDF/ZIP export with full provenance

Build premium PDF and ZIP export pipelines that include evidence fragments, extracted facts, coverage matrix, reviewer decisions, and full provenance.

**Acceptance criteria:**
- PDF export includes evidence fragments and extracted facts with provenance
- PDF export includes coverage matrix with reconciliation status
- PDF export includes reviewer decisions with rationale and evidence links
- ZIP export includes all source documents, evidence fragments, and structured metadata
- Exports are deterministic: same project state produces same output
- Exports are beautiful and professional-grade in layout and typography

**Visible UI change:** Premium PDF and ZIP export options available from project detail and review panels.

### Phase 5 — Verification pack integration with evidence intelligence

Integrate evidence intelligence outputs (fragments, facts, links, coverage, decisions) into the existing verification pack pipeline.

**Acceptance criteria:**
- Verification pack includes evidence fragments and extracted facts with provenance
- Verification pack includes coverage matrix with reconciliation status
- Verification pack includes reviewer decisions with evidence links
- Verification pack is deterministic: same project state produces same output
- Existing verification pack consumers (audit trail, export) are preserved

**Visible UI change:** Verification pack output includes evidence fragments and structured review data.

### Phase 6 — Evidence quality and coverage metrics

Surface evidence quality and coverage metrics in the UI: what fraction of rules have linked evidence, how many fragments per rule, what is the reconciliation confidence level.

**Acceptance criteria:**
- Evidence quality metrics are computed and displayed in the evidence inventory
- Coverage metrics show fraction of rules with linked evidence per standard
- Reconciliation confidence level is surfaced per evidence fragment
- Metrics are deterministic: same project state produces same metrics
- Metrics are advisory only — reviewers make the final sufficiency call

**Visible UI change:** Evidence quality badges and coverage progress bars visible in evidence inventory and project overview.

### Phase 7 — Evidence snapshot and comparison

Enable reviewers to take evidence snapshots at a point in time and compare evidence state across project versions or milestones.

**Acceptance criteria:**
- Evidence snapshots capture the full evidence state at a point in time
- Snapshots include fragments, facts, links, coverage, and decisions
- Comparison view shows added, removed, and changed evidence between snapshots
- Snapshots are deterministic: same project state at same time produces same snapshot
- Snapshots are exportable for offline review and record-keeping

**Visible UI change:** Evidence snapshot comparison timeline and diff view in project overview.

### Phase 8 — Export standardization and cross-export consistency

Ensure all export outputs (PDF, ZIP, verification pack, evidence snapshot) follow the same layout conventions, terminology, and section ordering.

**Acceptance criteria:**
- All export types follow the same layout conventions and terminology
- Section ordering is consistent across PDF, ZIP, verification pack, and snapshot exports
- Terminology is consistent: evidence fragment, extracted fact, candidate link, coverage status, reviewer decision
- Exports are deterministic: same project state produces same output across all export types
- Migration path is documented for existing export consumers

**Visible UI change:** Consistent section ordering and terminology across all export formats.
