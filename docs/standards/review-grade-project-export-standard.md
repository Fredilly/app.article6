# Review-Grade Project Export Standard

## Purpose

Define the app-side standard for converting uploaded project documents (PDDs, workbooks, AOIs, supporting evidence) into a premium reviewer-ready export. The export must be beautiful enough to sell, structured enough to defend, and conservative enough to trust.

## Scope

This standard covers the full pipeline:

1. Upload intake and evidence inventory
2. Fragment extraction from uploaded documents
3. Fact extraction from fragments
4. Candidate link generation between facts and methodology rules
5. Coverage matrix reconciliation
6. Reviewer decision records
7. Provenance tracking at every step
8. Premium PDF and ZIP export generation

## Principles

### Determinism

Every step in the pipeline must be deterministic: given the same inputs, it must produce the same outputs. Non-determinism (e.g. LLM calls, random sampling, timestamp-dependent logic) must not affect evidence extraction, fact generation, or link candidates. Determinism enables:
- Reproducible exports for audit and record-keeping
- Reliable before/after comparison during re-verification
- Predictable coverage state across reviewer sessions
- Stable provenance hashes for all artifacts

### Auditability

Every artifact produced by the pipeline must carry stable provenance:
- Evidence fragments carry the source document hash, upload timestamp, and extractor version
- Extracted facts carry the fragment hash, extractor version, and extraction timestamp
- Candidate links carry the fact hash, rule ID, and linker version
- Reviewer decisions carry the user ID, timestamp, status, rationale, and evidence references
- Coverage matrix rows carry the rule ID, linked evidence hashes, and reconciliation status

### Conservatism

The export must not overclaim:
- All output is scoped as readiness review, not official registry verification or certification
- Methodology sections and rules are canonical pack metadata — the app owns report layout, disclaimers, and evidence summaries
- Evidence sufficiency is always a reviewer call — metrics are advisory only
- No auto-verification or AI-based status assignment on evidence

## Pipeline

### 1. Upload intake

| Field | Description |
|---|---|
| Document type | PDD, workbook, monitoring report, AOI, supporting evidence |
| Storage | Evidence inventory with stable ID and content hash |
| Metadata | Upload timestamp, filename, size, content type, source (user upload / STAC / API) |
| Content hash | SHA-256 of raw bytes: `sha256(content)` |

**Standard:** Every upload produces a stable evidence inventory entry with content hash before any processing begins.

### 2. Fragment extraction

Uploaded documents are decomposed into deterministic fragments:

| Document type | Fragment boundaries |
|---|---|
| PDD | Per-section fragments using section headers, with section ID and page range |
| Workbook | Per-sheet fragments with sheet name and cell ranges for data regions |
| Monitoring report | Per-section fragments using section headers or page boundaries |
| AOI | Single fragment containing full AOI metadata |
| Supporting evidence | Single fragment for each attached document |

Each fragment produces:
- `fragment_id`: Stable hash of `(evidence_id, fragment_index, content)`
- `content`: Extracted text content
- `provenance`: Source evidence ID, fragment index, section/sheet reference, page range
- `metadata`: Extractor version, extraction timestamp, extraction duration

**Standard:** Fragment extraction is deterministic. Same document produces identical fragments with identical IDs across extraction runs.

### 3. Fact extraction

Fragments are analyzed for structured facts:

| Fact type | Description | Example |
|---|---|---|
| Methodology reference | Mention of a methodology code, version, or standard | "VM0007 v2.0", "GS-VER1" |
| Date or period | Project start date, crediting period, monitoring period | "01 Jan 2024 - 31 Dec 2034" |
| Quantity or unit | Emission reductions, area, volume, with unit | "10,000 tCO2e/year", "500 ha" |
| Location or boundary | Geographic reference, AOI coordinates, administrative region | "Machinga District, Malawi" |
| Eligibility condition | Applicability condition referenced from methodology | "Forest definition threshold" |
| Data source | Reference to external data, study, or default factor | "Tool 01 default factors" |
| Stakeholder input | Consultation record, feedback summary, safeguard description | "Stakeholder consultation conducted Jan 2024" |

Each fact produces:
- `fact_id`: Stable hash of `(fragment_id, fact_type, normalized_value)`
- `fact_type`: One of the types above
- `value`: Normalized value
- `provenance`: Source fragment ID, text span (start/end offset)
- `confidence`: Not applicable — all extraction is deterministic rule-based matching, not ML

**Standard:** Fact extraction is deterministic. Same fragment produces identical facts with identical IDs across extraction runs. No ML or LLM is used for fact extraction.

### 4. Candidate link generation

Extracted facts are matched against methodology rules to produce candidate links:

| Link type | Description |
|---|---|
| Section match | Fact references a methodology section by ID or title |
| Rule match | Fact content matches a rule's keywords, tags, or expected evidence |
| Standard match | Fact identifies the methodology standard (Verra, GS, UNFCCC) |
| Quantity match | Fact contains a quantity or unit relevant to a rule's calculation |
| Date match | Fact contains a date relevant to a rule's temporal scope |

Each candidate link produces:
- `link_id`: Stable hash of `(fact_id, rule_id)`
- `rule_id`: The methodology rule ID
- `confidence`: Always `candidate` — reviewers decide whether to accept, reject, or ignore
- `provenance`: Source fact ID, rule section reference
- `status`: Always `candidate` on generation — changed to `accepted`, `rejected`, or `ignored` by reviewer action

**Standard:** Link generation is deterministic. Same facts and rules produce identical candidate links across generation runs. Links are always candidate until a reviewer acts on them.

### 5. Coverage matrix

