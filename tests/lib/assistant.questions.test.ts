import { describe, expect, test } from "@jest/globals";
import { ASSISTANT_QUESTIONS } from "@/lib/assistant/questions";

describe("assistant guided prompts", () => {
  test("has the four guided prompts", () => {
    expect(ASSISTANT_QUESTIONS).toHaveLength(4);
    const labels = ASSISTANT_QUESTIONS.map((q) => q.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Show the most important rules to verify",
        "What evidence should I gather first?",
        "Where in the document is this defined?",
        "How do I export an audit-ready pack?",
      ]),
    );
  });
});
