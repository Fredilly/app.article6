# Phase 1: Status Consumer Audit

## Scope and reproducibility

This audit covers the repository at main commit `f909e49` (`Merge pull request #967 from Fredilly/feat/vvb-report-phase-0-terminology-contract`), audited on 2026-07-10. The working branch is `docs/vvb-report-phase-1-status-consumer-audit`.

The six values audited are:

```text
FOUND, UNCLEAR, MISSING, answered, unclear, no_evidence
```

The search was repository-wide, with generated/vendor directories excluded where they are not repository source:

```bash
rg -n --hidden -g '!node_modules' -g '!.git' -g '!dist' -g '!coverage' -w 'FOUND' .
rg -n --hidden -g '!node_modules' -g '!.git' -g '!dist' -g '!coverage' -w 'UNCLEAR' .
rg -n --hidden -g '!node_modules' -g '!.git' -g '!dist' -g '!coverage' -w 'MISSING' .
rg -n --hidden -g '!node_modules' -g '!.git' -g '!dist' -g '!coverage' -w 'answered' .
rg -n --hidden -g '!node_modules' -g '!.git' -g '!dist' -g '!coverage' -w 'unclear' .
rg -n --hidden -g '!node_modules' -g '!.git' -g '!dist' -g '!coverage' -w 'no_evidence' .
rg -l --glob 'src/**' --glob 'scripts/**' -e 'FOUND|UNCLEAR|MISSING|answered|unclear|no_evidence' | sort
rg -l --glob 'tests/**' -e 'FOUND|UNCLEAR|MISSING|answered|unclear|no_evidence' | sort
```

Prose-only roadmap history, comments, and fixture explanation text were retained as references but are not counted as runtime consumers unless a symbol reads, writes, compares, filters, serializes, or renders the value.

## Executive inventory

There are two active status families. They are not aliases in the current code:

| Family | Values | Owner/meaning today | Main boundary |
| --- | --- | --- | --- |
| Legacy Quick Check router | `answered`, `unclear`, `no_evidence` | `DeterministicRouterStatus`; routing and evidence-retrieval outcome | Router result -> `DocumentQuestionAnswer.status` and `EvidenceCheckStatus` |
| Quick Check v2 / fixture judgment | `FOUND`, `UNCLEAR`, `MISSING` | `QuickCheckStatus` or fixture `FixtureStatus`; deterministic evidence judgment or fixture expectation | `StatusResult` -> Quick Check UI / gold comparison / fixture-backed report |

The lowercase `unclear` is also used by the independent `DocumentAnswerStatus` as `DocumentQuestionAnswer.status`; it is not the same type as `DeterministicRouterStatus`. The lowercase router status is transformed to `likely_yes` for `answered` and `unclear` for both `unclear` and `no_evidence`. The evidence-check transform maps `answered -> found`, `no_evidence -> missing`, and `unclear -> unclear`.

### Counts by consumer category

Counts below are audit entries, not distinct files; one symbol can appear in more than one category. A category count of zero means no direct consumer of these six values was found in that area.

| Category | Entries | Result |
| --- | ---: | --- |
| Produces | 7 | Router, topic selection, sufficiency validator, structured evidence checks, v2 validator, and fixture-backed expected values produce or establish statuses. |
| Stores / serializes | 8 | Typed result objects, eval manifests, gold records, correction records, fixture JSON, and report rows retain statuses. |
| Transforms | 6 | Router-to-Q&A, router-to-evidence-check, uppercase-to-UI status, and status normalization boundaries exist. |
| Compares / filters | 12 | Router fallbacks, evidence sufficiency, LLM eligibility, eval gates, report row grouping, and priority filtering compare values. |
| Displays | 5 | Quick Check UI, structured-check UI, fixture-backed report UI, report display blocks, and PDF output display values. |
| Judgment | 8 | Router/evidence validators, v2 validation, evidence-stack validation, and fixture judgment gates. |
| Routing | 5 | Deterministic router, query intent/topic selection, and router-driven downstream selection. |
| Report | 4 | Fixture-backed report construction, grouping, display blocks, and internal report route. |
| PDF | 1 | Internal Envira VM0007 fixture-backed PDF. |
| UI | 3 | Quick Check panel and internal fixture-backed report view. |
| Fixtures | 8 | Quick Check v2 gold/corrections and pre-verification judgment/report fixtures. |
| Client readiness | 0 direct | No client-readiness report/workpaper consumer directly consumes one of these six values. The internal quarantined fixture report carries `clientAction` for `UNCLEAR`/`MISSING`, but is explicitly not client-ready. |
| Analytics | 1 | Active Quick Check corpus report counts and reports status outcomes. |
| Tests | 7 groups | Unit, component, eval, fixture-gate, route, and PDF tests assert or compare these values. |