The coverage matrix reconciles evidence against methodology rules:

| Column | Description |
|---|---|
| Rule ID | Methodology rule identifier |
| Rule title | Methodology rule title |
| Section | Methodology section reference |
| Linked evidence | List of evidence fragment IDs linked (candidate or accepted) |
| Reconciliation status | `covered` (≥1 accepted link), `candidate` (candidate links exist, none accepted), `unmatched` (no links), `gap` (rule has evidence requirements but no link) |
| Link count | Number of candidate + accepted links |
| Fragment count | Number of unique evidence fragments referenced |
| Last updated | Timestamp of last change to any link for this rule |

**Standard:** The coverage matrix is derived deterministically from evidence fragments, extracted facts, candidate links, and reviewer decisions. Same pipeline state produces identical coverage matrix.

### 6. Reviewer decision records

Reviewer decisions are structured records attached to evidence-linked rules:

| Field | Description |
|---|---|
| Decision ID | Stable hash of `(project_id, rule_id, user_id, timestamp)` |
| Rule ID | Methodology rule being reviewed |
| Status | `verified` / `not_verified` / `needs_follow_up` / `not_applicable` |
| Rationale | Free-text rationale from reviewer |
| Evidence references | List of evidence fragment IDs supporting the decision |
| User ID | Reviewer identity |
| Timestamp | Decision timestamp |
| Previous decision ID | Previous decision on same rule (null if first) — forms decision chain |
| Provenance | Source review session, export version, client context |

**Standard:** Reviewer decisions are append-only. Each decision creates a new record; previous decisions are preserved for audit. The coverage matrix reflects the latest decision per rule.

### 7. Provenance

Every artifact carries provenance metadata:

| Artifact | Provenance fields |
|---|---|
| Evidence upload | `evidence_id`, `content_hash`, `upload_timestamp`, `source` |
| Evidence fragment | `fragment_id`, `evidence_id`, `extractor_version`, `extraction_timestamp` |
| Extracted fact | `fact_id`, `fragment_id`, `extractor_version`, `extraction_timestamp` |
| Candidate link | `link_id`, `fact_id`, `rule_id`, `linker_version` |
| Coverage matrix | `matrix_hash` (hash of all rows), `generated_at`, `pipeline_version` |
| Reviewer decision | `decision_id`, `project_id`, `rule_id`, `user_id`, `timestamp` |
| Export | `export_id`, `project_id`, `export_timestamp`, `pipeline_version`, `input_hash` (hash of project state at export time) |

**Standard:** Provenance is mandatory for all artifacts. No artifact enters the pipeline without provenance. Provenance is stable and deterministic.

### 8. Premium PDF export

PDF exports follow these conventions:

| Element | Standard |
|---|---|
| Header | Project name, methodology, registry, export timestamp, export ID |
| Section 1 | Executive summary: registry, standard, methodology, version, category, review status, coverage summary |
| Section 2 | Project information: name, AOI, documents, dates |
| Section 3 | Methodology source sections: canonical sections from pack metadata, with section IDs |
| Section 4 | Evidence inventory: all uploaded evidence with fragment count, content hash, and provenance |
| Section 5 | Extracted facts: all facts grouped by fact type, with fragment reference |
| Section 6 | Coverage matrix: full rule-by-rule table with linked evidence, reconciliation status, link count |
| Section 7 | Reviewer decisions: all decisions with status, rationale, evidence references, and provenance |
| Section 8 | Limitations and disclaimers: readiness-review scope, no official verification claim, standard disclaimers |
| Section 9 | Provenance: full provenance chain from upload to export |

**Layout requirements:**
- Professional typography with consistent heading hierarchy
- Table formatting for coverage matrix and evidence inventory
- Page numbers, section anchors, and cross-references
- Deterministic pagination: same project state produces same page layout
- Responsive design: readable at both screen and print resolutions

### 9. Premium ZIP export

ZIP exports follow these conventions:

| Entry | Content |
|---|---|
| `export.json` | Structured JSON with all export data: evidence, fragments, facts, links, coverage, decisions, provenance |
| `evidence/` | Original uploaded documents organized by evidence ID |
| `fragments/` | Extracted fragments as individual text files organized by fragment ID |
| `reports/` | PDF export and any supporting report files |
| `manifest.json` | File listing with content hashes for every entry in the ZIP |

**Standard:** ZIP exports are deterministic. Same project state produces identical ZIP contents, file ordering, and content hashes.

## Relationship to existing artifacts

| Existing artifact | Relationship |
|---|---|
| Methodology pack | Supplies canonical methodology sections, rules, and expected evidence — consumed, not extended or duplicated |
| Verification report | Extended in Phase 5 to include evidence fragments, facts, and structured review data; existing report format is preserved |
| Audit pack | Consumes verification report output; enhanced by richer evidence data |
| QuickCheck | Ad-hoc entry point; evidence intelligence is the structured upgrade with deterministic extraction and coverage reconciliation |
| Evidence inventory | Extended with fragments, facts, and links in Phase 1-2; existing upload and storage flows are preserved |

## Versioning

This standard follows semantic versioning: `v1.0.0`.

| Version | Date | Changes |
|---|---|---|
| v1.0.0 | 2026-05-19 | Initial standard definition. Pipeline from upload to premium PDF/ZIP export defined. Determinism, auditability, and conservatism principles established. |

## Review and governance

- This standard is owned by the `review-grade-evidence-intelligence` roadmap
- Changes to the standard require a roadmap phase update
- Implementation phases must document compliance with this standard in their acceptance criteria
- Non-compliance must be documented as a known limitation with a plan for resolution
