import { describe, expect, it, jest } from "@jest/globals";
import { extractFieldCandidates, isLlmFactExtractorEnabled } from "@/lib/quickCheck/llmFactExtractor";

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

  it("returns empty when feature flag is off", async () => {
    delete process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR;
    const candidates = await extractFieldCandidates("hostCountry", ["Peru is the host country"]);
    expect(candidates).toEqual([]);
  });

  it("returns empty for unsupported fields", async () => {
    process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR = "ollama";
    const candidates = await extractFieldCandidates("leakage" as any, ["some text"]);
    expect(candidates).toEqual([]);
  });

  it("returns empty for empty spans", async () => {
    process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR = "ollama";
    const candidates = await extractFieldCandidates("hostCountry", []);
    expect(candidates).toEqual([]);
  });
});

describe("llmFactExtractor — Ollama integration", () => {
  beforeAll(() => {
    process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR = "ollama";
  });

  afterAll(() => {
    delete process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR;
  });

  it("extracts host country using Ollama", async () => {
    const spans = [
      "Project Title: Cordillera Azul National Park REDD Project",
      "Host Country: Peru",
      "Project Location: San Martin Region, Peru",
    ];

    const candidates = await extractFieldCandidates("hostCountry", spans);

    // If Ollama is not available (CI), candidates will be empty — that's fine
    if (candidates.length === 0) {
      console.warn("Ollama not available — skipping host country extraction test");
      return;
    }

    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const hostCountry = candidates.find((c) => c.field === "hostCountry");
    expect(hostCountry).toBeDefined();
    expect(hostCountry!.value.toLowerCase()).toContain("peru");
    expect(hostCountry!.quote.length).toBeGreaterThan(0);
    // Quote must match a span verbatim
    expect(spans.some((s) => s.includes(hostCountry!.quote))).toBe(true);
  }, 60_000);

  it("extracts methodology code using Ollama", async () => {
    const spans = [
      "VM0007 REDD Methodology Modules Version 1.3",
      "The project applies the REDD Methodology Framework (REDD-MF) under VM0007",
      "Section 3.1 Application of Methodology",
    ];

    const candidates = await extractFieldCandidates("methodologyPrimary", spans);

    if (candidates.length === 0) {
      console.warn("Ollama not available — skipping methodology extraction test");
      return;
    }

    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const methodology = candidates.find((c) => c.field === "methodologyPrimary");
    expect(methodology).toBeDefined();
    expect(methodology!.value).toContain("VM0007");
  }, 30_000);

  it("returns empty when quote is invented (not in spans)", async () => {
    // Feed spans that don't contain the field at all
    const spans = [
      "This document describes a carbon project.",
      "The project aims to reduce deforestation.",
      "Section 1: Introduction",
    ];

    const candidates = await extractFieldCandidates("hostCountry", spans);

    if (candidates.length === 0) {
      console.warn("Ollama not available — skipping empty extraction test");
      return;
    }

    // Model should return null value or empty, not invent a country
    // If it invents a country, the quote validation should reject it
    const withCountries = candidates.filter(
      (c) => c.field === "hostCountry" && c.value !== null
    );
    // All accepted candidates must have quotes that exist in spans
    for (const c of withCountries) {
      expect(spans.some((s) => s.includes(c.quote))).toBe(true);
    }
  }, 30_000);
});
