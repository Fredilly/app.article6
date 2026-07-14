# RC2 VM0007 v1.8 benchmark baseline

This committed baseline measures the current machine proposal against reviewed Marcondes truth. It changes no production behavior.

## Dataset

- Methodology: VM0007 v1.8
- Coverage: exactly 58 aligned stable rule IDs
- Machine and reviewed evidence remain separate collections.

## Headline metrics

- Fully matching categorical rows: 0/58
- Categorical rows with a mismatch: 58
- Accepted evidence precision / recall / F1: 0 / 0 / null
- Rejected evidence precision / recall / F1: null / 0 / null
- Accepted provenance full-match rate: null
- Rejected reason agreement: null

## Ranked generic failures

1. **accepted evidence missed** (58 rules; accepted-evidence-missed) — Improve generic retrieval coverage and accepted-evidence ranking.
2. **accepted evidence false support** (58 rules; accepted-evidence-false-support) — Improve generic accepted-evidence retrieval and ranking to suppress weak or boilerplate support.
3. **client-action disagreement** (58 rules; client-action-mismatch) — Improve generic action drafting from evidence gaps and review outcomes.
4. **contradiction-state disagreement** (58 rules; contradiction-state-mismatch) — Improve generic contradiction detection and decision reconciliation.
5. **draft-finding disagreement** (58 rules; draft-finding-mismatch) — Improve generic finding-candidate derivation from reviewed outcomes.

Recommended first RC3 fix: **accepted-evidence-missed** based on deterministic affected-rule ranking.

## Scope

This PR measures and ranks current behavior only. It does not fix benchmark failures or change retrieval, audit, fixtures, reviewed truth, UI, persistence, reports, or exports.
