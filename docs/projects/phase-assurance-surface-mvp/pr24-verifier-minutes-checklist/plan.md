# PR24 Verifier minutes + checklist (run bundle)

## Scope
- Add Verifier minutes + checklist persisted per method/version and run context.
- Surface minutes/checklist UI on Verify with a run indicator and optional New run.
- Include verifier minutes/checklist/run metadata in exported snapshot JSON.
- Optional Create ticket action (copy block + open prefilled issue link).

## Non-goals
- No multi-run history UI.
- No GitHub API integration or server-side ticket creation.
- No refactors of Verify layout or storage systems.

## Files touched
- src/components/map/ProofMapTab.tsx
- src/components/verify/VerifierMinutesPanel.tsx
- src/lib/verify/runState.ts
- src/lib/verify/snapshotExport.ts
- src/lib/proofMap/evidenceSnapshot.ts
- src/lib/proofMap/evidenceSnapshot.test.ts
- tests/lib/verify.runState.test.ts

## Visible UI change to look for
- Verify panel includes a Verifier minutes textarea and a Checklist list.
- Run indicator shows a short run id; New run resets minutes/checklist.
- Snapshot export now includes verifier minutes/checklist/run metadata.
