import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  buildReviewQuestionResult,
  buildReviewQuestionSectionRetrieval,
} from "@/lib/chat/quickCheckReviewQuestion";
import { getDocumentQaUiConfig } from "@/lib/quickCheck/documentQa";
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
      sectionPathsRequired: false,
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
      sectionPathsRequired: false,
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
      sectionPathsRequired: false,
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
