# Evals

## Questions

1. Does Quick Check still return usable facts for the existing PDF fixtures?
2. Does the system degrade safely when OpenDataLoader is unavailable?
3. Is the integration isolated from the client bundle and current UI contract?

## Coverage

- `tests/lib/quickCheckEvidence.test.ts`
  - keeps strong-signal PDF extraction and fact derivation green
  - verifies fallback warning behavior when a remote extractor degrades
- `tests/lib/quickCheckPdfExtractor.test.ts`
  - verifies text output handling
  - verifies JSON-content fallback
  - verifies clear Java prerequisite messaging

## Manual Evaluation Notes

- Official package selected: `@opendataloader/pdf` `2.2.1`
- Official runtime requirement: Java 11+ and Node.js 20+
- Current local environment on April 12, 2026 does not have Java installed, so the fallback path is expected in local development until Java is added.

## Acceptance

- Quick Check remains functional with no UI flow changes.
- PDF extraction prefers OpenDataLoader when available.
- Failures degrade to the previous heuristic parser with an explicit warning.
