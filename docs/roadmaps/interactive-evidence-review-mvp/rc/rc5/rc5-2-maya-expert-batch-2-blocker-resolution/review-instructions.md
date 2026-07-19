# RC5-2 Maya expert batch 2 blocker-resolution packet

This packet contains exactly three rules for independent adjudication:

- `Verra.AFOLU.VM0007.v1-8.R-1-0012`
- `Verra.AFOLU.VM0007.v1-8.R-1-0013`
- `Verra.AFOLU.VM0007.v1-8.R-2-0008`

For each rule, adjudicate using only the frozen official-source passages and that rule’s frozen PDD evidence. Return exactly one of these outcomes:

- `RESOLVED`: `reviewStatus` is `RESOLVED`, `evidenceAssessment` and `notes` are non-empty, `remainingBlockers` is empty, and `finalRuleDecision` is a complete canonical reviewed-truth decision using the repository’s existing fields and vocabulary.
- `UNRESOLVED`: `reviewStatus` is `UNRESOLVED`, `evidenceAssessment` and `notes` are non-empty, `finalRuleDecision` is `null`, and `remainingBlockers` contains every exact blocker that remains.

Do not preselect an outcome. Do not modify the stored PR #1088 conclusions, machine proposal, reviewed truth, or current inventory. A resolved response is an independent response only; it does not create or update `reviewed-truth.json` in this PR.

The PDD references Appendix 21, Appendix 22, the `Test of sig - 6 year bsl valid` tab, and a carbon-pool Table 4. Those attachments are not present in the frozen PDD or repository attachments used by this packet. They are marked missing rather than reconstructed.

Regenerate with:

```sh
npx tsx scripts/preverif/generate-rc5-maya-expert-batch2-blocker-resolution.ts
```
