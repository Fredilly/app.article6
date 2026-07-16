# RC5-2 live Maya Evidence Map review subject

This directory freezes the live production-run proposal for audit
`vm0007-gap-abd63948-2722-4f9b-831c-8ce3d1dfe0cd`.

The captured run is deliberately separate from the reproducible comparison
artifact in PR #1069:

- PR #1069 baseline: reproducible machine-generation comparison artifact,
  `FOUND 0 / UNCLEAR 47 / MISSING 11`.
- RC5-2 live audit: existing production-workflow run under review,
  `FOUND 0 / UNCLEAR 44 / MISSING 14`.

These are separate machine-generation runs. Their counts are not expected to
match. The three-rule difference is recorded as generation variance for later
retrieval/assessment investigation; it is not contamination, reviewed truth,
or truth drift. No Maya-specific production logic was added and no proposal
values were reviewed or corrected here.

## Frozen contents

- `tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json`
  is the exact persisted machine proposal, including all 58 rows, states,
  accepted/rejected evidence, provenance, assessment reasons, gaps, and
  actions.
- `tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/audit-record.json`
  preserves the corresponding live audit record and document identity.
- `live-review-sample.json` is the deterministic ten-rule review manifest. It
  selects six UNCLEAR and four MISSING rows, including rows with rejected-only
  evidence, accepted evidence that remained UNCLEAR, and broad/noisy evidence
  patterns likely to reveal retrieval or assessment failures.

The document SHA is
`407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b`.
The proposal remains `MACHINE_PROPOSED` and every row remains in `draft`
finalization state. This capture adds no reviewed truth and does not modify the
PR #1069 baseline or `gold.json`.

The focused test
`tests/fixtures/preverif/mayaForestCorridorLiveProposal.test.ts` checks the
audit identity, document SHA, 58-row count, 44/14 state counts, proposal and
audit hashes, and the hash of every row against the frozen manifest.
