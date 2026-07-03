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

## Verification

Before final handoff, report:

* branch name
* PR link, if opened
* files changed
* tests/checks run
* any failing checks and whether they are related or unrelated
