import { describe, expect, it } from "@jest/globals";
import { extractAnswerFromEvidence, extractAnswersForAllChecks } from "@/lib/quickCheckV2/answers";
import {
  loadAndParseExtractedText,
  retrieveEvidenceForAllChecks,
  type RetrievedCheckEvidence,
  type RetrievedEvidence,
} from "@/lib/quickCheckV2/evidence";

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/proj-desc-1382-extracted.txt";

function answerIsGroundedInEvidence(
  answer: string | null,
  evidence: RetrievedEvidence | null,
): boolean {
  if (!answer || !evidence) return answer === null;
  const answerTokens = answer
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !["that", "this", "with", "from", "into", "through", "because", "project"].includes(token));
  const quote = evidence.quote.toLowerCase();
  const overlappingTokens = answerTokens.filter((token) => quote.includes(token));

  return overlappingTokens.length >= Math.min(2, answerTokens.length);
}

describe("Quick Check v2 — Phase 4 tiny answer extractors", () => {
  const document = loadAndParseExtractedText(ENVIRA_FIXTURE_PATH);
  const selectedEvidence = retrieveEvidenceForAllChecks(document);
  const answers = extractAnswersForAllChecks(document);

  it("returns answer results for all six structured checks", () => {
    expect(answers.map((result) => result.checkName)).toStrictEqual([
      "host_country",
      "methodology",
      "baseline_scenario",
      "additionality",
      "leakage",
      "stakeholder_consultation",
    ]);
    expect(answers).toHaveLength(6);
  });

  it("returns Brazil for host_country", () => {
    const result = answers.find((item) => item.checkName === "host_country");
    expect(result?.answer).toBe("Brazil");
  });

  it("returns a methodology answer that includes VM0007", () => {
    const result = answers.find((item) => item.checkName === "methodology");
    expect(result?.answer).toContain("VM0007");
  });

  it("keeps answers grounded in the selected Phase 3 evidence", () => {
    for (const result of answers) {
      expect(answerIsGroundedInEvidence(result.answer, result.evidence)).toBe(true);
    }
  });

  it("returns non-null answers for the Envira fixture", () => {
    for (const result of answers) {
      expect(result.answer).not.toBeNull();
    }
  });

  it("returns null when evidence is missing", () => {
    const noEvidence: RetrievedCheckEvidence = {
      checkName: "additionality",
      evidence: null,
    };

    expect(extractAnswerFromEvidence(noEvidence)).toStrictEqual({
      checkName: "additionality",
      answer: null,
      evidence: null,
    });
  });

  it("preserves the original Phase 3 evidence object", () => {
    for (let index = 0; index < answers.length; index += 1) {
      expect(answers[index]!.evidence).toStrictEqual(selectedEvidence[index]!.evidence);
    }
  });

  it("does not leak status, score, or router fields", () => {
    for (const result of answers) {
      expect(Object.keys(result)).toStrictEqual(["checkName", "answer", "evidence"]);
      expect(Object.keys(result)).not.toContain("status");
      expect(Object.keys(result)).not.toContain("score");
      expect(Object.keys(result)).not.toContain("router");
      if (result.evidence) {
        expect(Object.keys(result.evidence)).not.toContain("status");
        expect(Object.keys(result.evidence)).not.toContain("score");
        expect(Object.keys(result.evidence)).not.toContain("router");
      }
    }
  });
});
