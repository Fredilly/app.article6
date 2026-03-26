# Post-finalize Review Summary

## Goal

Replace the abrupt post-finalize export moment with a readable in-app review summary while keeping JSON as the audit-source artifact.

## Scope

- Add a top-level `summary` object to finalized exports.
- Render the same summary in-app after finalize.
- Offer explicit JSON and PDF downloads from that summary surface.
- Keep raw evidence, provenance, and technical payload behind inline disclosure sections.

## Non-goals

- No auth or permissions changes.
- No methodology schema changes.
- No modal-first result UX.
