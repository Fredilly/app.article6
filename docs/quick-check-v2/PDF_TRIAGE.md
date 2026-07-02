# Quick Check PDF Triage

When given a new PDF, do not create a fixture first.

First run/export Quick Check results and classify the PDF into one bucket:

- `A. GOLD FIXTURE`: Engine is wrong, including wrong answer, hallucinated evidence, missed strong evidence, wrong quote/page/section/span, or a new document structure.
- `B. UI CLEANUP / CLASSIFICATION DRIFT`: Engine is right, but the UI label or display is confusing.
- `C. SKIP`: Already covered by an existing fixture or no new failure mode.

Return:

- PDF name
- bucket
- priority
- reason
- engine result
- UI issue, if any
- recommended next action

Rules:

- Do not create a fixture before bucketing the PDF.
- Do not turn every deed into a fixture.
- Do not create Phase 7 fixtures unless there is a real new engine failure.
- `ISS_REP` labeled `unknown`, `non-PDD`, or `registry-public-record` is acceptable if all evidence checks are correctly missing. `unknown` is not automatically a failure.

Recommended next action:

- `A`: open a fixture task only after the user approves.
- `B`: fix the UI label/display only if the engine result is already correct.
- `C`: skip the PDF or mark it covered by an existing fixture.
