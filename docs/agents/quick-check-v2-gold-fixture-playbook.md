# Quick Check v2 Gold Fixture Playbook

Use this playbook when creating or correcting a Quick Check v2 gold fixture from a single project PDF.

## Workflow

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

## Fixture Review Rules

- Generated `gold.json` is never final truth by default.
- `source.pdf` and `extracted.txt` outrank current Quick Check output.
- If Quick Check is wrong, preserve that wrong output in `corrections.json` and explain it in `REVIEW.md`.
- Do not fold the engine mistake back into `gold.json`.
- Keep the PR scoped to the fixture or playbook work only.

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