The category counts intentionally do not imply a new mapping. They identify later migration surfaces only.

## Detailed consumer inventory

### Producing and judgment symbols

| File and symbol | Status consumed | Operation / area | Current behavior and later dependency |
| --- | --- | --- | --- |
| `src/lib/quickCheck/router/deterministicRouter.ts` — `finalizeCandidate`, `buildDeterministicRouterResult` | `answered`, `unclear`, `no_evidence` | Produces, compares, filters; routing/judgment | Emits `answered` only after route confidence and provenance/sufficiency checks. Emits `unclear` for ambiguity, low confidence, missing context, or failed validation; emits `no_evidence` for unsupported/no validated route. This is the primary lowercase producer and the highest-risk presentation dependency. |
| `src/lib/quickCheck/indexing/selectTopicEvidence.ts` — `selectTopicEvidence` | `no_evidence` | Produces; routing | Returns `no_evidence` for unsupported topics, no references, weak matches, or ambiguous matches. The value is consumed by query-intent analysis and can influence router fallback behavior. |
| `src/lib/quickCheck/queryIntent/analyzeQueryIntent.ts` — `analyzeQueryIntent` | `no_evidence` | Produces/stores as a topic-selection result; routing | Uses `no_evidence` when a rule has no topic references. This is a nested selection status, not the final router status. |
| `src/lib/quickCheck/evidence/sufficiencyValidators.ts` — sufficiency validators and `downgradeTo` | `unclear`, `no_evidence` | Produces downgrade instructions; judgment/routing | Returns explicit downgrade targets when candidate evidence is too short, TOC-only, generic, ungrounded, or lacks resolved spans. The router applies these instructions when finalizing a result. |
| `src/lib/quickCheck/evidenceChecks.ts` — `evaluateEvidenceCheck` / structured check result creation | `found`, `missing`, `unclear` (derived from the six via `statusFromRouter`) | Produces/compares; judgment | Evidence-check search and validation produce the lower-case check status. Direct router status is accepted only for `answered`; failed candidates become `unclear`, and no evidence becomes `missing`. `not_applicable` is outside this six-value audit. |
| `src/lib/quickCheckV2/status/index.ts` — `validateAnswerResult`, `validateAnswerResults` | `FOUND`, `UNCLEAR`, `MISSING` | Produces/compares; judgment | Produces `MISSING` when evidence is absent, `UNCLEAR` for missing answers, incomplete provenance, stubs, blockers, or raw-text fallback, and `FOUND` only when answer, primary evidence, and complete provenance pass validation. |
| `tests/lib/preverifJudgmentFixtureGate.ts` — `FixtureStatus` and fixture assertions | `FOUND`, `UNCLEAR`, `MISSING` | Stores/validates expected status; fixtures/judgment/tests | Defines fixture status as `FOUND | UNCLEAR | MISSING | N/A`; checks quote/page/heading/action requirements by status. `N/A` is a fourth fixture value but is outside the requested six. |

### Storage, serialization, and boundary transforms

