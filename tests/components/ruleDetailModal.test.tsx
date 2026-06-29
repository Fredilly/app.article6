import { describe, expect, it } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import RuleDetailModal from "@/app/m/_components/RuleDetailModal";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";
import {
  createReviewerArtifactContext,
  createVerifierRunBundle,
  persistVerifierRunBundle,
} from "@/lib/verify/runState";
import { saveReview } from "@/lib/verify/reviewStore";

const linkedRow: RequirementCoverageRow = {
  ruleId: "R-1",
  ruleSummary: {
    title: "Monitoring frequency",
    snippet: "Maintain a monitoring report and spreadsheet workbook.",
    summary: "Maintain a monitoring report and spreadsheet workbook.",
    logic: "Maintain a monitoring report and spreadsheet workbook for each reporting period.",
    notes: "Retain the workbook appendices.",
    when: ["Each reporting period."],
    type: "operational",
    tags: ["monitoring"],
  },
  provenance: {
    sectionId: "S-10",
    sectionTitle: "Monitoring",
    page: 12,
    anchor: "#S-10",
    primarySection: "S-10",
    sectionAnchor: "#S-10",
    sectionStableId: "S-10",
    tools: ["UNFCCC/TOOL-1"],
    citations: [{ sectionId: "S-10", label: "Section 10" }],
  },
  expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
  linkedEvidence: [
    { id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "pin" },
    {
      id: "ev-pdd:frag:1",
      title: "Boundary overview",
      type: "PDD",
      source: "inventory",
      evidenceId: "ev-pdd",
      fragmentId: "ev-pdd:frag:1",
      fragmentLabel: "Boundary overview",
      documentLabel: "project-design.pdf",
      pageStart: 4,
      pageEnd: 5,
      sectionLabel: "3.1",
      sectionHeading: "Project boundary",
      excerpt: "The project boundary covers compartments 1 through 4.",
    },
  ],
  candidateEvidence: [],
  status: "linked",
};

const sparseRow: RequirementCoverageRow = {
  ruleId: "R-2",
  ruleSummary: {
    title: "Eligibility boundary",
    snippet: "Document the eligibility boundary for review.",
    type: undefined,
    tags: [],
  },
  provenance: {
    sectionId: "S-4",
    sectionTitle: undefined,
    page: undefined,
    anchor: undefined,
    primarySection: undefined,
    sectionAnchor: undefined,
    sectionStableId: undefined,
    tools: [],
    citations: [],
  },
  expectedEvidenceTypes: ["eligibility-proof"],
  linkedEvidence: [],
  candidateEvidence: [],
  status: "missing",
};

const missingExpectedEvidenceRow: RequirementCoverageRow = {
  ...sparseRow,
  ruleId: "R-3",
  expectedEvidenceTypes: [],
};

const linkedNoExpectedEvidenceRow: RequirementCoverageRow = {
  ...missingExpectedEvidenceRow,
  linkedEvidence: [{ id: "ev-stac-1", title: "Boundary map", type: "STAC item", source: "inventory" }],
  status: "linked",
};

function ensureLocalStorage(): Storage {
  if (typeof localStorage !== "undefined") return localStorage;
  let store: Record<string, string> = {};
  const memoryStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
  (globalThis as unknown as { localStorage: Storage }).localStorage = memoryStorage;
  return memoryStorage;
}

