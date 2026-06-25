import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import {
  isLlmUiEnabled,
  extractSpansForLlm,
  fetchLlmCandidate,
  CHECK_TO_FIELD,
} from "@/lib/quickCheck/llmUiClient";

const ORIGINAL_ENV = process.env;

function mockFetch(response: unknown, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    json: async () => response,
  });
}

describe("llmUiClient — feature flag", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("is disabled when NEXT_PUBLIC_QUICK_CHECK_LLM is not set", () => {
    delete process.env.NEXT_PUBLIC_QUICK_CHECK_LLM;
    expect(isLlmUiEnabled()).toBe(false);
  });

  it("is enabled when NEXT_PUBLIC_QUICK_CHECK_LLM=1", () => {
    process.env.NEXT_PUBLIC_QUICK_CHECK_LLM = "1";
    expect(isLlmUiEnabled()).toBe(true);
  });

  it("is disabled when NEXT_PUBLIC_QUICK_CHECK_LLM=0", () => {
    process.env.NEXT_PUBLIC_QUICK_CHECK_LLM = "0";
    expect(isLlmUiEnabled()).toBe(false);
  });
});

describe("llmUiClient — CHECK_TO_FIELD mapping", () => {
  it("maps all 11 check IDs to fields", () => {
    expect(Object.keys(CHECK_TO_FIELD)).toEqual([
      "host_country",
      "methodology",
      "baseline_scenario",
      "additionality",
      "leakage",
      "stakeholder_consultation",
      "monitoring_plan",
      "project_boundary",
      "crediting_period",
      "emission_reduction_calculation",
      "applicability_conditions",
    ]);
  });

  it("each mapping has a field and a question", () => {
    for (const [checkId, mapping] of Object.entries(CHECK_TO_FIELD)) {
      expect(mapping.field).toBeTruthy();
      expect(mapping.question).toBeTruthy();
      expect(mapping.question.endsWith("?")).toBe(true);
    }
  });
});

describe("llmUiClient — extractSpansForLlm", () => {
  it("filters out TOC, headers, footers, annexes, excluded", () => {
    const spans = [
      { spanId: "s1", text: "Project Description", page: 1, blockType: "paragraph" },
      { spanId: "s2", text: "Table of Contents", page: 1, blockType: "toc" },
      { spanId: "s3", text: "Header text", page: 1, blockType: "header" },
      { spanId: "s4", text: "VM0007 methodology", page: 4, blockType: "paragraph" },
      { spanId: "s5", text: "Appendix A", page: 10, blockType: "annex" },
    ];

    const result = extractSpansForLlm(spans);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("s1");
    expect(result[1]!.id).toBe("s4");
  });

  it("filters out short spans (< 15 chars)", () => {
    const spans = [
      { spanId: "s1", text: "Peru", page: 1, blockType: "paragraph" },
      { spanId: "s2", text: "Host Country: Papua New Guinea", page: 1, blockType: "paragraph" },
    ];

    const result = extractSpansForLlm(spans);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("s2");
  });

  it("limits to 20 spans", () => {
    const spans = Array.from({ length: 50 }, (_, i) => ({
      spanId: `s${i}`,
      text: `Span ${i} with enough text to pass filter`,
      page: 1,
      blockType: "paragraph" as const,
    }));

    const result = extractSpansForLlm(spans);
    expect(result).toHaveLength(20);
  });

  it("returns empty for unknown block types", () => {
    const spans = [
      { spanId: "s1", text: "Some text", page: 1, blockType: "toc" },
      { spanId: "s2", text: "More text", page: 1, blockType: "footer" },
    ];

    const result = extractSpansForLlm(spans);
    expect(result).toHaveLength(0);
  });
});

describe("llmUiClient — fetchLlmCandidate", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_QUICK_CHECK_LLM: "1" };
    globalThis.fetch = mockFetch({ candidates: [] });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns empty when flag is off", async () => {
    delete process.env.NEXT_PUBLIC_QUICK_CHECK_LLM;
    const result = await fetchLlmCandidate("host_country", []);
    expect(result).toEqual([]);
  });

  it("returns empty for unknown check ID", async () => {
    const result = await fetchLlmCandidate("unknown_check", []);
    expect(result).toEqual([]);
  });

  it("returns empty when spans list is empty", async () => {
    const result = await fetchLlmCandidate("host_country", []);
    expect(result).toEqual([]);
  });

  it("returns candidates for host_country when LLM responds", async () => {
    globalThis.fetch = mockFetch({
      candidates: [{
        field: "hostCountry",
        value: "Papua New Guinea",
        quote: "Country: Papua New Guinea",
        page: 1,
        evidenceSpanId: "s1",
        confidence: "high",
        warnings: [],
      }],
    });

    const spans = [
      { spanId: "s1", text: "Country: Papua New Guinea", page: 1, blockType: "paragraph" },
    ];

    const result = await fetchLlmCandidate("host_country", spans);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe("Papua New Guinea");
    expect(result[0]!.confidence).toBe("high");
  });

  it("fails silently on network error", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const spans = [
      { spanId: "s1", text: "Country: Peru", page: 1, blockType: "paragraph" },
    ];

    const result = await fetchLlmCandidate("host_country", spans);
    expect(result).toEqual([]);
  });

  it("fails silently on HTTP error", async () => {
    globalThis.fetch = mockFetch({ error: "not enabled" }, 400);

    const spans = [
      { spanId: "s1", text: "Country: Peru", page: 1, blockType: "paragraph" },
    ];

    const result = await fetchLlmCandidate("host_country", spans);
    expect(result).toEqual([]);
  });

  it("calls fetch with the correct field and question", async () => {
    const fetchMock = mockFetch({ candidates: [] });
    globalThis.fetch = fetchMock;

    const spans = [
      { spanId: "s1", text: "Methodology: VM0007", page: 4, blockType: "paragraph" },
    ];

    await fetchLlmCandidate("methodology", spans);

    const callArgs = (fetchMock as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(callArgs[0]).toBe("/api/quick-check/llm-extract");
    const body = JSON.parse(callArgs[1]!.body as string);
    expect(body.field).toBe("methodologyPrimary");
    expect(body.question).toBe("What methodology was applied?");
  });

  it("works for all 11 check types", async () => {
    globalThis.fetch = mockFetch({
      candidates: [{
        field: "test",
        value: "test",
        quote: "test",
        page: 1,
        evidenceSpanId: "s1",
        confidence: "medium",
        warnings: [],
      }],
    });

    const spans = [
      { spanId: "s1", text: "test output for verification", page: 1, blockType: "paragraph" },
    ];

    for (const checkId of Object.keys(CHECK_TO_FIELD)) {
      const result = await fetchLlmCandidate(checkId, spans);
      expect(Array.isArray(result)).toBe(true);
    }
  });
});