| File and symbol | Status consumed | Operation / area | Current behavior and risk |
| --- | --- | --- | --- |
| `src/lib/quickCheck/retrieval/types.ts` — `DeterministicRouterStatus`, `DeterministicRouterResult` | `answered`, `unclear`, `no_evidence` | Type boundary/storage; routing | Defines the serialized shape returned by the router, including status, answer, route, evidence spans, quotes, pages, and warnings. Any future presentation layer must preserve this boundary. |
| `src/lib/quickCheck/documentQa.ts` — `buildDocumentQuestionAnswer` | `answered`, `unclear`, `no_evidence` | Transforms/stores; UI boundary | Maps `answered -> likely_yes`; maps both `unclear` and `no_evidence -> unclear`; copies only router-validated quotes into document answer evidence. Changing status semantics would change visible Q&A state and evidence explanation. |
| `src/lib/quickCheck/evidenceChecks.ts` — `statusFromRouter` | `answered`, `unclear`, `no_evidence` | Transforms; judgment | Explicit mapping: `answered -> found`, `no_evidence -> missing`, default (`unclear`) -> `unclear`. This is a compatibility mapping, not a presentation mapping. |
| `src/lib/evidence/evidenceStack.ts` — `validateEvidenceStackForStatus` | `FOUND`, `answered`, `UNCLEAR`, `MISSING`, `unclear`, `no_evidence` only through normalization | Normalizes/compares; judgment | Uppercases the input status and requires a primary citation only for normalized `FOUND` or `ANSWERED`. The function does not define a full alias map, but its case normalization makes `answered` and `ANSWERED` equivalent for this validation option. |
| `src/lib/quickCheckV2/status/index.ts` — `StatusResult` | `FOUND`, `UNCLEAR`, `MISSING` | Stores; Quick Check v2 | Carries status with check name, answer, evidence, evidence stack, reason, and methodology identity. It is consumed by UI and gold comparison. |
| `src/lib/quickCheckV2/evidenceStackAdapter.ts` — `normalizeQuickCheckEvidenceCarrier` | No status branch; carries the v2 status result boundary | Normalizes adjacent evidence; judgment/UI | Does not reinterpret status. It restores a primary `evidence` field from normalized evidence-stack data, which is required by the v2 status validator and presentation consumers. |
| `src/lib/quickCheck/evalCorpus/manifest.ts` and `types.ts` — `expectedStatus` schema/type | `answered`, `unclear`, `no_evidence` | Stores/serializes; fixtures/tests | Eval corpus expectations are restricted to the lowercase router family and may include visible-answer status separately. A presentation migration must not treat `expectedStatus` as an uppercase fixture expectation. |
| `tests/lib/quickCheckV2/goldComparison.ts` — `QuickCheckGoldComparableRecord`, `buildComparableQuickCheckRecord` | `FOUND`, `UNCLEAR`, `MISSING` | Stores/transforms; fixtures/tests | Copies actual `StatusResult.status` into a comparable gold record and preserves quote/page/section/span/source/evidence stack. Gold truth must remain independent of current output. |
| `src/lib/preverif/fixtureBackedVm0007Report.ts` — `Vm0007EvidenceMapRow`, `buildEvidenceMapRows`, `buildFixtureBackedVm0007Report` | `FOUND`, `UNCLEAR`, `MISSING` | Stores/transforms; Evidence Map/report | Copies fixture `expectedStatus` into report rows, derives accepted/rejected evidence fields, adds `clientAction` only for `UNCLEAR`/`MISSING`, and carries expected counts. It is quarantined legacy mismatch output and not validated client truth. |

### Comparisons, filters, and displays

