import { describe, expect, test } from "@jest/globals";
import { generateAnswer } from "@/lib/assistant/generateAnswer";
import { ASSISTANT_QUESTIONS } from "@/lib/assistant/questions";

const rules = [
  { id: "R-1", title: "Eligibility", snippet: "Eligibility requirements", tags: ["eligibility"] },
  { id: "R-2", title: "Monitoring", snippet: "Monitoring requirements", tags: ["monitoring"] },
];

const sections = [
  { id: "S-10", title: "Eligibility section", textSnippet: "Eligibility details" },
  { id: "S-20", title: "Monitoring section", textSnippet: "Monitoring details" },
];

describe("generateAnswer", () => {
  test("returns evidence and actions for each prompt", () => {
    for (const question of ASSISTANT_QUESTIONS) {
      const result = generateAnswer({
        questionId: question.id,
        methodCode: "AR-AM0014",
        version: "v03-0",
        rules,
        sections,
        category: question.id === "where_defined" ? "monitoring" : undefined,
        provenance: {},
      });

      expect(result.answer.length).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.next_actions.length).toBeGreaterThan(0);
    }
  });

  test("where_defined reflects chosen category", () => {
    const result = generateAnswer({
      questionId: "where_defined",
      methodCode: "AR-AM0014",
      version: "v03-0",
      rules,
      sections,
      category: "monitoring",
      provenance: {},
    });

    expect(result.answer.toLowerCase()).toContain("monitoring");
  });
});
