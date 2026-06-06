import { expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseDocumentText } from "@/lib/documentParsing";
import { buildDocumentStructure } from "@/lib/documentModel";
import { compileEvidenceDocumentFromStructure } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import { buildProjectFactContract } from "@/lib/quickCheck/projectFacts";
import type { ProjectFactContract, ProjectFactField, ProjectFactValue } from "@/lib/quickCheck/projectFacts/types";

export type FixtureResult = {
  evidence: EvidenceDocument;
  contract: ProjectFactContract;
  qualityWarnings: string[];
  qualityReport: ReturnType<typeof buildDocumentStructure>["qualityReport"];
};

function loadFixtureText(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function loadJsonPagesFixture(relativePath: string): string {
  const parsed = JSON.parse(loadFixtureText(relativePath)) as { pages: Array<{ text?: string }> };
  return parsed.pages.map((page) => page.text ?? "").join("\f");
}

export function compileFixture(input: { fixturePath: string; docId: string; kind?: "text" | "json-pages" }): FixtureResult {
  const rawText = input.kind === "json-pages"
    ? loadJsonPagesFixture(input.fixturePath)
    : loadFixtureText(input.fixturePath);
  const parsed = parseDocumentText({ rawText, sourceName: input.fixturePath });
  const structure = buildDocumentStructure({ parsedDocument: parsed });
  const evidence = compileEvidenceDocumentFromStructure({ docId: input.docId, documentStructure: structure });
  const contract = buildProjectFactContract(evidence);

  return {
    evidence,
    contract,
    qualityWarnings: structure.qualityReport.warnings,
    qualityReport: structure.qualityReport,
  };
}

function hasPromotedValue(field: ProjectFactField<ProjectFactValue>): boolean {
  if (Array.isArray(field.value)) return field.value.length > 0;
  return field.value !== null;
}

function expectPromotedFactProvenance(
  evidence: EvidenceDocument,
  field: ProjectFactField<ProjectFactValue>,
): void {
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

export function expectContractProvenance(evidence: EvidenceDocument, contract: ProjectFactContract): void {
  const fields: ProjectFactField<ProjectFactValue>[] = [
    contract.projectTitle,
    contract.hostCountry,
    contract.projectCountry,
    contract.projectLocation,
    contract.projectStandard,
    contract.projectType,
    contract.projectProponent,
    contract.methodologyPrimary,
    contract.methodologyModules,
    contract.baselineMethodology,
    contract.monitoringMethodology,
    contract.creditingPeriod,
    contract.reportingPeriod,
    contract.monitoringPeriod,
    contract.projectStartDate,
    contract.baselineSections,
    contract.monitoringSections,
    contract.leakageSections,
    contract.additionalitySections,
  ];

  for (const field of fields) {
    expectPromotedFactProvenance(evidence, field);
  }
}
