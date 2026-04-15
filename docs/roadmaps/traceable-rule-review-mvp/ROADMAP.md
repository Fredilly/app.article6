# Traceable Rule Review MVP -> VVB-Ready Roadmap

Roadmap ID: `traceable-rule-review-mvp`

Status source: [`docs/roadmaps/traceable-rule-review-mvp/phase-status.json`](/Users/stphen/app.article6/docs/roadmaps/traceable-rule-review-mvp/phase-status.json)

## Goal

Turn Article6 from a methodology/checklist demo into a methodology-aware verification workspace that produces traceable, defensible, reviewable rule-by-rule outputs for VVB-style workflows.

## Product thesis

The monetizable object is not the checklist. The monetizable object is the rule review record:

- what rule is being reviewed
- what evidence supports it
- why it was marked the way it was
- what remains unresolved
- who reviewed it, when, and from what source or provenance

## Boundary rule

The app must not invent methodology semantics ad hoc. `article6-methodologies` defines the canonical contract. `app.article6` consumes it.

## Repo ownership

### `app.article6` owns

- projects and verification workflow
- rule review UI
- rationale, support, and provenance persistence
- evidence attachment and linking
- AOI and STAC fact display
- exports and review summaries

### `article6-methodologies` owns

- canonical methodology content
- rule text and source anchors
- rule metadata and contracts
- evidence-type expectations per rule
- STAC eligibility flags
- manual-review requirement flags
- canonical shapes consumed by the app

## Rule review record definition

Each rule review record is the reviewable object the product sells and exports. The minimum shape is:

- methodology identity: source, method, version, rule id
- rule content: full rule text plus canonical source anchor
- review decision: status, unresolved state, manual-review state
- rationale: reviewer-written explanation of why the status was chosen
- support: support reference plus linked evidence records where present
- provenance: reviewer identity, timestamp, source artifact or fragment references, and derived-fact lineage where applicable
- reserved support surfaces: AOI facts, STAC facts, document fragments, workbook fragments, monitoring references

No rule is "green" unless that record visibly supports the judgment.

## Current assets and how they fit

- Methods: contract layer defining what must be proven
- Complex methods: reality check so the product is not built only for toy cases
- AOI: spatial scope object tying a project to geospatial evidence
- STAC: geospatial fact source for eligible rules
- Projects: workflow container for review state, evidence, and exports
- Verification packs: current output shell that becomes useful once rule review records are real
- Quick Check: intake and triage layer, useful but not the core paid object

## VVB-ready definition

The system is VVB-ready only when all of the following are true:

- at least one target method can be reviewed end-to-end
- every verified rule has rationale, support, and provenance
- AOI and STAC facts appear only where relevant
- document and workbook evidence can be linked where needed
- export is reviewable outside the app
- the system does not overclaim or fake certainty
- the workflow saves meaningful reviewer time

## Non-goals

- no fake auto-verification
- no fake confidence
- no unsupported green checks
- no STAC-driven status flipping
- no formal certification opinion claims
- no broad redesign or refactor outside this roadmap
- no repo-boundary drift

## Phases

### Phase 0 - Roadmap + contract freeze

Outcome: one written roadmap and one shared phase-status system across both repos.

App responsibilities:

- publish the app-side roadmap
- publish the matching phase-status scaffold
- freeze app and methodology boundaries for this roadmap

Shared deliverables:

- roadmap doc in both repos
- phase-status.json in both repos
- same roadmap id and phase sequence
- explicit repo boundaries
- explicit definition of the rule review record

Exit criteria:

- no ambiguity about what gets built first
- no ambiguity about which repo owns what

### Phase 1 - Rule review record

Outcome: a rule opens into a real review surface, not a status toggle.

App responsibilities:

- review panel UI
- data model and persistence for rationale, support, and provenance
- panel open and close behavior
- status shown inside the review panel
- reserved areas for linked evidence and STAC facts

Methodology dependency:

- expose full rule text and source anchors cleanly
- stabilize the contract shape the app needs

Exit criteria:

- clicking a rule opens a real review record
- a reviewer can understand the rule and record rationale and support
- the UI shape can grow without redesign

### Phase 2 - Defensible verification

Outcome: "Verified" is no longer just a click.

App responsibilities:

- require rationale before `Verified`
- require support reference and or linked evidence before `Verified`
- capture reviewer identity and timestamp
- support unresolved and uncertain states cleanly
- display support on reviewed rules

Methodology dependency:

- support-type metadata where needed
- manual-review requirement flags where needed

Exit criteria:

- every verified rule has visible rationale and support
- a reviewer can inspect why a rule is green
- unsupported green checks are no longer possible

### Phase 3 - AOI + STAC support facts

Outcome: AOI and STAC become useful support for eligible rules.

App responsibilities:

- STAC integration and display
- AOI-linked fact rendering in the rule review panel
- rule-level support cards
- explicit "support only, not auto-verification" language

Methodology dependency:

- STAC eligibility by rule
- expected fact shapes for STAC-supported rules

Exit criteria:

- STAC appears only where appropriate
- STAC facts are inspectable and traceable
- STAC does not directly flip statuses

### Phase 4 - Document + workbook support

Outcome: non-geospatial evidence becomes first-class rule support.

App responsibilities:

- upload flows
- fragment and reference linking to rules
- evidence inventory integration
- rule panel support rendering

Methodology dependency:

- expected evidence-type contracts
- optional fact templates per rule

Exit criteria:

- a reviewer can support rules with document, workbook, and report references
- linked evidence is inspectable at source-fragment level
- evidence is traceable, not loosely attached

### Phase 5 - Method completeness on target methods

Outcome: at least one target method is complete enough to support a real pilot.

App responsibilities:

- consume richer method contracts without UI breakage
- ensure rule review works across all covered rules

Methodology dependency:

- full `AR-ACM0003` coverage
- one second target method after that
- support matrix maturity
- canonical consistency checks
- encoding and coverage playbook for adding more methods

Exit criteria:

- one real target method can be reviewed end-to-end
- a second method proves repeatability
- methodology expansion has a clear playbook

### Phase 6 - Exportable verification output

Outcome: the review can be exported and inspected outside the app.

App responsibilities:

- PDF and JSON export generation
- rule-by-rule rationale, support, and provenance export
- unresolved-gap rendering
- review summary synthesis
- provenance and hashes where already supported

Methodology dependency:

- canonical fields only where export requires them

Exit criteria:

- exported pack is understandable outside the app
- every verified rule in export has visible support
- unresolved rules remain explicit

### Phase 7 - Pilot-ready VVB workflow

Outcome: the system is ready for paid pilot use.

App responsibilities:

- workflow hardening
- key UX cleanup
- small onboarding improvements
- one pilot-ready demo path
- operator and reviewer instructions
- pricing and scope boundaries for pilot delivery

Exit criteria:

- one complete demo or pilot path works without hand-waving
- a VVB or project developer can understand the value quickly
- exports and review records hold up under scrutiny

## Sequencing

1. Phase 0 - roadmap + contract freeze
2. Phase 1 - rule review record
3. Phase 2 - defensible verification
4. Phase 3 - AOI + STAC support facts
5. Phase 4 - document + workbook support
6. Phase 5 - method completeness on target methods
7. Phase 6 - exportable verification output
8. Phase 7 - pilot-ready VVB workflow

## Immediate next action

Implement Phase 0 and Phase 1 only.

For this repo, that means:

- create this roadmap doc and matching phase-status file
- use the frozen contract to build the first real rule review panel later
- do not implement later phases as part of this roadmap freeze step
