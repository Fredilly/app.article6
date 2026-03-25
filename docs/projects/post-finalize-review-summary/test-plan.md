# Test Plan

## Unit

- `buildReviewSummary` happy path
- `buildReviewSummary` fallback path
- `buildEvidenceSnapshot` additive `summary` contract
- PDF builder emits the same ordered summary rows

## Integration

- Review summary card renders primary fields and disclosure sections
- Finalize success path stores a review artifact instead of forcing raw export UI

## E2E / smoke

- Finalize -> Review Summary visible
- Refresh finalized page -> Review Summary still visible
- JSON and PDF actions available on finalized result
