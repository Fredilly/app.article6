import path from "path";
import { buildReviewQuestionResult, getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import { STANDARD_PHASE6_QUESTIONS } from "@/lib/quickCheck/evalCorpus/standardQuestions";
import { loadEvalCorpusManifest, readEvalCorpusFixture } from "@/lib/quickCheck/evalCorpus/manifest";
import type {
  EvalCorpusFailure,
  EvalCorpusFixtureGold,
  EvalCorpusFixtureManifestEntry,
  EvalCorpusFixtureResult,
  EvalCorpusQuestionExpectation,
  EvalCorpusQuestionResult,
  EvalCorpusReport,
  EvalCorpusThresholds,
  EvalMetric,
  StandardPhase6QuestionId,
} from "@/lib/quickCheck/evalCorpus/types";
import { DEFAULT_STRICT_THRESHOLDS, DEFAULT_VISIBLE_ANSWER_THRESHOLDS } from "@/lib/quickCheck/evalCorpus/types";
import type { ProjectFactContract } from "@/lib/quickCheck/projectFacts/types";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function includesNormalized(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

function makeMetric(passed: number, total: number): EvalMetric {
  return {
    passed,
    total,
    rate: total > 0 ? passed / total : 0,
  };
}

function compareFactValue(actual: string | string[] | null, expected: string | null | undefined): boolean {
  if (expected === undefined) return true;
  if (expected === null) return actual == null;
  if (Array.isArray(actual)) return actual.some((value) => includesNormalized(value, expected));
  return actual != null && includesNormalized(actual, expected);
}

function actualSectionSignals(result: ReturnType<typeof buildReviewQuestionResult>): string[] {
  return Array.from(new Set([
    ...result.routerResult.sectionPaths,
    ...result.matchedHeadings.map((heading) => heading.title),
    result.routerResult.answerText,
  ].filter(Boolean)));
}

function compareFactContract(gold: EvalCorpusFixtureGold, contract: ProjectFactContract): string[] {
  const failures: string[] = [];
  const factChecks: Array<{ label: string; actual: string | string[] | null; expected: string | null | undefined }> = [
    { label: "documentFamily", actual: contract.documentFamily, expected: gold.documentFamily },
    { label: "projectTitle", actual: contract.projectTitle.value, expected: gold.projectTitle },
    { label: "hostCountry", actual: contract.hostCountry.value, expected: gold.hostCountry },
    { label: "projectCountry", actual: contract.projectCountry.value, expected: gold.projectCountry },
    { label: "methodology", actual: contract.methodologyPrimary.value, expected: gold.methodology },
    { label: "creditingPeriod", actual: contract.creditingPeriod.value, expected: gold.creditingPeriod },
    { label: "reportingPeriod", actual: contract.reportingPeriod.value, expected: gold.reportingPeriod },
    { label: "baselineSection", actual: contract.baselineSections.value, expected: gold.baselineSection },
    { label: "monitoringSection", actual: contract.monitoringSections.value, expected: gold.monitoringSection },
    { label: "leakageSection", actual: contract.leakageSections.value, expected: gold.leakageSection },
    { label: "additionalitySection", actual: contract.additionalitySections.value, expected: gold.additionalitySection },
  ];

  for (const check of factChecks) {
    if (!compareFactValue(check.actual, check.expected)) {
      failures.push(`${check.label} mismatch`);
    }
  }
  return failures;
}

function evaluateQuestion(input: {
  fixture: EvalCorpusFixtureManifestEntry;
  questionId: StandardPhase6QuestionId;
  expectation: EvalCorpusQuestionExpectation;
  rawPddText: string;
}): {
  result: EvalCorpusQuestionResult;
  provenancePassed: number;
  provenanceTotal: number;
  sectionPrecisionPassed: number;
  sectionPrecisionTotal: number;
  sectionRecallPassed: number;
  sectionRecallTotal: number;
  unsupportedPassed: number;
  unsupportedTotal: number;
  noEvidenceFalseNegativeFailures: number;
  noEvidenceFalseNegativeTotal: number;
  hallucinatedAnswered: number;
  answeredTotal: number;
  visibleAnswerPassed: number;
  visibleAnswerTotal: number;
  visibleAgreementPassed: number;
  visibleAgreementTotal: number;
} {
  const reviewResult = buildReviewQuestionResult({
    claimText: STANDARD_PHASE6_QUESTIONS[input.questionId],
    methodologyId: input.fixture.methodologyContext.methodologyId,
    methodologyVersion: input.fixture.methodologyContext.methodologyVersion,
    rawPddText: input.rawPddText,
  });
  const routerFailures: string[] = [];
  const visibleFailures: string[] = [];
  const expectation = input.expectation;

  if (reviewResult.routerResult.status !== expectation.expectedStatus) {
    routerFailures.push(`status expected ${expectation.expectedStatus} but got ${reviewResult.routerResult.status}`);
  }
  if (expectation.expectedRoute && reviewResult.routerResult.route !== expectation.expectedRoute) {
    routerFailures.push(`route expected ${expectation.expectedRoute} but got ${reviewResult.routerResult.route}`);
  }
  if (expectation.expectedEvidenceEmpty) {
    if (
      reviewResult.routerResult.evidenceSpanIds.length !== 0
      || reviewResult.routerResult.quotes.length !== 0
      || reviewResult.routerResult.pages.length !== 0
    ) {
      routerFailures.push("expected empty evidence for unsupported/no-evidence case");
    }
  }

  let provenancePassed = 0;
  let provenanceTotal = 0;
  let sectionPrecisionPassed = 0;
  let sectionPrecisionTotal = 0;
  let sectionRecallPassed = 0;
  let sectionRecallTotal = 0;

  if (expectation.goldEvidence?.pages?.length) {
    provenanceTotal += 1;
    const pagesMatch = expectation.goldEvidence.pages.every((page) => reviewResult.routerResult.pages.includes(page));
    if (pagesMatch) provenancePassed += 1;
    else routerFailures.push(`expected evidence pages ${expectation.goldEvidence.pages.join(", ")} not found`);
  }

  if (expectation.goldEvidence?.spanAnchors?.length) {
    provenanceTotal += 1;
    const quotes = reviewResult.routerResult.quotes.join("\n");
    const anchorMatch = expectation.goldEvidence.spanAnchors.every((anchor) => includesNormalized(quotes, anchor));
    if (anchorMatch) provenancePassed += 1;
    else routerFailures.push("expected quote anchors were not all present");
  }

  const expectedSectionHints = expectation.goldEvidence?.sectionHints ?? [];
  if (expectedSectionHints.length > 0) {
    const signals = actualSectionSignals(reviewResult);
    const matchedSection = expectedSectionHints.some((hint) => signals.some((signal) => includesNormalized(signal, hint)));
    sectionRecallTotal += 1;
    if (signals.length > 0) sectionPrecisionTotal += 1;
    if (matchedSection) {
      sectionRecallPassed += 1;
      if (signals.length > 0) sectionPrecisionPassed += 1;
    } else {
      routerFailures.push(`expected section hint not recovered: ${expectedSectionHints.join(" | ")}`);
    }
  }

  const unsupportedTotal = input.questionId === "marine_biodiversity_offsets" ? 1 : 0;
  const unsupportedPassed = unsupportedTotal === 1 && reviewResult.routerResult.status === "no_evidence" ? 1 : 0;
  const noEvidenceFalseNegativeTotal = expectation.expectedStatus === "no_evidence" ? 1 : 0;
  const noEvidenceFalseNegativeFailures = noEvidenceFalseNegativeTotal === 1 && reviewResult.routerResult.status !== "no_evidence" ? 1 : 0;

  const answeredTotal = reviewResult.routerResult.status === "answered" ? 1 : 0;
  const answeredWithoutProvenance = answeredTotal === 1 && (
    (expectation.goldEvidence?.pages?.length ? !expectation.goldEvidence.pages.every((page) => reviewResult.routerResult.pages.includes(page)) : false)
    || (expectation.goldEvidence?.spanAnchors?.length ? !expectation.goldEvidence.spanAnchors.every((anchor) => includesNormalized(reviewResult.routerResult.quotes.join("\n"), anchor)) : false)
    || reviewResult.routerResult.quotes.length === 0
    || reviewResult.routerResult.pages.length === 0
  ) ? 1 : 0;

  // Visible-answer evaluation — tracked in separate failure list so new
  // visible-answer checks do not corrupt existing router-only metrics
  // (firstPassSuccessRate, regressionCount).
  let visibleAnswerPassed = 0;
  let visibleAnswerTotal = 0;
  let visibleAgreementPassed = 0;
  let visibleAgreementTotal = 0;
  let visibleStatusMatch = false;
  let visibleAgreementOk = false;

  const da = reviewResult.documentAnswer;
  const router = reviewResult.routerResult;
  const visibleExpectation = expectation.visibleAnswerStatus;
  const visibleExpectationText = expectation.visibleAnswerTextContains;
  const visibleExpectationEvidenceMin = expectation.visibleAnswerEvidenceMin;
  const visibleExpectationEvidencePage = expectation.visibleAnswerEvidencePage;
  const hasVisibleAssertions = Boolean(visibleExpectation || visibleExpectationText
    || typeof visibleExpectationEvidenceMin === "number" || typeof visibleExpectationEvidencePage === "number");

  if (hasVisibleAssertions) {
    if (visibleExpectation) {
      visibleAnswerTotal += 1;
      if (da.status === visibleExpectation) {
        visibleAnswerPassed += 1;
        visibleStatusMatch = true;
      } else {
        visibleFailures.push(`visibleAnswerStatus expected ${visibleExpectation} but got ${da.status}`);
      }
    }

    if (visibleExpectationText) {
      if (!includesNormalized(da.explanation, visibleExpectationText)) {
        visibleFailures.push(`visibleAnswerText expected to contain "${visibleExpectationText}", got "${da.explanation.slice(0, 120)}"`);
      }
    }

    if (typeof visibleExpectationEvidenceMin === "number") {
      if (da.evidence.length < visibleExpectationEvidenceMin) {
        visibleFailures.push(`visibleAnswerEvidence expected at least ${visibleExpectationEvidenceMin} items, got ${da.evidence.length}`);
      }
    }

    if (typeof visibleExpectationEvidencePage === "number") {
      const hasPage = da.evidence.some((e) => e.page === visibleExpectationEvidencePage);
      if (!hasPage) {
        const pages = da.evidence.map((e) => e.page).filter(Boolean);
        visibleFailures.push(`visibleAnswerEvidence page ${visibleExpectationEvidencePage} not found (available pages: ${pages.join(", ") || "none"})`);
      }
    }
  }

  // Agreement between visible answer and Technical details (router)
  visibleAgreementTotal += 1;
  const routerHasEvidence = router.status === "answered";
  const visibleSaysLikelyYes = da.status === "likely_yes";
  const routerNoEvidence = router.status === "no_evidence";

  const visibleFalseNegative = routerHasEvidence && (da.status === "unclear" || da.status === "likely_no");
  const visibleFalsePositive = (routerNoEvidence || router.status === "unclear") && visibleSaysLikelyYes;
  const visibleOverride = routerHasEvidence && da.status === "likely_no";

  if (visibleFalseNegative) {
    visibleFailures.push(`visible answer (${da.status}) hides evidence that router Technical details found (${router.status})`);
  } else if (visibleFalsePositive) {
    visibleFailures.push(`visible answer (likely_yes) overrides router Technical details (${router.status}) — no evidence or only weak signal`);
  } else if (visibleOverride) {
    visibleFailures.push(`visible answer (likely_no) contradicts router Technical details (${router.status})`);
  } else {
    visibleAgreementPassed += 1;
    visibleAgreementOk = true;
  }

  return {
    result: {
      questionId: input.questionId,
      passed: routerFailures.length === 0,
      actualStatus: reviewResult.routerResult.status,
      actualRoute: reviewResult.routerResult.route,
      actualVisibleStatus: da.status,
      visibleStatusMatch,
      visibleAgreementOk,
      failures: routerFailures,
      visibleFailures,
    },
    provenancePassed,
    provenanceTotal,
    sectionPrecisionPassed,
    sectionPrecisionTotal,
    sectionRecallPassed,
    sectionRecallTotal,
    unsupportedPassed,
    unsupportedTotal,
    noEvidenceFalseNegativeFailures,
    noEvidenceFalseNegativeTotal,
    hallucinatedAnswered: answeredWithoutProvenance,
    answeredTotal,
    visibleAnswerPassed,
    visibleAnswerTotal,
    visibleAgreementPassed,
    visibleAgreementTotal,
  };
}

export function runQuickCheckEvalCorpus(options?: {
  manifestPath?: string;
  repoRoot?: string;
}): EvalCorpusReport {
  const repoRoot = options?.repoRoot ?? path.resolve(process.cwd());
  const manifestPath = options?.manifestPath ?? path.join(repoRoot, "tests/fixtures/quick-check/corpus/phase6-eval-corpus.json");
  const manifest = loadEvalCorpusManifest(manifestPath);
  const failures: EvalCorpusFailure[] = [];
  const fixtureResults: EvalCorpusFixtureResult[] = [];

  let factPassed = 0;
  let factTotal = 0;
  let provenancePassed = 0;
  let provenanceTotal = 0;
  let sectionPrecisionPassed = 0;
  let sectionPrecisionTotal = 0;
  let sectionRecallPassed = 0;
  let sectionRecallTotal = 0;
  let unsupportedPassed = 0;
  let unsupportedTotal = 0;
  let noEvidenceFalseNegativeFailures = 0;
  let noEvidenceFalseNegativeTotal = 0;
  let hallucinatedAnswered = 0;
  let answeredTotal = 0;
  let fixturesPassed = 0;
  let visibleAnswerPassed = 0;
  let visibleAnswerTotal = 0;
  let visibleAgreementPassed = 0;
  let visibleAgreementTotal = 0;

  for (const fixture of manifest.fixtures) {
    const rawPddText = readEvalCorpusFixture(repoRoot, fixture.fixturePath, fixture.kind);
    const structuredContext = getStructuredQueryContext(rawPddText);
    const factFailures = compareFactContract(fixture.gold, structuredContext.projectFactContract);
    const questionResults: EvalCorpusQuestionResult[] = [];

    const factChecksTotal = 11;
    factTotal += factChecksTotal;
    factPassed += factChecksTotal - factFailures.length;
    for (const factFailure of factFailures) {
      failures.push({
        fixtureId: fixture.id,
        category: "fact_contract",
        questionId: "fact_contract",
        message: factFailure,
      });
    }

    for (const [questionId, expectation] of Object.entries(fixture.gold.questionExpectations) as Array<
      [StandardPhase6QuestionId, EvalCorpusQuestionExpectation]
    >) {
      const evaluated = evaluateQuestion({
        fixture,
        questionId,
        expectation,
        rawPddText,
      });
      questionResults.push(evaluated.result);
      provenancePassed += evaluated.provenancePassed;
      provenanceTotal += evaluated.provenanceTotal;
      sectionPrecisionPassed += evaluated.sectionPrecisionPassed;
      sectionPrecisionTotal += evaluated.sectionPrecisionTotal;
      sectionRecallPassed += evaluated.sectionRecallPassed;
      sectionRecallTotal += evaluated.sectionRecallTotal;
      unsupportedPassed += evaluated.unsupportedPassed;
      unsupportedTotal += evaluated.unsupportedTotal;
      noEvidenceFalseNegativeFailures += evaluated.noEvidenceFalseNegativeFailures;
      noEvidenceFalseNegativeTotal += evaluated.noEvidenceFalseNegativeTotal;
      hallucinatedAnswered += evaluated.hallucinatedAnswered;
      answeredTotal += evaluated.answeredTotal;
      visibleAnswerPassed += evaluated.visibleAnswerPassed;
      visibleAnswerTotal += evaluated.visibleAnswerTotal;
      visibleAgreementPassed += evaluated.visibleAgreementPassed;
      visibleAgreementTotal += evaluated.visibleAgreementTotal;

      for (const failure of evaluated.result.failures) {
        failures.push({
          fixtureId: fixture.id,
          category: "question",
          questionId,
          message: failure,
        });
      }
      for (const visibleFailure of evaluated.result.visibleFailures) {
        failures.push({
          fixtureId: fixture.id,
          category: "visible_answer",
          questionId,
          message: visibleFailure,
        });
      }
    }

    const fixturePassed = factFailures.length === 0 && questionResults.every((question) => question.passed);
    if (fixturePassed) fixturesPassed += 1;
    fixtureResults.push({
      fixtureId: fixture.id,
      passed: fixturePassed,
      factFailures,
      questionResults,
    });
  }

  return {
    corpusId: manifest.corpusId,
    fixtureCount: manifest.fixtures.length,
    fixtureResults,
    failures,
    metrics: {
      factExtractionAccuracy: makeMetric(factPassed, factTotal),
      provenanceCorrectness: makeMetric(provenancePassed, provenanceTotal),
      sectionRetrievalPrecision: makeMetric(sectionPrecisionPassed, sectionPrecisionTotal),
      sectionRetrievalRecall: makeMetric(sectionRecallPassed, sectionRecallTotal),
      unsupportedRejectionRate: makeMetric(unsupportedPassed, unsupportedTotal),
      noEvidenceFalseNegativeRate: makeMetric(noEvidenceFalseNegativeFailures, noEvidenceFalseNegativeTotal),
      hallucinatedAnswerRate: makeMetric(hallucinatedAnswered, answeredTotal),
      firstPassSuccessRate: makeMetric(fixturesPassed, manifest.fixtures.length),
      visibleAnswerGoldMatch: makeMetric(visibleAnswerPassed, visibleAnswerTotal),
      visibleAnswerAgreementRate: makeMetric(visibleAgreementPassed, visibleAgreementTotal),
      regressionCount: failures.filter((f) => f.category !== "visible_answer").length,
    },
  };
}

function pct(metric: EvalMetric): string {
  return `${(metric.rate * 100).toFixed(1)}% (${metric.passed}/${metric.total})`;
}

export function formatQuickCheckEvalCorpusReport(report: EvalCorpusReport): string {
  const lines = [
    `Quick Check Eval Corpus: ${report.corpusId}`,
    `Fixtures: ${report.fixtureCount}`,
    "",
    "Metrics",
    `- Fact extraction accuracy: ${pct(report.metrics.factExtractionAccuracy)}`,
    `- Provenance correctness: ${pct(report.metrics.provenanceCorrectness)}`,
    `- Section retrieval precision: ${pct(report.metrics.sectionRetrievalPrecision)}`,
    `- Section retrieval recall: ${pct(report.metrics.sectionRetrievalRecall)}`,
    `- Unsupported rejection rate: ${pct(report.metrics.unsupportedRejectionRate)}`,
    `- No-evidence false negative rate: ${pct(report.metrics.noEvidenceFalseNegativeRate)}`,
    `- Hallucinated answer rate: ${pct(report.metrics.hallucinatedAnswerRate)}`,
    `- First-pass success rate: ${pct(report.metrics.firstPassSuccessRate)}`,
    `- Visible answer gold match: ${pct(report.metrics.visibleAnswerGoldMatch)}`,
    `- Visible answer / Technical agreement: ${pct(report.metrics.visibleAnswerAgreementRate)}`,
    `- Regression count: ${report.metrics.regressionCount}`,
    "",
    "Fixtures",
  ];

  for (const fixture of report.fixtureResults) {
    lines.push(`- ${fixture.fixtureId}: ${fixture.passed ? "PASS" : "FAIL"}`);
    if (fixture.factFailures.length > 0) {
      lines.push(`  fact failures: ${fixture.factFailures.join("; ")}`);
    }
    const failedQuestions = fixture.questionResults.filter((question) => !question.passed);
    if (failedQuestions.length > 0) {
      for (const failedQuestion of failedQuestions) {
        lines.push(`  ${failedQuestion.questionId}: ${failedQuestion.failures.join("; ")}`);
      }
    }
    const questionsWithVisibleFailures = fixture.questionResults.filter((q) => q.visibleFailures.length > 0);
    if (questionsWithVisibleFailures.length > 0) {
      for (const q of questionsWithVisibleFailures) {
        for (const vf of q.visibleFailures) {
          lines.push(`  ${q.questionId} [visible]: ${vf}`);
        }
      }
    }
  }

  if (report.failures.length > 0) {
    lines.push("", "Failures");
    for (const failure of report.failures.slice(0, 20)) {
      lines.push(`- ${failure.fixtureId}${failure.questionId ? `/${failure.questionId}` : ""}: ${failure.message}`);
    }
  }

  return lines.join("\n");
}

export function checkEvalCorpusThresholds(
  report: EvalCorpusReport,
  thresholds: EvalCorpusThresholds = DEFAULT_STRICT_THRESHOLDS,
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];

  const { metrics } = report;

  if (metrics.firstPassSuccessRate.rate < thresholds.firstPassSuccessRate) {
    violations.push(
      `firstPassSuccessRate ${(metrics.firstPassSuccessRate.rate * 100).toFixed(1)}% below threshold ${(thresholds.firstPassSuccessRate * 100).toFixed(1)}%`,
    );
  }

  if (metrics.provenanceCorrectness.total > 0 && metrics.provenanceCorrectness.rate < thresholds.provenanceCorrectness) {
    violations.push(
      `provenanceCorrectness ${(metrics.provenanceCorrectness.rate * 100).toFixed(1)}% below threshold ${(thresholds.provenanceCorrectness * 100).toFixed(1)}%`,
    );
  }

  if (metrics.unsupportedRejectionRate.total > 0 && metrics.unsupportedRejectionRate.rate < thresholds.unsupportedRejectionRate) {
    violations.push(
      `unsupportedRejectionRate ${(metrics.unsupportedRejectionRate.rate * 100).toFixed(1)}% below threshold ${(thresholds.unsupportedRejectionRate * 100).toFixed(1)}%`,
    );
  }

  if (metrics.hallucinatedAnswerRate.rate > thresholds.hallucinatedAnswerRate) {
    violations.push(
      `hallucinatedAnswerRate ${(metrics.hallucinatedAnswerRate.rate * 100).toFixed(1)}% exceeds threshold ${(thresholds.hallucinatedAnswerRate * 100).toFixed(1)}%`,
    );
  }

  if (metrics.regressionCount > thresholds.regressionCount) {
    violations.push(
      `regressionCount ${metrics.regressionCount} exceeds threshold ${thresholds.regressionCount}`,
    );
  }

  if (metrics.visibleAnswerGoldMatch.total > 0 && metrics.visibleAnswerGoldMatch.rate < DEFAULT_VISIBLE_ANSWER_THRESHOLDS.visibleAnswerGoldMatch) {
    violations.push(
      `visibleAnswerGoldMatch ${(metrics.visibleAnswerGoldMatch.rate * 100).toFixed(1)}% below threshold ${(DEFAULT_VISIBLE_ANSWER_THRESHOLDS.visibleAnswerGoldMatch * 100).toFixed(1)}%`,
    );
  }

  if (metrics.visibleAnswerAgreementRate.total > 0 && metrics.visibleAnswerAgreementRate.rate < DEFAULT_VISIBLE_ANSWER_THRESHOLDS.visibleAnswerAgreementRate) {
    violations.push(
      `visibleAnswerAgreementRate ${(metrics.visibleAnswerAgreementRate.rate * 100).toFixed(1)}% below threshold ${(DEFAULT_VISIBLE_ANSWER_THRESHOLDS.visibleAnswerAgreementRate * 100).toFixed(1)}%`,
    );
  }

  return { passed: violations.length === 0, violations };
}
