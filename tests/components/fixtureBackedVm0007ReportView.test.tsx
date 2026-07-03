import { describe, expect, test } from "@jest/globals";
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

describe("FixtureBackedVm0007ReportView", () => {
  test("renders the reviewed Envira fixture summary counts and all 58 evidence-map rows", () => {
    const html = buildHtml();
    const rowCount = (html.match(/data-evidence-map-row=/g) ?? []).length;

    expect(html).toContain("Internal Envira VM0007 Fixture-Backed Report Preview");
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
  });

  test("renders the executive summary section with VM0007 badge", () => {
    const html = buildHtml();
    expect(html).toContain("Executive Summary");
    expect(html).toContain("VM0007");
    expect(html).toContain("Fixture-backed evidence report");
  });

  test("renders priority client actions section showing MISSING and UNCLEAR only", () => {
    const html = buildHtml();
    expect(html).toContain("Priority Client Actions");
    expect(html).toContain("Follow-up for MISSING and UNCLEAR evidence");

    // Priority actions are rendered as cards before the evidence map
    const missingIndex = html.indexOf("data-status=\"MISSING\"");
    const unclearIndex = html.indexOf("data-status=\"UNCLEAR\"");
    // Expect both statuses to appear in the page
    expect(missingIndex).toBeGreaterThan(0);
    expect(unclearIndex).toBeGreaterThan(0);

    // Specific UNCLEAR rows with client actions
    expect(html).toContain("still an inference");
    expect(html).toContain("Add the conversion authorization document");
    expect(html).toContain("Add the project-specific eligibility analysis");
  });

  test("renders rejected evidence examples where the fixture encodes them and avoids banned wording", () => {
    const html = buildHtml();
    const lower = html.toLowerCase();

    expect(html).toContain("the land is legally permitted to be converted to non-forest");
    expect(html).toContain("Generic methodology-applicability language is not the underlying authorization document.");
    expect(html).toContain("Project Description");

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

  test("evidence map groups MISSING before UNCLEAR before FOUND before N/A", () => {
    const report = buildEnviraVm0007FixtureBackedReport();
    const rows = [...report.evidenceMapRows].sort((a, b) => {
      const rank = (s: string) => s === "MISSING" ? 0 : s === "UNCLEAR" ? 1 : s === "FOUND" ? 2 : 3;
      const r = rank(a.status) - rank(b.status);
      return r !== 0 ? r : a.ruleId.localeCompare(b.ruleId);
    });
    for (let i = 1; i < rows.length; i++) {
      const prevRank = rows[i - 1].status === "MISSING" ? 0 : rows[i - 1].status === "UNCLEAR" ? 1 : rows[i - 1].status === "FOUND" ? 2 : 3;
      const currRank = rows[i].status === "MISSING" ? 0 : rows[i].status === "UNCLEAR" ? 1 : rows[i].status === "FOUND" ? 2 : 3;
      expect(prevRank).toBeLessThanOrEqual(currRank);
    }
  });
});
