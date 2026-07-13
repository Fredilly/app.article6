# Marcondes REDD+ VM0007 v1.8 Evidence Map truth intake

- Reviewed rows: 48 of 58
- Remaining rows: 10, unreviewed and NOT_ASSESSED
- Corrected evidence states: FOUND 6, UNCLEAR 19, MISSING 2, N/A 21
- Reviewer outcomes: CONFORMS 6, ACTION_REQUIRED 21, NOT_APPLICABLE 21, NOT_ASSESSED 10
- Draft findings: NIR_CANDIDATE 21, OFI_CANDIDATE 0, NCR_CANDIDATE 0, null for reviewed N/A and remaining rows
- Gold promotion: BLOCKED_PENDING_REVIEW_COVERAGE
- Report release state: BLOCKED_PENDING_REVIEW_COVERAGE

## First-review truth intake: rules 39–48

The exact reviewed batch, in order, is R-3-0004, R-3-0007, R-3-0008, R-4-0001, R-4-0002, R-5-0001, R-5-0002, R-5-0003, R-5-0004, and R-5-0005. The prior 38 gold rows and IDs were preserved; no other rule was promoted.

Decisions and evidence basis:

- R-3-0004 — UNCLEAR/ACTION_REQUIRED. Pages 62 and 66 list VT0001 and a stepwise baseline/additionality process, but do not identify the selected investment-analysis option or its cost, IRR/NPV, or benchmark evidence.
- R-3-0007 — UNCLEAR/ACTION_REQUIRED. Page 68 defers the relevant quantification/monitoring information to validation; no reassessment frequency or next scheduled revision is provided.
- R-3-0008 — N/A/NOT_APPLICABLE. Page 62 identifies MapBiomas/PRODES project data, not a qualifying VCS JNR jurisdictional baseline.
- R-4-0001 — FOUND/CONFORMS. Pages 62 and 66 establish the VT0001 v3.0 tool and the project’s stepwise additionality procedure for the non-tidal APD activity.
- R-4-0002 — N/A/NOT_APPLICABLE. Pages 12 and 62 establish APD scope and state that no peat soils or tidal wetlands are present; the tidal-wetland ADD-AM pathway is not triggered.
- R-5-0001 — MISSING/ACTION_REQUIRED. Page 68 defers quantification; no complete REDD baseline/project/leakage equation or calculation is present.
- R-5-0002 — N/A/NOT_APPLICABLE. Pages 12 and 62 establish APD scope and no peat/tidal wetlands, so the WRC equation is not applicable.
- R-5-0003 — UNCLEAR/ACTION_REQUIRED. Pages 61, 64, and 65 identify LK-ASP and market-leakage context, but not the complete pathway, significance, and calculation evidence required by §8.3.
- R-5-0004 — N/A/NOT_APPLICABLE. Pages 12 and 62 establish that the WRC-specific wetland leakage pathway is absent.
- R-5-0005 — MISSING/ACTION_REQUIRED. Page 68 defers quantification; no T-BAR percentage, baseline/project inputs, or buffer contribution calculation is present.

The source document SHA-256 remains `a28e013ddbb4522b93ec954e2f9ca950b5fb906d6ead708e2cc11d829a3e37ea`. Accepted quotes are verbatim from `raw-document-extraction.json`, with manual page/section/span provenance. The machine’s generic stitched proposal evidence was rejected for every new row. The project is APD REDD; no external VVB validation or certification is claimed.

Gold promotion and report release remain blocked. Gold coverage is now 48/58; 10 rules remain `NOT_ASSESSED`. Independent-audit coverage remains exactly 38/58 and `independent-audit.json` is unchanged.

The batch-five `officialRequirementQuote` fields were corrected to the exact verbatim `source_span_text` wording from the authoritative VM0007 v1.8 rule records. Citation suffixes, rule-title summaries, and synthesized interpretations remain in traceability summaries rather than official quotes. Batch-five quote integrity is tested against the authoritative rule records, including methodology/version/section/page traceability and manual project-evidence provenance.

