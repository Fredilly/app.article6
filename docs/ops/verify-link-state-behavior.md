# Verify Link State Behavior

This spec covers the app-side verify workflow after a successful evidence link or unlink mutation.

## Post-link expectations

When a verifier links a selected evidence item to the active rule:

- the evidence inventory card must switch from `Unlinked` to `Linked` without a reload
- the linked card action must switch from `Link` to `Unlink`
- the unlinked inventory count must drop immediately
- the selected item inspect panel must show the linked rule immediately
- the verify workflow `Next required action` must advance past `Create/link pin`
- reviewer artifact save and finalize gating must unblock once the remaining requirements are satisfied

## Post-unlink expectations

When the verifier unlinks that same evidence item from the active rule:

- the evidence inventory card must switch back to `Unlinked` without a reload
- the card action must switch back from `Unlink` to `Link`
- the unlinked inventory count must increase immediately
- the selected item inspect panel must remove the linked rule immediately
- the verify workflow `Next required action` must return to `Create/link pin`
- reviewer artifact save and finalize gating must re-block when no linked evidence remains

## Reload expectations

Linked state is part of the persisted verify workspace state. After a refresh or reopen:

- linked inventory cards must still render as `Linked`
- linked and unlinked counts must match the persisted pins
- linked rule summaries must still render from the persisted pins
- transient STAC search/selection context may require rerunning the search, but persisted inventory linkage must remain correct

## Regression boundary

- STAC create/link uses the same derived linked-rule selectors as workbook and monitoring-report evidence
- fixing STAC link refresh must not change existing workbook evidence behavior
- fixing STAC link refresh must not change existing monitoring-report evidence behavior
