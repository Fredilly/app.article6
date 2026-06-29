import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks } from "@/lib/quickCheckV2/answers";
import { loadAndParseExtractedText, type StructuredCheckId } from "@/lib/quickCheckV2/evidence";
import { validateAnswerResults } from "@/lib/quickCheckV2/status";

const SOURCE_PDF_PATH =
  "tests/fixtures/quick-check/deep-methodology-pdd.pdf";
const EXTRACTED_TEXT_PATH =
  "tests/fixtures/quick-check/deep-methodology-pdd-extracted.txt";
const GOLD_FIXTURE_PATH =
  "tests/fixtures/quick-check/deep-methodology-gold-fixture.json";

type GoldRecord = {
  checkName: StructuredCheckId;
  expectedStatus: "FOUND" | "UNCLEAR" | "MISSING";
  expectedAnswer: string | null;
  goldQuote: string | null;
  page: number | null;
  sectionHeading: string | null;
  sectionPath: string[];
  spanId: string | null;
  sourceType: "fact_contract" | "exact_section" | "raw_text_fallback" | null;
};

function loadGoldFixture(): GoldRecord[] {
  return JSON.parse(
    fs.readFileSync(path.resolve(GOLD_FIXTURE_PATH), "utf-8"),
  ) as GoldRecord[];
}

function toGoldComparableRecord(
  result: ReturnType<typeof validateAnswerResults>[number],
): GoldRecord {
  return {
    checkName: result.checkName,
    expectedStatus: result.status,
    expectedAnswer: result.answer,
    goldQuote: result.evidence?.quote ?? null,
    page: result.evidence?.page ?? null,
    sectionHeading: result.evidence?.sectionHeading ?? null,
    sectionPath: result.evidence?.sectionPath ?? [],
    spanId: result.evidence?.spanId ?? null,
    sourceType: result.evidence?.sourceType ?? null,
  };
}

describe("Quick Check v2 — Phase 7 deep methodology PDF failure fixture", () => {
  const goldFixture = loadGoldFixture();
  const document = loadAndParseExtractedText(EXTRACTED_TEXT_PATH);
  const answers = extractAnswersForAllChecks(document);
  const statuses = validateAnswerResults(answers);

  it("keeps the real PDF source fixture in repo", () => {
    const stats = fs.statSync(path.resolve(SOURCE_PDF_PATH));
    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBeGreaterThan(0);
  });

  it("matches the deep-methodology gold fixture across the v2 pipeline", () => {
    expect(statuses.map(toGoldComparableRecord)).toStrictEqual(goldFixture);
  });

  it("does not accept 'Additional data parameters' as additionality evidence", () => {
    const result = statuses.find((item) => item.checkName === "additionality");

    expect(result).toBeDefined();
    expect(result!.status).toBe("MISSING");
    expect(result!.answer).toBeNull();
    expect(result!.evidence).toBeNull();
  });

  it("still preserves methodology as FOUND for the same PDF", () => {
    const result = statuses.find((item) => item.checkName === "methodology");

    expect(result).toBeDefined();
    expect(result!.status).toBe("FOUND");
    expect(result!.answer).toBe("VM0007");
    expect(result!.evidence?.sourceType).toBe("fact_contract");
  });
});
