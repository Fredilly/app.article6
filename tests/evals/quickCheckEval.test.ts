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

const EVAL_FIXTURE_DIR = path.join(__dirname, "../fixtures/quick-check/eval");
const EVAL_MANIFEST_PATH = path.join(EVAL_FIXTURE_DIR, "quickcheck-eval-cases.json");
const EVAL_MANIFEST = JSON.parse(
  fs.readFileSync(EVAL_MANIFEST_PATH, "utf-8"),
) as EvalFixtureManifest;

function readFixtureText(fixture: string): string {
  return fs.readFileSync(path.join(EVAL_FIXTURE_DIR, fixture), "utf-8");
}

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
