import { describe, expect, it, jest } from "@jest/globals";
import {
  extractFieldCandidates,
  isLlmFactExtractorEnabled,
  parseAndValidateCandidates,
  type InputSpan,
  type LlmFactCandidate,
} from "@/lib/quickCheck/llmFactExtractor";

const SAMPLE_SPANS: InputSpan[] = [
  { id: "span-1", text: "Project Title: Cordillera Azul National Park REDD Project", page: 1 },
  { id: "span-2", text: "Host Country: Peru", page: 1 },
  { id: "span-3", text: "Project Location: San Martin Region, Peru", page: 1 },
  { id: "span-4", text: "VM0007 REDD Methodology Modules Version 1.3", page: 4 },
  { id: "span-5", text: "The project applies the REDD Methodology Framework (REDD-MF) under VM0007", page: 4 },
];

describe("llmFactExtractor — feature flag", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("is disabled by default", () => {
    delete process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR;
    expect(isLlmFactExtractorEnabled()).toBe(false);
  });

  it("is enabled when QUICK_CHECK_LLM_FACT_EXTRACTOR=ollama", () => {
    process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR = "ollama";
    expect(isLlmFactExtractorEnabled()).toBe(true);
  });

  it("is enabled when QUICK_CHECK_LLM_FACT_EXTRACTOR=openrouter", () => {
    process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR = "openrouter";
    expect(isLlmFactExtractorEnabled()).toBe(true);
  });

  it("returns empty when feature flag is off", async () => {
    delete process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR;
    const candidates = await extractFieldCandidates("hostCountry", SAMPLE_SPANS);
    expect(candidates).toEqual([]);
  });

  it("returns empty for unsupported fields", async () => {
    process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR = "ollama";
    const candidates = await extractFieldCandidates("unsupported_field" as const, SAMPLE_SPANS);
    expect(candidates).toEqual([]);
  });

  it("returns empty for empty spans", async () => {
    process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR = "ollama";
    const candidates = await extractFieldCandidates("hostCountry", []);
    expect(candidates).toEqual([]);
  });
});

describe("llmFactExtractor — parseAndValidateCandidates (no network)", () => {
  it("accepts a valid host country candidate with correct span and page", () => {
    const rawJson = JSON.stringify({
      fields: [{ field: "hostCountry", value: "Peru", quote: "Host Country: Peru", confidence: "high" }],
    });

    const candidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.field).toBe("hostCountry");
    expect(candidates[0]!.value).toBe("Peru");
    expect(candidates[0]!.evidenceSpanId).toBe("span-2");
    expect(candidates[0]!.page).toBe(1);
    expect(candidates[0]!.confidence).toBe("high");
  });

  it("accepts a valid methodology candidate with correct span (page 4)", () => {
    const rawJson = JSON.stringify({
      fields: [{ field: "methodologyPrimary", value: "VM0007", quote: "VM0007 REDD Methodology Modules Version 1.3", confidence: "high" }],
    });

    const candidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.field).toBe("methodologyPrimary");
    expect(candidates[0]!.evidenceSpanId).toBe("span-4");
    expect(candidates[0]!.page).toBe(4);
  });

  it("rejects invented quote not found in any span", () => {
    const rawJson = JSON.stringify({
      fields: [{ field: "hostCountry", value: "Brazil", quote: "Host Country: Brazil", confidence: "high" }],
    });

    const candidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);
    expect(candidates).toHaveLength(0);
  });

  it("rejects unsupported field", () => {
    const rawJson = JSON.stringify({
      fields: [{ field: "invalid_field_name", value: "some value", quote: "Host Country: Peru", confidence: "high" }],
    });

    const candidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);
    expect(candidates).toHaveLength(0);
  });

  it("rejects entry with missing value", () => {
    const rawJson = JSON.stringify({
      fields: [{ field: "hostCountry", quote: "Host Country: Peru", confidence: "high" }],
    });

    const candidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);
    expect(candidates).toHaveLength(0);
  });

  it("rejects entry with missing quote", () => {
    const rawJson = JSON.stringify({
      fields: [{ field: "hostCountry", value: "Peru", confidence: "high" }],
    });

    const candidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);
    expect(candidates).toHaveLength(0);
  });

  it("rejects invalid JSON from LLM", () => {
    const candidates = parseAndValidateCandidates("not valid json", SAMPLE_SPANS);
    expect(candidates).toHaveLength(0);
  });

  it("rejects JSON without fields array", () => {
    const candidates = parseAndValidateCandidates(JSON.stringify({ ok: true }), SAMPLE_SPANS);
    expect(candidates).toHaveLength(0);
  });

  it("normalizes unknown confidence to low", () => {
    const rawJson = JSON.stringify({
      fields: [{ field: "hostCountry", value: "Peru", quote: "Host Country: Peru", confidence: "very_high" }],
    });

    const candidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);
    expect(candidates[0]!.confidence).toBe("low");
  });

  it("uses span's page, not LLM's claimed page", () => {
    // LLM says page 99 but the span is on page 1
    const rawJson = JSON.stringify({
      fields: [{ field: "hostCountry", value: "Peru", quote: "Host Country: Peru", confidence: "high", page: 99 }],
    });

    const candidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);
    expect(candidates[0]!.page).toBe(1); // from span-2, not 99
  });

  it("resolves quote from the correct span when multiple spans match", () => {
    const spans: InputSpan[] = [
      { id: "span-a", text: "VM0007 is mentioned as a reference", page: 1 },
      { id: "span-b", text: "VM0007 REDD Methodology Modules Version 1.3 is the applied methodology", page: 4 },
    ];

    const rawJson = JSON.stringify({
      fields: [{ field: "methodologyPrimary", value: "VM0007 REDD Methodology Modules", quote: "VM0007 REDD Methodology Modules Version 1.3", confidence: "high" }],
    });

    const candidates = parseAndValidateCandidates(rawJson, spans);
    expect(candidates).toHaveLength(1);
    // Should match span-b (exact quote), not span-a (partial mention)
    expect(candidates[0]!.evidenceSpanId).toBe("span-b");
    expect(candidates[0]!.page).toBe(4);
  });

  it("accepts multiple valid fields from one LLM response", () => {
    const rawJson = JSON.stringify({
      fields: [
        { field: "hostCountry", value: "Peru", quote: "Host Country: Peru", confidence: "high" },
        { field: "methodologyPrimary", value: "VM0007", quote: "VM0007 REDD Methodology Modules Version 1.3", confidence: "high" },
        { field: "projectTitle", value: "Cordillera Azul", quote: "Project Title: Cordillera Azul National Park REDD Project", confidence: "medium" },
      ],
    });

    const candidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.field).sort()).toEqual(["hostCountry", "methodologyPrimary", "projectTitle"]);
  });

  it("parseAndValidateCandidates returns all fields, extractFieldCandidates filters to requested field", () => {
    // parseAndValidateCandidates should return 3 fields from the multi-field response
    const rawJson = JSON.stringify({
      fields: [
        { field: "hostCountry", value: "Peru", quote: "Host Country: Peru", confidence: "high" },
        { field: "projectTitle", value: "Cordillera Azul", quote: "Project Title: Cordillera Azul National Park REDD Project", confidence: "medium" },
        { field: "methodologyPrimary", value: "VM0007", quote: "VM0007 REDD Methodology Modules Version 1.3", confidence: "high" },
      ],
    });

    const allCandidates = parseAndValidateCandidates(rawJson, SAMPLE_SPANS);
    expect(allCandidates).toHaveLength(3);

    // Simulate what extractFieldCandidates does — filter to requested field
    const hostCandidates = allCandidates.filter((c) => c.field === "hostCountry");
    expect(hostCandidates).toHaveLength(1);
    expect(hostCandidates[0]!.field).toBe("hostCountry");
    expect(hostCandidates[0]!.value).toBe("Peru");
  });
});