The post-998 runtime test continues to regenerate all 58 rules and now pins the batch-five machine baseline: all ten currently return `partially_supported`, with the selected page sets and gold states recorded in the test. The test intentionally records the current machine-versus-gold disagreements without requiring the known production retrieval behavior to match gold. No gold state or outcome changed.

## Production improvement candidate

- Pattern: generic methodology boilerplate or stitched page-level text is repeatedly selected as project evidence, and module naming is treated as proof of complete implementation or calculation.
- Affected rules: R-3-0004, R-3-0007, R-3-0008, R-4-0001, R-4-0002, R-5-0001, R-5-0002, R-5-0003, R-5-0004, R-5-0005.
- Current machine behavior: the same unrelated truncated baseline/additionality or methodology-application quote is proposed for all ten rows.
- Safer generic behavior: resolve applicability first, require project-specific evidence for every mandatory component, reject truncated/stitched quotes, and treat module/tool declarations as scope evidence rather than proof of calculations or decisions.
- Separate production PR required: YES.

## Previous review history

The next reviewed rows are exactly R-2-0003, R-2-0004, R-2-0009, R-2-0010, R-2-0011, R-2-0012, R-2-0013, R-2-0014, R-2-0015, and R-3-0003. R-2-0004 is N/A because reference regions are the AUDef pathway; Marcondes is APD using BL-PL. R-2-0009, R-2-0011, and R-2-0015 independently resolve WRC applicability as N/A from the APD classification and the project statement that no peat soils or tidal wetlands are present. R-2-0014 is FOUND/CONFORMS with a consistent 40-year period from 01 May 2023 through 30 April 2063. R-2-0003, R-2-0010, R-2-0012, R-2-0013, and R-3-0003 remain UNCLEAR/ACTION_REQUIRED because declarations or module references do not supply every mandatory project-specific component.

The first 28 rows of the independent-audit fixture remain textually and semantically unchanged. The remaining 20 rules remain outside independent audit and excluded from gold and NOT_ASSESSED. Raw extraction, machine proposals, methodology contracts, audit logic, production logic, report UI, and release gates were not changed.

The ten new gold rows preserve their original machine-proposal row objects verbatim; reviewed truth and rejected evidence are recorded separately. Methodology traceability uses verbatim official excerpts and separately lists mandatory modules/tools. R-2-0014 is FOUND/CONFORMS: three PDD locations consistently establish 01 May 2023–30 April 2063, 40 years; the client action is retention-only.

VM0007 v1.8 is version-qualified. The page 61 Section 3.1.1 VM0007 v1.7 wording remains a visible drafting contradiction; Table 30 and repeated project declarations identify v1.8. Version reconciliation is complete. Gold and report release remain blocked because review coverage is incomplete.

Accepted evidence for pages 12, 18–19, and 38 is located under 2 PROJECT DETAILS. Accepted evidence for pages 62–66 is located under 3 CLIMATE. Manually adjudicated evidence uses explicit manual:... provenance IDs; no fabricated parser element IDs are used.

An independent blind adversarial review was completed. The final reviewer retained the existing outcomes for all reviewed rules except for correcting the R-6-0008 requirement semantics to uncertainty reduction requirements and re-adjudicating R-1-0014 under VM0007 v1.8 Section 4.3.4.

## Independent truth audit batch 1

The first 10 existing reviewed rows were independently audited directly against the VM0007 v1.8 requirement logic and the preserved PDD extraction. Seven rows are CONFIRMED. R-1-0001 is CORRECTED to UNCLEAR/ACTION_REQUIRED because the PDD identifies the VCS threshold categories and supplies page-62 MapBiomas/PRODES history, but does not preserve numeric forest-definition thresholds. R-1-0002 is CORRECTED at the evidence level: the prior accepted quote listed AUDef/APDef but did not prove the project’s APDef selection; the accepted quote now preserves the page-62/63 project-specific classification and legal basis, with FOUND/CONFORMS retained. R-3-0005 is CORRECTED at the evidence level: page 61 Table 30 now preserves VMD0006 selection and page 63 preserves VMD0006 applicability plus the APD rationale, with FOUND/CONFORMS retained. No row had insufficient source access.

