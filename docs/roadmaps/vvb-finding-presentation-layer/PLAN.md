# VVB Finding Presentation Layer Roadmap

## Goal

Remove ambiguity around `FOUND -> CONFORMS` in the VVB finding presentation layer.

## Non-Negotiable Invariant

The deterministic router and Quick Check v2 status validator remain the truth gates. The VVB layer is not allowed to upgrade, rescue, reinterpret, or relabel weak evidence as `CONFORMS`.

No `CONFORMS` output may be emitted merely because a lower-level router returned `"answered"` or an extractor found text.

## Phases

### Phase 0: Status Consumer Audit

Status: planned

Done when:

* current consumers of Quick Check v2 status output are mapped
* all `FOUND` -> `CONFORMS` touch points are identified
* no implementation code is changed

### Phase 1: CONFORMS Eligibility Contract

Status: planned

Done when:

* `CONFORMS` may only be derived from the final Quick Check v2 validated `StatusResult`
* `status/internalStatus` is `FOUND`
* `reason` is `answer_and_provenance_complete`
* `evidence.quote` is non-empty
* `evidence.page` is a positive number
* `evidence` has section provenance
* `evidence.spanId` is non-empty
* `evidenceStack` has primary evidence
* `evidenceStack` validates for `FOUND`
* no blocker downgrade rule applies
* `evidence.sourceType` is not `raw_text_fallback`
* the VVB mapper consumes only the final validated status result, not raw extractor output, not raw router output, and not unvalidated evidence

### Phase 2: VVB Finding Mapper

Status: planned

Done when:

* mapper code derives VVB output from the eligibility contract
* mapper code does not read raw router or extractor output directly

### Phase 3: Evidence Presentation Object

Status: planned

Done when:

* the presentation object carries the validated evidence fields needed by VVB consumers

### Phase 4: Presentation Gates

Status: planned

Done when:

* tests fail if `FOUND` is upgraded to `CONFORMS` without the eligibility contract
* tests fail if raw router or extractor output is used directly

### Phase 5: Fixture Expectation Migration

Status: planned

Done when:

* fixture expectations are migrated to the new presentation contract

### Phase 6: UI, Report, and Gap Report Consumers

Status: planned

Done when:

* UI consumers read the presentation object
* report consumers read the presentation object
* gap report consumers read the presentation object

### Phase 7: Deprecation Review

Status: planned

Done when:

* old ambiguous `FOUND -> CONFORMS` paths are deprecated or removed

## Risks

* Risk: FOUND is treated as a display synonym for CONFORMS before all provenance and sufficiency gates are checked.
* Mitigation: add a CONFORMS eligibility contract and tests before any UI/report/gap report migration.
