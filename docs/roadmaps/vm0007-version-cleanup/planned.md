# VM0007 Version Cleanup Roadmap

## Goal

Block VM0007 evidence audits unless the PDD-declared methodology version matches the loaded rulebook/contract version. For the current internal review lane, version mismatches are surfaced as warnings that require explicit user confirmation, but hard blocking remains the intended end state.

## Non-Negotiable Invariant

No VM0007 evidence judgment may produce FOUND, UNCLEAR, MISSING, N/A, report output, PDF output, or client-readiness output unless the system has verified:

1. methodology ID match
2. rulebook/contract version match
3. PDD-declared methodology version match
4. applicable module/version context where available

## Phases

### Phase 1: Version Lock

Status: in_progress

Current note:

- Internal review is running with VM0007 v1.8 as the only active rulebook target for now.
- Version mismatches currently show a warning and may continue only after explicit user confirmation.
- Warning-accepted results are draft/internal only and may be wrong.
- Hard `BLOCKED_VERSION_MISMATCH` behavior is deferred because version detection is currently over-blocking valid v1.8 uploads.
- Follow-up hard-block restoration is tracked in GitHub issue #926.

Done when:

* audit contracts/results include methodologyId
* audit contracts/results include rulebookVersion
* audit contracts/results include pddDeclaredMethodologyVersion
* audit contracts/results include versionMatch
* audit contracts/results include versionMismatchReason
* generic evidenceAudit refuses to audit when versionMatch is false
* Envira v1.5 + VM0007 v1.8 is blocked
* matching VM0007 v1.8 + VM0007 v1.8 may proceed
* blocked audits produce no FOUND, UNCLEAR, MISSING, or N/A judgments

### Phase 2: Envira Quarantine

Status: planned

Done when:

* Envira fixtures/routes/report labels clearly say legacy v1.5 mismatch
* Envira is preserved as a regression fixture
* old 30 FOUND / 8 UNCLEAR / 3 MISSING / 17 N/A counts are not treated as validated truth
* false FOUND rows, wrong page anchors, module-list evidence, and flattened table evidence errors are preserved as failure examples

### Phase 3: Report and PDF Blocking

Status: planned

Done when:

* internal report route blocks mismatched versions
* PDF export blocks mismatched versions
* UI shows this message or equivalent:

“Methodology version mismatch: PDD declares REDD-MF v1.5, but loaded rulebook is VM0007 v1.8. Evidence judgment blocked.”

* blocked output does not say client ready, ready for verification, verified, all clear, or similar

### Phase 4: Gate Strengthening

Status: planned

Done when tests fail if:

* a mismatched version produces FOUND rows
* a mismatched version produces a report
* a mismatched version produces a PDF export
* a mismatched version passes client-readiness
* old Envira counts are asserted as truth

Also preserve:

* exact quote integrity tests
* page correctness tests
* section correctness tests
* cross-PDF leakage tests

### Phase 5: Roadmap Correction

Status: planned

Done when:

* docs/roadmaps/vm0007-judgement-fixtures and related summaries are corrected
* old done states are changed to blocked, quarantined, or pending versioned re-audit
* docs say VM0007 Evidence Map is not truth-complete until version lock and re-audit pass

### Phase 6: Forward Path

Status: planned

Done when:

* minimal fixture/test hook proves a clean VM0007 v1.8 PDD can pass the version lock
* Envira remains blocked
* no full Maya evidence map is built in this cleanup roadmap unless explicitly requested

## Expected PR Split

PR 1:
`fix: require methodology version match before VM0007 evidence audit`

Covers:

* Phase 1
* minimal Phase 6 proof

PR 2:
`fix: quarantine Envira VM0007 fixture as legacy v1.5`

Covers:

* Phase 2
* Phase 3

PR 3:
`docs/test: mark VM0007 report fixture phases blocked pending versioned re-audit`

Covers:

* Phase 4
* Phase 5
* any remaining Phase 6 hook

## Final Acceptance Criteria

* Envira PDD declaring REDD-MF v1.5 cannot be judged using VM0007 v1.8 contracts
* Envira mismatch produces an explicit blocked status
* no normal Envira VM0007 evidence map, report, or PDF is produced from mismatched contracts
* no tests assert 30 FOUND / 8 UNCLEAR / 3 MISSING / 17 N/A as validated truth
* client-readiness gate fails on version mismatch
* fixture quality gate checks methodology-version match
* roadmap no longer says contaminated VM0007 report fixture work is truth-complete
* existing Quick Check v2 fixtures still pass
* existing quote integrity tests still pass
* a future VM0007 v1.8 PDD can be audited only after version match is confirmed
