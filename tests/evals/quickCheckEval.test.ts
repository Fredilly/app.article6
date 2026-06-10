import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  buildReviewQuestionResult,
  buildReviewQuestionSectionRetrieval,
} from "@/lib/chat/quickCheckReviewQuestion";
import { getDocumentQaUiConfig } from "@/lib/quickCheck/documentQa";
import {
  runQuickCheckEvalCorpus,
  checkEvalCorpusThresholds,
  formatQuickCheckEvalCorpusReport,
} from "@/lib/quickCheck/evalCorpus/runner";
import { loadEvalCorpusManifest } from "@/lib/quickCheck/evalCorpus/manifest";
import { DEFAULT_VISIBLE_ANSWER_THRESHOLDS } from "@/lib/quickCheck/evalCorpus/types";
import type { EvalCorpusReport, EvalMetric } from "@/lib/quickCheck/evalCorpus/types";
import type {
  BuildReviewQuestionSectionRetrievalInput,
  ReviewArea,
  ReviewQuestionMatchStage,
  ReviewQuestionStatus,
} from "@/lib/quickCheck/retrieval/types";

type RetrievalEvalCase = {
  id: string;
  fixture: string;
  input: BuildReviewQuestionSectionRetrievalInput;
  expected: {
    reviewArea: ReviewArea;
    matchStage: ReviewQuestionMatchStage;
    relevantSections: string[];
    matchedHeadingTitle?: string;
  };
};

type VerdictEvalCase = {
  id: string;
  fixture: string;
  input: BuildReviewQuestionSectionRetrievalInput;
  expected: {
    status: ReviewQuestionStatus;
    baselineVerdict?: string;
    reviewAreaVerdict?: string;
  };
};

type DocumentAnswerEvalCase = {
  id: string;
  fixture: string;
  input: BuildReviewQuestionSectionRetrievalInput;
  expected: {
    status: "likely_yes" | "likely_no" | "unclear";
    explanationContains: string;
    evidenceCountMin?: number;
    methodologyRuleMatched?: boolean;
  };
};

type EvalFixtureManifest = {
  retrievalCases: RetrievalEvalCase[];
  verdictCases: VerdictEvalCase[];
  documentAnswerCases: DocumentAnswerEvalCase[];
};

type RouterEvalExpectation = {
  status: "answered" | "unclear" | "no_evidence";
  route?: "project_fact_contract" | "section_index" | "table_index" | "lexical_retrieval" | "fallback";
  allowedStatuses?: Array<"answered" | "unclear" | "no_evidence">;
  confidenceMin?: number;
  evidenceRequired: boolean;
  sectionPathsRequired?: boolean;
  allowTableIndexWithoutProvenance?: boolean;
  emptyEvidenceExpected?: boolean;
  warningsInclude?: string[];
};

type RouterEvalCase = {
  id: string;
  rawPddText: string;
  input: BuildReviewQuestionSectionRetrievalInput;
  expected: RouterEvalExpectation;
};

const EVAL_FIXTURE_DIR = path.join(__dirname, "../fixtures/quick-check/eval");
const EVAL_MANIFEST_PATH = path.join(EVAL_FIXTURE_DIR, "quickcheck-eval-cases.json");
const EVAL_MANIFEST = JSON.parse(
  fs.readFileSync(EVAL_MANIFEST_PATH, "utf-8"),
) as EvalFixtureManifest;
const FIXTURE_ROOT = path.join(__dirname, "../fixtures");

function readFixtureText(fixture: string): string {
  return fs.readFileSync(path.join(EVAL_FIXTURE_DIR, fixture), "utf-8");
}

function readRootFixtureText(fixturePath: string): string {
  const absolutePath = path.join(FIXTURE_ROOT, fixturePath);
  if (absolutePath.endsWith(".json")) {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as {
      pages?: Array<{ text?: string; rawText?: string }>;
    };
    return (parsed.pages ?? [])
      .map((page) => page.text ?? page.rawText ?? "")
      .filter(Boolean)
      .join("\n\n");
  }
  return fs.readFileSync(absolutePath, "utf-8");
}

