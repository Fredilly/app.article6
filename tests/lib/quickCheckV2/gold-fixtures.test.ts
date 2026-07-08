import fs from "node:fs";
import os from "node:os";
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
  type QuickCheckMethodologyIdentity,
} from "@/lib/quickCheckV2/methodologyIdentity";
import { normalizeDeclaredMethodologyVersion } from "@/lib/chat/methodologyVersion";
import type { EvidenceStackItem } from "@/lib/evidence/evidenceStack";
import {
  buildComparableQuickCheckRecord,
  normalizeExpectedQuickCheckGoldRecord,
  type QuickCheckGoldComparableRecord,
} from "./goldComparison";

const FIXTURE_ROOT = path.resolve("tests/fixtures/quick-check/v2");

type RuntimeMode = "static" | "runtime-smoke" | "nightly";

type Manifest = {
  version: number;
  fixtures: Array<{
    id: string;
    directory: string;
    adjudicationStatus?: "pending" | "reviewed";
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
  adjudicationStatus?: "pending" | "reviewed";
};

type GoldRecord = QuickCheckGoldComparableRecord & {
  expectedMethodology?: Partial<QuickCheckMethodologyIdentity>;
  evidenceStack?: EvidenceStackItem[];
};

type PendingGoldDraft = {
  status: "PENDING_ADJUDICATION";
  message: string;
};

type FixtureBundle = {
  directory: string;
  extractedPath: string;
  goldPath: string;
  metaPath: string;
  correctionsPath: string;
  sourcePdfPath: string;
  meta: FixtureMeta;
  gold: GoldRecord[] | PendingGoldDraft | null;
  pending: boolean;
};

function loadManifest(): Manifest {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURE_ROOT, "manifest.json"), "utf-8"),
  ) as Manifest;
}

function loadJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function isPendingGoldDraft(value: unknown): value is PendingGoldDraft {
  return Boolean(
    value
    && typeof value === "object"
    && (value as PendingGoldDraft).status === "PENDING_ADJUDICATION",
  );
}

