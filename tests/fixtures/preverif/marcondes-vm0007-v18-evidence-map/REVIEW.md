# Marcondes REDD+ VM0007 v1.8 Evidence Map truth intake

- Reviewed rows: 28 of 58
- Remaining rows: 30, unreviewed and NOT_ASSESSED
- Corrected evidence states: FOUND 4, UNCLEAR 12, MISSING 0, N/A 12
- Reviewer outcomes: CONFORMS 4, ACTION_REQUIRED 12, NOT_APPLICABLE 12, NOT_ASSESSED 30
- Draft findings: NIR_CANDIDATE 12, OFI_CANDIDATE 0, NCR_CANDIDATE 0, null for reviewed N/A and remaining rows
- Gold promotion: BLOCKED_PENDING_REVIEW_COVERAGE
- Report release state: BLOCKED_PENDING_REVIEW_COVERAGE

VM0007 v1.8 is version-qualified. The page 61 Section 3.1.1 VM0007 v1.7 wording remains a visible drafting contradiction; Table 30 and repeated project declarations identify v1.8. Version reconciliation is complete. Gold and report release remain blocked because review coverage is incomplete.

Accepted evidence for pages 12, 18–19, and 38 is located under 2 PROJECT DETAILS. Accepted evidence for pages 62–66 is located under 3 CLIMATE. Manually adjudicated evidence uses explicit manual:... provenance IDs; no fabricated parser element IDs are used.

An independent blind adversarial review was completed. The final reviewer retained the existing outcomes for all reviewed rules except for correcting the R-6-0008 requirement semantics to uncertainty reduction requirements and re-adjudicating R-1-0014 under VM0007 v1.8 Section 4.3.4.

## Independent truth audit batch 1

The first 10 existing reviewed rows were independently audited directly against the VM0007 v1.8 requirement logic and the preserved PDD extraction. Seven rows are CONFIRMED. R-1-0001 is CORRECTED to UNCLEAR/ACTION_REQUIRED because the PDD identifies the VCS threshold categories and supplies page-62 MapBiomas/PRODES history, but does not preserve numeric forest-definition thresholds. R-1-0002 is CORRECTED at the evidence level: the prior accepted quote listed AUDef/APDef but did not prove the project’s APDef selection; the accepted quote now preserves the page-62/63 project-specific classification and legal basis, with FOUND/CONFORMS retained. R-3-0005 is CORRECTED at the evidence level: page 61 Table 30 now preserves VMD0006 selection and page 63 preserves VMD0006 applicability plus the APD rationale, with FOUND/CONFORMS retained. No row had insufficient source access.

Audit records are in `independent-audit.json`. The cumulative audit contains exactly 28 unique rows: 20 CONFIRMED and 8 CORRECTED, with no source-access failures. The audit confirms that incomplete multi-part requirements remain UNCLEAR/ACTION_REQUIRED, rejected machine evidence is not used as truth, and the remaining 30 rows remain excluded from gold.

The source requirement cross-check used the official [VM0007 v1.8 methodology page](https://verra.org/methodologies/vm0007-redd-methodology-framework-redd-mf-v1-8/) and its listed methodology, module, and tool requirements, with the preserved Marcondes PDD pages used for project evidence. No source-access failure occurred.


## Batch 2 review: R-1-0003 and R-1-0006 through R-1-0014

Nine newly audited rules remain N/A. R-1-0014 is CORRECTED to FOUND/CONFORMS under official VM0007 v1.8 Section 4.3.4, page 18: the ARR exclusion is satisfied by the APD-only scope, while the separate WRC-plus-ARR accounting clause is not triggered. For the other rows, the PDD identifies the project as APD/upland REDD and explicitly states: “There are no peat soils and tidal wetlands present in the Marcondes REDD+ Project Area.” The AUDef-agent rule is out of scope because APDef is applicable. RWE requirements are out of scope because the project activity is APD. WRC, peatland, tidal-restoration, CIW, and AUWD rules are out of scope because the project area has no peat soils or tidal wetlands.

Each accepted quote is PDF-backed with manual provenance, page, section, and span ID. R-1-0014 additionally records the official methodology traceability and project evidence from pages 12, 61, and 63. The fresh machine proposal is retained separately as machine-proposal-post-999-review-candidate.json. A reusable retrieval weakness remains documented: page-level extraction can select a broad methodology span instead of the narrow project statement; this truth-intake PR does not change production logic.

## Batch 3 review: R-1-0013 and R-1-0014

R-1-0013 and R-1-0014 are N/A/FOUND respectively under the prior review. The final eight were independently re-audited blind. R-1-0015, R-2-0008, R-2-0016, and R-3-0006 are CONFIRMED. R-2-0001, R-2-0002, R-2-0006, and R-3-0002 are CORRECTED to UNCLEAR/ACTION_REQUIRED because the PDD supplies assertions, representative table rows, or general descriptions without all mandatory project-specific components.

Accepted evidence pages: 22–24, 41–42, and 62–65. R-2-0001 preserves Table 10 headers and representative parcel rows, but the independent audit does not treat those as proof of all six boundary elements for all 36 parcels. R-3-0002 preserves all three scenario records, but they do not match the three required VM0007/VT0001 categories. Rejected machine evidence is preserved for every new row. No unreviewed row is promoted into gold. Review coverage remains 28 of 58, with 30 rows remaining NOT_ASSESSED; gold promotion and report release remain blocked.
