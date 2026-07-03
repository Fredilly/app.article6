import { describe, expect, it } from "@jest/globals";
import { GET } from "@/app/api/exports/internal/envira-vm0007-report/route";
import { extractPdfTextWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";
import { buildReportLines } from "@/lib/preverif/enviraVm0007FixtureBackedPdf";

describe("/api/exports/internal/envira-vm0007-report route", () => {
  it("returns a parseable PDF attachment built from fixture-backed report data", async () => {
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
    const normalizeProvenanceText = (value: string) =>
      value
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    const normalizePdfProvenanceText = (value: string) =>
      normalizeProvenanceText(value)
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain('attachment; filename="internal-envira-vm0007-fixture-backed-report.pdf"');

    const bytes = await response.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });
    const text = parsed.text;
    const lower = text.toLowerCase();
    const normalized = normalize(text);
    const report = buildEnviraVm0007FixtureBackedReport();
    const reportLines = buildReportLines(report).join("\n");
    const reportLinesNormalized = normalize(reportLines);
    const textNormalized = normalize(text);
    const rowsWithQuotes = report.evidenceMapRows.filter((row) => row.acceptedQuote?.trim());
    const rowsWithPages = report.evidenceMapRows.filter((row) => row.page != null);
    const rowsWithSections = report.evidenceMapRows.filter((row) => row.sectionHeading?.trim());
    const reportLineList = reportLines.split("\n");
    const prioritySectionStart = reportLineList.indexOf("Priority Client Actions");
    const prioritySectionEnd = reportLineList.indexOf("Evidence Map");
    const prioritySectionLines = prioritySectionStart >= 0 && prioritySectionEnd > prioritySectionStart ? reportLineList.slice(prioritySectionStart, prioritySectionEnd) : [];
    const priorityRows = report.evidenceMapRows.filter((row) => row.status === "UNCLEAR" || row.status === "MISSING");

    expect(text).toContain("Envira VM0007 Evidence Map");
    expect(text).toContain("Internal fixture-backed preview");
    expect(text).toContain("Not client-ready");
    expect(text).toContain("Based on PDF-backed fixture truth");
    expect(text).toContain("Purpose: show supported, weak, missing, and non-applicable methodology evidence");
    expect(text).toContain("FOUND: 30");
    expect(text).toContain("UNCLEAR: 8");
    expect(text).toContain("MISSING: 3");
    expect(text).toContain("N/A: 17");
    expect(text).toContain("Total rules: 58");
    expect(text).toContain("Priority Client Actions");
    expect(text).toContain("MISSING - 3");
    expect(text).toContain("UNCLEAR - 8");
    expect(text).toContain("FOUND - 30");
    expect(text).toContain("N/A - 17");

    expect(rowsWithQuotes.length).toBeGreaterThan(0);
    expect(rowsWithPages.length).toBeGreaterThan(0);
    expect(rowsWithSections.length).toBeGreaterThan(0);

    for (const row of report.evidenceMapRows) {
      expect(reportLinesNormalized).toContain(`Rule ID: ${row.ruleId}`);
      expect(reportLinesNormalized).toContain(`Rule name: ${row.ruleName}`);

      if (row.acceptedQuote?.trim()) {
        const expectedQuoteLabel = row.status === "UNCLEAR" ? "Weak quote" : "Accepted quote";
        const quotePrefix = row.acceptedQuote.trim().slice(0, 60);
        expect(normalizePdfProvenanceText(reportLinesNormalized)).toContain(
          normalizePdfProvenanceText(`${expectedQuoteLabel}: ${quotePrefix}`),
        );
        expect(normalizePdfProvenanceText(textNormalized)).toContain(
          normalizePdfProvenanceText(`${expectedQuoteLabel}: ${quotePrefix}`),
        );
      }

      if (row.page != null) {
        expect(reportLinesNormalized).toContain(`Page: ${row.page}`);
        expect(textNormalized).toContain(`Page: ${row.page}`);
      }

      if (row.sectionHeading?.trim()) {
        expect(normalizePdfProvenanceText(reportLinesNormalized)).toContain(
          normalizePdfProvenanceText(`Section: ${row.sectionHeading.trim()}`),
        );
        expect(normalizePdfProvenanceText(textNormalized)).toContain(
          normalizePdfProvenanceText(`Section: ${row.sectionHeading.trim()}`),
        );
      }
    }

    for (const row of priorityRows) {
      const startIndex = prioritySectionLines.indexOf(`Rule ID: ${row.ruleId}`);
      expect(startIndex).toBeGreaterThanOrEqual(0);

      let endIndex = prioritySectionLines.length;
      for (let index = startIndex + 1; index < prioritySectionLines.length; index += 1) {
        if (prioritySectionLines[index].startsWith("Rule ID: ")) {
          endIndex = index;
          break;
        }
      }

      const rowText = normalizePdfProvenanceText(prioritySectionLines.slice(startIndex, endIndex).join(" "));
      expect(rowText).toContain(row.ruleId);
      expect(rowText).toContain(row.ruleName);

      if (row.status === "UNCLEAR") {
        if (row.acceptedQuote?.trim()) {
          expect(rowText).toContain(normalizePdfProvenanceText(row.acceptedQuote.trim()));
          expect(rowText).toContain("Weak quote");
        }

        if (row.page != null) {
          expect(rowText).toContain(`Page: ${row.page}`);
        }

        if (row.sectionHeading?.trim()) {
          expect(rowText).toContain(normalizePdfProvenanceText(`Section: ${row.sectionHeading.trim()}`));
        }

        if (row.clientAction?.trim()) {
          expect(rowText).toContain(normalizePdfProvenanceText(row.clientAction.trim()));
        }
      }

      if (row.status === "MISSING") {
        expect(rowText).toContain(normalizePdfProvenanceText(row.whyEvidenceIsAccepted.trim()));
        if (row.clientAction?.trim()) {
          expect(rowText).toContain(normalizePdfProvenanceText(row.clientAction.trim()));
        }
        expect(rowText).not.toContain("No accepted quote encoded");
        expect(rowText).not.toContain("Page: Not available");
        expect(rowText).not.toContain("Section: Not available");
        expect(rowText).not.toContain("Span ID: Not available");
      }
    }

    expect(normalized).toContain("Rejected evidence:");
    expect(normalized).toContain("the land is legally permitted to be converted to non-forest");
    expect(normalized).toContain("Generic methodology-applicability language is not the underlying authorization document.");
    expect(text).not.toContain("Span ID: Not available");
    expect(text).not.toContain("No accepted quote encoded in fixture truth.");
    expect(text).not.toContain("Page: Not available");
    expect(text).not.toContain("Section: Not available");

    for (const banned of [
      "all clear",
      "passed",
      "fully verified",
      "ready for verification",
      "58 supported",
      "all rules supported",
    ]) {
      expect(lower).not.toContain(banned);
    }
  }, 20000);
});
