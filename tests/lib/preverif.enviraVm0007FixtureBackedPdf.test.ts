import { describe, expect, test } from "@jest/globals";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";
import { buildReportLines } from "@/lib/preverif/enviraVm0007FixtureBackedPdf";

function normalizeProvenanceText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPrioritySectionLines(lines: string[]): string[] {
  const startIndex = lines.indexOf("Priority Client Actions");
  const endIndex = lines.indexOf("Evidence Map");
  return startIndex >= 0 && endIndex > startIndex ? lines.slice(startIndex, endIndex) : [];
}

function extractPriorityRowLines(lines: string[], ruleId: string): string[] {
  const sectionLines = extractPrioritySectionLines(lines);
  const startIndex = sectionLines.indexOf(`Rule ID: ${ruleId}`);
  if (startIndex < 0) return [];

  let endIndex = sectionLines.length;
  for (let index = startIndex + 1; index < sectionLines.length; index += 1) {
    if (sectionLines[index] === "Priority Client Actions" || sectionLines[index].startsWith("Rule ID: ")) {
      endIndex = index;
      break;
    }
  }

  return sectionLines.slice(startIndex, endIndex);
}

describe("buildReportLines", () => {
  test("preserves provenance for every evidence-bearing row", () => {
    const report = buildEnviraVm0007FixtureBackedReport();
    const lines = buildReportLines(report);
    const normalizedLines = normalizeProvenanceText(lines.join(" "));
    const prioritySection = extractPrioritySectionLines(lines).join("\n");

    for (const row of report.evidenceMapRows) {
      if (row.acceptedQuote?.trim()) {
        const expectedQuoteLabel = row.status === "UNCLEAR" ? "Weak quote" : "Accepted quote";
        expect(normalizedLines).toContain(
          normalizeProvenanceText(`${expectedQuoteLabel}: ${row.acceptedQuote.trim().slice(0, 60)}`),
        );
      }

      if (row.page != null) {
        expect(normalizedLines).toContain(`Page: ${row.page}`);
      }

      if (row.sectionHeading?.trim()) {
        expect(normalizedLines).toContain(normalizeProvenanceText(`Section: ${row.sectionHeading.trim()}`));
      }
    }

    const priorityRows = report.evidenceMapRows.filter((row) => row.status === "UNCLEAR" || row.status === "MISSING");
    expect(prioritySection).toContain("Priority Client Actions");

    for (const row of priorityRows) {
      const rowLines = extractPriorityRowLines(lines, row.ruleId);
      const rowText = normalizeProvenanceText(rowLines.join(" "));

      expect(rowText).toContain(row.ruleId);
      expect(rowText).toContain(row.ruleName);

      if (row.status === "UNCLEAR") {
        if (row.acceptedQuote?.trim()) {
          expect(rowText).toContain(normalizeProvenanceText(row.acceptedQuote.trim()));
          expect(rowText).toContain("Weak quote");
        }

        if (row.page != null) {
          expect(rowText).toContain(`Page: ${row.page}`);
        }

        if (row.sectionHeading?.trim()) {
          expect(rowText).toContain(normalizeProvenanceText(`Section: ${row.sectionHeading.trim()}`));
        }

        if (row.whyEvidenceIsAccepted?.trim()) {
          expect(rowText).toContain(normalizeProvenanceText(row.whyEvidenceIsAccepted.trim()));
        }

        if (row.whyRejectedEvidenceIsNotEnough?.trim()) {
          expect(rowText).toContain(normalizeProvenanceText(row.whyRejectedEvidenceIsNotEnough.trim()));
        }

        for (const rejected of row.rejectedEvidenceExamples) {
          expect(rowText).toContain(normalizeProvenanceText(rejected.quote));
          expect(rowText).toContain(normalizeProvenanceText(rejected.rejectionReason));
        }
      }

      if (row.status === "MISSING") {
        expect(rowText).toContain(normalizeProvenanceText(row.whyEvidenceIsAccepted.trim()));
        if (row.clientAction?.trim()) {
          expect(rowText).toContain(normalizeProvenanceText(row.clientAction.trim()));
        }
        expect(rowText).not.toContain("No accepted quote encoded");
        expect(rowText).not.toContain("Page: Not available");
        expect(rowText).not.toContain("Section: Not available");
        expect(rowText).not.toContain("Span ID: Not available");
      }
    }
  });
});
