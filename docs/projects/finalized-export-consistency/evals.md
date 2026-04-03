# Evals

## Happy path finalized export

- Finalize a run with one selected STAC item linked to one rule.
- Confirm `selected.item.linked_rules` matches `outcome.linkage.linkedRuleIds`.
- Confirm the selected evidence record stays linked after reload and re-export.

## Summary usefulness

- Confirm the top-level `summary` names the method/version, rule, selected evidence, AOI, linked-rule scope, and reviewer note.
- Confirm the summary includes a short human-readable narrative.

## Redundancy reduction

- Confirm finalized artifacts keep only one lightweight candidate STAC ID list at `outcome.stac.itemIds`.
- Confirm finalized artifacts do not duplicate raw STAC payloads in multiple top-level sections.

## Checklist unused path

- Finalize with the default untouched checklist.
- Confirm unchecked default checklist rows are omitted from the artifact.
- Confirm exported metadata still states that the checklist was unused.

## Regression path

- Confirm draft snapshot export still builds successfully.
- Confirm finalized JSON and PDF export actions still work from the review summary surface.

## Reload and finalize consistency

- Finalize, refresh, then download JSON again.
- Confirm linkage, KPIs, and summary remain stable across reload.
