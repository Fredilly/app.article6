import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  extractAnswersForAllChecks,
  extractMethodologyDetailsFromEvidence,
} from "@/lib/quickCheckV2/answers";
import {
  loadAndParseExtractedText,
  type QuickCheckV2ExtractedDocument,
} from "@/lib/quickCheckV2/evidence";
import { validateAnswerResults } from "@/lib/quickCheckV2/status";
import {
  buildQuickCheckMethodologyIdentity,
  type QuickCheckMethodologyIdentity,
} from "@/lib/quickCheckV2/methodologyIdentity";

const FIXTURE_DIR = path.resolve("tests/fixtures/quick-check/v2/lisala-drc-pdd");
const EXTRACTED_PATH = path.join(FIXTURE_DIR, "extracted.txt");
const GOLD_PATH = path.join(FIXTURE_DIR, "gold.json");
const DOCUMENT_ID = "lisala-drc-pdd-extracted";

type GoldRecord = {
  checkName: string;
  expectedStatus: "FOUND" | "UNCLEAR" | "MISSING";
  expectedAnswer: string | null;
  goldQuote: string | null;
  page: number | null;
  sectionHeading: string | null;
  sectionPath: string[];
  spanId: string | null;
  sourceType: "fact_contract" | "exact_section" | "raw_text_fallback" | null;
  expectedMethodology?: Partial<QuickCheckMethodologyIdentity>;
};

const methodologyComparisonKeys = [
  "methodologyId",
  "methodologyName",
  "methodologyAlias",
  "pddDeclaredMethodologyVersion",
  "versionStatus",
  "evidencePage",
  "evidenceSection",
  "evidenceQuote",
] as const satisfies ReadonlyArray<keyof QuickCheckMethodologyIdentity>;

function loadJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function normalizeMethodologyAlias(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function extractDeclaredMethodologyVersionFromDocument(
  document: QuickCheckV2ExtractedDocument,
  methodologyId: string,
): string | null {
  const needle = methodologyId.toLowerCase();

  for (let index = 0; index < document.blocks.length; index += 1) {
    if (!document.blocks[index]!.text.toLowerCase().includes(needle)) continue;
    const page = document.blocks[index]!.page;
    for (let cursor = index; cursor < document.blocks.length; cursor += 1) {
      if (document.blocks[cursor]!.page !== page) break;
      const versionMatch = document.blocks[cursor]!.text.match(/\b(?:version|ver\.?|v\.?)\s*([0-9]+(?:[.-][0-9]+)*)\b/i);
      if (versionMatch?.[0]) {
        return versionMatch[0].replace(/\s+/g, " ").trim().replace(/^[Vv](?!ersion)/, "v");
      }
    }
  }

  return null;
}

function buildComparableMethodology(
  document: QuickCheckV2ExtractedDocument,
  record: ReturnType<typeof validateAnswerResults>[number],
): QuickCheckMethodologyIdentity | null {
  if (record.checkName !== "methodology" || !record.evidence) return null;

  const tableMethodology = extractMethodologyDetailsFromEvidence(record.evidence);
  if (tableMethodology) return tableMethodology;

  const evidenceMethodology = buildQuickCheckMethodologyIdentity(record.evidence);
  if (!evidenceMethodology) return null;

  const fallbackVersion =
    evidenceMethodology.pddDeclaredMethodologyVersion ??
    extractDeclaredMethodologyVersionFromDocument(document, evidenceMethodology.methodologyId);

  return {
    methodologyId: evidenceMethodology.methodologyId,
    methodologyName: evidenceMethodology.methodologyName,
    methodologyAlias: normalizeMethodologyAlias(evidenceMethodology.methodologyAlias),
    pddDeclaredMethodologyVersion: fallbackVersion,
    versionStatus: fallbackVersion ? "DECLARED" : evidenceMethodology.versionStatus,
    evidencePage: record.evidence.page,
    evidenceSection: record.evidence.sectionHeading?.trim() ?? "",
    evidenceQuote: record.evidence.quote,
  };
}

function toComparableRecord(
  document: QuickCheckV2ExtractedDocument,
  record: ReturnType<typeof validateAnswerResults>[number],
): Omit<GoldRecord, "expectedMethodology"> & { expectedMethodology?: Partial<QuickCheckMethodologyIdentity> } {
  const methodology = buildComparableMethodology(document, record);
  const comparable: GoldRecord = {
    checkName: record.checkName,
    expectedStatus: record.status,
    expectedAnswer: record.answer,
    goldQuote: record.evidence?.quote ?? null,
    page: record.evidence?.page ?? null,
    sectionHeading: record.evidence?.sectionHeading ?? null,
    sectionPath: record.evidence?.sectionPath ?? [],
    spanId: record.evidence?.spanId ?? null,
    sourceType: record.evidence?.sourceType ?? null,
  };

  if (methodology) {
    comparable.expectedMethodology = methodologyComparisonKeys.reduce(
      (accumulator, key) => {
        accumulator[key] = methodology[key];
        return accumulator;
      },
      {} as Partial<QuickCheckMethodologyIdentity>,
    );
  }

  return comparable;
}

function pickComparableMethodology(
  recordMethodology: Partial<QuickCheckMethodologyIdentity>,
  goldMethodology: Partial<QuickCheckMethodologyIdentity>,
): Partial<QuickCheckMethodologyIdentity> {
  const comparable: Partial<QuickCheckMethodologyIdentity> = {};
  for (const key of methodologyComparisonKeys) {
    if (key in goldMethodology) {
      comparable[key] = recordMethodology[key];
    }
  }
  return comparable;
}

function normalizeAgainstGold(
  record: ReturnType<typeof toComparableRecord>,
  goldRecord: GoldRecord,
): Omit<GoldRecord, "expectedMethodology"> & { expectedMethodology?: Partial<QuickCheckMethodologyIdentity> } {
  const { spanId: _spanId, expectedMethodology: recordMethodology, ...rest } = record;
  if (!recordMethodology || !goldRecord.expectedMethodology) {
    return rest;
  }

  return {
    ...rest,
    expectedMethodology: pickComparableMethodology(recordMethodology, goldRecord.expectedMethodology),
  };
}

describe("Quick Check v2 — Lisala truth mismatches", () => {
  it("matches the reviewed Lisala gold fixture", () => {
    const document = loadAndParseExtractedText(EXTRACTED_PATH, DOCUMENT_ID);
    const results = validateAnswerResults(extractAnswersForAllChecks(document));
    const gold = loadJsonFile<GoldRecord[]>(GOLD_PATH);
    const comparable = results.map((result) => toComparableRecord(document, result));
    const normalizedComparable = comparable.map((record, index) =>
      normalizeAgainstGold(record, gold[index]!),
    );
    const normalizedGold = gold.map((record) =>
      normalizeAgainstGold(
        {
          checkName: record.checkName,
          expectedStatus: record.expectedStatus,
          expectedAnswer: record.expectedAnswer,
          goldQuote: record.goldQuote,
          page: record.page,
          sectionHeading: record.sectionHeading,
          sectionPath: record.sectionPath,
          sourceType: record.sourceType,
          ...(record.expectedMethodology ? { expectedMethodology: record.expectedMethodology } : {}),
        },
        record,
      ),
    );

    expect(normalizedComparable).toStrictEqual(normalizedGold);
  });
});
