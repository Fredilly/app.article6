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

describe("buildReportLines", () => {
  test("preserves provenance for every evidence-bearing row", () => {
    const report = buildEnviraVm0007FixtureBackedReport();
    const normalizedLines = normalizeProvenanceText(buildReportLines(report).join(" "));

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
  });
});
