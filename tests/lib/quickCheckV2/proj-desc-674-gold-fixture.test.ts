import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks } from "@/lib/quickCheckV2/answers";
import { loadAndParseExtractedText, type StructuredCheckId } from "@/lib/quickCheckV2/evidence";
import { validateAnswerResults } from "@/lib/quickCheckV2/status";

const SOURCE_PDF_PATH =
  "tests/fixtures/quick-check/PROJ_DESC_674_15MAY2011.pdf";
const EXTRACTED_TEXT_PATH =
  "tests/fixtures/quick-check/proj-desc-674-extracted.txt";
const GOLD_FIXTURE_PATH =
  "tests/fixtures/quick-check/proj-desc-674-gold-fixture.json";

type GoldRecord = {
  checkName: StructuredCheckId;
  expectedStatus: "FOUND" | "UNCLEAR" | "MISSING";
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
    goldQuote: result.evidence?.quote ?? null,
    page: result.evidence?.page ?? null,
    sectionHeading: result.evidence?.sectionHeading ?? null,
    sectionPath: result.evidence?.sectionPath ?? [],
    spanId: result.evidence?.spanId ?? null,
    sourceType: result.evidence?.sourceType ?? null,
  };
}

describe("Quick Check v2 — Phase 7 PROJ_DESC_674 fixture", () => {
  const goldFixture = loadGoldFixture();
  const document = loadAndParseExtractedText(EXTRACTED_TEXT_PATH, "proj-desc-674");
  const answers = extractAnswersForAllChecks(document);
  const statuses = validateAnswerResults(answers);

  it("keeps the real PDF source fixture in repo", () => {
    const stats = fs.statSync(path.resolve(SOURCE_PDF_PATH));
    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBeGreaterThan(0);
  });

  it("matches the PROJ_DESC_674 gold fixture across the v2 pipeline", () => {
    expect(statuses.map(toGoldComparableRecord)).toStrictEqual(goldFixture);
  });
});
