import fs from "node:fs";
import path from "node:path";

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

  it("requires configured applicability context for JNR-style exclusions", () => {
    const jnrContract = {
      ...baseContract,
      supportsNotApplicable: true,
      notApplicableSignals: ["not applicable"],
      applicability: {
        exclusionSignals: ["not applicable", "does not use JNR data"],
        contextSignals: ["JNR data", "project activity"],
        requireProjectSpecificContext: true,
      },
    };
    expect(audit("Not applicable.", jnrContract).status).not.toBe("not_applicable");
    expect(audit("The project activity does not use JNR data; JNR data is not applicable to this project.", jnrContract).status).toBe("not_applicable");
    expect(audit("The methodology describes JNR data applicability conditions and required sources.", jnrContract).status).not.toBe("not_applicable");
    const engineSource = fs.readFileSync(path.join(process.cwd(), "src/lib/preverif/evidenceAudit.ts"), "utf8");
    expect(engineSource).not.toContain("family:jnr-data-use");
  });

  it("does not apply a project-specific scope exclusion to an unrelated rule subject", () => {
    const contract = {
      ...baseContract,
      label: "Pool and source selection",
      supportsNotApplicable: true,
      notApplicableSignals: [
        "A pool or source is excluded because the project activity does not create that pathway",
        "The project scope excludes the wetland or tidal activity that would trigger the pool or source",
      ],
      applicability: {
        exclusionSignals: [
          "A pool or source is excluded because the project activity does not create that pathway",
          "The project scope excludes the wetland or tidal activity that would trigger the pool or source",
        ],
        contextSignals: [],
        requireProjectSpecificContext: true,
        requireRuleSubjectAlignment: true,
      },
    };
    const scopeEvidence = "There is no peat soil or tidal wetland in the project area.";
    const evidenceDocument: EvidenceDocument = {
      docId: "test",
      rawText: scopeEvidence,
      spans: [span(scopeEvidence)],
    };
    const result = auditEvidence({
      rules: [{
        id: "R-POOL",
        title: "Mandatory aboveground biomass pool",
        logic: "Aboveground biomass is always mandatory and must be included consistently in baseline and project accounting.",
      }],
      evidenceDocument,
      getContract: () => contract,
      versionContext: { methodologyId: "TEST", rulebookVersion: "v1", pddDeclaredMethodologyVersion: "v1" },
    }).results[0];

    expect(result.status).not.toBe("not_applicable");
  });

  it("does not let an exact exclusion phrase bypass required rule-subject alignment", () => {
    const exactExclusion = "The project activity does not include tidal wetland.";
    const contract = {
      ...baseContract,
      label: "Pool and source selection",
      supportsNotApplicable: true,
      notApplicableSignals: [exactExclusion],
      applicability: {
        exclusionSignals: [exactExclusion],
        contextSignals: [],
        requireProjectSpecificContext: true,
        requireRuleSubjectAlignment: true,
      },
    };
    const evidenceDocument: EvidenceDocument = {
      docId: "test",
      rawText: exactExclusion,
      spans: [span(exactExclusion)],
    };
    const result = auditEvidence({
      rules: [{
        id: "generic-biomass-rule",
        title: "Mandatory aboveground biomass pool",
        logic: "Aboveground biomass must be included consistently in baseline and project accounting.",
      }],
      evidenceDocument,
      getContract: () => contract,
      versionContext: { methodologyId: "TEST", rulebookVersion: "v1", pddDeclaredMethodologyVersion: "v1" },
    }).results[0];

    expect(result.status).not.toBe("not_applicable");
  });

  it("retains N/A when the exclusion addresses the rule subject", () => {
    const contract = {
      ...baseContract,
      label: "Wetland soil carbon pool",
      supportsNotApplicable: true,
      notApplicableSignals: [
        "The project scope excludes the wetland or tidal activity that would trigger the soil carbon pool",
      ],
      applicability: {
        exclusionSignals: [
          "The project scope excludes the wetland or tidal activity that would trigger the soil carbon pool",
        ],
        contextSignals: [],
        requireProjectSpecificContext: true,
        requireRuleSubjectAlignment: true,
      },
    };
    const scopeEvidence = "There is no peat soil or tidal wetland in the project area.";
    const evidenceDocument: EvidenceDocument = {
      docId: "test",
      rawText: scopeEvidence,
      spans: [span(scopeEvidence)],
    };
    const result = auditEvidence({
      rules: [{
        id: "R-WETLAND-SOIL",
        title: "Wetland soil carbon pool",
        logic: "The wetland soil carbon pool applies to peat or tidal wetland activities.",
      }],
      evidenceDocument,
      getContract: () => contract,
      versionContext: { methodologyId: "TEST", rulebookVersion: "v1", pddDeclaredMethodologyVersion: "v1" },
    }).results[0];

    expect(result.status).toBe("not_applicable");
  });

  it("keeps scalar provenance aligned with accepted evidence", () => {
    const evidenceDocument: EvidenceDocument = {
      docId: "test",
      rawText: "methodology project implementation",
      spans: [
        span("The methodology requires project implementation.", { spanId: "rejected", page: 1 }),
        span("The project implementation was completed for the project area.", { spanId: "accepted", page: 9, heading: "Implementation", sectionId: "S-9" }),
      ],
    };
    const result = auditEvidence({
      rules: [{ id: "R-1", title: "test requirement", logic: "project implementation" }],
      evidenceDocument,
      getContract: () => baseContract,
      versionContext: { methodologyId: "TEST", rulebookVersion: "v1", pddDeclaredMethodologyVersion: "v1" },
    }).results[0];
    expect(result.bestEvidenceQuote).toBe(result.evidence?.[0]?.quote);
    expect({ page: result.page, section: result.section, span: result.span }).toEqual({ page: 9, section: "Implementation", span: "accepted" });
  });

  it("clears scalar provenance when no accepted evidence exists", () => {
    const result = audit("No relevant project evidence is present.", undefined, { spanId: "missing", page: 4 });
    expect(result.status).toBe("missing_evidence");
    expect(result.bestEvidenceQuote).toBeNull();
    expect(result.evidence).toEqual([]);
    expect({ page: result.page, section: result.section, span: result.span }).toEqual({ page: null, section: null, span: null });
    expect(result.rejectedEvidence?.[0]?.span).toBe("missing");
  });
});
