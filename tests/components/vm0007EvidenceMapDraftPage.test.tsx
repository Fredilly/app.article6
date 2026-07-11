/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Vm0007EvidenceMapDraftPage from "@/components/preverif/Vm0007EvidenceMapDraftPage";
import { saveVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import type { Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";

describe("VM0007 Evidence Map draft page", () => {
  test("renders all 58 rows from persisted draft data", async () => {
    const auditId = "ui-audit";
    const rows = Array.from({ length: 58 }, (_, index) => ({
      rowId: `${auditId}:R-${index + 1}`,
      auditId,
      ruleReference: `R-${index + 1}`,
      ruleTitle: `Rule ${index + 1}`,
      stableRuleId: `R-${index + 1}`,
      requirementText: "Requirement",
      methodologyId: "VM0007",
      methodologyVersion: "v1.8",
      rawAuditStatus: "missing_evidence",
      upstreamStatus: "MISSING",
      proposedEvidenceStatus: "MISSING",
      proposedApplicability: "APPLICABLE",
      proposedAcceptedEvidence: null,
      proposedRejectedEvidence: null,
      assessmentReason: "No evidence.",
      gap: "Add evidence.",
      clientAction: "Review.",
      confidence: "low",
      searchCoverage: { searched: true, searchedDocumentIds: ["doc"], notes: null },
      sourceDocument: { documentId: "doc", documentName: "pdd.pdf", contentSha256: null },
      quote: null,
      page: null,
      section: null,
      spanId: null,
      provenance: null,
      finalizationState: "draft",
      proposalSource: "VM0007_QUICK_CHECK_AUDIT",
      proposalTimestamp: "2026-07-11T00:00:00.000Z",
    }));
    saveVm0007EvidenceMapDraft({ auditId, generatedAt: "2026-07-11T00:00:00.000Z", methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8", sourceDocument: rows[0].sourceDocument, proposalState: "MACHINE_PROPOSED", rows, blockedBy: [], contractVersion: "vm0007-evidence-map-draft-v1" } as Vm0007EvidenceMapDraftPackage);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<Vm0007EvidenceMapDraftPage auditId={auditId} />); });
    expect(container.textContent).toContain("Evidence Map");
    expect(container.textContent).toContain("VM0007 v1.8 · 58 requirements");
    expect(container.textContent).toContain("Rule 1");
    expect(container.textContent).toContain("Rule 58");
    expect(container.textContent).not.toContain("Gap Report");
    expect(container.textContent).toContain("Pre-Validation Readiness Report");
    expect(container.textContent).toContain("Available after the Evidence Map has been reviewer-finalized.");
    expect(container.querySelector("button")?.hasAttribute("disabled")).toBe(true);
    act(() => root.unmount());
  });
});
