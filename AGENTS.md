# AGENTS.md

## Repository rules

This repository is app.article6.

1. Do not break the dev server.
   After app or UI changes, verify the app still starts and the changed flow still works.

2. Run checks before handoff.
   Run the relevant focused test first. For broader changes, run lint and typecheck before saying the work is done.

3. Do not touch gold.json unless explicitly asked.
   Treat gold.json as Fred's owned source of truth.

4. Clean up temporary files.
   Do not leave scratch files, debug output, generated junk, or unused artifacts in the repo.

5. Keep UI simple and functional.
   Prefer clear, boring, usable UI over fancy design. Do not add visual complexity unless explicitly requested.

6. No scoring in Quick Check.
   Quick Check is triage, not a final report. Do not add scores, grades, or client-facing certainty unless explicitly requested.

## PR discipline

* Create a fresh branch from current origin/main.
* Keep one task per PR.
* Do not mix unrelated changes.
* Do not touch unrelated dirty files.
* Do not weaken tests to make a PR pass.
* If the task is fixture-only, do not change production logic.

## Quick Check PDF triage / Phase 7 fixture workflow

For new Quick Check PDF triage or Phase 7 fixture tasks, first read and follow:

docs/quick-check-v2/PDF_TRIAGE.md

Do not create a fixture until the PDF has been bucketed and the user approves.

This rule applies only to Quick Check PDF triage / Phase 7 fixture work.

## PDD judgment fixture workflow

Use this workflow whenever the task asks to add a new PDD, PD, project description, or methodology judgment fixture.

1. Use one PDF only.

2. First confirm the document type.

Accept only:
- PDD
- PD
- project description
- project design document

Reject or pause if the file appears to be:
- deed
- contract
- registry listing
- methodology PDF
- validation report
- verification report
- monitoring report
- generic legal document

3. Do not use current app output as gold.

PDF truth beats current app output.

Every FOUND fixture must have:
- exact quote
- page number
- section heading
- span ID if available
- expected answer
- direct support for the answer

4. Status rules:

FOUND means the quote directly proves the answer.

UNCLEAR means related evidence exists, but it is weak, generic, incomplete, contradictory, or not enough to prove the answer.

MISSING means no usable project evidence exists in the document.

N/A means the rule truly does not apply and the reason is specific.

Never mark FOUND because related words exist.

5. Encode rejected evidence.

Reject junk evidence such as:
- boilerplate
- table of contents rows
- methodology instructions
- module tables
- URLs
- registry links
- random country mentions
- generic section headings without body evidence
- references to supporting documents without the actual evidence in the PDD

6. Use the reusable fixture quality gate.

Use this reference test to see the correct wiring pattern:

tests/lib/preverif/fixtureQualityGate.test.ts

Do not add every future PDD to fixtureQualityGate.test.ts. For each serious new PDD/methodology fixture, create a fixture-specific test that imports assertFixtureQualityGate from tests/lib/preverif/fixtureQualityGate.ts.

For every new methodology/PDD fixture test, call:

assertFixtureQualityGate(...)

from:

tests/lib/preverif/fixtureQualityGate.ts

The gate should receive:
- methodology rule list
- audit summary
- report object
- rendered report HTML
- judgment fixture JSON
- source excerpts JSON
- expected visible wording
- banned wording

7. Keep fixture PRs clean.

Do not change:
- production audit logic
- parser/router logic
- client-facing report UI
- unrelated fixtures
- unrelated dirty files

8. Testing

Run the focused fixture test for the new PDD.

Then run:

npm run pr:gate

If npm run pr:gate fails because of an unrelated existing failure, report the exact failing test and explain why it is unrelated.

## Verification

Before final handoff, report:

* branch name
* PR link, if opened
* files changed
* tests/checks run
* any failing checks and whether they are related or unrelated
