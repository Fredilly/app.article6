# Phase 8: Fixture Expectation Migration

## Migration boundary

Phase 8 migrates reviewed fixture truth at the boundary between the existing
judgment/report fixture layer and the generic presentation contracts. Existing
`FOUND`, `UNCLEAR`, `MISSING`, `N/A`, `answered`, `unclear`, and `no_evidence`
values remain unchanged. The adapter accepts explicit reviewed truth and explicit
assessment inputs; it does not infer a judgment from prose or status.

The existing Envira and PD_REDD reviewed fixtures remain the upstream truth source.
Their current report consumers and legacy wording assertions are intentionally not
rewritten in this phase.

## Old and new flow

The old reviewed flow is:

```text
judgment fixture -> report-only fields -> legacy report assertions
```

The migrated presentation flow is:

```text
reviewed fixture truth
  -> finalized Evidence Map row
  -> Phase 3 conclusion input/result
  -> Phase 4 draft-finding input/result
  -> Phase 5 applicability result
  -> Phase 6 ReportPresentationObject
  -> Phase 7 PresentationGateInput/result
```

`tests/fixtures/fixturePresentationAdapter.ts` is the reusable packaging adapter.
It calls the production contracts and preserves the row object, accepted and
rejected evidence, provenance, source identity, review metadata, methodology
identity, assessment reason, client action, and upstream status.

## Compatibility and evidence rules

The adapter is additive. Existing Quick Check gold fixtures, report fixtures,
extraction expectations, router behavior, and methodology rules are untouched.
Rejected evidence remains a separate typed collection with its rejection reason;
it is never folded into accepted evidence or inferred from prose. Canonical
provenance is required for strict Phase 6/7 fixtures, including document ID, page,
section path, span ID, section heading, and source type.

## Migrated fixture inventory

- Generic reviewed-fixture presentation cases cover FOUND/CONFORMS, UNCLEAR with
  ACTION_REQUIRED/NIR_CANDIDATE, pending review, contradictory input/BLOCKED,
  single-row `NOT_EVALUATED`, and compatible multi-row `PASS`.
- The adapter tests preserve accepted and rejected evidence exactly and verify
  strict Phase 6 objects and real Phase 7 gate results.
- Existing Envira VM0007 and PD_REDD VM0007 legacy consumers continue to use their
  reviewed JSON and report fixtures unchanged.

## Intentionally deferred fixtures

The existing Envira and PD_REDD JSON evidence entries use `spanId: null` in their
reviewed source truth. They are not converted into strict Phase 6 rows in Phase 8:
inventing span IDs would manufacture provenance and violate the fixture truth rules.
They remain covered by their existing PDF anchoring and legacy compatibility tests.

## Test coverage

`tests/lib/evidence/fixturePresentationAdapter.test.ts` covers evidence retention,
provenance, status preservation, typed expectations, strict packaging, release
states, cross-row outcomes, contradictory fixtures, and the rejected-evidence
regression. Existing evidence, preverif, and Quick Check suites provide the legacy
consumer coverage.

## Phase 9 handoff

Phase 9 can consume the adapter's strict presentation objects and gate results for
the readiness report and reviewer UI. It must continue to treat the Evidence Map
as canonical and use the centralized Phase 7 release gate.
