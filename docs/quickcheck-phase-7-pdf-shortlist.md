# Quick Check v2 Phase 7 PDF Shortlist

I scanned all `23` PDFs under `~/Desktop/test folder 2` and ranked them with this messiness score:

`old template + over 80 pages + lots of tables + bad spacing + non-PDD report + one point per check that did not return FOUND`

The table below keeps the shortlist diverse. I excluded obvious duplicate siblings like the compressed PLUM copy and repeated folder copies of the same report family.

## Ranked candidates

Legend:
- QC status: `F` = `FOUND`, `U` = `UNCLEAR`, `M` = `MISSING`
- Evidence source: `fc` = `fact_contract`, `es` = `exact_section`, `rt` = `raw_text_fallback`
- Flags are heuristic, based on extracted text quality and current v2 output

| Rank | PDF | Registry | Type | Pages | Score | Flags | Current Quick Check summary | Why useful |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | `PROJ_DESC_674_15MAY2011.pdf` | VCS | PDD/project description | 148 | 7 | `>80`, tables, spacing | `H:F(fc) M:U(fc) B:U(rt) A:U(rt) L:F(es) S:U(rt)` | Long VCS PDD with table-like extraction and mixed retrieval quality. |
| 2 | `Revised PDD.pdf` | UNFCCC | PDD/project description | 51 | 7 | spacing | `H:M M:U(fc) B:U(rt) A:U(rt) L:U(rt) S:M` | UNFCCC PDD with 6/6 misses and noisy spacing. |
| 3 | `ISS_REP_1530_09JUL2021.pdf` | VCS | unknown | 6 | 8 | spacing | `H:M M:M B:M A:U(rt) L:M S:M` | Very short deed-style file; the current v2 pipeline finds almost nothing. |
| 4 | `MK_PDD PDA3.pdf` | UNFCCC | PDD/project description | 26 | 6 | spacing | `H:M M:U(fc) B:U(rt) A:U(rt) L:F(es) S:M` | Small-scale UNFCCC PDD with one exact-section hit and five misses. |
| 5 | `VERIF_STA_1530_23JUL2021.pdf` | VCS | unknown | 4 | 7 | none | `H:M M:M B:M A:M L:M S:M` | Tiny verification/status-style file with a complete current QC miss. |
| 6 | `MONIT_REP_985_08AUG2016_07AUG2018.pdf` | CCB | monitoring report | 184 | 6 | `>80`, spacing | `H:F(fc) M:F(fc) B:U(rt) A:U(rt) L:F(es) S:F(es)` | Large monitoring report from a different registry with several exact hits. |
| 7 | `CCB_ValidationReport_V3-1_021913.pdf` | CCB | validation report | 56 | 6 | spacing | `H:M M:F(fc) B:U(rt) A:U(rt) L:U(rt) S:F(es)` | CCB validation report with mixed misses and a couple of solid hits. |
| 8 | `CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf` | CCB | verification report | 56 | 6 | spacing | `H:F(fc) M:U(fc) B:M A:U(rt) L:U(rt) S:F(es)` | CCB verification report with a missing baseline and partial provenance. |
| 9 | `VERRA-Verification-Report_2016-2021.pdf` | Verra | verification report | 63 | 5 | spacing | `H:F(fc) M:F(fc) B:U(rt) A:U(rt) L:U(rt) S:F(es)` | Verra-branded verification report that keeps some checks grounded and others weak. |
| 10 | `CCB_MON_REP_ENG_1530_01AUG2011_12DEC2020.pdf` | CCB | monitoring report | 219 | 4 | `>80`, spacing | `H:F(fc) M:F(fc) B:U(rt) A:F(es) L:F(es) S:F(es)` | Very long monitoring report; only baseline stays unclear. |
| 11 | `VALID_REP_1530_31MAY2016.pdf` | VCS | validation report | 31 | 4 | spacing | `H:F(fc) M:U(fc) B:F(es) A:F(es) L:F(es) S:F(es)` | Shorter validation report with one unclear methodology result. |
| 12 | `PROJ_DESC_612_10MAY2011.pdf` | VCS | PDD/project description | 11 | 3 | broken headings | `H:F(fc) M:F(fc) B:F(es) A:U(rt) L:U(rt) S:U(rt)` | Compact PDD with visibly broken heading structure and three misses. |
| 13 | `PD_REDD_v1_130.pdf` | VCS | PDD/project description | 178 | 3 | `old template`, `>80`, spacing | `H:F(fc) M:F(fc) B:F(es) A:F(es) L:F(es) S:F(es)` | Old-template VCS PDD control; current QC already passes it, so it is a lower-priority contrast case. |

## Recommended first 3

1. `PROJ_DESC_674_15MAY2011.pdf` - highest-messiness VCS PDD candidate; long, table-heavy, and still partially grounded by current QC.
2. `Revised PDD.pdf` - UNFCCC PDD with 6/6 current QC misses and spacing noise.
3. `PROJ_DESC_612_10MAY2011.pdf` - short PDD with broken headings and three current QC misses.
