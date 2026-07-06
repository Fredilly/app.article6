# Quick Check v2 Gold Fixture Playbook
Use this playbook when creating or correcting a Quick Check v2 gold fixture from a single project PDF.

## Mission

Gold fixtures must make failures reproducible and prevent weak evidence from passing.

## Definition Of Valid Gold

A valid gold fixture contains:

- the reviewed answer
- the strongest quote
- the exact page
- the section or table context
- the review trail that explains why the evidence was selected

## Core Principles

- Do not weaken reviewed gold to match extractor output.
- Draft output is not truth.
- Empty corrections are not proof of correctness.
- Quote and page provenance are part of truth.

## PR Taxonomy

- PR1 truth intake
- Gold hygiene PR
- PR2 / PR2b system fix

Use PR1 for intake of the reviewed truth.
Use a Gold hygiene PR when the gold fixture needs cleanup, stronger provenance, or corrected evidence selection without changing the underlying system behavior.
Use PR2 or PR2b when the reviewed gold exposes a real system defect that must be fixed in production logic or extraction behavior.

## Gold Fixture Review Rules

- Treat reviewed gold as the source of truth once it has been validated.
- Never replace reviewed evidence with a weaker excerpt just because it is easier for the extractor to surface.
- Keep the best evidence even when the current app output differs.
- Preserve the review trail so later reviewers can see why the fixture is anchored the way it is.
- If the gold fixture is corrected, the correction must improve truth quality, not hide a mismatch.

## Draft Output Is Not Gold

Draft output is only a starting point.

- It may miss the strongest evidence.
- It may choose the wrong page.
- It may paraphrase instead of quoting.
- It may surface a generic heading instead of the actual proof.

Do not promote draft output into gold unless it is reviewed against the PDF and the surrounding context.

## Single-Page Evidence Rule

Prefer one page that directly proves the answer.

- Use the page with the most direct supporting evidence.
- Keep the exact page number in the fixture.
- If the strongest proof is on a different page than the summary, use the proof page.
- Do not rely on a nearby page just because it is more convenient or already extracted.

## Evidence Quality Rule

Gold evidence must be specific, not merely related.

- Prefer exact answer-bearing text over broad summaries.
- Prefer rows, notes, conclusions, or action items over headings alone.
- Reject generic boilerplate, TOC entries, and section names that do not carry the answer.
- If the evidence does not directly support the answer, it is not valid gold.

## Maya Lesson

The Maya fixture shows how evidence selection should work:

- Additionality should prefer page 92 conclusion evidence over page 91 methodology or tool introduction.
- Stakeholder consultation should prefer page 57 Table 7 comment/action rows over page 54 summary text or the table heading.

The lesson is simple: choose the page and span that actually prove the answer, not the page that merely introduces the topic.

## When Reviewed Gold Fails Tests

If reviewed gold fails tests:

- Do not weaken gold.
- Report the mismatch clearly.
- Classify whether PR2 or PR2b is needed.

If the failure is caused by the system output being wrong, the gold should stay truthful and the system should be fixed separately.
If the failure is caused by weak or incomplete gold, improve the fixture rather than hiding the problem.

## Fixture Improvement Workflow

1. Start from `main` and pull the latest remote changes.

   ```bash
   git checkout main
   git pull origin main
   ```

2. Create a new branch named `feat/qcv2-<fixture-id>-gold-fixture`.

   ```bash
   git checkout -b feat/qcv2-<fixture-id>-gold-fixture
   ```

3. Run the fixture intake command.

   ```bash
   npm run quickcheck:fixture:add -- \
     --pdf <pdf-path> \
     --id <fixture-id> \
     --title "<title>"
   ```

4. Open the generated fixture folder:

   ```text
   tests/fixtures/quick-check/v2/<fixture-id>/
   ```

5. Treat generated `gold.json` as draft only.

6. Review `gold.json` against `source.pdf` and `extracted.txt`.

7. Correct `gold.json` until it is the truth source for the fixture.

8. Keep the current wrong Quick Check output in `corrections.json` and `REVIEW.md`.

9. Verify every judgment field that matters:
   - `quote`
   - `page`
   - `sectionHeading`
   - `sectionPath`
   - `expectedStatus`
   - `expectedAnswer`

10. Prioritize methodology ID and methodology version review before other fields.

11. Run validation:

   ```bash
   npm test -- quickCheckV2
   npm test -- gold-fixtures
   npm run lint
   ```

12. Commit only the fixture or playbook files that belong to the task.

13. Open a PR.

## Merge Rule

- Do not merge wrong truth.
- Minor hygiene issues require an immediate follow-up cleanup PR.
- Do not let a small formatting or provenance issue block the fact that the fixture itself must remain truthful.
- If the evidence is wrong, fix the evidence before merge.

## Acceptance Criteria

A change to this playbook is complete when:

- the mission and gold definition are explicit
- the core principles are clear
- the PR taxonomy distinguishes truth intake, hygiene, and system fixes
- the review rules explain how to choose the strongest evidence
- the Maya lesson is included
- the failure path explains how to handle mismatches
- the merge rule protects truth and enforces cleanup follow-up
- the workflow still gives a usable step-by-step process

## Future Agent Command

For future fixture requests, the user only needs to provide:

- PDF path
- Fixture ID
- Title

Example:

```text
Use the Quick Check v2 gold fixture playbook for:
PDF: ~/Desktop/12-maya-forest-corridor-redd-belize.pdf
Fixture ID: maya-forest-corridor-redd-belize
Title: Maya Forest Corridor REDD+ Belize
```
