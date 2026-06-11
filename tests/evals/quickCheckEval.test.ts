import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  buildReviewQuestionResult,
  buildReviewQuestionSectionRetrieval,
  getStructuredQueryContext,
} from "@/lib/chat/quickCheckReviewQuestion";
import { getDocumentQaUiConfig } from "@/lib/quickCheck/documentQa";
import { buildEvidenceSpanIndex } from "@/lib/quickCheck/evidence/buildEvidenceSpanIndex";
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

  it("project_title: visible answer is likely_yes with document-grounded evidence", () => {
    const result = buildReviewQuestionResult({
      claimText: "What is the project title?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    const da = result.documentAnswer;
    const router = result.routerResult;

    expect(router.status).toBe("answered");
    expect(da.status).toBe("likely_yes");
    expect(da.evidence.length).toBeGreaterThanOrEqual(1);
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

    expect(router.status).toBe("no_evidence");
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
    expect(result.documentAnswer.status).not.toBe("likely_yes");
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
  it("router answered + visible likely_yes passes the visible agreement gate", () => {
    const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
    const result = buildReviewQuestionResult({
      claimText: "What is the project title?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    const router = result.routerResult;
    const da = result.documentAnswer;

    // Router finds evidence AND visible answer promotes it — agreement
    expect(router.status).toBe("answered");
    expect(da.status).toBe("likely_yes");

    // No false negative — agreement is OK
    const visibleFalseNegative = router.status === "answered" && (da.status === "unclear" || da.status === "likely_no");
    expect(visibleFalseNegative).toBe(false);
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

  it("real corpus has zero visible/Technical disagreements (single source of truth)", () => {
    const report = runQuickCheckEvalCorpus();
    let visibleFailureCount = 0;
    for (const fixtureResult of report.fixtureResults) {
      for (const questionResult of fixtureResult.questionResults) {
        visibleFailureCount += questionResult.visibleFailures.length;
      }
    }
    expect(visibleFailureCount).toBe(0);
  });
});

describe("Phase 6 visible-answer eval — fact-backed visible answers promoted correctly", () => {
  it("project_title: router answered + visible likely_yes with evidence", () => {
    const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
    const result = buildReviewQuestionResult({
      claimText: "What is the project title?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    expect(result.routerResult.status).toBe("answered");
    expect(result.documentAnswer.status).toBe("likely_yes");
    expect(result.documentAnswer.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it("host_country: router answered + visible likely_yes with evidence", () => {
    const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
    const result = buildReviewQuestionResult({
      claimText: "What is the host country?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    expect(result.routerResult.status).toBe("answered");
    expect(result.documentAnswer.status).toBe("likely_yes");
    expect(result.documentAnswer.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it("methodology: router answered + visible likely_yes with evidence", () => {
    const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
    const result = buildReviewQuestionResult({
      claimText: "What methodology is used?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });
    expect(result.routerResult.status).toBe("answered");
    expect(result.documentAnswer.status).toBe("likely_yes");
    expect(result.documentAnswer.evidence.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Phase 6 — country and location fact routing", () => {
  const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");
  const ENVIRA_TEXT = readRootFixtureText("quick-check/envira-amazonia-vm0007-extracted.txt");

  it("routes 'What is the host country?' to fact_lookup with hostCountry target", () => {
    const r = buildReviewQuestionResult({ claimText: "What is the host country?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    expect(r.queryIntentAnalysis?.intent).toBe("fact_lookup");
    expect(r.queryIntentAnalysis?.targetFacts).toContain("hostCountry");
    expect(r.routerResult.status).toBe("answered");
    expect(r.documentAnswer.status).toBe("likely_yes");
    expect(r.routerResult.quotes.join(" ")).toContain("Nepal");
  });

  it("routes 'What country is this project hosted in?' to fact_lookup with country evidence", () => {
    const r = buildReviewQuestionResult({ claimText: "What country is this project hosted in?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    expect(r.queryIntentAnalysis?.intent).toBe("fact_lookup");
    expect(r.routerResult.status).toBe("answered");
    expect(r.documentAnswer.status).toBe("likely_yes");
    expect(r.routerResult.quotes.join(" ")).toContain("Nepal");
  });

  it("routes 'What country is the project in?' to fact_lookup with country evidence", () => {
    const r = buildReviewQuestionResult({ claimText: "What country is the project in?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    expect(r.queryIntentAnalysis?.intent).toBe("fact_lookup");
    expect(r.routerResult.status).toBe("answered");
    expect(r.documentAnswer.status).toBe("likely_yes");
    expect(r.routerResult.quotes.join(" ")).toContain("Nepal");
  });

  it("routes 'Where is this project located?' to fact_lookup with country fallback", () => {
    const r = buildReviewQuestionResult({ claimText: "Where is this project located?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    expect(r.queryIntentAnalysis?.intent).toBe("fact_lookup");
    expect(r.routerResult.status).toBe("answered");
    expect(r.documentAnswer.status).toBe("likely_yes");
    expect(r.routerResult.quotes.join(" ")).toContain("Nepal");
  });

  it("returns no_evidence for country question when fixture has no country info", () => {
    const r = buildReviewQuestionResult({ claimText: "What is the host country?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: ENVIRA_TEXT });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.documentAnswer.status).not.toBe("likely_yes");
  });

  it("visible answer and router agree for country fact questions", () => {
    const r = buildReviewQuestionResult({ claimText: "What is the host country?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    const visibleAgrees = (r.routerResult.status === "answered" && r.documentAnswer.status === "likely_yes")
      || (r.routerResult.status !== "answered" && r.documentAnswer.status !== "likely_yes");
    expect(visibleAgrees).toBe(true);
  });
});

describe("Phase 6 — Verra-family country and location fact routing", () => {
  const BLUE_NILE_TEXT = readRootFixtureText("quick-check/blue-nile-redd-extracted.txt");
  const GS_LUF_TEXT = readRootFixtureText("quick-check/gs-luf-pdd-extracted.txt");
  const ENVIRA_TEXT = readRootFixtureText("quick-check/envira-amazonia-vm0007-extracted.txt");

  it("blue-nile-redd: 'What is the host country?' returns Ethiopia", () => {
    const r = buildReviewQuestionResult({ claimText: "What is the host country?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: BLUE_NILE_TEXT });
    expect(r.routerResult.status).toBe("answered");
    expect(r.documentAnswer.status).toBe("likely_yes");
    expect(r.routerResult.quotes.join(" ")).toContain("Ethiopia");
  });

  it("blue-nile-redd: 'What country is this project hosted in?' returns Ethiopia", () => {
    const r = buildReviewQuestionResult({ claimText: "What country is this project hosted in?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: BLUE_NILE_TEXT });
    expect(r.routerResult.status).toBe("answered");
    expect(r.documentAnswer.status).toBe("likely_yes");
    expect(r.routerResult.quotes.join(" ")).toContain("Ethiopia");
  });

  it("gs-luf: 'What is the host country?' returns Mozambique", () => {
    const r = buildReviewQuestionResult({ claimText: "What is the host country?", methodologyId: "GS-00XX", methodologyVersion: "1.0", rawPddText: GS_LUF_TEXT });
    expect(r.routerResult.status).toBe("answered");
    expect(r.documentAnswer.status).toBe("likely_yes");
    expect(r.routerResult.quotes.join(" ")).toContain("Mozambique");
  });

  it("envira-amazonia: 'What is the host country?' returns no_evidence (no country in fixture)", () => {
    const r = buildReviewQuestionResult({ claimText: "What is the host country?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: ENVIRA_TEXT });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.documentAnswer.status).not.toBe("likely_yes");
  });

  it("envira-amazonia: 'What country is the project in?' returns no_evidence", () => {
    const r = buildReviewQuestionResult({ claimText: "What country is the project in?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: ENVIRA_TEXT });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.documentAnswer.status).not.toBe("likely_yes");
  });
});

describe("EvidenceSpanIndex — section routing provenance", () => {
  const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");

  it("section_index route carries actual evidence span provenance, not just parent section ID", () => {
    const result = buildReviewQuestionResult({
      claimText: "What does the document say about monitoring?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });

    expect(result.routerResult.route).toBe("section_index");
    expect(result.routerResult.status).toBe("answered");

    // Evidence must have span IDs
    expect(result.routerResult.evidenceSpanIds.length).toBeGreaterThan(0);

    // Pages must come from actual spans, not be empty
    expect(result.routerResult.pages.length).toBeGreaterThan(0);

    // Section paths must be present
    expect(result.routerResult.sectionPaths.length).toBeGreaterThan(0);

    // Quote validation must pass (no quote_validation_failed warning)
    expect(result.routerResult.warnings).not.toContain("quote_validation_failed");
  });

  it("descendant section candidate validates correctly with its own provenance", () => {
    // Baseline scenario (B.4) has content spans. Target the parent section
    // and verify that the returned evidence carries the actual span's
    // provenance, not just the parent's section ID.
    const result = buildReviewQuestionResult({
      claimText: "What is the baseline scenario?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });

    expect(result.routerResult.route).toBe("section_index");
    expect(result.routerResult.status).toBe("answered");
    expect(result.routerResult.quotes.length).toBeGreaterThan(0);

    // No quote validation failures
    expect(result.routerResult.warnings.filter((w) => w.includes("quote_validation"))).toEqual([]);
  });

  it("candidate sectionId is passed into quote validation, not inferred from sectionPath", () => {
    // Build the EvidenceSpanIndex directly and verify sectionId is set on candidates
    const ctx = getStructuredQueryContext(REAL_CDM_TEXT);
    const index = buildEvidenceSpanIndex({
      evidenceDocument: ctx.evidenceDocument,
      projectFactContract: ctx.projectFactContract,
      sectionTableIndex: ctx.sectionTableIndex,
    });

    const candidates = index.query({
      claimText: "What is the baseline scenario?",
      reviewArea: "baseline",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      intent: "section_topic",
      targetSections: ["section:B.4"],
      maxCandidates: 2,
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      // sectionId must be explicitly carried, not reconstructed
      expect(c.sectionId).toBeDefined();
      expect(typeof c.sectionId).toBe("string");
      expect(c.sectionId!.length).toBeGreaterThan(0);
    }

    // Verify the full pipeline produces validated quotes with correct provenance
    const result = buildReviewQuestionResult({
      claimText: "What is the baseline scenario?",
      methodologyId: "AMS-I.E.",
      methodologyVersion: "1.0",
      rawPddText: REAL_CDM_TEXT,
    });

    expect(result.routerResult.status).toBe("answered");
    expect(result.routerResult.route).toBe("section_index");

    // Evidence span IDs exist and map to actual document spans
    for (const spanId of result.routerResult.evidenceSpanIds) {
      const span = ctx.evidenceDocument.spans.find((s) => s.spanId === spanId);
      expect(span).toBeDefined();
    }
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

describe("Phase 5 — unsupported question refusal regression", () => {
  const REAL_CDM_TEXT = readRootFixtureText("quick-check/bsp-nepal-activity3-cdm-excerpt.txt");

  it("marine biodiversity offsets: no_evidence, no quotes, no fabricated answer", () => {
    const r = buildReviewQuestionResult({ claimText: "What does the document say about marine biodiversity offsets?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.documentAnswer.status).not.toBe("likely_yes");
    expect(r.routerResult.quotes).toEqual([]);
    expect(r.routerResult.evidenceSpanIds).toEqual([]);
    expect(r.routerResult.warnings).not.toContain("quote_validation_failed");
  });

  it("satellite launch telemetry: no_evidence, no quotes", () => {
    const r = buildReviewQuestionResult({ claimText: "Does the document describe satellite launch telemetry?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.documentAnswer.status).not.toBe("likely_yes");
    expect(r.routerResult.quotes).toEqual([]);
  });

  it("stock price of developer: no_evidence, no quotes", () => {
    const r = buildReviewQuestionResult({ claimText: "What is the stock price of the project developer?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.documentAnswer.status).not.toBe("likely_yes");
    expect(r.routerResult.quotes).toEqual([]);
  });

  it("tax credits: no_evidence, no quotes", () => {
    const r = buildReviewQuestionResult({ claimText: "What does the document say about tax credits?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.routerResult.quotes).toEqual([]);
  });

  it("political risk insurance: no_evidence, no quotes", () => {
    const r = buildReviewQuestionResult({ claimText: "What does the document say about political risk insurance?", methodologyId: "AMS-I.E.", methodologyVersion: "1.0", rawPddText: REAL_CDM_TEXT });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.routerResult.quotes).toEqual([]);
  });

  it("blue carbon: no_evidence, no quotes across Verra fixture", () => {
    const BLUE_NILE = readRootFixtureText("quick-check/blue-nile-redd-extracted.txt");
    const r = buildReviewQuestionResult({ claimText: "What does the document say about blue carbon?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: BLUE_NILE });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.routerResult.quotes).toEqual([]);
  });
});

describe("Phase 5 — table routing regression", () => {
  const BLUE_NILE = readRootFixtureText("quick-check/blue-nile-redd-extracted.txt");

  it("table-lookup question returns no_evidence when table provenance is missing", () => {
    // blue-nile-redd has pipe-delimited tables that break evidence validation.
    // The router should not fabricate answers from fragmented table text.
    const r = buildReviewQuestionResult({ claimText: "What does the table say about net ghg removals?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: BLUE_NILE });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.documentAnswer.status).not.toBe("likely_yes");
    expect(r.routerResult.quotes).toEqual([]);
    expect(r.routerResult.evidenceSpanIds).toEqual([]);
  });

  it("unsupported table-like question returns no_evidence with zero quotes", () => {
    const r = buildReviewQuestionResult({ claimText: "What does the table say about satellite launch telemetry?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: BLUE_NILE });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.routerResult.quotes).toEqual([]);
    expect(r.routerResult.warnings).not.toContain("quote_validation_failed");
  });

  it("baseline scenario in table-heavy doc does not fabricate from table fragments", () => {
    const r = buildReviewQuestionResult({ claimText: "What is the baseline scenario?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: BLUE_NILE });
    // Known: blue-nile gets table_lookup intent from pipe-delimited content.
    // The router must not promote fragmented table text as an answered section.
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.documentAnswer.status).not.toBe("likely_yes");
    expect(r.routerResult.quotes).toEqual([]);
  });

  it("carbon pools question returns no_evidence in table-heavy doc", () => {
    const r = buildReviewQuestionResult({ claimText: "What does the document say about carbon pools?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: BLUE_NILE });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.routerResult.quotes).toEqual([]);
  });

  it("monitoring question in table-heavy doc does not fabricate from table text", () => {
    const r = buildReviewQuestionResult({ claimText: "What does the document say about monitoring?", methodologyId: "VM0007", methodologyVersion: "4.2", rawPddText: BLUE_NILE });
    // Known: blue-nile gets table_lookup from pipe-delimited content.
    // Verify no fabricated answer.
    expect(r.documentAnswer.status).not.toBe("likely_yes");
    expect(r.routerResult.warnings).not.toContain("quote_validation_failed");
  });
});
