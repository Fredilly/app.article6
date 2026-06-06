import { expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { buildDocumentStructure } from "@/lib/documentModel";
import { parseDocumentText } from "@/lib/documentParsing";
import { compileEvidenceDocumentFromStructure } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import { buildProjectFactContract } from "@/lib/quickCheck/projectFacts";
import type { ProjectFactContract, ProjectFactField, ProjectFactValue } from "@/lib/quickCheck/projectFacts/types";

const FACT_FIELD_NAMES = [
  "projectTitle",
  "hostCountry",
  "projectCountry",
  "projectLocation",
  "projectStandard",
  "projectType",
  "projectProponent",
  "methodologyPrimary",
  "methodologyModules",
  "baselineMethodology",
  "monitoringMethodology",
  "creditingPeriod",
  "reportingPeriod",
  "monitoringPeriod",
  "projectStartDate",
  "baselineSections",
  "monitoringSections",
  "leakageSections",
  "additionalitySections",
] as const;

type FactFieldName = (typeof FACT_FIELD_NAMES)[number];

const factValueSchema = z.union([z.string(), z.array(z.string())]);

const manifestEntrySchema = z.object({
  id: z.string(),
  fixturePath: z.string(),
  kind: z.enum(["text", "json-pages"]),
  expectedDocumentFamily: z.string(),
  expectedPromotedFacts: z.record(z.enum(FACT_FIELD_NAMES), factValueSchema),
  expectedNullFacts: z.array(z.enum(FACT_FIELD_NAMES)),
  expectedWarnings: z.object({
    contractIncludes: z.array(z.string()).optional(),
    contractExcludes: z.array(z.string()).optional(),
    fieldIncludes: z.record(z.enum(FACT_FIELD_NAMES), z.array(z.string())).optional(),
  }),
  expectedFieldMetadata: z.record(z.enum(FACT_FIELD_NAMES), z.object({
    evidenceSpanIdsMin: z.number().int().positive().optional(),
    pageNumbers: z.array(z.number().int().positive()).optional(),
  })).optional(),
  expectedQuality: z.object({
    pageCount: z.number().int().positive().optional(),
    pageCountMin: z.number().int().positive().optional(),
    textDensityMax: z.number().nonnegative().optional(),
    headersFootersDetected: z.boolean().optional(),
    tableHeavyWarning: z.boolean().optional(),
    warningsInclude: z.array(z.string()).optional(),
  }).optional(),
  provenanceRequired: z.boolean(),
  notes: z.string(),
});

const manifestSchema = z.object({
  fixtures: z.array(manifestEntrySchema),
});

export type ProjectFactFixtureManifestEntry = z.infer<typeof manifestEntrySchema>;
type ProjectFactFixtureManifest = z.infer<typeof manifestSchema>;

type FixtureRunResult = {
  evidence: EvidenceDocument;
  contract: ProjectFactContract;
  qualityWarnings: string[];
  qualityReport: ReturnType<typeof buildDocumentStructure>["qualityReport"];
  structure: ReturnType<typeof buildDocumentStructure>;
};

export function loadFixtureText(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

export function loadFixtureInput(entry: ProjectFactFixtureManifestEntry): string {
  if (entry.kind === "json-pages") {
    const parsed = JSON.parse(loadFixtureText(entry.fixturePath)) as { pages: Array<{ text?: string }> };
    return parsed.pages.map((page) => page.text ?? "").join("\f");
  }
  return loadFixtureText(entry.fixturePath);
}

export function runProjectFactFixturePipeline(entry: ProjectFactFixtureManifestEntry): FixtureRunResult {
  const rawText = loadFixtureInput(entry);
  const parsed = parseDocumentText(
    { rawText, sourceName: entry.fixturePath },
    "current-extractor",
  );
  const structure = buildDocumentStructure({ parsedDocument: parsed });
  const evidence = compileEvidenceDocumentFromStructure({ docId: entry.id, documentStructure: structure });
  const contract = buildProjectFactContract(evidence);

  return {
    evidence,
    contract,
    qualityWarnings: structure.qualityReport.warnings,
    qualityReport: structure.qualityReport,
    structure,
  };
}

function hasPromotedValue(field: ProjectFactField<ProjectFactValue>): boolean {
  if (Array.isArray(field.value)) return field.value.length > 0;
  return field.value !== null;
}

function expectPromotedFactProvenance(evidence: EvidenceDocument, field: ProjectFactField<ProjectFactValue>): void {
  if (!hasPromotedValue(field)) return;
  if (field.extractionRule === "standard:family" || field.extractionRule === "project-type:family") return;

  expect(field.evidenceSpanIds.length).toBeGreaterThan(0);
  expect(field.pageNumbers.length).toBeGreaterThan(0);
  expect(field.sourceParser).toBeTruthy();
  expect(field.family).toBeTruthy();

  const spans = field.evidenceSpanIds
    .map((spanId) => evidence.spans.find((span) => span.spanId === spanId))
    .filter((span): span is EvidenceDocument["spans"][number] => Boolean(span));
  expect(spans.length).toBe(field.evidenceSpanIds.length);
  expect(new Set(spans.map((span) => span.page).filter((page): page is number => page != null))).toEqual(
    new Set(field.pageNumbers),
  );
}

function expectContractProvenance(evidence: EvidenceDocument, contract: ProjectFactContract): void {
  for (const fieldName of FACT_FIELD_NAMES) {
    expectPromotedFactProvenance(evidence, contract[fieldName]);
  }
}

function expectFactValue(
  field: ProjectFactField<ProjectFactValue>,
  expectedValue: string | string[],
): void {
  if (Array.isArray(expectedValue)) {
    expect(field.value).toEqual(expectedValue);
    return;
  }
  if (typeof field.value === "string") {
    expect(field.value).toBe(expectedValue);
    return;
  }
  expect(field.value).toBe(expectedValue);
}

function expectWarnings(
  contract: ProjectFactContract,
  qualityWarnings: string[],
  entry: ProjectFactFixtureManifestEntry,
): void {
  for (const warning of entry.expectedWarnings.contractIncludes ?? []) {
    expect(contract.warnings).toContain(warning);
  }
  for (const warning of entry.expectedWarnings.contractExcludes ?? []) {
    expect(contract.warnings).not.toContainEqual(expect.stringContaining(warning));
  }
  for (const [fieldName, warnings] of Object.entries(entry.expectedWarnings.fieldIncludes ?? {})) {
    const field = contract[fieldName as FactFieldName];
    for (const warning of warnings) {
      expect(field.warnings).toContain(warning);
    }
  }
  for (const warning of entry.expectedQuality?.warningsInclude ?? []) {
    expect(qualityWarnings).toContain(warning);
  }
}

function expectFieldMetadata(
  contract: ProjectFactContract,
  entry: ProjectFactFixtureManifestEntry,
): void {
  for (const [fieldName, metadata] of Object.entries(entry.expectedFieldMetadata ?? {})) {
    const field = contract[fieldName as FactFieldName];
    if (metadata.evidenceSpanIdsMin !== undefined) {
      expect(field.evidenceSpanIds.length).toBeGreaterThanOrEqual(metadata.evidenceSpanIdsMin);
    }
    if (metadata.pageNumbers !== undefined) {
      expect(field.pageNumbers).toEqual(metadata.pageNumbers);
    }
  }
}

function expectQuality(
  qualityReport: FixtureRunResult["qualityReport"],
  entry: ProjectFactFixtureManifestEntry,
): void {
  const expectedQuality = entry.expectedQuality;
  if (!expectedQuality) return;

  if (expectedQuality.pageCount !== undefined) {
    expect(qualityReport.pageCount).toBe(expectedQuality.pageCount);
  }
  if (expectedQuality.pageCountMin !== undefined) {
    expect(qualityReport.pageCount).toBeGreaterThanOrEqual(expectedQuality.pageCountMin);
  }
  if (expectedQuality.textDensityMax !== undefined) {
    expect(qualityReport.textDensity).toBeLessThan(expectedQuality.textDensityMax);
  }
  if (expectedQuality.headersFootersDetected !== undefined) {
    expect(qualityReport.headersFootersDetected).toBe(expectedQuality.headersFootersDetected);
  }
  if (expectedQuality.tableHeavyWarning !== undefined) {
    expect(qualityReport.tableHeavyWarning).toBe(expectedQuality.tableHeavyWarning);
  }
}

export function loadProjectFactFixtureManifest(): ProjectFactFixtureManifest {
  const manifestPath = path.join(process.cwd(), "tests/fixtures/quick-check/project-fact-fixtures.json");
  const rawManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return manifestSchema.parse(rawManifest);
}

export function runProjectFactFixtureExpectation(entry: ProjectFactFixtureManifestEntry): void {
  const { evidence, contract, qualityWarnings, qualityReport } = runProjectFactFixturePipeline(entry);

  expect(contract.documentFamily).toBe(entry.expectedDocumentFamily);

  for (const [fieldName, expectedValue] of Object.entries(entry.expectedPromotedFacts)) {
    expectFactValue(contract[fieldName as FactFieldName], expectedValue);
  }

  for (const fieldName of entry.expectedNullFacts) {
    expect(contract[fieldName].value).toBeNull();
  }

  expectWarnings(contract, qualityWarnings, entry);
  expectFieldMetadata(contract, entry);
  expectQuality(qualityReport, entry);

  if (entry.provenanceRequired) {
    expectContractProvenance(evidence, contract);
  }
}
