# PR25 Acceptance Criteria

## Persist
- Exporting or starting a new run saves the current run into history.
- History caps at 10 entries per method/version.

## Load
- Loading a run restores minutes/checklist, linked rules, AOI, pins, and selected evidence.
- Export uses the loaded run's verifier.runId.

## No regressions
- Existing Verify export flow still works.
