# PR25 Local run history (last N runs)

## Scope
- Persist the last 10 Verify runs per method/version locally.
- Add a minimal Run history UI to load prior runs and re-export.
- Ensure export uses the currently loaded run state.

## Non-goals
- No backend or GitHub API integration.
- No UI polish beyond a compact list.
- No minutes template/limits work.

## Files touched
- src/components/map/ProofMapTab.tsx
- src/components/verify/RunHistoryPanel.tsx
- src/lib/verify/runState.ts
- tests/lib/verify.runState.test.ts

## Visible UI change to look for
- Verify shows a Run history list with Load (and Delete).
- Loading swaps minutes/checklist/linked rules/AOI/pins selections.
