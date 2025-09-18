import { describe, expect, it } from "vitest";
import { QueryRequestSchema, QueryResponseSchema } from "@/lib/query/schema";

const sampleResponse = {
  engineTag: "mvp-baselines-v1",
  metrics: {
    tookMs: 123,
    hitCount: 2
  },
  results: [
    {
      id: "evidence-1",
      title: "Carbon fraction reference",
      summary: "Sample summary",
      sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      sourcePath: "methodologies/META.json",
      score: 0.9876,
      metadata: {
        section: "3.2",
        topic: "Stoichiometry"
      }
    }
  ]
};

describe("QueryRequestSchema", () => {
  it("accepts trimmed non-empty text", () => {
    const result = QueryRequestSchema.safeParse({ query: "  carbon fraction " });
    expect(result.success).toBe(true);
    expect(result.success && result.data.query).toBe("carbon fraction");
  });

  it("rejects empty queries", () => {
    const result = QueryRequestSchema.safeParse({ query: "   " });
    expect(result.success).toBe(false);
  });
});

describe("QueryResponseSchema", () => {
  it("parses a minimal sample response", () => {
    const result = QueryResponseSchema.safeParse(sampleResponse);
    expect(result.success).toBe(true);
  });

  it("rejects invalid hashes", () => {
    const invalid = { ...sampleResponse, results: [{ ...sampleResponse.results[0], sha256: "bad" }] };
    const result = QueryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
