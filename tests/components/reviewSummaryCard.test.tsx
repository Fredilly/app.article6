import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import ReviewSummaryCard from "@/components/verify/ReviewSummaryCard";

describe("ReviewSummaryCard", () => {
  test("renders the finalized review summary and export actions", () => {
    const html = renderToStaticMarkup(
      <ReviewSummaryCard
        summary={{
          methodCode: "AR-ACM0003",
          version: "v02-0",
          ruleId: "R-1",
          ruleSection: "Monitoring period",
          ruleText: "Evidence must fall inside the monitoring period.",
          selectedEvidenceId: "stac-1",
          selectedEvidenceDatetime: "2026-03-25T00:00:00Z",
          cloudCover: 4.5,
          aoiLabel: "Project AOI",
          reviewState: "finalized",
          generatedAt: "2026-03-25T00:10:00Z",
          outcomeNote: "Stable result.",
        }}
        artifact={null}
        onDownloadJson={() => {}}
        onDownloadPdf={() => {}}
      />,
    );

    expect(html).toContain("Review Summary");
    expect(html).toContain("Download PDF summary");
    expect(html).toContain("Download JSON artifact");
    expect(html).toContain("Monitoring period");
    expect(html).toContain("Stable result.");
    expect(html).toContain("Raw evidence details");
  });

  test("shows the PDF failure fallback message without crashing", () => {
    const html = renderToStaticMarkup(
      <ReviewSummaryCard
        summary={{
          methodCode: null,
          version: null,
          ruleId: null,
          ruleSection: null,
          ruleText: null,
          selectedEvidenceId: null,
          selectedEvidenceDatetime: null,
          cloudCover: null,
          aoiLabel: null,
          reviewState: null,
          generatedAt: null,
          outcomeNote: null,
        }}
        artifact={null}
        onDownloadJson={() => {}}
        onDownloadPdf={() => {}}
        pdfError="pdf failed"
      />,
    );

    expect(html).toContain("PDF export failed");
    expect(html).toContain("No reviewer note provided");
    expect(html).toContain("Unnamed AOI");
  });
});
