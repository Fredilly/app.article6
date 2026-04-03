import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import FinalReviewSummaryPanel from "@/components/verify/FinalReviewSummaryPanel";
import { getVerifyWizardStepDetails } from "@/lib/verify/runState";

describe("FinalReviewSummaryPanel", () => {
  test("renders the finalized right-panel summary with blocks and actions", () => {
    const html = renderToStaticMarkup(
      <FinalReviewSummaryPanel
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
          stacSearchResultCount: 3,
          linkedRuleCount: 1,
          selectedEvidenceLinkedRules: ["R-1"],
          checklistStatus: "unused",
          narrative: "Finalized verify review.",
        }}
        artifact={null}
        currentRunLabel="run-1234"
        finalizedAt="2026-03-25T00:10:00Z"
        reviewedRuleCount={1}
        linkedEvidenceCount={2}
        wizard={getVerifyWizardStepDetails({
          selectedRuleId: "R-1",
          aoiHash: "aoi",
          stacItemIds: ["item-1"],
          selectedStacItemId: "item-1",
          linkedRuleIds: ["R-1"],
          reviewerArtifactSavedAt: "2026-03-25T00:05:00Z",
          finalizedAt: "2026-03-25T00:10:00Z",
        })}
        onDownloadJson={() => {}}
        onDownloadPdf={() => {}}
        onCopyLink={() => {}}
        onStartAnotherRun={() => {}}
        onViewRunHistory={() => {}}
      />,
    );

    expect(html).toContain("Final Review Summary");
    expect(html).toContain("Download PDF");
    expect(html).toContain("Download JSON");
    expect(html).toContain("Copy link");
    expect(html).toContain("Rule applied");
    expect(html).toContain("Evidence used");
    expect(html).toContain("AOI");
    expect(html).toContain("What happened");
    expect(html).toContain("Review scope");
    expect(html).toContain("Outcome note");
    expect(html).toContain("Review state");
    expect(html).toContain("Start another run");
    expect(html).toContain("View run history");
    expect(html).toContain("Expand completed workflow");
    expect(html).toContain("Completed workflow history");
    expect(html).not.toContain("Current workspace");
    expect(html).not.toContain("Next required action");
  });
});
