import { describe, expect, test } from "@jest/globals";
import { ASSISTANT_QUESTIONS } from "@/lib/assistant/questions";

describe("assistant guided prompts", () => {
  test("has 4-6 guided prompts", () => {
    expect(ASSISTANT_QUESTIONS.length).toBeGreaterThanOrEqual(4);
    expect(ASSISTANT_QUESTIONS.length).toBeLessThanOrEqual(6);
  });

  test("labels are concise and investor-safe", () => {
    const labels = ASSISTANT_QUESTIONS.map((q) => q.label.toLowerCase());
    expect(labels.some((l) => l.includes("plain english"))).toBe(true);
    expect(labels.some((l) => l.includes("auditor"))).toBe(true);
    expect(labels.some((l) => l.includes("evidence"))).toBe(true);
  });
});

