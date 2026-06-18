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

<!-- Add queue items below as they are reviewed. Follow the format above. -->

_No items currently pending._

## Promoted items

### Taisei China PDD — host_country, methodology, baseline, leakage, additionality

- **Status:** promoted (Goals 2–3, PRs #781, #782)
- **Fix:** `buildProjectFactContract.ts` — added labeled-field fallback for `findProjectTitle`, heading-next fallback for `hostCountry`, B.1 code-scan for `methodologyPrimary`, full-span-text for `sectionsFact`
- **Result:** 5/6 core checks answered with provenance, 0% hallucinated

### Taisei China PDD — leakage and additionality

- **Status:** deferred
- **Fix needed:** Section table index must recognize inline subsection anchors (parser limitation, not selector)
- **Priority:** medium
