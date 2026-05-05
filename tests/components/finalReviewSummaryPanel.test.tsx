/** @jest-environment jsdom */

import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import FinalReviewSummaryPanel from "@/components/verify/FinalReviewSummaryPanel";
import type { EvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";
import type { EvidencePin } from "@/lib/proofMap/types";
import { getVerifyWizardStepDetails } from "@/lib/verify/runState";

describe("FinalReviewSummaryPanel", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

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
          stacSupportFactsStatus: null,
          linkedStacSupportFactCount: null,
          unlinkedStacSupportFactCount: null,
          checklistStatus: "unused",
          reconciliationStatus: "Supported",
          reconciliationReason: "All expected evidence is linked.",
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
    expect(html).toContain("Area");
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

  test("shows the client readiness export action only when export wiring is provided", () => {
    const withoutExport = renderToStaticMarkup(
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
          stacSupportFactsStatus: null,
          linkedStacSupportFactCount: null,
          unlinkedStacSupportFactCount: null,
          checklistStatus: "unused",
          reconciliationStatus: "Supported",
          reconciliationReason: "All expected evidence is linked.",
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
        onStartAnotherRun={() => {}}
        onViewRunHistory={() => {}}
      />,
    );
    expect(withoutExport).not.toContain("Export client readiness report");

    const withExport = renderToStaticMarkup(
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
          stacSupportFactsStatus: null,
          linkedStacSupportFactCount: null,
          unlinkedStacSupportFactCount: null,
          checklistStatus: "unused",
          reconciliationStatus: "Supported",
          reconciliationReason: "All expected evidence is linked.",
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
        onExportClientReadinessReport={() => {}}
        onStartAnotherRun={() => {}}
        onViewRunHistory={() => {}}
      />,
    );
    expect(withExport).toContain("Export client readiness report");
  });

  test("shows the VVB draft workpaper export action only when export wiring is provided", () => {
    const withoutExport = renderToStaticMarkup(
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
          stacSupportFactsStatus: null,
          linkedStacSupportFactCount: null,
          unlinkedStacSupportFactCount: null,
          checklistStatus: "unused",
          reconciliationStatus: "Supported",
          reconciliationReason: "All expected evidence is linked.",
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
        onStartAnotherRun={() => {}}
        onViewRunHistory={() => {}}
      />,
    );
    expect(withoutExport).not.toContain("Export VVB draft workpaper");

    const withExport = renderToStaticMarkup(
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
          stacSupportFactsStatus: null,
          linkedStacSupportFactCount: null,
          unlinkedStacSupportFactCount: null,
          checklistStatus: "unused",
          reconciliationStatus: "Supported",
          reconciliationReason: "All expected evidence is linked.",
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
        onExportVvbWorkpaper={() => {}}
        onStartAnotherRun={() => {}}
        onViewRunHistory={() => {}}
      />,
    );
    expect(withExport).toContain("Export VVB draft workpaper");
  });

  test("keeps reviewer minutes and outcome note in the finalized audit-pack POST body", async () => {
    const artifact: EvidenceSnapshot = {
      method: { code: "AR-ACM0003", version: "v02-0" },
      evidence_source: { type: "stac_url", ref: "https://stac.example.test" },
      selected: {
        id: "sentinel-scene-1",
        item: {
          id: "sentinel-scene-1",
          datetime: "2026-03-25T00:00:00Z",
          collection: "sentinel-2",
          cloud_cover: 4,
          linked_rules: ["R-1"],
        },
      },
      outcome: {
        aoi: { hash: "aoi", bbox: [0, 0, 1, 1], areaKm2: 1 },
        stac: { query: { source: "https://stac.example.test" }, itemIds: ["sentinel-scene-1"] },
        linkage: { selectedRuleId: "R-1", linkedRuleIds: ["R-1"] },
        exportState: { snapshotExportedAt: "2026-03-25T00:10:00Z" },
        provenance: {
          methodCode: "AR-ACM0003",
          version: "v02-0",
          generatedAt: "2026-03-25T00:10:00Z",
          snapshotSchemaVersion: "evidence-snapshot/v2",
        },
      },
      verifier: {
        runId: "run-1234",
        createdAt: "2026-03-25T00:05:00Z",
        minutes: "Reviewer linked selected evidence and PDD fragment.",
        outcomeNote: "Stable result.",
        finalizedAt: "2026-03-25T00:10:00Z",
        finalizedState: "finalized",
        delta: "",
        impact: "",
        checklistStatus: "1/1 completed",
        checklist: [],
        tasks: [],
      },
      kpis: {
        stacSearchResultCount: 1,
        selectedEvidenceCount: 1,
        linkedRuleCount: 1,
        coverage: { numerator: 1, denominator: 1 },
        snapshotExportedAt: "2026-03-25T00:10:00Z",
      },
      summary: {
        methodCode: "AR-ACM0003",
        version: "v02-0",
        ruleId: "R-1",
        ruleSection: "Monitoring period",
        ruleText: "Evidence must fall inside the monitoring period.",
        selectedEvidenceId: "sentinel-scene-1",
        selectedEvidenceDatetime: "2026-03-25T00:00:00Z",
        cloudCover: 4,
        aoiLabel: "Project AOI",
        reviewState: "finalized",
        generatedAt: "2026-03-25T00:10:00Z",
        outcomeNote: "Stable result.",
        stacSearchResultCount: 1,
        linkedRuleCount: 1,
        selectedEvidenceLinkedRules: ["R-1"],
        stacSupportFactsStatus: null,
        linkedStacSupportFactCount: null,
        unlinkedStacSupportFactCount: null,
        checklistStatus: "1/1 completed",
        reconciliationStatus: "Supported",
        reconciliationReason: "All expected evidence is linked.",
        narrative: "Finalized verify review.",
      },
    };
    const evidencePins: EvidencePin[] = [
      {
        id: "pin-pdd-1",
        kind: "pdd",
        title: "PDD.pdf",
        cited_ids: [],
        created_at: "2026-03-25T00:00:00Z",
        pdd_fragments: [{ evidence_id: "pin-pdd-1", fragment_id: "frag-monitoring-period", label: "Monitoring period" }],
        pdd_fragment_links: [{ fragment_id: "frag-monitoring-period", rule_id: "R-1", linked_at: "2026-03-25T00:01:00Z" }],
      },
    ];
    const fetchMock = jest.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:audit-pack") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:audit-pack");
    jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FinalReviewSummaryPanel
          summary={artifact.summary}
          artifact={artifact}
          currentRunLabel="run-1234"
          finalizedAt="2026-03-25T00:10:00Z"
          reviewedRuleCount={1}
          linkedEvidenceCount={1}
          evidencePins={evidencePins}
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
          onStartAnotherRun={() => {}}
          onViewRunHistory={() => {}}
        />,
      );
    });

    await act(async () => {
      const auditPackButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
        button.textContent?.includes("Download audit pack"),
      );
      auditPackButton?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/exports/audit-pack",
      expect.objectContaining({
        method: "POST",
        body: expect.any(String),
      }),
    );
    const requestBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      artifact?: EvidenceSnapshot;
      evidencePins?: EvidencePin[];
    };
    expect(requestBody.artifact?.verifier.minutes).toBe("Reviewer linked selected evidence and PDD fragment.");
    expect(requestBody.artifact?.verifier.outcomeNote).toBe("Stable result.");
    expect(requestBody.artifact?.summary.outcomeNote).toBe("Stable result.");
    expect(requestBody.evidencePins).toEqual(evidencePins);

    await act(async () => {
      root.unmount();
    });
  });
});