describe("RuleDetailModal", () => {
  it("renders rich rule detail with methodology metadata", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={linkedRow}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-1"
        ruleText="Maintain a monitoring report and spreadsheet workbook."
        ruleLogic="Maintain a monitoring report and spreadsheet workbook for each reporting period."
        ruleNotes="Retain the workbook appendices."
        ruleWhen={["Each reporting period."]}
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath="methodologies/example/rules.rich.json"
        sha256="abc123"
        traceSections={[{ sectionId: "S-10", title: "Monitoring", textSnippet: "Monitoring context" }]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("Rule review");
    expect(html).toContain("Review");
    expect(html).toContain("Rule R-1");
    expect(html).toContain("No judgment recorded yet.");
    expect(html).toContain("UNFCCC Forestry · AR-ACM0003 · v02-0");
    expect(html).toContain("UNFCCC.Forestry.AR-ACM0003.v02-0.R-1");
    expect(html).not.toContain("Rule brief");
    expect(html).toContain("Maintain a monitoring report and spreadsheet workbook.");
    expect(html).toContain("Maintain a monitoring report and spreadsheet workbook for each reporting period.");
    expect(html).toContain("Retain the workbook appendices.");
    expect(html).toContain("Each reporting period.");
    expect(html).toContain("Complete");
    expect(html).toContain("Conditions");
    expect(html).toContain("Methodology provenance");
    expect(html).toContain("Section 10 · Monitoring");
    expect(html).toContain("p. 12");
    expect(html).toContain("Anchor S-10");
    expect(html).toContain("Tools UNFCCC/TOOL-1");
    expect(html).toContain("Reconciliation");
    expect(html).toContain("Partial");
    expect(html).toContain("Missing expected evidence: Spreadsheet workbook.");
    expect(html).toContain("Audit details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("Monitoring report");
    expect(html).toContain("Q1 monitoring report");
    expect(html).toContain("Boundary overview");
    expect(html).toContain("ev-pdd:frag:1");
    expect(html).toContain("project-design.pdf");
    expect(html).toContain("Project boundary");
    expect(html).toContain("The project boundary covers compartments 1 through 4.");
  });

  it("uses only the short rule id in the header title when the rule id is canonical", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={{ ...linkedRow, ruleId: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001" }}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001"
        ruleText="Maintain a monitoring report and spreadsheet workbook."
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath="methodologies/example/rules.rich.json"
        sha256="abc123"
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("Rule R-1-0001");
    expect(html).toContain("UNFCCC Forestry · AR-ACM0003 · v02-0");
    expect(html).toContain("UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001");
    expect(html).not.toContain("Rule UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001");
  });

  it("shows intentional empty states when optional metadata is missing", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={missingExpectedEvidenceRow}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-3"
        ruleText="Document the eligibility boundary for review."
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath={null}
        sha256={null}
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("No expected evidence defined");
    expect(html).toContain("This rule does not specify methodology-owned expected evidence types.");
    expect(html).toContain("Missing evidence");
    expect(html).toContain("No linked evidence for this rule.");
    expect(html).toContain("Next: link supporting evidence or leave a reviewer note.");
    expect(html).toContain("S-4");
  });

  it("keeps unresolved linked-evidence states actionable with sparse provenance", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={sparseRow}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-2"
        ruleText="Document the eligibility boundary for review."
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath={null}
        sha256={null}
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("Eligibility proof");
    expect(html).toContain("Missing evidence");
    expect(html).toContain("Requirement is unresolved. No linked evidence yet.");
    expect(html).toContain("Next: link eligibility proof.");
    expect(html).toContain("S-4");
  });

  it("shows reviewer artifact saved in the current support picture when the saved verify bundle matches the current rule context", () => {
    const storage = ensureLocalStorage();
    storage.clear();
    const bundle = createVerifierRunBundle("AR-ACM0003", "v02-0");
    const reviewerContext = createReviewerArtifactContext({
      methodCode: "AR-ACM0003",
      version: "v02-0",
      ruleId: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-3",
      runId: bundle.runContext.runId,
    });
    persistVerifierRunBundle("AR-ACM0003", "v02-0", {
      ...bundle,
      reviewerContext,
      savedReviewerArtifactContext: reviewerContext,
      savedReviewerArtifactAt: "2026-04-26T01:02:03Z",
      minutes: "Saved reviewer minutes.",
      outcomeNote: "Saved reviewer outcome.",
      draftMinutes: "Saved reviewer minutes.",
      draftOutcomeNote: "Saved reviewer outcome.",
    });

    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={linkedNoExpectedEvidenceRow}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-3"
        ruleText="Document the eligibility boundary for review."
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath={null}
        sha256={null}
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("Current support picture");
    expect(html).toContain("Linked evidence is present and reviewer artifact is saved.");
    expect(html).not.toContain("Linked evidence is present, but no reviewer artifact is saved yet.");
  });

  it("keeps the no-reviewer-artifact message for wrong-rule or unsaved-draft state", () => {
    const storage = ensureLocalStorage();
    storage.clear();
    const bundle = createVerifierRunBundle("AR-ACM0003", "v02-0");
    const wrongRuleContext = createReviewerArtifactContext({
      methodCode: "AR-ACM0003",
      version: "v02-0",
      ruleId: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-999",
      runId: bundle.runContext.runId,
    });
    persistVerifierRunBundle("AR-ACM0003", "v02-0", {
      ...bundle,
      reviewerContext: wrongRuleContext,
      savedReviewerArtifactContext: wrongRuleContext,
      savedReviewerArtifactAt: "2026-04-26T01:02:03Z",
      minutes: "Saved reviewer minutes.",
      outcomeNote: "Saved reviewer outcome.",
      draftMinutes: "Saved reviewer minutes.",
      draftOutcomeNote: "Saved reviewer outcome.",
    });

    const wrongRuleHtml = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={linkedNoExpectedEvidenceRow}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-3"
        ruleText="Document the eligibility boundary for review."
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath={null}
        sha256={null}
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(wrongRuleHtml).toContain("Linked evidence is present, but no reviewer artifact is saved yet.");

    const draftOnlyContext = createReviewerArtifactContext({
      methodCode: "AR-ACM0003",
      version: "v02-0",
      ruleId: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-3",
      runId: bundle.runContext.runId,
    });
    persistVerifierRunBundle("AR-ACM0003", "v02-0", {
      ...bundle,
      reviewerContext: draftOnlyContext,
      savedReviewerArtifactContext: null,
      savedReviewerArtifactAt: null,
      minutes: "",
      outcomeNote: "",
      draftMinutes: "Unsaved draft reviewer minutes.",
      draftOutcomeNote: "Unsaved draft reviewer outcome.",
    });

    const draftOnlyHtml = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={linkedNoExpectedEvidenceRow}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-3"
        ruleText="Document the eligibility boundary for review."
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath={null}
        sha256={null}
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(draftOnlyHtml).toContain("Linked evidence is present, but no reviewer artifact is saved yet.");
    expect(draftOnlyHtml).not.toContain("Linked evidence is present and reviewer artifact is saved.");
  });

  it("shows verified-with-caveats support labels for document-backed VM0007 review records", () => {
    const storage = ensureLocalStorage();
    storage.clear();
    saveReview({
      ruleId: "Verra.AFOLU.VM0007.v1-8.R-1-0001",
      methodology: "VM0007",
      version: "v1-8",
      status: "verified",
      rationale: "Boundary support is acceptable for review.",
      supportReference: "PLUM boundary appendix",
      evidenceAttachments: [],
      reviewedBy: "local-reviewer",
      reviewedAt: "2026-05-24T10:00:00Z",
      updatedAt: "2026-05-24T10:00:00Z",
      reviewerArtifactSavedAt: "2026-05-24T10:05:00Z",
      reviewerMinutes: "Verified against uploaded documents.",
      reviewerOutcomeNote: "Verified with caveats.",
    });

    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={{
          ...linkedNoExpectedEvidenceRow,
          ruleId: "Verra.AFOLU.VM0007.v1-8.R-1-0001",
          linkedEvidence: [
            {
              id: "frag-boundary-1",
              title: "PLUM project area boundary",
              type: "PDD",
              source: "inventory",
              fragmentId: "frag-boundary-1",
              fragmentLabel: "Project area boundary",
              documentLabel: "plum-pdd.pdf",
              sectionHeading: "Project boundary",
            },
            {
              id: "scene-1",
              title: "Sentinel scene 1",
              type: "STAC item",
              source: "pin",
            },
          ],
        }}
        canonicalRuleId="Verra.AFOLU.VM0007.v1-8.R-1-0001"
        ruleText="Document the project boundary for review."
        methodologyLabel="Verra AFOLU · VM0007 · v1-8"
        reviewMethodology="VM0007"
        reviewVersion="v1-8"
        documentSupport={[
          {
            id: "frag-boundary-1",
            kind: "pdd_excerpt",
            source: "plum-pdd.pdf",
            title: "Project area boundary",
            provenance: "plum-pdd.pdf · Project boundary",
            excerpt: "Approximate digitized boundary for project area.",
            ruleLinked: true,
          },
        ]}
        stacSupportState={{
          lookupStatus: "results_available",
          lookupMessage: "1 result available.",
          searchResultCount: 1,
          linkedFacts: [],
          unlinkedFacts: [
            {
              id: "scene-1",
              sourcePinIds: ["pin-1"],
              linkedRuleIds: [],
            },
          ],
          staleFacts: [],
          availableUnlinkedIds: ["scene-1"],
        }}
        sourcePath={null}
        sha256={null}
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("Rule status:</span> Verified");
    expect(html).toContain("Document support:</span> Satisfied");
    expect(html).toContain("Spatial support:</span> Approximate");
    expect(html).toContain("Satellite support:</span> Selected, not interpreted");
    expect(html).toContain("Overall:</span> Verified with caveats");
  });
});
