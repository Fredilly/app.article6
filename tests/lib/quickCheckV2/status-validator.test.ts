import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks, type AnswerResult } from "@/lib/quickCheckV2/answers";
import {
  loadAndParseExtractedText,
  type RetrievedEvidence,
} from "@/lib/quickCheckV2/evidence";
import { validateAnswerResult, validateAnswerResults } from "@/lib/quickCheckV2/status";

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/proj-desc-1382-extracted.txt";

const STATUS_SOURCE_PATH = path.resolve("src/lib/quickCheckV2/status/index.ts");

function makeAnswerResult(
  overrides: Partial<AnswerResult>,
): AnswerResult {
  return {
    checkName: "additionality",
    answer: "Additionality is demonstrated.",
    evidence: {
      sourceType: "exact_section",
      quote: "Additionality is demonstrated.",
      page: 38,
      sectionHeading: "Additionality",
      sectionPath: ["3", "3.2"],
      spanId: "synthetic-doc:p38:b0:add",
    },
    ...overrides,
  };
}

describe("Quick Check v2 — Phase 5 deterministic status validator", () => {
  const document = loadAndParseExtractedText(ENVIRA_FIXTURE_PATH);
  const answers = extractAnswersForAllChecks(document);
  const statuses = validateAnswerResults(answers);

  it("marks all six Envira structured checks as FOUND", () => {
    expect(statuses).toHaveLength(6);
    expect(statuses.every((result) => result.status === "FOUND")).toBe(true);
  });

  it("returns MISSING when evidence is null", () => {
    expect(
      validateAnswerResult(
        makeAnswerResult({
          answer: null,
          evidence: null,
        }),
      ),
    ).toStrictEqual({
      checkName: "additionality",
      status: "MISSING",
      answer: null,
      evidence: null,
      reason: "evidence_missing",
    });
  });

  it("returns UNCLEAR when evidence exists but answer is null", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        answer: null,
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("answer_missing");
  });

  it("returns UNCLEAR when answer exists without complete provenance", () => {
    const incompleteEvidence = {
      sourceType: "exact_section",
      quote: "Additionality is demonstrated.",
      page: 0,
      sectionHeading: null,
      sectionPath: [],
      spanId: "",
    } as RetrievedEvidence;

    const result = validateAnswerResult(
      makeAnswerResult({
        evidence: incompleteEvidence,
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("provenance_incomplete");
  });

  it("returns UNCLEAR when only raw-text fallback evidence supports the answer", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        evidence: {
          sourceType: "raw_text_fallback",
          quote: "Additionality is demonstrated.",
          page: 38,
          sectionHeading: "Additionality",
          sectionPath: ["3", "3.2"],
          spanId: "synthetic-doc:p38:b0:add",
        },
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("fallback_evidence_only");
  });

  it("returns FOUND for fact-contract evidence with complete answer and provenance", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        checkName: "methodology",
        answer: "VM0007",
        evidence: {
          sourceType: "fact_contract",
          quote: "The project applies methodology VM0007.",
          page: 31,
          sectionHeading: "Title and Reference of Methodology",
          sectionPath: ["3", "3.1"],
          spanId: "synthetic-doc:p31:b0:methodology",
        },
      }),
    );

    expect(result.status).toBe("FOUND");
    expect(result.reason).toBe("answer_and_provenance_complete");
  });

  it("returns FOUND for exact-section evidence with complete answer and provenance", () => {
    const result = validateAnswerResult(makeAnswerResult({}));

    expect(result.status).toBe("FOUND");
    expect(result.reason).toBe("answer_and_provenance_complete");
  });

  it("returns only checkName, status, answer, evidence, and reason", () => {
    for (const result of statuses) {
      expect(Object.keys(result)).toStrictEqual([
        "checkName",
        "status",
        "answer",
        "evidence",
        "reason",
      ]);
      expect(Object.keys(result)).not.toContain("score");
      expect(Object.keys(result)).not.toContain("router");
    }
  });

  it("does not leak score or router fields into evidence", () => {
    for (const result of statuses) {
      if (!result.evidence) continue;
      expect(Object.keys(result.evidence)).not.toContain("score");
      expect(Object.keys(result.evidence)).not.toContain("router");
      expect(Object.keys(result.evidence)).not.toContain("status");
    }
  });

  it("does not import search, ranking, scoring, router, Blob, LLM, or Quick Check v1 code", () => {
    const source = fs.readFileSync(STATUS_SOURCE_PATH, "utf-8");

    expect(source).not.toMatch(/retrieveEvidenceFor(Check|AllChecks)/);
    expect(source).not.toMatch(/extractAnswerForCheck\s*\(/);
    expect(source).not.toMatch(/extractAnswersForAllChecks\s*\(/);
    expect(source).not.toMatch(/from\s+"@\/lib\/quickCheck\//);
    expect(source).not.toMatch(/from\s+"@\/lib\/chat\//);
    expect(source).not.toMatch(/from\s+"@\/lib\/quickCheckV2\/(ingestion|section-tree)"/);
  });
});
