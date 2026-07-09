import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import FixtureBackedVm0007ReportView from "@/components/preverif/FixtureBackedVm0007ReportView";
import { VM0007_VERSION_MISMATCH_BLOCK_MESSAGE, buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";

function buildHtml() {
  return renderToStaticMarkup(
    <FixtureBackedVm0007ReportView
      report={buildEnviraVm0007FixtureBackedReport()}
      pdfDownloadHref="/api/exports/internal/envira-vm0007-report"
    />,
  );
}

describe("FixtureBackedVm0007ReportView", () => {
  test("renders the blocked legacy mismatch panel instead of a normal evidence map", () => {
    const html = buildHtml();
    const rowCount = (html.match(/data-evidence-map-row=/g) ?? []).length;

    expect(html).toContain("Report blocked");
    expect(html).toContain("Envira VM0007 legacy v1.5 mismatch");
    expect(html).toContain(VM0007_VERSION_MISMATCH_BLOCK_MESSAGE);
    expect(html).toContain("Download blocked PDF");
    expect(html).toContain("Quarantine metadata");
    expect(html).toContain("PDD-declared methodology: REDD-MF / VM0007 v1.5");
    expect(html).toContain("Loaded rulebook: VM0007 v1.8");
    expect(html).toContain("Version match: false");
    expect(html).toContain("Internal-only blocked output. No evidence map is rendered.");
    expect(rowCount).toBe(0);
    expect(html).not.toContain("Executive Summary");
    expect(html).not.toContain("Priority Client Actions");
    expect(html).not.toContain("Evidence Map");
    expect(html).not.toContain(">30<");
    expect(html).not.toContain(">8<");
    expect(html).not.toContain(">3<");
    expect(html).not.toContain(">17<");
  });

  test("avoids readiness language in the blocked report view", () => {
    const lower = buildHtml().toLowerCase();

    for (const banned of ["client ready", "ready for verification", "verified", "all clear"]) {
      expect(lower).not.toContain(banned);
    }
  });
});
