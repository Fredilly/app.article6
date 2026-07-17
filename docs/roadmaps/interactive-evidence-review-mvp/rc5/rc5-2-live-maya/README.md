# RC5-2 live Maya Evidence Map review subject

This directory freezes the live production-run proposal for audit
`vm0007-gap-abd63948-2722-4f9b-831c-8ce3d1dfe0cd`.

The canonical RC5-2 Maya machine proposal is one shared-builder result:
58 rows with `FOUND 0 / UNCLEAR 44 / MISSING 14`. PR #1069 used direct raw
rule loading while production used canonical `loadMethodRules` normalization;
PR #1072 unified both paths. The regenerated canonical proposal is semantically
equal to this frozen proposal after ignoring documented execution identity
fields. This is reproducibility evidence, not generation variance or a second
machine-truth baseline.

No reviewer outcomes are inferred, no reviewed truth exists, and no proposal
values were corrected here. No Maya-specific production logic was added.

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
- `semantic-comparison.json` compares the regenerated canonical proposal and
  this frozen proposal by `stableRuleId`. All substantive row fields match;
  only documented execution identity fields differ.

The document SHA is
`407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b`.
The proposal remains `MACHINE_PROPOSED` and every row remains in `draft`
finalization state. This capture adds no reviewed truth and does not modify
`gold.json`.

The focused test
`tests/fixtures/preverif/mayaForestCorridorLiveProposal.test.ts` checks the
audit identity, document SHA, 58-row count, 44/14 state counts, proposal and
audit hashes, and the hash of every row against the frozen manifest.
The focused semantic comparison test
`tests/fixtures/preverif/mayaSemanticComparison.test.ts` fails on substantive
row drift, validates identity-field tolerance, checks row-hash sensitivity,
and rejects reviewer-outcome fields.
