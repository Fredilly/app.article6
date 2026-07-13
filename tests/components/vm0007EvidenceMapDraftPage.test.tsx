/** @jest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import Vm0007EvidenceMapDraftPage from "@/components/preverif/Vm0007EvidenceMapDraftPage";
import { loadVm0007EvidenceMapDraft, saveVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import type { Vm0007EvidenceMapDraftPackage, Vm0007EvidenceMapDraftRow } from "@/lib/preverif/vm0007EvidenceMapDraft";

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

async function renderPage(auditId: string): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<Vm0007EvidenceMapDraftPage auditId={auditId} />); });
  return { container, root };
}

function click(element: Element | null) { expect(element).not.toBeNull(); act(() => { (element as HTMLElement).click(); }); }
function change(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null, value: string) { expect(element).not.toBeNull(); act(() => { const setter = Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set; setter?.call(element, value); element?.dispatchEvent(new Event("change", { bubbles: true })); element?.dispatchEvent(new Event("input", { bubbles: true })); }); }

afterEach(() => { document.body.innerHTML = ""; window.localStorage.clear(); });

describe("VM0007 Evidence Map review workspace", () => {
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
});
