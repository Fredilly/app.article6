import { describe, expect, it } from "@jest/globals";
import {
  auditEvidence,
  type MethodologyEvidenceAuditRule,
  type MethodologyEvidenceContract,
} from "@/lib/preverif/evidenceAudit";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";

function span(page: number, spanId: string, sectionId: string, text: string): EvidenceSpan {
  return {
    spanId,
    docId: "synthetic-pdd",
    page,
    sectionId,
    heading: "Evidence",
    headingPath: ["Evidence"],
    sectionPath: ["Evidence"],
    blockType: "paragraph",
    text,
    normalizedText: text.toLowerCase(),
    charStart: null,
    charEnd: null,
    reliability: "primary",
    confidence: 1,
  };
}

describe("evidence audit best-candidate coherence", () => {
  it("keeps the preferred best candidate first when accepted candidates have equal scores", () => {
    const rule: MethodologyEvidenceAuditRule = {
      id: "R-TIE-0001",
      title: "Forest qualification",
      summary: "Forest qualification",
      logic: "Forest qualification",
      type: "eligibility",
    };
    const contract: MethodologyEvidenceContract = {
      id: "test:preferred-section-tie",
      label: "Forest qualification",
      methodologyId: "VM0007",
      rulebookVersion: "v1.8",
      pddSectionsToSearch: ["Preferred anchor"],
      strongEvidenceSignals: [],
      weakEvidenceSignals: [],
      rejectSignals: [],
      notApplicableSignals: [],
      defaultGapMessage: "Add forest qualification evidence.",
      clientAction: "Add forest qualification evidence.",
      supportsNotApplicable: false,
    };
    const earlierText = "The project area was measured for forest qualification across all 36 parcels.";
    const preferredText = "The project area was measured for forest qualification.";
    const evidenceDocument: EvidenceDocument = {
      docId: "synthetic-pdd",
      rawText: `${earlierText}
${preferredText}`,
      spans: [
        span(1, "earlier-equal", "section-earlier", earlierText),
        span(2, "preferred-equal", "section-preferred", preferredText),
      ],
    };

    const audit = auditEvidence({
      rules: [rule],
      evidenceDocument,
      getContract: () => contract,
      versionContext: {
        methodologyId: "VM0007",
        rulebookVersion: "v1.8",
        pddDeclaredMethodologyVersion: "v1.8",
      },
      diagnosticTrace: true,
      sections: [
        {
          id: "section-earlier",
          titleRaw: "Evidence",
          titleClean: "Evidence",
          bodyRaw: "",
          bodyClean: "",
        },
        {
          id: "section-preferred",
          titleRaw: "Evidence",
          titleClean: "Evidence",
          bodyRaw: "Preferred anchor",
          bodyClean: "Preferred anchor",
        },
      ],
    });
    const result = audit.results[0];

    expect(audit.diagnosticTrace?.[0]?.selectedCandidates[0]?.spanId).toBe("preferred-equal");
    expect(result.span).toBe("preferred-equal");
    expect(result.page).toBe(2);
    expect(result.bestEvidenceQuote).toBe(preferredText);
    expect(result.evidence?.[0]?.span).toBe("preferred-equal");
    expect(result.evidence?.[0]?.quote).toBe(preferredText);
  });
});
