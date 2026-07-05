import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks, extractMethodologyDetailsFromEvidence } from "@/lib/quickCheckV2/answers";
import { formatQuickCheckPdfPages } from "@/lib/chat/quickCheckPdfPages";
import { extractPdfPagesWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";
import {
  loadAndParseExtractedText,
  parseExtractedText,
  type QuickCheckV2ExtractedDocument,
  type StructuredCheckId,
} from "@/lib/quickCheckV2/evidence";
import { validateAnswerResults } from "@/lib/quickCheckV2/status";
import {
  buildQuickCheckMethodologyIdentity,
  extractDeclaredMethodologyVersionFromDocument,
  type QuickCheckMethodologyIdentity,
} from "@/lib/quickCheckV2/methodologyIdentity";
import { normalizeDeclaredMethodologyVersion } from "@/lib/chat/methodologyVersion";

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

function normalizeMethodologyAlias(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

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

function buildComparableMethodology(
  document: QuickCheckV2ExtractedDocument,
  result: ReturnType<typeof validateAnswerResults>[number],
): QuickCheckMethodologyIdentity | null {
  if (result.checkName !== "methodology" || !result.evidence) return null;

  const tableMethodology = extractMethodologyDetailsFromEvidence(result.evidence);
  if (tableMethodology) {
    return tableMethodology;
  }

  const evidenceMethodology = buildQuickCheckMethodologyIdentity(result.evidence);
  const answerMethodology = result.answer
    ? buildQuickCheckMethodologyIdentity({
        ...result.evidence,
        quote: result.answer,
      })
    : null;

  const methodology = answerMethodology ?? evidenceMethodology ?? result.methodology ?? null;
  if (!methodology) return null;

  const fallbackVersion =
    methodology.pddDeclaredMethodologyVersion
    ?? extractDeclaredMethodologyVersionFromDocument(document, methodology.methodologyId);
  const methodologyAlias = normalizeMethodologyAlias(
    answerMethodology?.methodologyAlias ?? evidenceMethodology?.methodologyAlias ?? methodology.methodologyAlias,
  );

  if (result.answer) {
    return {
      methodologyId: answerMethodology?.methodologyId ?? evidenceMethodology?.methodologyId ?? methodology.methodologyId,
      methodologyName: answerMethodology?.methodologyName ?? evidenceMethodology?.methodologyName ?? methodology.methodologyName,
      methodologyAlias,
      pddDeclaredMethodologyVersion: fallbackVersion,
      versionStatus: fallbackVersion ? "DECLARED" : (
        evidenceMethodology?.versionStatus
        ?? answerMethodology?.versionStatus
        ?? methodology.versionStatus
      ),
      evidencePage: result.evidence.page,
      evidenceSection: result.evidence.sectionHeading?.trim() ?? "",
      evidenceQuote: result.evidence.quote,
    };
  }

  return {
    methodologyId: methodology.methodologyId,
    methodologyName: methodology.methodologyName,
    methodologyAlias,
    pddDeclaredMethodologyVersion: fallbackVersion,
    versionStatus: fallbackVersion ? "DECLARED" : methodology.versionStatus,
    evidencePage: result.evidence.page,
    evidenceSection: result.evidence.sectionHeading?.trim() ?? "",
    evidenceQuote: result.evidence.quote,
  };
}

function toGoldComparableRecord(
  document: QuickCheckV2ExtractedDocument,
  result: ReturnType<typeof validateAnswerResults>[number],
  expected: GoldRecord,
): GoldRecord {
  const methodology = buildComparableMethodology(document, result);

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

function validateMethodologyGoldRecord(record: GoldRecord): void {
  if (record.checkName !== "methodology") return;

  expect(record.expectedMethodology).toBeDefined();
  const methodology = record.expectedMethodology!;
  expect(Object.keys(methodology)).toStrictEqual([
    "methodologyId",
    "methodologyName",
    "methodologyAlias",
    "pddDeclaredMethodologyVersion",
    "versionStatus",
    "evidencePage",
    "evidenceSection",
    "evidenceQuote",
  ]);
  expect(methodology.evidencePage).toBe(record.page);
  expect(methodology.evidenceSection).toBe(record.sectionHeading ?? "");
  expect(methodology.evidenceQuote).toBe(record.goldQuote);

  if (methodology.versionStatus === "DECLARED") {
    expect(methodology.pddDeclaredMethodologyVersion).not.toBeNull();
    expect(normalizeDeclaredMethodologyVersion(methodology.pddDeclaredMethodologyVersion)).toBe(
      methodology.pddDeclaredMethodologyVersion,
    );
  } else {
    expect(methodology.pddDeclaredMethodologyVersion).toBeNull();
  }
}

function shouldCompareMethodology(
  record: GoldRecord,
  goldRecord: GoldRecord,
): boolean {
  return Boolean(
    goldRecord.expectedStatus === "FOUND" &&
    record.expectedMethodology &&
    goldRecord.expectedMethodology,
  );
}

function stripMethodologyIfNeeded(
  record: GoldRecord,
  shouldKeepMethodology: boolean,
): GoldRecord {
  if (shouldKeepMethodology) return record;
  const { expectedMethodology: _expectedMethodology, ...rest } = record;
  return rest;
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

      it("normalizes methodology gold shape", () => {
        for (const record of bundle.gold) {
          validateMethodologyGoldRecord(record);
        }
      });

      it("matches gold.json from extracted.txt through the Quick Check v2 pipeline", () => {
        const document = loadAndParseExtractedText(
          bundle.extractedPath,
          bundle.meta.documentId,
        );
        const statuses = validateAnswerResults(extractAnswersForAllChecks(document));
        const comparableStatuses = statuses.map((result, index) => toGoldComparableRecord(document, result, bundle.gold[index]!));
        const methodologyComparisonFlags = comparableStatuses.map((record, index) =>
          shouldCompareMethodology(record, bundle.gold[index]!),
        );

        if (bundle.meta.comparisonMode === "evidence-only") {
          expect(comparableStatuses.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!))).toStrictEqual(
            bundle.gold.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
          );
          return;
        }

        expect(comparableStatuses.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!))).toStrictEqual(
          bundle.gold.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
        );
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
          const comparableRuntimeStatuses = runtimeStatuses.map((result, index) => toGoldComparableRecord(runtimeDocument, result, bundle.gold[index]!));
          const methodologyComparisonFlags = comparableRuntimeStatuses.map((record, index) =>
            shouldCompareMethodology(record, bundle.gold[index]!),
          );

          if (bundle.meta.comparisonMode === "evidence-only") {
            expect(
              comparableRuntimeStatuses.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
            ).toStrictEqual(
              bundle.gold.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
            );
            return;
          }

          expect(comparableRuntimeStatuses.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!))).toStrictEqual(
            bundle.gold.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
          );
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
          const comparableRuntimeStatuses = runtimeStatuses.map((result, index) => toGoldComparableRecord(runtimeDocument, result, bundle.gold[index]!));
          const methodologyComparisonFlags = comparableRuntimeStatuses.map((record, index) =>
            shouldCompareMethodology(record, bundle.gold[index]!),
          );

          if (bundle.meta.comparisonMode === "evidence-only") {
            expect(
              comparableRuntimeStatuses.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
            ).toStrictEqual(
              bundle.gold.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
            );
            return;
          }

          expect(comparableRuntimeStatuses.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!))).toStrictEqual(
            bundle.gold.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
          );
        }, 30000);
      }
    });
  }
});