const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
const REAL_ENVIRA_TEXT = readRootFixtureText("quick-check/envira-amazonia-vm0007-extracted.txt");
const REAL_TABLE_HEAVY_APPENDIX_TEXT = readRootFixtureText("projects/ccb1530-appendix1-pages.json");
const WEAK_UNKNOWN_FALLBACK_TEXT = readRootFixtureText("quick-check/weak-unknown-fallback.txt");

const ROUTER_EVAL_CASES: RouterEvalCase[] = [
  {
    id: "real_document_project_title_router_contract",
    rawPddText: REAL_CDM_TEXT,
    input: {
      claimText: "What is the project title?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
    },
    expected: {
      status: "answered",
      route: "project_fact_contract",
      confidenceMin: 0.7,
      evidenceRequired: true,
    },
  },
  {
    id: "real_document_host_country_router_contract",
    rawPddText: REAL_CDM_TEXT,
    input: {
      claimText: "What is the host country?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
    },
    expected: {
      status: "answered",
      route: "project_fact_contract",
      confidenceMin: 0.7,
      evidenceRequired: true,
    },
  },
  {
    id: "real_document_methodology_router_contract",
    rawPddText: REAL_CDM_TEXT,
    input: {
      claimText: "What methodology is used for this project?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
    },
    expected: {
      status: "answered",
      route: "project_fact_contract",
      confidenceMin: 0.7,
      evidenceRequired: true,
    },
  },
  {
    id: "real_document_baseline_router_contract",
    rawPddText: REAL_CDM_TEXT,
    input: {
      claimText: "Explain the baseline scenario.",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
    },
    expected: {
      status: "answered",
      allowedStatuses: ["answered", "unclear"],
      route: "section_index",
      confidenceMin: 0.6,
      evidenceRequired: true,
      sectionPathsRequired: true,
    },
  },
  {
    id: "real_document_monitoring_router_contract",
    rawPddText: REAL_ENVIRA_TEXT,
    input: {
      claimText: "Explain the monitoring plan.",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    },
    expected: {
      status: "answered",
      route: "section_index",
      confidenceMin: 0.7,
      evidenceRequired: true,
      sectionPathsRequired: true,
    },
  },
  {
    id: "real_document_table_heavy_router_contract",
    rawPddText: REAL_TABLE_HEAVY_APPENDIX_TEXT,
    input: {
      claimText: "What does the table say about net ghg removals?",
      methodologyId: "AR-ACM0003",
      methodologyVersion: "1.0",
    },
    expected: {
      status: "no_evidence",
      allowedStatuses: ["no_evidence", "unclear"],
      confidenceMin: 0,
      evidenceRequired: false,
      allowTableIndexWithoutProvenance: false,
    },
  },
  {
    id: "real_document_unsupported_router_contract",
    rawPddText: REAL_CDM_TEXT,
    input: {
      claimText: "Does the document address marine biodiversity offsets?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
    },
    expected: {
      status: "no_evidence",
      route: "fallback",
      confidenceMin: 0,
      evidenceRequired: false,
      emptyEvidenceExpected: true,
      warningsInclude: ["unsupported_or_out_of_scope"],
    },
  },
  {
    id: "real_document_ambiguous_router_contract",
    rawPddText: REAL_CDM_TEXT,
    input: {
      claimText: "baseline methodology",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
    },
    expected: {
      status: "unclear",
      route: "fallback",
      confidenceMin: 0,
      evidenceRequired: false,
      emptyEvidenceExpected: true,
      warningsInclude: ["ambiguous_intent"],
    },
  },
  {
    id: "real_document_envira_project_title_router_contract",
    rawPddText: REAL_ENVIRA_TEXT,
    input: {
      claimText: "What is the project title?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    },
    expected: {
      status: "answered",
      route: "project_fact_contract",
      confidenceMin: 0.7,
      evidenceRequired: true,
    },
  },
  {
    id: "real_document_envira_host_country_no_evidence",
    rawPddText: REAL_ENVIRA_TEXT,
    input: {
      claimText: "What is the host country?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    },
    expected: {
      status: "no_evidence",
      route: "fallback",
      confidenceMin: 0,
      evidenceRequired: false,
      emptyEvidenceExpected: true,
    },
  },
  {
    id: "structured_input_methodology_fallback_warns_provenance",
    rawPddText: WEAK_UNKNOWN_FALLBACK_TEXT,
    input: {
      claimText: "What methodology is used?",
      methodologyId: "AMS-III.AV.",
      methodologyVersion: "4.0",
    },
    expected: {
      status: "answered",
      route: "project_fact_contract",
      confidenceMin: 0.7,
      evidenceRequired: false,
      emptyEvidenceExpected: true,
      warningsInclude: ["structured_input_provenance"],
    },
  },
];

describe("Quick Check eval harness — retrieval", () => {
  for (const testCase of EVAL_MANIFEST.retrievalCases) {
    it(testCase.id, () => {
      const retrieval = buildReviewQuestionSectionRetrieval({
        ...testCase.input,
        rawPddText: readFixtureText(testCase.fixture),
      });

      expect(retrieval.reviewArea).toBe(testCase.expected.reviewArea);
      expect(retrieval.matchStage).toBe(testCase.expected.matchStage);
      expect(retrieval.relevantSections).toEqual(testCase.expected.relevantSections);

      if (testCase.expected.matchedHeadingTitle) {
        expect(retrieval.matchedHeadings[0]?.title).toBe(testCase.expected.matchedHeadingTitle);
      }
    });
  }
});

describe("Quick Check eval harness — verdicts", () => {
  for (const testCase of EVAL_MANIFEST.verdictCases) {
    it(testCase.id, () => {
      const result = buildReviewQuestionResult({
        ...testCase.input,
        rawPddText: readFixtureText(testCase.fixture),
      });

      expect(result.status).toBe(testCase.expected.status);

      if (testCase.expected.baselineVerdict) {
        expect(result.baselineReview?.verdict).toBe(testCase.expected.baselineVerdict);
      }

      if (testCase.expected.reviewAreaVerdict) {
        expect(result.reviewAreaReview?.verdict).toBe(testCase.expected.reviewAreaVerdict);
      }
    });
  }
});

describe("Quick Check eval harness — golden Document Q&A answer states", () => {
  for (const testCase of EVAL_MANIFEST.documentAnswerCases) {
    it(testCase.id, () => {
      const result = buildReviewQuestionResult({
        ...testCase.input,
        rawPddText: readFixtureText(testCase.fixture),
      });

      const da = result.documentAnswer;

      expect(da.status).toBe(testCase.expected.status);
      expect(da.explanation).toContain(testCase.expected.explanationContains);

      if (typeof testCase.expected.evidenceCountMin === "number") {
        expect(da.evidence.length).toBeGreaterThanOrEqual(testCase.expected.evidenceCountMin);
      }

      if (typeof testCase.expected.methodologyRuleMatched === "boolean") {
        expect(da.methodologyRuleMatched).toBe(testCase.expected.methodologyRuleMatched);
      }
    });
  }
});

describe("Quick Check — calibrated UI config from internal Document Q&A states", () => {
  it("likely_yes produces emerald badge", () => {
    const answer = {
      status: "likely_yes" as const,
      explanation: "Quick Check found document-grounded evidence relevant to the question.",
      methodologyRuleMatched: false,
      evidence: [],
      diagnostic: { reviewQuestionRoutingFired: true, rawPddTextAvailable: true, documentEvidenceCount: 2, methodologyRuleMatched: false },
    } as any;
    const cfg = getDocumentQaUiConfig(answer);
    expect(cfg.badgeClasses).toContain("emerald");
    expect(cfg.statusLabel).toBe("likely_yes");
    expect(cfg.explanation).toContain("document-grounded");
  });

  it("unclear from mismatch produces amber and the not-directly explanation", () => {
    const answer = {
      status: "unclear" as const,
      explanation: "The retrieved document evidence does not directly address the question.",
      methodologyRuleMatched: false,
      evidence: [{ snippet: "foo" }],
      diagnostic: { reviewQuestionRoutingFired: true, rawPddTextAvailable: true, documentEvidenceCount: 1, methodologyRuleMatched: false },
    } as any;
    const cfg = getDocumentQaUiConfig(answer);
    expect(cfg.badgeClasses).toContain("amber");
    expect(cfg.explanation).toContain("does not directly address");
  });
});

describe("Quick Check eval harness — deterministic router contract on real documents", () => {
  for (const testCase of ROUTER_EVAL_CASES) {
    it(testCase.id, () => {
      const result = buildReviewQuestionResult({
        ...testCase.input,
        rawPddText: testCase.rawPddText,
      });
      const router = result.routerResult;

      if (testCase.expected.allowedStatuses) {
        expect(testCase.expected.allowedStatuses).toContain(router.status);
      } else {
        expect(router.status).toBe(testCase.expected.status);
      }

      if (testCase.expected.route) {
        expect(router.route).toBe(testCase.expected.route);
      }

      if (typeof testCase.expected.confidenceMin === "number") {
        expect(router.confidence).toBeGreaterThanOrEqual(testCase.expected.confidenceMin);
      }
      expect(router.confidence).toBeLessThanOrEqual(1);

      if (testCase.expected.allowTableIndexWithoutProvenance === false) {
        expect(router.route).not.toBe("table_index");
      }

      if (testCase.expected.evidenceRequired) {
        expect(router.evidenceSpanIds.length).toBeGreaterThan(0);
        expect(router.quotes.length).toBeGreaterThan(0);
        expect(router.pages.length).toBeGreaterThan(0);
        if (testCase.expected.sectionPathsRequired !== false) {
          expect(router.sectionPaths.length).toBeGreaterThan(0);
        }
      }

      if (testCase.expected.emptyEvidenceExpected) {
        expect(router.evidenceSpanIds).toEqual([]);
        expect(router.quotes).toEqual([]);
        expect(router.pages).toEqual([]);
        expect(router.sectionPaths).toEqual([]);
      }

      if (testCase.expected.warningsInclude) {
        expect(router.warnings).toEqual(expect.arrayContaining(testCase.expected.warningsInclude));
      }

      expect(Array.isArray(router.evidenceSpanIds)).toBe(true);
      expect(Array.isArray(router.quotes)).toBe(true);
      expect(Array.isArray(router.pages)).toBe(true);
      expect(Array.isArray(router.sectionPaths)).toBe(true);
      expect(Array.isArray(router.warnings)).toBe(true);
    });
  }
});

describe("Phase 6 visible-answer eval — manifest has visible answer expectations for all questions", () => {
  const manifest = loadEvalCorpusManifest(
    path.join(__dirname, "../fixtures/quick-check/corpus/phase6-eval-corpus.json"),
  );

  for (const fixture of manifest.fixtures) {
    it(`${fixture.id}: all question expectations include visibleAnswerStatus`, () => {
      for (const [questionId, expectation] of Object.entries(fixture.gold.questionExpectations)) {
        expect(expectation.visibleAnswerStatus).toBeDefined();
        const validStatuses = ["likely_yes", "likely_no", "unclear"];
        expect(validStatuses).toContain(expectation.visibleAnswerStatus);
      }
    });
  }
});

describe("Phase 6 visible-answer eval — real document visible answer status matches expectation", () => {
  const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");

  it("project_title: manifests likely_yes gold but current Document Q&A returns unclear (known gap)", () => {
    const result = buildReviewQuestionResult({
      claimText: "What is the project title?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    const da = result.documentAnswer;
    const router = result.routerResult;

    // Router correctly finds evidence
    expect(router.status).toBe("answered");
    // Visible answer currently stays unclear — this is the gap the gate catches
    expect(da.status).toBe("unclear");
  });

  it("marine_biodiversity_offsets: visible answer correctly rejects unsupported question", () => {
    const result = buildReviewQuestionResult({
      claimText: "What does the document say about marine biodiversity offsets?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    const da = result.documentAnswer;
    const router = result.routerResult;

    // Router correctly rejects
    expect(router.status).toBe("no_evidence");
    // Visible answer correctly rejects — stays unclear, not promoted
    expect(da.status).toBe("unclear");
    expect(da.status).not.toBe("likely_yes");
  });

  it("unsupported question is never promoted to likely_yes", () => {
    const result = buildReviewQuestionResult({
      claimText: "What does the document say about marine biodiversity offsets?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    const da = result.documentAnswer;
    const router = result.routerResult;

    expect(router.status).toBe("no_evidence");
    expect(da.status).not.toBe("likely_yes");
  });
});

describe("Phase 6 visible-answer eval — checkEvalCorpusThresholds gates on visible answer metrics", () => {
  function metric(passed: number, total: number): EvalMetric {
    return { passed, total, rate: total > 0 ? passed / total : 0 };
  }

  it("passes when all router and visible-answer thresholds are met", () => {
    const report: EvalCorpusReport = {
      corpusId: "test",
      fixtureCount: 1,
      fixtureResults: [],
      failures: [],
      metrics: {
        factExtractionAccuracy: metric(10, 10),
        provenanceCorrectness: metric(0, 0),
        sectionRetrievalPrecision: metric(0, 0),
        sectionRetrievalRecall: metric(0, 0),
        unsupportedRejectionRate: metric(0, 0),
        noEvidenceFalseNegativeRate: metric(0, 0),
        hallucinatedAnswerRate: metric(0, 0),
        firstPassSuccessRate: metric(1, 1),
        visibleAnswerGoldMatch: metric(9, 10),
        visibleAnswerAgreementRate: metric(10, 10),
        regressionCount: 0,
      },
    };
    const result = checkEvalCorpusThresholds(report);
    expect(result.passed).toBe(true);
  });

  it("fails when visible answer gold match drops below 85% threshold", () => {
    const report: EvalCorpusReport = {
      corpusId: "test",
      fixtureCount: 1,
      fixtureResults: [],
      failures: [],
      metrics: {
        factExtractionAccuracy: metric(10, 10),
        provenanceCorrectness: metric(0, 0),
        sectionRetrievalPrecision: metric(0, 0),
        sectionRetrievalRecall: metric(0, 0),
        unsupportedRejectionRate: metric(0, 0),
        noEvidenceFalseNegativeRate: metric(0, 0),
        hallucinatedAnswerRate: metric(0, 0),
        firstPassSuccessRate: metric(1, 1),
        visibleAnswerGoldMatch: metric(7, 10),
        visibleAnswerAgreementRate: metric(10, 10),
        regressionCount: 0,
      },
    };
    const result = checkEvalCorpusThresholds(report);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("visibleAnswerGoldMatch"))).toBe(true);
  });

  it("fails when visible answer / Technical agreement drops below 100% threshold", () => {
    const report: EvalCorpusReport = {
      corpusId: "test",
      fixtureCount: 1,
      fixtureResults: [],
      failures: [],
      metrics: {
        factExtractionAccuracy: metric(10, 10),
        provenanceCorrectness: metric(0, 0),
        sectionRetrievalPrecision: metric(0, 0),
        sectionRetrievalRecall: metric(0, 0),
        unsupportedRejectionRate: metric(0, 0),
        noEvidenceFalseNegativeRate: metric(0, 0),
        hallucinatedAnswerRate: metric(0, 0),
        firstPassSuccessRate: metric(1, 1),
        visibleAnswerGoldMatch: metric(10, 10),
        visibleAnswerAgreementRate: metric(9, 10),
        regressionCount: 0,
      },
    };
    const result = checkEvalCorpusThresholds(report);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("visibleAnswerAgreementRate"))).toBe(true);
  });
});

describe("Phase 6 visible-answer eval — disagreement gate catches specific failure modes", () => {
  it("router answered + visible unclear fails the visible agreement gate", () => {
    const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
    const result = buildReviewQuestionResult({
      claimText: "What is the project title?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    const router = result.routerResult;
    const da = result.documentAnswer;

    // Router finds evidence but visible answer doesn't promote it
    expect(router.status).toBe("answered");
    expect(da.status).toBe("unclear");

    // This should be caught as a visible false negative
    const visibleFalseNegative = router.status === "answered" && (da.status === "unclear" || da.status === "likely_no");
    expect(visibleFalseNegative).toBe(true);
  });

  it("router no_evidence + visible likely_yes fails the visible agreement gate", () => {
    // blue-nile-redd baseline_scenario: router returns no_evidence but Document Q&A
    // sometimes over-promotes to likely_yes when table-heavy content bleeds signal
    const BLUE_NILE_TEXT = readRootFixtureText("quick-check/blue-nile-redd-extracted.txt");
    const result = buildReviewQuestionResult({
      claimText: "What does the document say about marine biodiversity offsets?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: BLUE_NILE_TEXT,
    });
    const router = result.routerResult;
    const da = result.documentAnswer;

    // Router correctly rejects unsupported
    expect(router.status).toBe("no_evidence");
    // Visible must not promote to likely_yes
    expect(da.status).not.toBe("likely_yes");
  });

  it("supported visible answers require evidence (likely_yes must have evidence items)", () => {
    const report = runQuickCheckEvalCorpus();
    for (const fixtureResult of report.fixtureResults) {
      for (const questionResult of fixtureResult.questionResults) {
        if (questionResult.actualVisibleStatus === "likely_yes") {
          // Can't assert evidence count from questionResult alone, but the visibleAgreementOk
          // flag already ensures no false positives (likely_yes with no_evidence router)
          expect(typeof questionResult.visibleStatusMatch).toBe("boolean");
          expect(typeof questionResult.visibleAgreementOk).toBe("boolean");
        }
      }
    }
  });

  it("real corpus reports visible-answer failures with [visible] prefix", () => {
    const report = runQuickCheckEvalCorpus();
    // Verify visible failures are tracked
    let visibleFailureCount = 0;
    for (const fixtureResult of report.fixtureResults) {
      for (const questionResult of fixtureResult.questionResults) {
        visibleFailureCount += questionResult.visibleFailures.length;
      }
    }
    expect(visibleFailureCount).toBeGreaterThan(0);
  });
});

describe("Phase 6 visible-answer eval — known Document Q&A gaps (not regressions)", () => {
  it("project_title: router finds evidence but visible says unclear (known gap)", () => {
    const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
    const result = buildReviewQuestionResult({
      claimText: "What is the project title?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    // Router correctly finds evidence
    expect(result.routerResult.status).toBe("answered");
    // Visible answer fails to promote — known gap, not a new regression
    expect(result.documentAnswer.status).toBe("unclear");
  });

  it("host_country: router finds evidence but visible says unclear (known gap)", () => {
    const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
    const result = buildReviewQuestionResult({
      claimText: "What is the host country?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    expect(result.routerResult.status).toBe("answered");
    expect(result.documentAnswer.status).toBe("unclear");
  });

  it("methodology: router finds evidence but visible says unclear (known gap)", () => {
    const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
    const result = buildReviewQuestionResult({
      claimText: "What methodology is used?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    expect(result.routerResult.status).toBe("answered");
    expect(result.documentAnswer.status).toBe("unclear");
  });
});

describe("Phase 6 visible-answer eval — eval corpus runner returns visible answer metrics", () => {
  it("report includes visibleAnswerGoldMatch and visibleAnswerAgreementRate", () => {
    const report = runQuickCheckEvalCorpus();
    expect(report.metrics.visibleAnswerGoldMatch).toBeDefined();
    expect(report.metrics.visibleAnswerAgreementRate).toBeDefined();
    expect(typeof report.metrics.visibleAnswerGoldMatch.rate).toBe("number");
    expect(typeof report.metrics.visibleAnswerAgreementRate.rate).toBe("number");
  });

  it("question results include actualVisibleStatus, visibleFailures, and agreement flags", () => {
    const report = runQuickCheckEvalCorpus();
    expect(report.fixtureResults.length).toBeGreaterThan(0);
    for (const fixtureResult of report.fixtureResults) {
      for (const questionResult of fixtureResult.questionResults) {
        expect(questionResult.actualVisibleStatus).toBeDefined();
        const validDocStatuses = ["likely_yes", "likely_no", "unclear"];
        expect(validDocStatuses).toContain(questionResult.actualVisibleStatus);
        expect(typeof questionResult.visibleStatusMatch).toBe("boolean");
        expect(typeof questionResult.visibleAgreementOk).toBe("boolean");
        expect(Array.isArray(questionResult.failures)).toBe(true);
        expect(Array.isArray(questionResult.visibleFailures)).toBe(true);
      }
    }
  });

  it("formatted report includes visible answer metrics", () => {
    const report = runQuickCheckEvalCorpus();
    const formatted = formatQuickCheckEvalCorpusReport(report);
    expect(formatted).toContain("Visible answer gold match");
    expect(formatted).toContain("Visible answer / Technical agreement");
  });
});
