# Quick Check v2 fixture intake: Tumed Left Banner Improved Agricultural Land Management Project

This fixture was created by the intake command and independently reviewed against the source PDF.

Adjudication is complete. The machine proposal is preserved in `gold.draft.json`; final reviewed truth is in `gold.json`; the proposal-to-review trail is in `corrections.json`.

- Fixture id: 5739
- Source PDF: /Users/stphen/Desktop/5739 TUMED_VCS PD DRAFT 5739 16-Sep-2025.pdf
- Document type: PDD / Project Description
- Checks reviewed: 6
- Final statuses: FOUND 6; UNCLEAR 0; MISSING 0; N/A 0
- Reviewed rule IDs: host_country, methodology, baseline_scenario, additionality, leakage, stakeholder_consultation

## Adjudication notes

- `host_country`: ACCEPTED `China.` on PDF page 4, section `1.1 Summary Description of the Project`, span `5739-extracted:p4:b67:9037f4c4`. The draft's page-6 `Minhang` address is rejected because it belongs to Shanghai Discovery Energy Services, the consultant listed under section 1.7, not the project location.
- `methodology`: ACCEPTED exact methodology table evidence on page 19, section 3.1.
- `baseline_scenario`: ACCEPTED exact section 3.4 evidence on page 25.
- `additionality`: ACCEPTED exact section 3.5 evidence on page 26.
- `leakage`: ACCEPTED the explicit omission statement in section 4.3 on page 27.
- `stakeholder_consultation`: ACCEPTED the explicit omission statement in section 2.1 on page 18.

## PR2 discrepancy reserve

The generic host-country extractor appears to choose a consultant address containing `Minhang` instead of the project location `China`. This fixture records the PDF truth and preserves the machine proposal; production extraction logic is intentionally unchanged in PR1.
