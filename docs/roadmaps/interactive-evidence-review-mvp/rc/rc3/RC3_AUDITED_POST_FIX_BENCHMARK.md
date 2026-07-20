# RC3 audited post-fix benchmark

- Frozen baseline: `docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_PRE_FIX_BASELINE.json` (472b5512070df175c5cdad438993119edb6a2caa8258ca69cf8c901d80513e20)
- Frozen pre-fix proposal: `docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_PRE_FIX_PROPOSAL.json` (2ffe9413b09a795edc50b15e9564716f9fcf51d916f13368b416d2b22088fb85)
- Reviewed truth: `tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json` (ad9576b39f90c28f829b013121eaf177f841c98b2a9997391b85027b4fcee511)
- Raw extraction: `tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/raw-document-extraction.json` (7031b49bf70d541679788e65f74efef09921712a506a0ba4aa28d0b0bcd98747)
- Frozen pre-fix diagnostic: `docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_DIAGNOSTIC.json` (8dba5b3b83444212d5d90a781958f6c9bfb43189a69035932061551c5a6ab220)
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

Serialized-row changes: 21. Accepted-evidence-miss diagnostic changes: 0. Changed rules reviewed from authored input: 21. Improvements: acceptedEvidenceFalseSupport. Regressions: none. Phase 3 gate: **passed**.

No production logic or reviewed/frozen artifact was changed by this benchmark.
