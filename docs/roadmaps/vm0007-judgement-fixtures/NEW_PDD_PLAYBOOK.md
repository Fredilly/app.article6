# New PDD Playbook

Use this exact workflow when adding a new PDD to the VM0007 evidence-map learning process.

1. Supply the PDF path, stable project ID, project title, and optional registry ID.
2. Confirm the PDF exists.
3. Derive the project intake folder from the project ID.
4. Record the source identity and file hash.
5. Run Quick Check and document extraction.
6. Verify project identity, methodology, and version from the PDF.
7. Generate and preserve the untouched 58-row machine Evidence Map.
8. Open PR1 truth intake.
9. Review high-value, UNCLEAR, MISSING, contradictory, and weak-provenance rows.
10. Record reviewed truth, rejected evidence, corrections, and `REVIEW.md`.
11. Open PR2 generic system improvement.
12. Classify reusable edge cases and improve only shared logic.
13. Rerun all previous fixtures and regressions.
14. Complete all intended row reviews.
15. Finalize the Evidence Map.
16. Generate HTML and PDF from the same finalized model.
17. Run the client-release gate.
18. Repeat on an unseen PDD before declaring the process standard.

## Intake Example

PDF:

`~/Desktop/vm0007_v18_pdds copy/5953-Marcondes-Brazil-pdd.pdf`

ID:

`marcondes-redd-brazil-5953`

Title:

`Marcondes REDD+`

Registry ID:

`5953`
