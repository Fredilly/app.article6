# PR24 Acceptance Criteria

## Persist
- Reloading the Verify page retains minutes and checklist for the same method/version.

## New run
- Clicking New run clears minutes, resets checklist, and updates the run id.

## Export
- Exported snapshot JSON includes:
  - verifier.runId
  - verifier.createdAt
  - verifier.minutes
  - verifier.checklist

## No regressions
- Existing Verify export still works with AOI + STAC evidence.
