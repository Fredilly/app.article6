# 5595 Asvata ALM India — Final Reconciled Gold Review

## Review process
1. Current Quick Check output frozen in `gold.draft.json`.
2. First independent PDF-grounded adjudication.
3. Second blind adversarial adjudication.
4. Differences reconciled against the source PDF.

## Final outcomes
| Check | Machine | Final gold | Judgment |
|---|---|---|---|
| host_country | UNCLEAR | FOUND | India is directly identified. |
| methodology | FOUND v2.0 | UNCLEAR | VM0042 is clear, but v2.0/v2.1 conflict is unresolved. |
| baseline_scenario | FOUND | FOUND | Substantive baseline evidence is present. |
| additionality | FOUND | UNCLEAR | Regulatory surplus is partly populated, but barrier/common-practice analysis is not demonstrated. |
| leakage | FOUND | UNCLEAR | Machine selected template text; project-specific content is qualitative only. |
| stakeholder_consultation | FOUND | FOUND | Direct dated consultation evidence exists on p.27-28. |

**Final totals: 3 FOUND / 3 UNCLEAR / 0 MISSING.**

## Key corrections

### host_country
Final: `FOUND`, answer `India`.
Failure: `qualifying evidence missed`.

### methodology
Final: `UNCLEAR`.
VM0042 is consistent, but version references conflict:
- v2.0: p.4, p.34, p.36
- v2.1: p.5, p.6, p.7, p.37

Do not represent this as `FOUND + NIR`; Quick Check gold keeps Quick Check status semantics.
Failure: `contradiction missed`.

### baseline_scenario
Final: `FOUND`.
Accepted evidence: p.36-37, continuation of pre-project agricultural practices including excessive fertilizer use, crop-residue burning, and intensive tillage.

### additionality
Final: `UNCLEAR`.
The PDD includes regulatory-surplus responses but only lists barrier analysis and common-practice analysis without substantively completing them.
Failure: `assessment too strong`.

### leakage
Final: `UNCLEAR`.
Machine evidence on p.39 is untouched VCS template instruction text, not project evidence. Project-specific leakage discussion on p.22 is qualitative and does not provide the quantification procedure/results.
Failure: `generic-text false support`.

### stakeholder_consultation
Final: `FOUND`.
Strongest evidence is the dated consultation record on p.27-28, not the earlier stakeholder-identification text.
Failure: `qualifying evidence missed`.

## Reusable lessons
1. Strong project identity evidence can resolve country even when the location section omits the country name.
2. Methodology version resolution must detect internal contradictions.
3. Additionality framework language is not equivalent to completed analysis.
4. Untouched VCS template prompts must never count as project evidence.
5. Qualitative leakage discussion can still be insufficient for a quantification-oriented check.
6. Correct status with weak evidence is still a fixture failure.
7. Quick Check and Evidence Map share truth but not final status vocabularies.

## PR1 invariant
Truth intake only. Do not change parser, retrieval, ranking, evidence selection, sufficiency, routing, Evidence Map logic, reporting, UI, or eval thresholds in this PR.
