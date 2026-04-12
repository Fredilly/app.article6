# Evals

## Questions

1. Does Quick Check still return usable facts for the existing PDF fixtures?
2. Does the system degrade safely when `pdf-parse` cannot extract text?
3. Is the integration isolated from the client bundle and current UI contract?
4. Does the solution stay deployable on Vercel without Java?

## Coverage

- `tests/lib/quickCheckEvidence.test.ts`
  - keeps strong-signal PDF extraction and fact derivation green
  - verifies heuristic fallback remains usable
- `tests/lib/quickCheckPdfExtractor.test.ts`
  - verifies `pdf-parse` text extraction handling
  - verifies parser cleanup
  - verifies parser failures propagate to the route for fallback handling

## Manual Evaluation Notes

- Official package selected: `pdf-parse` `2.4.5`
- Runtime target: Vercel Node.js serverless functions
- No Java requirement

## Acceptance

- Quick Check remains functional with no UI flow changes.
- PDF extraction prefers `pdf-parse`.
- Failures degrade to the previous heuristic parser without changing the UI contract.
