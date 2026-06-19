# Future Quick Check Pack Process

New Quick Check items must be added in disciplined packs with fixtures, evidence rules, and eval gating. Broad expansion is blocked until the existing core checks are stable.

## What a check pack is

A check pack is a small, themed group of 3–5 new Quick Check questions that share a document region or review topic. Examples:

- **Project identity pack**: project proponent, project ID, project type
- **Crediting pack**: crediting period, reporting period, monitoring period
- **Environmental impacts pack**: environmental impact assessment, transboundary impacts, mitigation measures
- **Stakeholder pack**: stakeholder identification, consultation summary, grievance mechanism

Packs are added one at a time. No pack may be started until the previous pack's fixtures pass strict eval.

## Required artifacts per check

Each new check in a pack must include:

### 1. Check definition

In `src/lib/quickCheck/evidenceChecks.ts`:

- `checkId` — unique, snake_case identifier
- `label` — human-readable display name
- `question` — the natural-language question text
- `searchTargets` — `["fact_contract"]`, `["section"]`, or `["fact_contract", "section"]`
- `selector` — the selector key for authoritative candidate building
- `allowedAnchorTerms` — terms the evidence must contain
- `forbiddenAnchorTerms` — terms that disqualify evidence (e.g. "stakeholder" for non-stakeholder checks)

### 2. Check group membership

In `src/lib/quickCheck/evidenceCheckGroups.ts`:

- Add the check to the appropriate group for each document purpose (PDD, validation_report, monitoring_report, verification_report, general)

### 3. Query intent analysis

In `src/lib/quickCheck/queryIntent/analyzeQueryIntent.ts` (if fact-backed):

- Add fact aliases or section topic rules so the router can classify the query

### 4. Gold fixture (at least one per check)

In the eval corpus manifest:

- `expectedStatus` — `answered`, `unclear`, or `no_evidence`
- `expectedRoute` — how the router should reach this answer
- `expectedAnswer` — the correct answer text (Goal 1 field)
- `goldEvidence` — pages, span anchors, and section hints that prove the answer
- `visibleAnswerStatus` — `likely_yes`, `likely_no`, or `unclear`
- `visibleAnswerEvidenceMin` — minimum evidence items expected
- `failureReason` — what real failure this fixture guards against (Goal 1 field)

### 5. Evidence rules

Before a check can be promoted to the strict corpus, it must define:

- **Preferred sections** — which PDD sections/fields contain the authoritative answer. Added to `SELECTOR_SECTION_ALIASES` in `evidenceChecks.ts`.
- **Rejected noisy sources** — which sections/patterns must be ignored (e.g. generic applicability text, commentary, CAR/CL notes). Added to `forbiddenAnchorTerms` or `forbiddenSectionPatterns`.
- **Evidence shape** — minimum requirements for `answered` status. Defined via `expectedShape` in the check contract.

## Adding a new check: step-by-step

1. **Run the active corpus report** (`npm run quickcheck:report` and `npm run quickcheck:report:messy`). Identify the weakest check IDs and document types. Do not add new checks to bypass weaknesses — fix the weak checks first.

2. **Choose the pack theme.** Pick 3–5 related checks that share document regions. Do not add one-off checks — packs ensure coverage consistency.

3. **Define each check.** Add the check definition, group membership, and query intent rules as described above.

4. **Create baseline fixtures.** Add at least one gold fixture per check in a non-blocking baseline manifest (like `taisei-baseline-eval-corpus.json`). The fixture must fail before the check is implemented and pass after.

5. **Implement candidate gathering.** Add authoritative candidate-building logic and selector section aliases. Wire the check into `buildAuthoritativeCandidates()`.

6. **Run the full eval gate.** `npm run quickcheck:eval:corpus -- --strict` must pass with all existing fixtures plus the new pack's fixtures. No regressions.

7. **Promote to strict corpus.** When all new check fixtures pass strict eval, move them from the baseline manifest into the main `phase6-eval-corpus.json`.

8. **Update the active corpus report.** The report should show improved scores for the checks the pack addressed.

## When to block new checks

Broad check expansion is blocked when:

- **Any core check has < 85% provenance correctness** across the strict corpus. Check the active corpus report. If `methodology` or `additionality` are below 85%, fix them before adding new checks.
- **Hallucinated answer rate is > 0%** across the strict corpus. Every answered question must have evidence provenance.
- **The messy carbon document pack shows > 10% hallucinated answers**. New checks must work on real-world document patterns, not just clean PDDs.
- **No active corpus report has been run** to confirm the current state. Always check `npm run quickcheck:report` first.

## Core checks (must be stable before expansion)

These six checks must pass strict eval at ≥ 85% provenance before any new packs are added:

| Check | Current strict |
|-------|---------------|
| host_country | 100% |
| methodology | 100% |
| baseline_scenario | 100% |
| additionality | 100% |
| leakage | 100% |
| stakeholder_consultation | 100% |

These must also pass on the messy corpus at ≥ 80% provenance:

| Check | Current messy |
|-------|--------------|
| methodology | 60% |
| additionality | 80% |
| baseline_scenario | 100% |
| monitoring | 100% |

**Blocked until resolved**: `methodology` (60% provenance on messy corpus) and `additionality` (80%) need fixes before new check packs.

## Example pack: Project Identity

When the core checks are stable, the first recommended pack is:

| Check | Question |
|-------|----------|
| `project_proponent` | Who are the project participants? |
| `project_id` | What is the project ID? |
| `project_type` | What type of project is this? |
| `project_start_date` | When did the project start? |

Each would require:
- A fact contract field rule (already exists for most)
- Query intent aliases
- At least one gold fixture per check in a baseline manifest
- Evidence shape rules
- Section aliases for CDM/VCS/Verra families
