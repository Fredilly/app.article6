---
# RC-2026-01-31 — Linked rules count stuck at 0

## Symptom
- Verify KPI strip showed `Linked rules: 0` even after opening rules.
- Exported snapshots had:
  - `"itemsCount": 10`
  - `"linkedRulesCount": 0`
  - `"outcome.linkage.linkedRuleIds": []`

## Impact
- Demo flow blocked for ~24 hours.
- Outcome widget + exported run artifacts looked incorrect, reducing trust.

## Reproduction
1) Run Verify with AOI + STAC (items returned).
2) Open a rule via Methods pane / Rules tab (URL includes `?rule=R-...`).
3) Return to Verify: `Linked rules` stayed 0.
4) Export snapshot: linkage array empty.

## Root Cause
An effect in `src/components/map/ProofMapTab.tsx` cleared `linkedRuleIds` to `[]`
whenever `currentAoiFingerprint` (and method/version) changed.

AOI fingerprint updates are part of the normal Verify run lifecycle, so the UI
would:
- hydrate linkedRuleIds from storage correctly
- then immediately wipe it back to empty
→ KPI/Outcome/export read the empty list and reported 0.

## Fix
- Removed the clearing effect:
  - deleted `useEffect(() => setLinkedRuleIds([]), [currentAoiFingerprint, methodCode, version])`
- Added an explicit storage reset API:
  - `clearLinkedRuleIdsFromStorage(methodCode, version)` in `src/lib/verify/runState.ts`
- Cleared linked rules ONLY on explicit user intent (“Start over”):
  - call `clearLinkedRuleIdsFromStorage(methodCode, version)` inside `runStartOver`
- Fixed lint deps for `runStartOver` callback (added `methodCode`, `version`).

## Why this works
- Linked rules are “verifier minutes” (what was viewed). They should not reset on
incidental run state changes like AOI fingerprint updates.
- Storage-backed linkedRuleIds now remain stable across tab switches and run
updates, and only reset when the user explicitly starts over.

## Verification
- After fix, exported snapshot shows:
  - `"itemsCount": 10`
  - `"linkedRulesCount": 8`
  - `"outcome.linkage.linkedRuleIds": ["R-1-0001"... "R-1-0008"]`
  - coverage numerator/denominator = 8/8
  - repoCommit captured

(Attach sample snapshot filename: `[evidence-snapshot.AR-AM0014.v03-0.json]`)

## Prevention
- Rule: do not clear “minutes/checklist” state on incidental deps (AOI hash,
fingerprint, tab changes). Only clear on explicit user actions.
- Add a regression test:
  - hydrate linkedRuleIds from storage
  - simulate AOI fingerprint change
  - assert linkedRuleIds remains unchanged
- Require comments on any `setX([])` effects in Verify flow explaining reset
intent and trigger.

## References
- PR: #397
- Key files:
  - `src/components/map/ProofMapTab.tsx`
  - `src/lib/verify/runState.ts`
---