function loadFixtureBundle(directory: string, fixtureRoot = FIXTURE_ROOT): FixtureBundle {
  const fixtureDir = path.join(fixtureRoot, directory);
  const extractedPath = path.join(fixtureDir, "extracted.txt");
  const goldPath = path.join(fixtureDir, "gold.json");
  const metaPath = path.join(fixtureDir, "meta.json");
  const correctionsPath = path.join(fixtureDir, "corrections.json");
  const sourcePdfPath = path.join(fixtureDir, "source.pdf");
  const meta = loadJsonFile<FixtureMeta>(metaPath);
  const goldExists = fs.existsSync(goldPath);
  const gold = goldExists ? loadJsonFile<GoldRecord[] | PendingGoldDraft>(goldPath) : null;
  const pending = meta.adjudicationStatus === "pending" || !goldExists || isPendingGoldDraft(gold);

  return {
    directory,
    extractedPath,
    goldPath,
    metaPath,
    correctionsPath,
    sourcePdfPath,
    meta,
    gold: pending ? null : (gold as GoldRecord[]),
    pending,
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

function extractDeclaredMethodologyVersionFromText(text: string): string | null {
  const normalized = text.replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const match = normalized.match(/\b(?:version|ver\.?|v\.?)\s*([0-9]+(?:[.-][0-9]+)*)\b/i);
  return match?.[0] ? normalizeDeclaredMethodologyVersion(match[0]) : null;
}

function extractDeclaredMethodologyVersionFromDocument(
  document: QuickCheckV2ExtractedDocument,
  methodologyId: string,
): string | null {
  const needle = methodologyId.toLowerCase();
  const candidateIndices: number[] = [];

  for (let index = 0; index < document.blocks.length; index += 1) {
    if (document.blocks[index]!.text.toLowerCase().includes(needle)) {
      candidateIndices.push(index);
    }
  }

  for (const index of candidateIndices) {
    const page = document.blocks[index]!.page;
    for (let cursor = index; cursor < document.blocks.length; cursor += 1) {
      if (document.blocks[cursor]!.page !== page) break;
      const version = extractDeclaredMethodologyVersionFromText(document.blocks[cursor]!.text);
      if (version) return version;
    }
  }

  return null;
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
  const resolvedMethodology =
    answerMethodology && answerMethodology.methodologyName !== answerMethodology.methodologyId
      ? answerMethodology
      : evidenceMethodology ?? result.methodology ?? methodology;
  if (!resolvedMethodology) return null;

  const fallbackVersion =
    resolvedMethodology.pddDeclaredMethodologyVersion
    ?? extractDeclaredMethodologyVersionFromDocument(document, resolvedMethodology.methodologyId);
  const methodologyAlias = normalizeMethodologyAlias(
    answerMethodology?.methodologyAlias ?? evidenceMethodology?.methodologyAlias ?? resolvedMethodology.methodologyAlias,
  );

  if (result.answer) {
    return {
      methodologyId: resolvedMethodology.methodologyId,
      methodologyName: resolvedMethodology.methodologyName,
      methodologyAlias,
      pddDeclaredMethodologyVersion: fallbackVersion,
      versionStatus: fallbackVersion ? "DECLARED" : (
        evidenceMethodology?.versionStatus
        ?? answerMethodology?.versionStatus
        ?? resolvedMethodology.versionStatus
      ),
      evidencePage: result.evidence.page,
      evidenceSection: result.evidence.sectionHeading?.trim() ?? "",
      evidenceQuote: result.evidence.quote,
    };
  }

  return {
    methodologyId: resolvedMethodology.methodologyId,
    methodologyName: resolvedMethodology.methodologyName,
    methodologyAlias,
    pddDeclaredMethodologyVersion: fallbackVersion,
    versionStatus: fallbackVersion ? "DECLARED" : resolvedMethodology.versionStatus,
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
  const record: GoldRecord = buildComparableQuickCheckRecord(result, expected);

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

it("blocks pending adjudication fixtures from strict gold truth loading", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qcv2-pending-"));
  try {
    const fixtureRoot = path.join(root, "tests/fixtures/quick-check/v2");
    const fixtureDir = path.join(fixtureRoot, "pending-fixture");
    fs.mkdirSync(fixtureDir, { recursive: true });

    fs.writeFileSync(
      path.join(fixtureRoot, "manifest.json"),
      JSON.stringify({
        version: 1,
        fixtures: [
          {
            id: "pending-fixture",
            directory: "pending-fixture",
            adjudicationStatus: "pending",
          },
        ],
      }, null, 2),
    );
    fs.writeFileSync(
      path.join(fixtureDir, "meta.json"),
      JSON.stringify({
        id: "pending-fixture",
        title: "Pending Fixture",
        documentId: "pending-fixture-extracted",
        runtimeMode: "static",
        comparisonMode: "full",
        phase: "fixture_intake",
        registry: "UNKNOWN",
        documentType: "PDD / Project Description",
        adjudicationStatus: "pending",
      }, null, 2),
    );
    fs.writeFileSync(path.join(fixtureDir, "gold.draft.json"), JSON.stringify([], null, 2));
    fs.writeFileSync(
      path.join(fixtureDir, "corrections.json"),
      JSON.stringify({ status: "PENDING_ADJUDICATION", corrections: [] }, null, 2),
    );
    fs.writeFileSync(
      path.join(fixtureDir, "REVIEW.md"),
      "# Quick Check v2 fixture intake: Pending Fixture\n\nAdjudication not done.\n",
    );
    fs.writeFileSync(path.join(fixtureDir, "extracted.txt"), "Page 1\nPending fixture\n");
    fs.writeFileSync(path.join(fixtureDir, "source.pdf"), "%PDF-1.4\npending\n");

    const bundle = loadFixtureBundle("pending-fixture", fixtureRoot);
    expect(bundle.pending).toBe(true);
    expect(bundle.gold).toBeNull();
    expect(bundle.meta.adjudicationStatus).toBe("pending");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const manifest = loadManifest();

describe("Quick Check v2 gold fixtures", () => {
  for (const fixtureRef of manifest.fixtures) {
    const bundle = loadFixtureBundle(fixtureRef.directory);

    describe(bundle.meta.title, () => {
      if (bundle.pending) {
        it("remains pending adjudication and is skipped from strict gold truth", () => {
          expect(bundle.meta.adjudicationStatus).toBe("pending");
          expect(bundle.gold).toBeNull();
          expect(fs.existsSync(bundle.goldPath)).toBe(false);
        });
        return;
      }

      const gold = bundle.gold;
      if (!gold) {
        throw new Error(`Expected reviewed gold for fixture ${bundle.directory}`);
      }

      it("keeps fixture files in the v2 layout", () => {
        expect(fs.statSync(bundle.extractedPath).isFile()).toBe(true);
        expect(fs.statSync(bundle.goldPath).isFile()).toBe(true);
        expect(fs.statSync(bundle.metaPath).isFile()).toBe(true);
        expect(fs.statSync(bundle.correctionsPath).isFile()).toBe(true);
      });

      it("normalizes methodology gold shape", () => {
        for (const record of gold) {
          validateMethodologyGoldRecord(record);
        }
      });

      it("matches gold.json from extracted.txt through the Quick Check v2 pipeline", () => {
        const document = loadAndParseExtractedText(
          bundle.extractedPath,
          bundle.meta.documentId,
        );
        const statuses = validateAnswerResults(extractAnswersForAllChecks(document));
        const comparableStatuses = statuses.map((result, index) => toGoldComparableRecord(document, result, gold[index]!));
        const methodologyComparisonFlags = comparableStatuses.map((record, index) =>
          shouldCompareMethodology(record, gold[index]!),
        );

        if (bundle.meta.comparisonMode === "evidence-only") {
          expect(comparableStatuses.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!))).toStrictEqual(
            gold.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
          );
          return;
        }

        expect(comparableStatuses.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!))).toStrictEqual(
          gold
            .map(normalizeExpectedQuickCheckGoldRecord)
            .map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
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
          const comparableRuntimeStatuses = runtimeStatuses.map((result, index) => toGoldComparableRecord(runtimeDocument, result, gold[index]!));
          const methodologyComparisonFlags = comparableRuntimeStatuses.map((record, index) =>
            shouldCompareMethodology(record, gold[index]!),
          );

          if (bundle.meta.comparisonMode === "evidence-only") {
            expect(
              comparableRuntimeStatuses.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
            ).toStrictEqual(
              gold.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
            );
            return;
          }

          expect(comparableRuntimeStatuses.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!))).toStrictEqual(
            gold.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
          );
        }, 120000);
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
          const comparableRuntimeStatuses = runtimeStatuses.map((result, index) => toGoldComparableRecord(runtimeDocument, result, gold[index]!));
          const methodologyComparisonFlags = comparableRuntimeStatuses.map((record, index) =>
            shouldCompareMethodology(record, gold[index]!),
          );

          if (bundle.meta.comparisonMode === "evidence-only") {
            expect(
              comparableRuntimeStatuses.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
            ).toStrictEqual(
              gold.map(toEvidenceOnlyComparableRecord).map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
            );
            return;
          }

          expect(comparableRuntimeStatuses.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!))).toStrictEqual(
            gold.map((record, index) => stripMethodologyIfNeeded(record, methodologyComparisonFlags[index]!)),
          );
        }, 30000);
      }
    });
  }
});
