# Quick Check v2 fixture intake: Tumed Left Banner Improved Agricultural Land Management Project

This fixture was created by the intake command and independently reviewed against the source PDF.

Adjudication is complete. The machine proposal is preserved in `gold.draft.json`; final reviewed truth is in `gold.json`; the proposal-to-review trail is in `corrections.json`.

- Fixture id: 5739
- Source PDF: /Users/stphen/Desktop/5739 TUMED_VCS PD DRAFT 5739 16-Sep-2025.pdf
- Document type: PDD / Project Description
- Checks reviewed: 6
- Final statuses: FOUND 5; UNCLEAR 1; MISSING 0; N/A 0
- Reviewed rule IDs: host_country, methodology, baseline_scenario, additionality, leakage, stakeholder_consultation

## Adjudication notes

- `host_country`: ACCEPTED `China.` on PDF page 4, section `1.1 Summary Description of the Project`, span `5739-extracted:p4:b67:9037f4c4`. The draft's page-6 `Minhang` address is rejected because it belongs to Shanghai Discovery Energy Services, the consultant listed under section 1.7, not the project location.
- `methodology`: ACCEPTED exact methodology table evidence on page 19, section 3.1.
- `baseline_scenario`: ACCEPTED exact section 3.4 evidence on page 25.
- `additionality`: UNCLEAR. Sections 3.5 on pages 25–26 establish that regulatory surplus is addressed and list barrier analysis and common-practice analysis as required steps, but do not provide project-specific analyses. The statement that additionality shall be demonstrated is a requirement, not proof that it was demonstrated.
- `leakage`: ACCEPTED the substantive `Leakage Management` evidence in section 1.19 on page 17. The project screens the VM0042 leakage pathways and concludes that the identified activities are not applicable. The page-27 section 4.3 omission is rejected as boilerplate rather than project-specific leakage evidence.
- `stakeholder_consultation`: ACCEPTED the explicit omission statement in section 2.1 on page 18.

## PR2 discrepancy reserve

The unchanged PR1 runtime still disagrees with the reviewed truth for three rows: it chooses a consultant address containing `Minhang` instead of the project location `China`; treats the additionality requirement/list as `FOUND` despite absent project-specific barrier and common-practice analyses; and selects page-27 leakage omission boilerplate instead of the substantive page-17 screening. This fixture records the PDF truth and preserves the machine proposal; production extraction logic is intentionally unchanged in PR1.
