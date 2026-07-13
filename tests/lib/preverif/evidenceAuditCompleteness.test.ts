import { auditEvidence, type MethodologyEvidenceContract } from "@/lib/preverif/evidenceAudit";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";

const baseContract: MethodologyEvidenceContract = {
  id: "test",
  label: "test requirement",
  methodologyId: "TEST",
  rulebookVersion: "v1",
  pddSectionsToSearch: ["Project evidence"],
  strongEvidenceSignals: ["project implementation"],
  weakEvidenceSignals: [],
  rejectSignals: ["methodology requires"],
  notApplicableSignals: [],
  defaultGapMessage: "Add project evidence.",
  clientAction: "Add project evidence.",
  supportsNotApplicable: false,
};

function span(text: string, overrides: Partial<EvidenceSpan> = {}): EvidenceSpan {
  return {
    spanId: "test:span",
    docId: "test",
    page: 1,
    headingPath: ["Project evidence"],
    sectionPath: ["Project evidence"],
    blockType: "paragraph",
    text,
    normalizedText: text.toLowerCase(),
    charStart: null,
    charEnd: null,
    reliability: "primary",
    confidence: 1,
    ...overrides,
  };
}

function audit(text: string, contract: MethodologyEvidenceContract = baseContract, overrides?: Partial<EvidenceSpan>) {
  const evidenceDocument: EvidenceDocument = {
    docId: "test",
    rawText: text,
    spans: [span(text, overrides)],
  };
  return auditEvidence({
    rules: [{ id: "R-1", title: "test requirement", logic: "project implementation" }],
    evidenceDocument,
    getContract: () => contract,
    versionContext: { methodologyId: "TEST", rulebookVersion: "v1", pddDeclaredMethodologyVersion: "v1" },
  }).results[0];
}

describe("generic evidence applicability and completeness contract", () => {
  it("rejects methodology boilerplate and preserves the diagnostic", () => {
    const result = audit("The methodology requires project implementation for all activities.");
    expect(result.status).not.toBe("supported_by_pdd");
    expect(result.rejectedEvidence?.[0]).toEqual(expect.objectContaining({ evidenceType: "methodology_boilerplate" }));
    expect(result.rejectedEvidence?.[0]?.rejectionReason).toMatch(/copied methodology|project-specific/i);
  });

  it("does not treat a module or tool declaration as implementation", () => {
    const result = audit("The project selected module M and tool T for the project pathway.");
    expect(result.status).not.toBe("supported_by_pdd");
    expect(result.rejectedEvidence?.[0]?.evidenceType).toBe("module_or_tool_declaration");
  });

  it("rejects truncated or stitched evidence", () => {
    const result = audit("The project measured the variables and calculated the result …", undefined, { noise: ["source-caption"] });
    expect(result.status).not.toBe("supported_by_pdd");
    expect(result.rejectedEvidence?.[0]?.evidenceType).toBe("incomplete_or_noisy");
  });

  it("resolves applicability before judging evidence", () => {
    const contract = {
      ...baseContract,
      supportsNotApplicable: true,
      notApplicableSignals: ["project is not wetland"],
    };
    const result = audit("The project implementation is documented.", contract);
    expect(result.status).toBe("manual_review_needed");
    expect(result.assessmentReason).toMatch(/scope|applicability/i);
  });

  it("keeps a multi-component rule partial when one component is missing", () => {
    const contract = {
      ...baseContract,
      mandatoryComponents: [
        { id: "equation", description: "Equation", signals: ["equation"] },
        { id: "inputs", description: "Inputs", signals: ["inputs"] },
        { id: "result", description: "Result", signals: ["result"] },
      ],
    };
    const result = audit("The project calculated the equation using project inputs.", contract);
    expect(result.status).toBe("partially_supported");
    expect(result.assessmentReason).toContain("result");
  });

  it("returns supported only when every mandatory component has project implementation evidence", () => {
    const contract = {
      ...baseContract,
      mandatoryComponents: [
        { id: "equation", description: "Equation", signals: ["equation"] },
        { id: "inputs", description: "Inputs", signals: ["inputs"] },
        { id: "result", description: "Result", signals: ["result"] },
      ],
    };
    const result = audit("The project calculated the equation using project inputs and documented the result.", contract);
    expect(result.status).toBe("supported_by_pdd");
  });

  it("keeps legitimate project findings supported and N/A stable", () => {
    expect(audit("The project area qualifies as forest and is eligible.", {
      ...baseContract,
      strongEvidenceSignals: ["project area qualifies as forest", "forest"],
    }).status).toBe("supported_by_pdd");
    const naContract = {
      ...baseContract,
      supportsNotApplicable: true,
      notApplicableSignals: ["project is not wetland"],
    };
    expect(audit("The project is not wetland.", naContract).status).toBe("not_applicable");
  });
});
