import { describe, expect, it } from "@jest/globals";
import type {
  RequirementCoverageExpectedEvidenceType,
  RequirementCoverageLinkedEvidence,
} from "@/app/m/_lib/requirementCoverage";
import type { DocumentSupportEntry } from "@/lib/verify/documentSupport";
import { buildReviewSuggestion } from "@/lib/verify/reviewSuggestion";

function buildSuggestion(input: {
  ruleId?: string;
  ruleText: string;
  ruleTags?: string[];
  expectedEvidenceTypes?: RequirementCoverageExpectedEvidenceType[];
  linkedEvidence?: RequirementCoverageLinkedEvidence[];
  documentSupport?: DocumentSupportEntry[];
}) {
  return buildReviewSuggestion({
    ruleId: input.ruleId ?? "R-1",
    ruleText: input.ruleText,
    ruleTags: input.ruleTags ?? [],
    expectedEvidenceTypes: input.expectedEvidenceTypes ?? [],
    linkedEvidence: input.linkedEvidence ?? [],
    documentSupport: input.documentSupport ?? [],
    stacSupportState: null,
  });
}

describe("buildReviewSuggestion", () => {
  it("suggests the best matching baseline fragment from rule text", () => {
    const suggestion = buildSuggestion({
      ruleText: "Baseline land use must be documented for the without-project scenario.",
      ruleTags: ["baseline", "land-use"],
      expectedEvidenceTypes: ["pdd"],
      linkedEvidence: [
        {
          id: "ev-boundary",
          title: "Boundary map",
          type: "GIS map evidence",
          source: "inventory",
        },
      ],
      documentSupport: [
        {
          id: "frag-baseline",
          kind: "pdd_excerpt",
          source: "project-design.pdf",
          title: "B.4 Baseline scenario",
          provenance: "project-design.pdf · B.4 Baseline scenario · p. 14",
          excerpt: "Baseline land use is cropland in the without-project case.",
          ruleLinked: true,
        },
        {
          id: "frag-monitoring",
          kind: "pdd_excerpt",
          source: "project-design.pdf",
          title: "D.1 Monitoring plan",
          provenance: "project-design.pdf · D.1 Monitoring plan · p. 40",
          excerpt: "Monitoring variables are described here.",
          ruleLinked: true,
        },
      ],
    });

    expect(suggestion.suggestedFragment?.label).toBe("B.4 Baseline scenario");
    expect(suggestion.reason).toContain("baseline");
  });

  it("surfaces expected evidence gaps clearly", () => {
    const suggestion = buildSuggestion({
      ruleText: "Monitoring parameters must be evidenced with a report and workbook.",
      ruleTags: ["monitoring", "workbook"],
      expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
      linkedEvidence: [
        {
          id: "ev-report",
          title: "Monitoring report",
          type: "monitoring-report",
          source: "inventory",
        },
      ],
    });

    expect(suggestion.suggestedOutcome).toBe("partial");
    expect(suggestion.missingExpectedEvidence).toEqual(["Spreadsheet workbook"]);
  });

  it("keeps weak PDD-only evidence as partial instead of supported", () => {
    const suggestion = buildSuggestion({
      ruleText: "Monitoring variables must be recorded in the workbook for each sampling period.",
      ruleTags: ["monitoring", "workbook"],
      expectedEvidenceTypes: ["spreadsheet-workbook"],
      linkedEvidence: [
        {
          id: "ev-pdd-frag",
          title: "D.1 Monitoring plan",
          type: "PDD",
          source: "inventory",
          evidenceId: "ev-pdd",
          fragmentId: "frag-d1",
          fragmentLabel: "D.1 Monitoring plan",
          documentLabel: "project-design.pdf",
          provenanceSummary: "project-design.pdf • D.1 Monitoring plan • p. 37",
          excerpt: "The monitoring plan describes variables and reporting frequency.",
        },
      ],
    });

    expect(suggestion.suggestedOutcome).toBe("partial");
    expect(suggestion.mappedReviewStatus).toBe("needs_followup");
    expect(suggestion.whyThisJudgment).toContain("still incomplete");
  });

  it("handles R-1-0007 uncertainty rules conservatively when only the monitoring plan exists", () => {
    const suggestion = buildSuggestion({
      ruleId: "R-1-0007",
      ruleText: "Sampling uncertainty kept below 10% at 90% confidence or conservatively adjusted using Tool 12.",
      ruleTags: ["uncertainty", "monitoring", "sampling"],
      expectedEvidenceTypes: ["monitoring-report", "calculation-support", "spreadsheet-workbook"],
      linkedEvidence: [
        {
          id: "ev-pdd-frag",
          title: "D.1 Monitoring plan",
          type: "PDD",
          source: "inventory",
          evidenceId: "ev-pdd",
          fragmentId: "frag-d1",
          fragmentLabel: "D.1 Monitoring plan",
          documentLabel: "project-design.pdf",
          provenanceSummary: "project-design.pdf • D.1 Monitoring plan • p. 37",
          sectionHeading: "Monitoring plan",
          excerpt: "Sampling procedures and monitoring variables are described for the reporting period.",
        },
      ],
      documentSupport: [
        {
          id: "frag-d1",
          kind: "pdd_excerpt",
          source: "project-design.pdf",
          title: "D.1 Monitoring plan",
          provenance: "project-design.pdf · D.1 Monitoring plan · p. 37",
          excerpt: "Sampling procedures and monitoring variables are described for the reporting period.",
          ruleLinked: true,
        },
      ],
    });

    expect(suggestion.suggestedOutcome).toBe("partial");
    expect(suggestion.suggestedFragment?.label).toBe("D.1 Monitoring plan");
    expect(suggestion.missingExpectedEvidence).toEqual(
      expect.arrayContaining([
        "90% confidence result",
        "Tool 12 deduction record, if threshold exceeded",
        "Spreadsheet workbook",
        "uncertainty worksheet",
        "sampling calculation",
      ]),
    );
    expect(suggestion.whyThisJudgment).toContain("does not prove the uncertainty calculation");
  });
});
