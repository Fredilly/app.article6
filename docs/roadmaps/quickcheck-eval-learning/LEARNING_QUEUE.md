# Quick Check Learning Queue

Candidate corrections collected from the Quick Check UI export button must be reviewed before becoming gold fixtures. This queue tracks failed document cases, expected answers, and the selector fixes needed.

## Queue item format

Each queue item records:

```markdown
## Queue item: {fixture-id} — {check-id} {failure-summary}

- **Wrong answer:** {what the system currently returns}
- **Correct answer:** {what the reviewer expects}
- **Wrong quote/page:** {where the system found wrong evidence}
- **Correct quote/page:** {where the correct evidence is in the document}
- **Failure reason:** {why the selector produced the wrong answer}
- **Likely selector fix:** {what code change is needed}
- **Priority:** high | medium | low
- **Status:** pending | promoted | deferred
```

## Example (Taisei — host_country wrong span)

- **Wrong answer:** Japan
- **Correct answer:** People's Republic of China
- **Wrong quote/page:** "Japan and China are both Parties to the Kyoto Protocol" (page 2)
- **Correct quote/page:** "Host Party: People's Republic of China" (page 1, section A.3)
- **Failure reason:** Broad keyword match; selector matched "China" in a generic paragraph instead of the structured Host Party field
- **Likely selector fix:** Prefer section A.3 / "Host Party" pattern over free-text keyword match
- **Priority:** high
- **Status:** promoted (Goal 2 fixture, Goal 3 fix)

## Promotion workflow

1. **Export** — Reviewer clicks "Export correction" on a wrong answer card in the Quick Check UI. This downloads a JSON file with current answer data and placeholder fields for corrections.

2. **Review** — Reviewer fills in the JSON file with:
   - `correctedAnswer` — the expected correct answer
   - `correctedQuote` — the correct evidence quote from the document
   - `correctedPage` — the page number
   - `correctedSection` — the section identifier
   - `failureReason` — why the current answer is wrong

3. **Queue** — The filled correction JSON is filed as a queue item in this document (or an equivalent admin surface). The item records the nature of the failure and the likely selector change needed.

4. **Triage** — Each queue item is assessed for:
   - **Priority** — How severe is the wrong answer? Does it affect multiple documents?
   - **Root cause** — Is this a selector bug, a parser gap, or a document-structure edge case?
   - **Fix complexity** — Is the fix a simple label addition, a routing change, or a parser overhaul?

5. **Promote** — Once reviewed, the correction is promoted to:
   - A gold fixture entry in the eval corpus (new or updated `phase6-eval-corpus.json`)
   - Or a baseline fixture in a non-blocking manifest (e.g., `taisei-baseline-eval-corpus.json`)
   - A selector or fact extraction code change in `src/lib/quickCheck/`

6. **Gate** — The code change and new/updated fixture are submitted in a PR. The strict eval gate (`npm run quickcheck:eval:corpus -- --strict`) must pass:
   - New fixture expectations must be met
   - No existing fixtures may regress
   - All strict thresholds must hold

7. **Close** — After merge, the queue item is marked `promoted` and the correction JSON may be archived.

## Rules

- **Candidate corrections do not affect evals until promoted.** A correction JSON file sitting in `tests/fixtures/quick-check/corrections/` is inert — no test consumes it by default. Only when it is codified as a gold fixture in an eval corpus manifest does it gate PRs.

- **One fix per PR.** Each correction should produce a single, reviewable selector change with its own fixture regression test.

- **No automatic learning.** The export button collects data. The reviewer decides what becomes a test. The CI gate enforces that nothing breaks. There is no automated feedback loop that changes production behavior.

- **No production file writes from corrections.** The export button writes to the user's local filesystem via browser download. Corrections are never written to the repo or server automatically.

## Active queue

### PD_REDD_v1_130 — host_country/methodology/baseline/additionality/leakage/stakeholder corrections

- **Wrong answers:** host_country = Portugal (from Figure 2 source citation); methodology = full Modules and Tools table; baseline = unclear; additionality = VT0001 procedural intro
- **Correct answers:** host_country = Guinea-Bissau (from project location); methodology = VM0007 – REDD Methodology Framework (REDD-MF), Version 1.4; baseline = continuation of traditional land-use practices / Alternative Scenario I with accelerated deforestation; additionality = project is additional due to financial barriers, institutional barriers, and first-of-its-kind barrier; leakage = displacement of unplanned deforestation, market leakage zero, 20% leakage factor; stakeholder = CBMP participatory process with safeguard consultations, workshops, radio, Park Committees
- **Failure reason:** `deriveCountryFromLocation` picked Portugal from split segments of a figure caption (exact match against KNOWN_COUNTRY_NAMES) instead of Guinea-Bissau from the project description (which required substring matching). Methodology label "Title and Reference of Methodology" was missing from VCS_PD labels. Project title used "Project Title" label which wasn't detected in title blocks. Router had no hostCountry → projectCountry fallback.
- **Likely fix:** Fix `deriveCountryFromLocation` to (a) reject figure/map/source-caption segments, (b) prefer substring matches in early content segments over exact matches in later segments, (c) use whole-token guards. Add `hostCountry → ["projectCountry"]` fallback to router. Add "Title and Reference of Methodology" to methodology labels. Add "title" blockType to `findProjectTitle` labeled-field check.
- **Priority:** high
- **Status:** promoted
- **Fix:** buildProjectFactContract.ts `deriveCountryFromLocation` rewrite + labeled-title detection + methodology label addition; deterministicRouter.ts fallback map addition; new gold fixture `real-pd-redd-v130-full` in phase6-eval-corpus.json
- **Notes:** Portugal must never be accepted as host country for this document. The strict eval now gates this — returning Portugal fails the gold fixture.

## Promoted items

### Taisei China PDD — host_country, methodology, baseline, leakage, additionality

- **Status:** promoted (Goals 2–3, PRs #781, #782)
- **Fix:** `buildProjectFactContract.ts` — added labeled-field fallback for `findProjectTitle`, heading-next fallback for `hostCountry`, B.1 code-scan for `methodologyPrimary`, full-span-text for `sectionsFact`
- **Result:** 5/6 core checks answered with provenance, 0% hallucinated

### Taisei China PDD — leakage and additionality

- **Status:** deferred
- **Fix needed:** Section table index must recognize inline subsection anchors (parser limitation, not selector)
- **Priority:** medium