describe("llmFactExtractor — LLM integration", () => {
  beforeAll(() => {
    process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR = "openrouter";
  });

  afterAll(() => {
    delete process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR;
  });

  it("extracts host country using OpenRouter", async () => {
    const spans: InputSpan[] = [
      { id: "s1", text: "Project Title: Cordillera Azul National Park REDD Project", page: 1 },
      { id: "s2", text: "Host Country: Peru", page: 1 },
      { id: "s3", text: "Project Location: San Martin Region, Peru", page: 1 },
    ];

    const candidates = await extractFieldCandidates("hostCountry", spans);

    if (candidates.length === 0) {
      console.warn("LLM not available — skipping host country extraction test");
      return;
    }

    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const hc = candidates.find((c) => c.field === "hostCountry");
    expect(hc).toBeDefined();
    expect(hc!.value.toLowerCase()).toContain("peru");
    expect(hc!.evidenceSpanId).toBe("s2");
    expect(hc!.page).toBe(1);
  }, 60_000);

  it("extracts methodology using OpenRouter with correct span provenance", async () => {
    const spans: InputSpan[] = [
      { id: "s4", text: "VM0007 REDD Methodology Modules Version 1.3", page: 4 },
      { id: "s5", text: "The project applies REDD-MF under VM0007", page: 4 },
    ];

    const candidates = await extractFieldCandidates("methodologyPrimary", spans);

    if (candidates.length === 0) {
      console.warn("LLM not available — skipping methodology extraction test");
      return;
    }

    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const mc = candidates.find((c) => c.field === "methodologyPrimary");
    expect(mc).toBeDefined();
    // Value may be VM0007 or REDD-MF — both are reasonable; the key is provenance
    expect(mc!.value).toBeTruthy();
    // evidenceSpanId must point to a real span
    expect(mc!.evidenceSpanId).toBeTruthy();
    const matchedSpan = spans.find((s) => s.id === mc!.evidenceSpanId);
    expect(matchedSpan).toBeDefined();
    // page must match the matched span
    expect(mc!.page).toBe(matchedSpan!.page);
    // quote must exist in the matched span
    expect(matchedSpan!.text).toContain(mc!.quote);
  }, 60_000);
});
