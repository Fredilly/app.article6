import { describe, expect, test } from "@jest/globals";
import {
  buildReviewSummary,
  formatReviewSummaryDisplay,
  reviewSummaryRows,
} from "@/lib/verify/buildReviewSummary";
import { buildReviewSummaryPdf } from "@/lib/verify/reviewSummaryPdf";

describe("buildReviewSummary", () => {
  test("builds the review summary from finalized export data", () => {
    const summary = buildReviewSummary({
      method: { code: "AR-ACM0003", version: "v02-0" },
      aoi: { id: "aoi-1", label: "Project AOI", bbox: [10, 11, 12, 13] },
      selected: {
        id: "stac-1",
        item: {
          id: "stac-1",
          properties: {
            datetime: "2026-03-25T00:00:00Z",
            "eo:cloud_cover": 12.5,
          },
        },
      },
      verifier: {
        outcomeNote: "Ready for external review.",
        finalizedAt: "2026-03-25T00:10:00Z",
        finalizedState: "finalized",
      },
      rule: {
        id: "R-12",
        text: "The selected evidence must match the monitoring period.",
        sectionId: "S-4",
        sectionTitle: "Monitoring period",
      },
      generatedAt: "2026-03-25T00:10:00Z",
    });

    expect(summary).toEqual({
      methodCode: "AR-ACM0003",
      version: "v02-0",
      ruleId: "R-12",
      ruleSection: "Monitoring period",
      ruleText: "The selected evidence must match the monitoring period.",
      selectedEvidenceId: "stac-1",
      selectedEvidenceDatetime: "2026-03-25T00:00:00Z",
      cloudCover: 12.5,
      aoiLabel: "Project AOI",
      reviewState: "finalized",
      generatedAt: "2026-03-25T00:10:00Z",
      outcomeNote: "Ready for external review.",
    });
  });

  test("renders clean fallback labels for missing optional fields", () => {
    const summary = buildReviewSummary({
      method: { code: "AR-ACM0003", version: "v02-0" },
      aoi: { bbox: [10, 11, 12, 13] },
      selected: { id: null, item: null },
      rule: { id: "R-1", text: null, sectionId: null, sectionTitle: null },
      verifier: { outcomeNote: "", finalizedAt: null, finalizedState: "draft" },
    });

    const display = formatReviewSummaryDisplay(summary);
    expect(display.outcomeNote).toBe("No reviewer note provided");
    expect(display.selectedEvidenceDatetime).toBe("Unavailable");
    expect(display.aoiLabel).toBe("BBox 10.00, 11.00, 12.00, 13.00");
    expect(display.cloudCover).toBe("Unavailable");
  });

  test("uses the same summary rows for PDF output", () => {
    const summary = buildReviewSummary({
      method: { code: "AR-ACM0003", version: "v02-0" },
      rule: { id: "R-1", text: "Rule text", sectionTitle: "Section title" },
      verifier: { outcomeNote: "Note", finalizedAt: "2026-03-25T00:10:00Z", finalizedState: "finalized" },
    });

    const pdfText = new TextDecoder().decode(buildReviewSummaryPdf(summary));
    expect(reviewSummaryRows(summary)).toEqual(
      expect.arrayContaining([
        { label: "Method code", value: "AR-ACM0003" },
        { label: "Rule ID", value: "R-1" },
      ]),
    );
    expect(pdfText).toContain("Review Summary");
    expect(pdfText).toContain("AR-ACM0003");
    expect(pdfText).toContain("Rule ID: R-1");
  });
});
