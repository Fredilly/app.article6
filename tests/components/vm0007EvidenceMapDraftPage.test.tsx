/** @jest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import Vm0007EvidenceMapDraftPage from "@/components/preverif/Vm0007EvidenceMapDraftPage";
import { loadVm0007EvidenceMapDraft, saveVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import type { Vm0007EvidenceMapDraftPackage, Vm0007EvidenceMapDraftRow } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { ReviewedEvidenceMapSnapshot, ReviewedEvidenceState, ReviewedOutcome } from "@/lib/preverif/reviewedEvidenceMapTypes";

const provenance = (spanId: string, page: number | null = 12) => ({ docId: "doc", page, sectionPath: ["Project implementation"], spanId, sectionHeading: "Project implementation", sourceType: "PDD" });

function makeRows(auditId: string): Vm0007EvidenceMapDraftRow[] {
  return Array.from({ length: 58 }, (_, index) => {
    const state = index === 0 ? "FOUND" : index === 1 || index === 3 || index === 4 ? "UNCLEAR" : "MISSING";
    const raw = index === 0 ? "supported_by_pdd" : index === 1 ? "partially_supported" : index === 3 ? "not_applicable" : index === 4 ? "manual_review_needed" : "missing_evidence";
    return {
      rowId: `${auditId}:R-${index + 1}`, auditId, ruleReference: `R-${index + 1}`, ruleTitle: index === 0 ? " r-1 " : index === 1 ? "Rule Two" : `Rule ${index + 1}`, stableRuleId: `R-${index + 1}`,
      requirementText: index === 0 ? "The project must document implementation and monitoring." : "Requirement", methodologyId: "VM0007", methodologyVersion: "v1.8", rawAuditStatus: raw,
      upstreamStatus: state, proposedEvidenceStatus: state, proposedApplicability: index === 3 ? "NOT_APPLICABLE" : index === 4 ? "UNKNOWN" : "APPLICABLE",
      proposedAcceptedEvidence: index === 0 ? { quote: "Legacy accepted project evidence.", provenance: provenance("legacy-accepted") } : null,
      proposedRejectedEvidence: index === 0 ? { quote: "Legacy boilerplate.", reason: "Methodology instructions are not project evidence.", provenance: provenance("legacy-rejected", 4) } : null,
      ...(index === 0 ? {
        acceptedEvidence: [
          { quote: "The implementation plan names the responsible team.", page: 12, section: "Project implementation", spanId: "accepted-1", evidenceType: "project_specific_implementation" as const, provenance: provenance("accepted-1") },
          { quote: "Monitoring occurs every six months.", page: 21, section: "Monitoring", spanId: "accepted-2", evidenceType: "project_specific_implementation" as const, provenance: { ...provenance("accepted-2", 21), sectionPath: ["Monitoring"], sectionHeading: "Monitoring" } },
        ],
        rejectedEvidence: [{ quote: "Projects should implement monitoring.", page: 4, section: "Methodology", spanId: "rejected-1", evidenceType: "methodology_boilerplate" as const, rejectionReason: "Generic methodology instruction; it does not describe this project.", provenance: { ...provenance("rejected-1", 4), sectionPath: ["Methodology"], sectionHeading: "Methodology" } }],
        supportedComponents: ["implementation"], missingComponents: ["monitoring records"], reasonSelected: "The strongest project-specific passages were retained.",
      } : {}),
      assessmentReason: state === "MISSING" ? "No project evidence was found." : "Evidence was assessed without changing audit truth.", gap: state === "MISSING" ? "Provide project evidence." : "Confirm the retained evidence.", clientAction: "Review the source document.", confidence: state === "FOUND" ? "high" : "low",
      searchCoverage: { searched: true, searchedDocumentIds: ["doc"], notes: null }, sourceDocument: { documentId: "doc", documentName: "Project PDD.pdf", contentSha256: null },
      quote: index === 0 ? "Legacy accepted project evidence." : null, page: index === 0 ? 12 : null, section: index === 0 ? "Project implementation" : null, spanId: index === 0 ? "legacy-accepted" : null, provenance: index === 0 ? provenance("legacy-accepted") : null,
      finalizationState: "draft", reviewState: "pending review", reviewHistory: [], rowVersion: 1, finalizationActorRef: null, finalizedAt: null, finalizationBasis: null, reviewHistoryRef: null,
      proposalSource: "VM0007_QUICK_CHECK_AUDIT", proposalTimestamp: "2026-07-11T00:00:00.000Z",
    } satisfies Vm0007EvidenceMapDraftRow;
  });
}

function savePackage(auditId: string, rows = makeRows(auditId)) {
  expect(saveVm0007EvidenceMapDraft({ auditId, generatedAt: "2026-07-11T00:00:00.000Z", methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8", sourceDocument: rows[0].sourceDocument, proposalState: "MACHINE_PROPOSED", rows, blockedBy: [], contractVersion: "vm0007-evidence-map-draft-v1" } as Vm0007EvidenceMapDraftPackage)).toBe(true);
}

async function renderPage(auditId: string, reviewedCandidate?: ReviewedEvidenceMapSnapshot): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<Vm0007EvidenceMapDraftPage auditId={auditId} reviewedCandidate={reviewedCandidate} />); });
  return { container, root };
}

function click(element: Element | null) { expect(element).not.toBeNull(); act(() => { (element as HTMLElement).click(); }); }
function change(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null, value: string) { expect(element).not.toBeNull(); act(() => { const setter = Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set; setter?.call(element, value); element?.dispatchEvent(new Event("change", { bubbles: true })); element?.dispatchEvent(new Event("input", { bubbles: true })); }); }

afterEach(() => { document.body.innerHTML = ""; window.localStorage.clear(); });

describe("VM0007 Evidence Map review workspace", () => {
  test("defaults a matching reviewed case to a read-only snapshot and switches without persistence", async () => {
    const auditId = "reviewed-ui";
    const rows = makeRows(auditId).map((row) => ({ ...row, sourceDocument: { ...row.sourceDocument, contentSha256: "reviewed-hash" } }));
    savePackage(auditId, rows);
    const reviewedRows = rows.map((row, index) => {
      const finalEvidenceState: ReviewedEvidenceState = index < 6 ? "FOUND" : index < 26 ? "UNCLEAR" : index < 36 ? "MISSING" : "N/A";
      const reviewerOutcome: ReviewedOutcome = index < 6 ? "CONFORMS" : index < 36 ? "ACTION_REQUIRED" : "NOT_APPLICABLE";
      return { rowId: row.rowId, stableRuleId: row.stableRuleId, ruleReference: row.ruleReference, requirementText: row.requirementText, finalEvidenceState, reviewerOutcome, reviewerEvidence: index === 0 ? [{ quote: "Reviewed canonical quote.", page: 9, section: "Reviewed section", spanId: "reviewed-span", provenance: { docId: "doc", page: 9, sectionPath: ["Reviewed section"], spanId: "reviewed-span", sectionHeading: "Reviewed section", sourceType: "PDD" } }] : [], rejectedEvidence: [], draftFindingCandidate: reviewerOutcome === "ACTION_REQUIRED" ? "NIR_CANDIDATE" : null, contradictionState: "NONE_IDENTIFIED", clientAction: "Reviewed action." };
    });
    const snapshot: ReviewedEvidenceMapSnapshot = { canonicalAuditId: auditId, stableProjectId: "project", sourceDocument: { documentId: "doc", documentName: "Project PDD.pdf", contentSha256: "reviewed-hash" }, methodologyId: "VM0007", methodologyVersion: "v1.8", rows: reviewedRows, readOnly: true };
    const before = window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${auditId}`);
    const { container, root } = await renderPage(auditId, snapshot);
    expect(container.textContent).toContain("Evidence Map · Reviewed truth");
    expect(container.textContent).toContain("6Found");
    expect(container.textContent).toContain("20Unclear");
    expect(container.textContent).toContain("10Missing");
    expect(container.textContent).toContain("22Not applicable");
    expect(container.textContent).toContain("30Action required");
    expect(Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Finalize Evidence Map"))?.hasAttribute("disabled")).toBe(true);
    click(container.querySelector(`[data-evidence-map-row="${auditId}:R-1"] > button`));
    expect(container.textContent).toContain("Reviewed canonical quote.");
    expect(container.textContent).toContain("Page 9");
    expect(container.textContent).toContain("Save, approve, reopen, and finalize controls are unavailable.");
    click(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Machine proposal") ?? null);
    expect(container.textContent).toContain("Evidence Map · Machine proposal");
    expect(container.textContent).toContain("1Found");
    expect(container.textContent).toContain("The implementation plan names the responsible team.");
    expect(window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${auditId}`)).toBe(before);
    act(() => root.unmount());
  });

  test("shows all rows and truthful summary counts by default, including missing rows", async () => {
    const auditId = "ui-default"; savePackage(auditId);
    const { container, root } = await renderPage(auditId);
    expect(container.querySelectorAll("[data-evidence-map-row]")).toHaveLength(58);
    expect(container.textContent).toContain("1Found");
    expect(container.textContent).toContain("3Unclear");
    expect(container.textContent).toContain("54Missing");
    expect(container.textContent).toContain("1Not applicable");
    expect(container.textContent).toContain("58Action required");
    expect(container.textContent).toContain("58 of 58 rules");
    expect(container.textContent).toContain("Provide project evidence.");
    expect(container.textContent).not.toContain("supported_by_pdd");
    act(() => root.unmount());
  });

  test("filters immediately and clearing restores every row", async () => {
    const auditId = "ui-filters"; savePackage(auditId);
    const { container, root } = await renderPage(auditId);
    change(container.querySelector('select[aria-label="Evidence state"]'), "FOUND");
    expect(container.querySelectorAll("[data-evidence-map-row]")).toHaveLength(1);
    expect(container.textContent).toContain("1 of 58 rules");
    click(Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Clear all")) ?? null);
    expect(container.querySelectorAll("[data-evidence-map-row]")).toHaveLength(58);
    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    change(search, "Rule Two");
    expect(container.querySelectorAll("[data-evidence-map-row]")).toHaveLength(1);
    expect(container.textContent).toContain("Rule Two");
    change(search, "");
    expect(container.querySelectorAll("[data-evidence-map-row]")).toHaveLength(58);
    act(() => root.unmount());
  });

  test("expands rich and legacy details without attaching component coverage to evidence records", async () => {
    const auditId = "ui-rich"; savePackage(auditId);
    const { container, root } = await renderPage(auditId);
    click(container.querySelector(`[data-evidence-map-row="${auditId}:R-1"] > button`));
    expect(container.textContent).toContain("The implementation plan names the responsible team.");
    expect(container.textContent).toContain("Monitoring occurs every six months.");
    expect(container.textContent).toContain("Projects should implement monitoring.");
    expect(container.textContent).toContain("Generic methodology instruction; it does not describe this project.");
    expect(container.textContent).toContain("implementation");
    expect(container.textContent).toContain("monitoring records");
    expect(container.textContent).toContain("The strongest project-specific passages were retained.");
    expect(container.querySelectorAll('[data-evidence-record="accepted"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-evidence-record="rejected"]')).toHaveLength(1);
    for (const evidence of container.querySelectorAll("[data-evidence-record]")) expect(evidence.querySelector("[data-component-coverage]")).toBeNull();
    act(() => root.unmount());
  });

  test("uses an accessible review panel and the existing reviewer workflow without browser prompts", async () => {
    const promptSpy = jest.spyOn(window, "prompt");
    const auditId = "ui-review"; const rows = makeRows(auditId);
    rows[0] = { ...rows[0], reviewState: "edited", reviewHistory: [{ reviewerIdentity: "reviewer:local", timestamp: "2026-07-11T01:00:00.000Z", reasonOrNote: "Canonical assessment completed.", previousState: "pending review", newState: "edited", presentationContractVersion: "v1", reviewPolicyVersion: "policy-v1" }], assessment: { evidenceMapRowId: rows[0].rowId, rowVersion: 1, applicability: { decision: "APPLICABLE", decisionBasis: "The requirement applies to the project." }, conformance: { requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" }, draftFinding: { draftFindingType: null, findingBasis: null, reviewerAssessment: null }, reviewState: "CURRENT" } };
    savePackage(auditId, rows);
    const truthBefore = loadVm0007EvidenceMapDraft(auditId)?.rows[0];
    const { container, root } = await renderPage(auditId);
    click(container.querySelector(`[data-evidence-map-row="${auditId}:R-1"] > button`));
    click(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Review decision") ?? null);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull(); expect(dialog?.getAttribute("aria-modal")).toBe("true");
    change(dialog?.querySelector<HTMLTextAreaElement>('textarea[placeholder="Why are you making this decision?"]') ?? null, "Evidence and canonical assessment reviewed.");
    click(Array.from(dialog?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Approve row") ?? null);
    const truthAfter = loadVm0007EvidenceMapDraft(auditId)?.rows[0];
    expect(truthAfter?.reviewState).toBe("approved");
    expect(truthAfter?.reviewHistory).toHaveLength(2);
    expect({ status: truthAfter?.rawAuditStatus, confidence: truthAfter?.confidence, applicability: truthAfter?.proposedApplicability, accepted: truthAfter?.acceptedEvidence, rejected: truthAfter?.rejectedEvidence }).toEqual({ status: truthBefore?.rawAuditStatus, confidence: truthBefore?.confidence, applicability: truthBefore?.proposedApplicability, accepted: truthBefore?.acceptedEvidence, rejected: truthBefore?.rejectedEvidence });
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore(); act(() => root.unmount());
  });

  test("reopens a finalized row with a required note while preserving evidence truth and review history", async () => {
    const auditId = "ui-finalized-reopen";
    const finalizedAt = "2026-07-11T03:00:00.000Z";
    const rows = makeRows(auditId).map((row) => ({
      ...row,
      finalizationState: "finalized" as const,
      finalizationActorRef: "reviewer:local",
      finalizedAt,
      finalizationBasis: "Reviewer-approved Evidence Map finalization.",
    }));
    rows[0] = {
      ...rows[0],
      reviewState: "approved",
      reviewHistoryRef: `${auditId}:${rows[0].rowId}:history:2`,
      reviewHistory: [
        { reviewerIdentity: "reviewer:local", timestamp: "2026-07-11T01:00:00.000Z", reasonOrNote: "Canonical assessment completed.", previousState: "pending review", newState: "edited", presentationContractVersion: "v1", reviewPolicyVersion: "policy-v1" },
        { reviewerIdentity: "reviewer:local", timestamp: "2026-07-11T02:00:00.000Z", reasonOrNote: "Evidence and assessment approved.", previousState: "edited", newState: "approved", presentationContractVersion: "v1", reviewPolicyVersion: "policy-v1" },
      ],
      assessment: { evidenceMapRowId: rows[0].rowId, rowVersion: 1, applicability: { decision: "APPLICABLE", decisionBasis: "The requirement applies to the project." }, conformance: { requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" }, draftFinding: { draftFindingType: null, findingBasis: null, reviewerAssessment: null }, reviewState: "CURRENT" },
    };
    expect(saveVm0007EvidenceMapDraft({ auditId, generatedAt: "2026-07-11T00:00:00.000Z", methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8", sourceDocument: rows[0].sourceDocument, proposalState: "MACHINE_PROPOSED", rows, blockedBy: [], contractVersion: "vm0007-evidence-map-draft-v1", finalizationState: "finalized", finalizedBy: "reviewer:local", finalizedAt, finalizationBasis: "Reviewer-approved Evidence Map finalization." } as Vm0007EvidenceMapDraftPackage)).toBe(true);
    const truthBefore = loadVm0007EvidenceMapDraft(auditId)?.rows[0];

    const { container, root } = await renderPage(auditId);
    click(container.querySelector(`[data-evidence-map-row="${auditId}:R-1"] > button`));
    expect(container.textContent).toContain("Latest review activity");
    expect(container.textContent).not.toContain("Review history");
    expect(container.textContent).toContain("2 event(s) · last by reviewer:local");
    expect(container.textContent).toContain("Evidence and assessment approved.");
    click(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "View review decision") ?? null);

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(Array.from(dialog?.querySelectorAll("select, input") ?? []).every((field) => (field as HTMLInputElement | HTMLSelectElement).disabled)).toBe(true);
    expect(dialog?.querySelector<HTMLTextAreaElement>('textarea:not([placeholder])')?.disabled).toBe(true);
    expect(Array.from(dialog?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Save reviewer decision")?.hasAttribute("disabled")).toBe(true);
    expect(Array.from(dialog?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Approve row")?.hasAttribute("disabled")).toBe(true);
    const note = dialog?.querySelector<HTMLTextAreaElement>('textarea[placeholder="Why are you making this decision?"]') ?? null;
    expect(note?.disabled).toBe(false);

    click(Array.from(dialog?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Reopen") ?? null);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Add a review note");
    expect(loadVm0007EvidenceMapDraft(auditId)?.finalizationState).toBe("finalized");
    expect(loadVm0007EvidenceMapDraft(auditId)?.rows[0].reviewHistory).toHaveLength(2);

    change(note, "Reopening to review newly supplied context.");
    click(Array.from(document.querySelectorAll('[role="dialog"] button')).find((button) => button.textContent === "Reopen") ?? null);
    const reopened = loadVm0007EvidenceMapDraft(auditId);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(reopened?.finalizationState).toBe("draft");
    expect(reopened?.rows[0].finalizationState).toBe("draft");
    expect(reopened?.rows[0].reviewState).toBe("reopened");
    expect(reopened?.rows[0].reviewHistory).toHaveLength(3);
    expect(reopened?.rows[0].reviewHistory?.at(-1)).toEqual(expect.objectContaining({ previousState: "approved", newState: "reopened", reasonOrNote: "Reopening to review newly supplied context." }));
    expect(container.textContent).toContain(`Row ${auditId}:R-1 is now reopened.`);
    expect(container.textContent).toContain("Latest review activity");
    expect(container.textContent).toContain("3 event(s) · last by reviewer:local");
    expect(container.textContent).toContain("Reopening to review newly supplied context.");
    expect({ status: reopened?.rows[0].rawAuditStatus, confidence: reopened?.rows[0].confidence, applicability: reopened?.rows[0].proposedApplicability, accepted: reopened?.rows[0].acceptedEvidence, rejected: reopened?.rows[0].rejectedEvidence }).toEqual({ status: truthBefore?.rawAuditStatus, confidence: truthBefore?.confidence, applicability: truthBefore?.proposedApplicability, accepted: truthBefore?.acceptedEvidence, rejected: truthBefore?.rejectedEvidence });
    act(() => root.unmount());
  });
});
