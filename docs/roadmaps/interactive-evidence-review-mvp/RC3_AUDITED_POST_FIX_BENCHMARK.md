# RC3 audited post-fix benchmark

- Frozen baseline: `docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_PRE_FIX_BASELINE.json` (12c6276c12ba62d7f93987e3d4097d732ab05ded1432621a5895aa7527e5be87)
- Frozen pre-fix proposal: `docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_PRE_FIX_PROPOSAL.json` (2ffe9413b09a795edc50b15e9564716f9fcf51d916f13368b416d2b22088fb85)
- Reviewed truth: `tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json` (af93a39a0b874377efe88648f6f4538c2454c9e8dcceae66086681b4a336f75c)
- Raw extraction: `tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/raw-document-extraction.json` (7031b49bf70d541679788e65f74efef09921712a506a0ba4aa28d0b0bcd98747)
- Frozen pre-fix diagnostic: `docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_DIAGNOSTIC.json` (3dc8f4616eae03b1bfbc44e2a872f7177d56c06766c0524e22571573b6b298bd)
- Human review input: `docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_POST_FIX_MANUAL_REVIEW.json` (56201e020a0180f4905c46245c658cc63f6b472cf8babf0c41404e7cd1564d45)
- Post-fix audit execution: 8257b8d8c16f9f71da0f2d5aad2fab9a083cc1e527ef34909ec6b5b88d0ae834

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| acceptedEvidenceFalseSupport | 174 | 139 | -35 |
| acceptedEvidenceMissed | 97 | 97 | 0 |
| evidenceStateFailures | 38 | 38 | 0 |
| applicabilityFailures | 6 | 6 | 0 |
| reviewerOutcomeFailures | 58 | 58 | 0 |
| contradictionFailures | 58 | 58 | 0 |
| draftFindingFailures | 58 | 58 | 0 |
| clientActionFailures | 58 | 58 | 0 |
| acceptedEvidencePrecision | 0 | 0 | 0 |
| acceptedEvidenceRecall | 0 | 0 | 0 |
| acceptedEvidenceF1 | null | null | null |

Serialized-row changes: 21. Diagnostic-trace changes: 0. Changed rules reviewed from authored input: 21. Improvements: acceptedEvidenceFalseSupport. Regressions: none. Phase 3 gate: **passed**.

No production logic or reviewed/frozen artifact was changed by this benchmark.
