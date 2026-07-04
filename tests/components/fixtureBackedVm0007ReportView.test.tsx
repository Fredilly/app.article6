import { describe, expect, test } from "@jest/globals";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import FixtureBackedVm0007ReportView from "@/components/preverif/FixtureBackedVm0007ReportView";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";

function buildHtml() {
  return renderToStaticMarkup(
    <FixtureBackedVm0007ReportView
      report={buildEnviraVm0007FixtureBackedReport()}
      pdfDownloadHref="/api/exports/internal/envira-vm0007-report"
    />,
  );
}

function buildDocument() {
  return new JSDOM(buildHtml()).window.document;
}

function normalizeProvenanceText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

describe("FixtureBackedVm0007ReportView", () => {
  test("renders the reviewed Envira fixture summary counts and all 58 evidence-map rows", () => {
    const html = buildHtml();
    const rowCount = (html.match(/data-evidence-map-row=/g) ?? []).length;

    expect(html).toContain("Envira VM0007 Evidence Map");
    expect(html).toContain("Internal fixture-backed preview");
    expect(html).toContain("Not client-ready");
    expect(html).toContain("Based on PDF-backed fixture truth");
    expect(html).toContain("Purpose: show supported, weak, missing, and non-applicable methodology evidence");
    expect(html).toContain("Download PDF");
    expect(html).toContain(">FOUND<");
    expect(html).toContain(">30<");
    expect(html).toContain(">UNCLEAR<");
    expect(html).toContain(">8<");
    expect(html).toContain(">MISSING<");
    expect(html).toContain(">3<");
    expect(html).toContain(">N/A<");
    expect(html).toContain(">17<");
    expect(rowCount).toBe(58);
    expect(html).toContain("Executive Summary");
    expect(html).toContain("Priority Client Actions");
  });

  test("renders row-scoped provenance for every evidence-bearing row and keeps missing rows honest", () => {
    const document = buildDocument();
    const report = buildEnviraVm0007FixtureBackedReport();

    const rowsWithQuotes = report.evidenceMapRows.filter((row) => row.acceptedQuote?.trim());
    const rowsWithPages = report.evidenceMapRows.filter((row) => row.page != null);
    const rowsWithSections = report.evidenceMapRows.filter((row) => row.sectionHeading?.trim());

    expect(rowsWithQuotes.length).toBeGreaterThan(0);
    expect(rowsWithPages.length).toBeGreaterThan(0);
    expect(rowsWithSections.length).toBeGreaterThan(0);

    for (const row of report.evidenceMapRows) {
      const rowEl = document.querySelector(`[data-evidence-map-row="${row.ruleId}"]`);
      expect(rowEl).not.toBeNull();
      const rowText = rowEl?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const normalizedRowText = normalizeProvenanceText(rowText);

      if (row.acceptedQuote?.trim()) {
        expect(normalizedRowText).toContain(normalizeProvenanceText(row.acceptedQuote.trim()));
        expect(normalizedRowText).toContain(row.status === "UNCLEAR" ? "Weak quote" : "Accepted quote");
      }

      if (row.page != null) {
        expect(normalizedRowText).toContain(String(row.page));
      }

      if (row.sectionHeading?.trim()) {
        expect(normalizedRowText).toContain(normalizeProvenanceText(row.sectionHeading.trim()));
      }
    }

    for (const row of report.evidenceMapRows.filter((entry) => entry.status === "MISSING")) {
      const rowEl = document.querySelector(`[data-evidence-map-row="${row.ruleId}"]`);
      const rowText = rowEl?.textContent?.replace(/\s+/g, " ").trim() ?? "";

      expect(rowText).not.toContain("No accepted quote encoded");
      expect(rowText).not.toContain("Page: Not available");
      expect(rowText).not.toContain("Section: Not available");
      expect(rowText).not.toContain("Span ID: Not available");
    }
  });

  test("renders grouped evidence-map sections in the expected order", () => {
    const html = buildHtml();

    expect(html).toContain("MISSING — 3");
    expect(html).toContain("UNCLEAR — 8");
    expect(html).toContain("FOUND — 30");
    expect(html).toContain("N/A — 17");
    expect(html).toContain('data-status="UNCLEAR"');
    expect(html).toContain('data-status="MISSING"');
    expect(html).toContain('data-status="N/A"');
  });

  test("renders row-scoped priority client actions with provenance for UNCLEAR rows", () => {
    const document = buildDocument();
    const report = buildEnviraVm0007FixtureBackedReport();
    const priorityRows = report.evidenceMapRows.filter((row) => row.status === "UNCLEAR" || row.status === "MISSING");

    expect(priorityRows.length).toBeGreaterThan(0);

    for (const row of priorityRows) {
      const rowEl = document.querySelector(`[data-priority-action-row="${row.ruleId}"]`);
      expect(rowEl).not.toBeNull();

      const rowText = rowEl?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const normalizedRowText = normalizeProvenanceText(rowText);

      if (row.status === "UNCLEAR") {
        if (row.acceptedQuote?.trim()) {
          expect(normalizedRowText).toContain(normalizeProvenanceText(row.acceptedQuote.trim()));
          expect(normalizedRowText).toContain("Weak quote");
        }

        if (row.page != null) {
          expect(normalizedRowText).toContain(String(row.page));
        }

        if (row.sectionHeading?.trim()) {
          expect(normalizedRowText).toContain(normalizeProvenanceText(row.sectionHeading.trim()));
        }

        expect(normalizedRowText).toContain(normalizeProvenanceText(row.whyEvidenceIsAccepted));

        if (row.whyRejectedEvidenceIsNotEnough?.trim()) {
          expect(normalizedRowText).toContain(normalizeProvenanceText(row.whyRejectedEvidenceIsNotEnough.trim()));
        }

        for (const rejected of row.rejectedEvidenceExamples) {
          expect(normalizedRowText).toContain(normalizeProvenanceText(rejected.quote));
          expect(normalizedRowText).toContain(normalizeProvenanceText(rejected.rejectionReason));
        }

        if (row.clientAction?.trim()) {
          expect(normalizedRowText).toContain(normalizeProvenanceText(row.clientAction.trim()));
        }
      }

      if (row.status === "MISSING") {
        expect(rowText).toContain("Missing reason");
        expect(normalizedRowText).toContain(normalizeProvenanceText(row.whyEvidenceIsAccepted));

        if (row.clientAction?.trim()) {
          expect(normalizedRowText).toContain(normalizeProvenanceText(row.clientAction.trim()));
        }

        for (const placeholder of ["No accepted quote encoded", "Page: Not available", "Section: Not available", "Span ID: Not available"]) {
          expect(rowText).not.toContain(placeholder);
        }
      }
    }
  });

  test("hides placeholder clutter while preserving rejected evidence where encoded and avoids banned wording", () => {
    const html = buildHtml();
    const lower = html.toLowerCase();

    expect(html).toContain("the land is legally permitted to be converted to non-forest");
    expect(html).toContain("Generic methodology-applicability language is not the underlying authorization document.");
    expect(html).toContain("Project Description");
    expect(html).not.toContain("Span ID: Not available");
    expect(html).not.toContain("No accepted quote encoded in fixture truth.");
    expect(html).not.toContain("Rejected evidence examples");

    for (const banned of [
      "all clear",
      "fully verified",
      "ready for verification",
      "58 supported",
      "all rules supported",
      "passed",
    ]) {
      expect(lower).not.toContain(banned);
    }
  });
});
