import { describe, expect, test } from "@jest/globals";
import { generateAnswer } from "@/lib/assistant/generateAnswer";

describe("generateAnswer", () => {
  test("empty inputs -> Not enough evidence loaded", () => {
    const result = generateAnswer({
      questionId: "purpose_claims",
      methodCode: "AR-AM0014",
      version: "v03-0",
      rules: [],
      sections: [],
      rich: null,
      meta: null,
      provenance: { pack: "methodologies-pack-3ea9dc32bfaf", generated_at: "2026-01-02T15:50:29Z", repo_sha: "deadbeef" },
    });

    expect(result.answer_md).toContain("Not enough evidence loaded");
    expect(result.evidence).toEqual([]);
    expect(result.question_id).toBe("purpose_claims");
  });

  test("evidence formatting stable", () => {
    const result = generateAnswer({
      questionId: "required_data",
      methodCode: "AR-AM0014",
      version: "v03-0",
      rules: [
        { id: "R-1", title: "Inputs", snippet: "Data requirements" },
        { id: "R-2", title: "Other", snippet: "..." },
      ],
      sections: [
        { id: "S-10", title: "Data and parameters", textSnippet: "Input data" },
        { id: "S-2", title: "Purpose", textSnippet: "..." },
      ],
      rich: null,
      meta: null,
      provenance: {},
    });

    expect(result.question_id).toBe("required_data");
    expect(result.evidence.some((e) => e.type === "section" && e.id === "S-10")).toBe(true);
    const firstSection = result.evidence.find((e) => e.type === "section");
    expect(firstSection?.excerpt).toBeTruthy();
    expect(firstSection?.quality).toBeDefined();
    expect(result.answer_md).toContain("Required data inputs");
  });
});