| File and symbol | Status consumed | Operation / area | Current behavior and later dependency |
| --- | --- | --- | --- |
| `src/lib/quickCheck/router/deterministicRouter.ts` — candidate finalization/fallback branches | `answered`, `unclear`, `no_evidence` | Compares/filters; routing/judgment | Confidence, route kind, evidence quote/page/path/span presence, ambiguity, and sufficiency determine which lowercase status is emitted. This is the status decision tree later phases must not bypass. |
| `src/lib/quickCheck/evidenceChecks.ts` — `searchFromRouter`, `validateCandidate`, `statusFromRouter` | `answered`, `unclear`, `no_evidence` | Compares/filters; judgment | Only an `answered` router result with usable answer/provenance is searched as a candidate; validation downgrades failed evidence to `unclear`. |
| `src/lib/quickCheck/llmUiClient.ts` — `shouldFetchLlmSuggestion` | `found`, `missing`, `unclear` | Compares/filters; UI/LLM suggestion | Fetches a suggestion for `missing`/`unclear`; does not fetch for a sufficiently answered `found` result. This is not a final-status producer. |
| `src/lib/quickCheck/evalCorpus/runner.ts` — `runCorpusQuestion`, active-corpus summary builders | `answered`, `unclear`, `no_evidence` | Compares/filters/analytics; tests | Compares actual router status to `expectedStatus`, counts no-evidence false negatives, and emits per-check `answeredCount`, `unclearCount`, and `noEvidenceCount` summaries used by active-corpus report tests. |
| `src/lib/quickCheck/evalCorpus/runner.ts` — unsupported/no-evidence gates | `no_evidence` | Compares/filters; tests/analytics | Requires unsupported questions to remain `no_evidence` and counts any promotion as a failure. |
| `src/lib/quickCheckV2/status/index.ts` — `validateAnswerResult` branches | `FOUND`, `UNCLEAR`, `MISSING` | Compares/filters; judgment | Evidence presence, answer presence, primary evidence, provenance, source type, and check-specific blockers determine the uppercase result. |
| `src/lib/preverif/fixtureBackedVm0007Report.ts` — `sortEvidenceMapRows`, `groupEvidenceMapRowsByStatus`, `getPriorityClientActionRows` | `FOUND`, `UNCLEAR`, `MISSING` | Compares/filters; report | Orders rows as `MISSING`, `UNCLEAR`, `FOUND`, `N/A`; groups by exact equality; prioritizes only `MISSING` and `UNCLEAR` for client actions. |
| `src/lib/preverif/vm0007ReportDisplay.ts` — `buildVm0007DisplayBlocks` | `FOUND` | Compares/displays; report | Adds the accepted-evidence reason only when a row is `FOUND` and the reason is non-empty. |
| `src/components/chat/QuickCheckPanel.tsx` — structured-check result mapping | `FOUND`, `UNCLEAR`, `MISSING` | Transforms/displays; UI | Maps uppercase v2 results to component-local `found | unclear | missing`, then uses those values to choose answer text, evidence visibility, colors, and downgrade copy. |
| `src/components/chat/QuickCheckPanel.tsx` — review-question rendering and `getDocumentQaUiConfig` use | `answered`, `unclear`, `no_evidence` indirectly through `DocumentQuestionAnswer` | Displays; UI | Displays the derived `likely_yes`/`unclear` label and explanation; only directly shows the router result as an answer when the router status is `answered`. `no_evidence` is therefore visible as an `unclear` answer state, not as a new client-facing status. |
| `src/components/preverif/FixtureBackedVm0007ReportView.tsx` — `statusTone`, `statusSummaryCopy`, row/group rendering | `FOUND`, `UNCLEAR`, `MISSING` | Compares/filters/displays; UI/report | Uses exact status for tone, summary language, cards, row badges, and grouped sections. It also displays counts and includes `N/A`; the page is an internal quarantined preview. |
| `src/lib/preverif/enviraVm0007FixtureBackedPdf.ts` — `buildEnviraVm0007FixtureBackedPdf` | `FOUND`, `UNCLEAR`, `MISSING` | Displays/serializes; PDF/report | Prints summary counts and row statuses in the internal PDF. The route is not a client-ready export. |
| `src/app/internal/reports/envira-vm0007/page.tsx` and `src/app/api/exports/internal/envira-vm0007-report/route.ts` | Indirectly `FOUND`, `UNCLEAR`, `MISSING` through `Vm0007FixtureBackedReport` | Displays/serializes; report/PDF | Connect the fixture-backed report object to the internal page and PDF response. They do not define status semantics. |

## Status-by-status coverage

| Status | Producers / stores | Transformations | Comparisons / displays | Explicit absence |
| --- | --- | --- | --- | --- |
| `FOUND` | `QuickCheckStatus`; v2 validator; fixture `expectedStatus`; report row | Evidence-stack validation normalizes it; v2 result maps to local `found` UI status | Accepted-evidence display, report grouping/counts, PDF count/row output, gold comparison, fixture gates | No direct lowercase-router producer; no direct client-readiness consumer |
| `UNCLEAR` | v2 validator; fixture expected values; report rows | Uppercase v2 -> local `unclear`; evidence stack accepts it without the `FOUND` primary-citation requirement | Router/evidence validation, action-row filtering, report/PDF/UI display, fixture/eval assertions | No direct client-readiness consumer |
| `MISSING` | v2 validator; fixture expected values; report rows | Uppercase v2 -> local `missing`; lowercase `no_evidence -> missing` in `statusFromRouter` | Missing-evidence branches, action-row filtering, report/PDF/UI display, fixture gates | No direct client-readiness consumer |
| `answered` | `DeterministicRouterStatus`; router branches; eval expectations | `answered -> likely_yes` in Document Q&A; `answered -> found` in evidence checks; uppercase normalization in evidence-stack validation | Router evidence eligibility, LLM eligibility through derived `found`, eval gates, tests | No report/PDF/UI consumer reads lowercase `answered` directly; no client-readiness consumer |
| `unclear` | Router branches; `DocumentAnswerStatus`; topic/evidence results | `unclear -> unclear` in Q&A and evidence checks; uppercase normalization only where passed to evidence-stack validation | Router fallback/sufficiency, evidence validation, Q&A explanation/UI, eval expectations | No direct client-readiness consumer |
| `no_evidence` | Router fallback; topic selector; query-intent nested result | `no_evidence -> unclear` in Document Q&A; `no_evidence -> missing` in evidence checks | Unsupported-question gates, no-evidence false-negative analytics, test assertions | No report/PDF/UI consumer reads lowercase `no_evidence` directly; no client-readiness consumer |

## End-to-end flow and boundaries