Audit records are in `independent-audit.json`. The cumulative audit contains exactly 38 unique rows: 30 CONFIRMED and 8 CORRECTED, with no source-access failures. Conditional applicability is resolved before evidence completeness: R-2-0002 is N/A because only the APD/BL-PL spatial baseline is identified. The remaining 20 rows remain excluded from gold.

The source requirement cross-check used the official [VM0007 v1.8 methodology page](https://verra.org/methodologies/vm0007-redd-methodology-framework-redd-mf-v1-8/) and its listed methodology, module, and tool requirements, with the preserved Marcondes PDD pages used for project evidence. No source-access failure occurred.


## Batch 2 review: R-1-0003 and R-1-0006 through R-1-0014

Nine newly audited rules remain N/A. R-1-0014 is CORRECTED to FOUND/CONFORMS under official VM0007 v1.8 Section 4.3.4, page 18: the ARR exclusion is satisfied by the APD-only scope, while the separate WRC-plus-ARR accounting clause is not triggered. For the other rows, the PDD identifies the project as APD/upland REDD and explicitly states: “There are no peat soils and tidal wetlands present in the Marcondes REDD+ Project Area.” The AUDef-agent rule is out of scope because APDef is applicable. RWE requirements are out of scope because the project activity is APD. WRC, peatland, tidal-restoration, CIW, and AUWD rules are out of scope because the project area has no peat soils or tidal wetlands.

Each accepted quote is PDF-backed with manual provenance, page, section, and span ID. R-1-0014 additionally records the official methodology traceability and project evidence from pages 12, 61, and 63. The fresh machine proposal is retained separately as machine-proposal-post-999-review-candidate.json. A reusable retrieval weakness remains documented: page-level extraction can select a broad methodology span instead of the narrow project statement; this truth-intake PR does not change production logic.

## Batch 3 review: R-1-0013 and R-1-0014

R-1-0013 and R-1-0014 are N/A/FOUND respectively under the prior review. The final eight were independently re-audited blind. R-1-0015, R-2-0008, R-2-0016, and R-3-0006 are CONFIRMED. R-2-0002 is CORRECTED to N/A because the project identifies only APD/BL-PL and no parallel spatial baseline. R-2-0001 and R-2-0006 remain UNCLEAR because parcel-boundary and X-STR evidence is incomplete. R-3-0002 remains UNCLEAR only on the minimum required alternative-scenario list; barrier/investment analysis and final baseline selection are outside that row.

Accepted evidence pages: 22–24, 41–42, and 62–65. R-2-0001 preserves Table 10 headers and representative parcel rows, but the independent audit does not treat those as proof of all six boundary elements for all 36 parcels. R-3-0002 preserves all three scenario records, but they do not match the three required VM0007/VT0001 categories. Rejected machine evidence is preserved for every new row. No unreviewed row is promoted into gold. Review coverage is 38 of 58, with 20 rules remaining outside independent audit; gold promotion and report release remain blocked.

## Independent audit batch 4: reconciled next 10

Gold review coverage is 38/58 and independent audit coverage is 38/58. This batch had six direct blind matches: R-2-0009, R-2-0011, R-2-0013, R-2-0014, R-2-0015, and R-3-0003. Four initial disagreements (R-2-0003, R-2-0004, R-2-0010, and R-2-0012) were reconciled with gold retained. The audit result is CONFIRMED for all ten rows; no gold judgment changed.

The four disagreements preserve the original blind state, reviewer outcome, and finding candidate separately from the reconciled gold judgment. The evidence basis is the retained PDD extraction and official requirement text in the merged gold rows; no machine-proposal evidence was used as the audit basis. The PDD SHA-256 remains `a28e013ddbb4522b93ec954e2f9ca950b5fb906d6ead708e2cc11d829a3e37ea`.

Twenty rules remain outside independent audit. Gold promotion and report release remain blocked until full required coverage is complete. This fixture records an internal reconciled audit only and does not claim external VVB validation or certification.
