# Finalized Export Consistency And Summary

## Goal

Make finalized verify exports internally consistent, less redundant, and more useful to reviewers without dropping machine-readable provenance.

## Contract

- The finalized artifact must have one canonical selected STAC item shape at `selected.item`.
- `selected.item.linked_rules` must reflect the actual finalized linked state, not raw search-result properties.
- Finalized search-result export must use at most one lightweight list of candidate IDs. The canonical list is `outcome.stac.itemIds`.
- Finalized exports should not duplicate the same STAC payload across `selected`, top-level `items`, and `stacItemsJson`.
- Export KPI names must describe what they count.
- Top-level `summary` must tell a human what happened without requiring a raw JSON read.
- Default unused checklist rows must not be exported as if they were meaningful reviewer output.

## Shape expectations

- `selected.item`
  - Canonical finalized selected evidence record.
  - Includes the selected item id and lightweight reviewer-relevant fields.
  - Includes `linked_rules` from finalized app state.
- `outcome.stac.itemIds`
  - Lightweight candidate search-result ID list for the finalized run.
- `kpis`
  - Uses explicit names for search-result count, selected-evidence count, and linked-rule count.
- `summary`
  - Includes reviewer-meaningful facts and a short narrative sentence.
- `verifier.checklist`
  - Omitted when no checklist items were meaningfully used.
  - Paired with explicit checklist status metadata.
