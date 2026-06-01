import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  buildReviewQuestionResult,
  buildReviewQuestionSectionRetrieval,
} from "@/lib/chat/quickCheckReviewQuestion";
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

type EvalFixtureManifest = {
  retrievalCases: RetrievalEvalCase[];
  verdictCases: VerdictEvalCase[];
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