```text
Quick Check input
  -> topic/query selection (`no_evidence` can be nested)
  -> deterministic router (`answered` | `unclear` | `no_evidence`)
      -> Document Q&A (`likely_yes` | `unclear`, with validated quotes only)
      -> Evidence checks (`found` | `unclear` | `missing`)
      -> eval corpus comparisons and analytics

Quick Check v2 document/evidence retrieval
  -> deterministic status validator (`FOUND` | `UNCLEAR` | `MISSING`)
      -> Quick Check panel local display status (`found` | `unclear` | `missing`)
      -> v2 gold comparison and status tests

Pre-verification judgment fixtures
  -> fixture expected status (`FOUND` | `UNCLEAR` | `MISSING` | `N/A`)
  -> quarantined Evidence Map-like report rows
      -> internal report UI and internal PDF
```

No current path sends raw lowercase router output directly into the fixture-backed report. No current path sends fixture uppercase status directly into the client readiness report or UI. The existing report/PDF path is an internal, quarantined VM0007 legacy-mismatch preview, not the future VVB presentation layer.

## Fixtures and tests

The fixture surface is broad but follows a small number of schemas. The exact repository locations found are:

- Lowercase router fixtures and corrections: `tests/fixtures/quick-check/eval/quickcheck-eval-cases.json`, `tests/fixtures/quick-check/corpus/*.json`, `tests/fixtures/quick-check/corrections/*.json`, and `tests/fixtures/quick-check/v2/**/{gold.json,gold.draft.json,corrections.json}`. Their `expectedStatus`, `currentStatus`, or `correctedStatus` fields are fixture data, not runtime status producers.
- Uppercase judgment fixtures: `tests/fixtures/preverif/envira-vm0007-judgment-fixtures.json`, `tests/fixtures/preverif/pd-redd-vm0007-judgment-fixtures.json`, and `tests/fixtures/preverif/envira-vm0007-full-audit-fixture-shape.json`. Their expected counts and evidence fields are checked by `tests/lib/preverifJudgmentFixtureGate.ts` and related fixture-specific tests.
- Test consumers include `tests/lib/quickCheckDeterministicRouter.test.ts`, `tests/lib/quickCheckReviewQuestion.test.ts`, `tests/lib/quickCheck/evalCorpus` tests, `tests/evals/quickCheckEval.test.ts`, `tests/evals/quickCheckDocumentSmoke.test.ts`, `tests/components/quickCheckPanel*.test.tsx`, `tests/lib/quickCheckV2/status-validator.test.ts`, `tests/lib/quickCheckV2/gold-fixtures.test.ts`, `tests/lib/quickCheckV2/goldComparison.ts`, `tests/lib/preverif.vm0007*` tests, `tests/lib/preverif.enviraVm0007FixtureBackedPdf.test.ts`, and `tests/app/api/exports/internal.envira-vm0007-report.route.test.ts`.

Tests assert exact values, allowed status sets, derived visible status, evidence emptiness, status counts, and status-specific quote/page/action requirements. They are therefore regression constraints for later phases even where they do not feed production output.

## Risks and dependencies for later phases

1. A presentation mapping must not be inserted into `statusFromRouter`, `buildDocumentQuestionAnswer`, or the v2 validator. Those are existing compatibility/judgment boundaries, not presentation-layer contracts.
2. `no_evidence` currently becomes `unclear` in visible Document Q&A but `missing` in `EvidenceCheckStatus`. A single global mapping would change existing UI and evaluation behavior.
3. `FOUND` is evidence/provenance-gated in v2, while fixture `FOUND` values include quarantined historical output. A presentation layer must distinguish validated Evidence Map rows from legacy fixture rows.
4. `UNCLEAR` and `MISSING` drive client-action priority in the fixture-backed report. Any reinterpretation changes action ordering and report/PDF text.
5. Evidence-stack validation recognizes `FOUND` and case-insensitive `ANSWERED` as requiring primary evidence. This normalization is a validation convenience, not permission to rename or merge status families.
6. Lowercase eval expectations and uppercase gold expectations are serialized separately. Migration work must preserve both schemas until an explicit later phase changes them.
7. No current status consumer establishes a client-ready conclusion, formal finding, applicability decision, or VVB authority claim. Those are downstream contracts and remain unimplemented here.

## Phase 1 conclusion

All six requested values have direct producers, storage boundaries, transformations, comparisons, filters, displays, fixture representations, and tests documented above. No runtime status semantics were changed by this audit. No direct consumer was found in the client-readiness area. The audit is the dependency inventory for Phase 2; it does not define or apply a new presentation mapping.
