# Evals

## Summary contract

- Build summary from finalized artifact inputs with method, rule, evidence, AOI, and reviewer data present.
- Build summary with missing optional fields and confirm null-safe outputs plus readable UI fallbacks.

## Finalize UX

- Finalize a run and confirm the page shows Review Summary immediately.
- Refresh the page and confirm Review Summary still renders from persisted finalized state.

## Export parity

- Download JSON and confirm `summary` is present at the top level.
- Download PDF and confirm it reflects the same summary rows as the UI.

## Failure handling

- Force PDF generation failure and confirm the UI shows an inline error while JSON export still works.
