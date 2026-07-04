import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks, extractMethodologyDetailsFromEvidence } from "@/lib/quickCheckV2/answers";
import { formatQuickCheckPdfPages } from "@/lib/chat/quickCheckPdfPages";
import { extractPdfPagesWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";
import {
  loadAndParseExtractedText,
  parseExtractedText,
  type StructuredCheckId,
} from "@/lib/quickCheckV2/evidence";
import { validateAnswerResults } from "@/lib/quickCheckV2/status";
import type { QuickCheckMethodologyIdentity } from "@/lib/quickCheckV2/methodologyIdentity";

const FIXTURE_ROOT = path.resolve("tests/fixtures/quick-check/v2");

type RuntimeMode = "static" | "runtime-smoke" | "nightly";

type Manifest = {
  version: number;
  fixtures: Array<{
    id: string;
    directory: string;
  }>;
};

type FixtureMeta = {
  id: string;
  title: string;
  documentId: string;
  runtimeMode: RuntimeMode;
  comparisonMode: "full" | "evidence-only";
  phase: string;
  registry: string;
  documentType: string;
};

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
  expectedMethodology?: Partial<QuickCheckMethodologyIdentity>;
};

type FixtureBundle = {
  directory: string;
  extractedPath: string;
  goldPath: string;
  metaPath: string;
  correctionsPath: string;
  sourcePdfPath: string;
  meta: FixtureMeta;
  gold: GoldRecord[];
};

function loadManifest(): Manifest {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURE_ROOT, "manifest.json"), "utf-8"),
  ) as Manifest;
}

function loadJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function loadFixtureBundle(directory: string): FixtureBundle {
  const fixtureDir = path.join(FIXTURE_ROOT, directory);
  const extractedPath = path.join(fixtureDir, "extracted.txt");
  const goldPath = path.join(fixtureDir, "gold.json");
  const metaPath = path.join(fixtureDir, "meta.json");
  const correctionsPath = path.join(fixtureDir, "corrections.json");
  const sourcePdfPath = path.join(fixtureDir, "source.pdf");

  return {
    directory,
    extractedPath,
    goldPath,
    metaPath,
    correctionsPath,
    sourcePdfPath,
    meta: loadJsonFile<FixtureMeta>(metaPath),
    gold: loadJsonFile<GoldRecord[]>(goldPath),
  };
}

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

function pickComparableMethodology(
  methodology: QuickCheckMethodologyIdentity,
  goldMethodology: Partial<QuickCheckMethodologyIdentity>,
): Partial<QuickCheckMethodologyIdentity> {
  const comparable: Partial<QuickCheckMethodologyIdentity> = {};

  for (const key of methodologyComparisonKeys) {
    if (key in goldMethodology) {
      comparable[key] = methodology[key];
    }
  }

  return comparable;
}

function toGoldComparableRecord(
  result: ReturnType<typeof validateAnswerResults>[number],
  expected: GoldRecord,
): GoldRecord {
  const methodology = result.checkName === "methodology"
    ? extractMethodologyDetailsFromEvidence(result.evidence)
    : null;

  const record: GoldRecord = {
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

  if (methodology && expected.expectedMethodology) {
    record.expectedMethodology = pickComparableMethodology(methodology, expected.expectedMethodology);
  }

  return record;
}

function toEvidenceOnlyComparableRecord(record: GoldRecord): Omit<GoldRecord, "expectedAnswer"> {
  const { expectedAnswer: _expectedAnswer, ...rest } = record;
  return rest;
}

const manifest = loadManifest();

describe("Quick Check v2 gold fixtures", () => {
  for (const fixtureRef of manifest.fixtures) {
    const bundle = loadFixtureBundle(fixtureRef.directory);

    describe(bundle.meta.title, () => {
      it("keeps fixture files in the v2 layout", () => {
        expect(fs.statSync(bundle.extractedPath).isFile()).toBe(true);
        expect(fs.statSync(bundle.goldPath).isFile()).toBe(true);
        expect(fs.statSync(bundle.metaPath).isFile()).toBe(true);
        expect(fs.statSync(bundle.correctionsPath).isFile()).toBe(true);
      });

      it("matches gold.json from extracted.txt through the Quick Check v2 pipeline", () => {
        const document = loadAndParseExtractedText(
          bundle.extractedPath,
          bundle.meta.documentId,
        );
        const statuses = validateAnswerResults(extractAnswersForAllChecks(document));
        const comparableStatuses = statuses.map((result, index) => toGoldComparableRecord(result, bundle.gold[index]!));

        if (bundle.meta.comparisonMode === "evidence-only") {
          expect(comparableStatuses.map(toEvidenceOnlyComparableRecord)).toStrictEqual(
            bundle.gold.map(toEvidenceOnlyComparableRecord),
          );
          return;
        }

        expect(comparableStatuses).toStrictEqual(bundle.gold);
        for (const record of bundle.gold) {
          if (record.checkName === "methodology" && record.expectedMethodology) {
            expect(record.expectedMethodology.methodologyId).toBeTruthy();
          }
        }
      });

      if (bundle.meta.runtimeMode === "runtime-smoke") {
        it("matches gold.json from the real pdf-parse runtime path", async () => {
          expect(fs.statSync(bundle.sourcePdfPath).isFile()).toBe(true);

          const bytes = fs.readFileSync(bundle.sourcePdfPath);
          const arrayBuffer = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer;
          const extraction = await extractPdfPagesWithPdfParse({ bytes: arrayBuffer });
          const runtimeDocument = parseExtractedText(
            formatQuickCheckPdfPages(extraction.pages),
            bundle.meta.documentId,
            "pdf-parse",
          );
          const runtimeStatuses = validateAnswerResults(
            extractAnswersForAllChecks(runtimeDocument),
          );
          const comparableRuntimeStatuses = runtimeStatuses.map((result, index) => toGoldComparableRecord(result, bundle.gold[index]!));

          if (bundle.meta.comparisonMode === "evidence-only") {
            expect(comparableRuntimeStatuses.map(toEvidenceOnlyComparableRecord)).toStrictEqual(
              bundle.gold.map(toEvidenceOnlyComparableRecord),
            );
            return;
          }

          expect(comparableRuntimeStatuses).toStrictEqual(bundle.gold);
        }, 30000);
      }

      if (bundle.meta.runtimeMode === "nightly") {
        const runtimeTest = process.env.CI ? it.skip : it;
        runtimeTest("matches gold.json from the real pdf-parse runtime path", async () => {
          expect(fs.statSync(bundle.sourcePdfPath).isFile()).toBe(true);

          const bytes = fs.readFileSync(bundle.sourcePdfPath);
          const arrayBuffer = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer;
          const extraction = await extractPdfPagesWithPdfParse({ bytes: arrayBuffer });
          const runtimeDocument = parseExtractedText(
            formatQuickCheckPdfPages(extraction.pages),
            bundle.meta.documentId,
            "pdf-parse",
          );
          const runtimeStatuses = validateAnswerResults(
            extractAnswersForAllChecks(runtimeDocument),
          );
          const comparableRuntimeStatuses = runtimeStatuses.map((result, index) => toGoldComparableRecord(result, bundle.gold[index]!));

          if (bundle.meta.comparisonMode === "evidence-only") {
            expect(comparableRuntimeStatuses.map(toEvidenceOnlyComparableRecord)).toStrictEqual(
              bundle.gold.map(toEvidenceOnlyComparableRecord),
            );
            return;
          }

          expect(comparableRuntimeStatuses).toStrictEqual(bundle.gold);
        }, 30000);
      }
    });
  }
});
