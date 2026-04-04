import {
  buildRequirementCoverageRows,
  REQUIREMENT_COVERAGE_STATUSES,
  requirementProvenanceHint,
  summarizeExpectedEvidence,
  summarizeLinkedEvidence,
} from "@/app/m/_lib/requirementCoverage";
import type { RuleSummary } from "@/app/m/_lib/methodRules";
import type { EvidenceInventoryItem } from "@/lib/evidence/inventory";

describe("buildRequirementCoverageRows", () => {
  test("builds deterministic requirement coverage rows with provenance and expected evidence", () => {
    const rules: RuleSummary[] = [
      {
        id: "R-1",
        title: "Monitoring frequency",
        snippet: "Maintain a monitoring report and spreadsheet workbook.",
        text: "Maintain a monitoring report and spreadsheet workbook for each reporting period.",
        summary: "Maintain a monitoring report and spreadsheet workbook.",
        logic: "Maintain a monitoring report and spreadsheet workbook for each reporting period.",
        notes: "Retain the workbook appendices.",
        when: ["Each reporting period."],
        expectedEvidence: ["monitoring-report", "spreadsheet-workbook"],
        tags: ["monitoring"],
        type: "operational",
        sectionId: "S-10",
        anchor: "#S-10",
        citations: [{ sectionId: "S-10", label: "Section 10" }],
        refs: {
          primarySection: "S-10",
          sectionAnchor: "#S-10",
          sectionStableId: "S-10",
          sections: ["S-10"],
          tools: ["UNFCCC/TOOL-1"],
        },
      },
      {
        id: "R-2",
        title: "Eligibility boundary",
        snippet: "Document eligibility and ownership evidence.",
        text: "Document eligibility and ownership evidence.",
        tags: [],
      },
    ];

    const rows = buildRequirementCoverageRows({
      rules,
      sectionTitleById: new Map([["S-10", "Monitoring"]]),
      linkedEvidenceByRuleId: new Map([
        [
          "R-1",
          [
            { id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "inventory" },
            { id: "ev-2", title: "Workbook tab A", type: "spreadsheet-workbook", source: "inventory" },
          ],
        ],
      ]),
      statusesByRuleId: new Map([["R-2", "needs-review"]]),
    });

    expect(rows).toEqual([
      {
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
          page: undefined,
          anchor: "#S-10",
          primarySection: "S-10",
          sectionAnchor: "#S-10",
          sectionStableId: "S-10",
          tools: ["UNFCCC/TOOL-1"],
          citations: [{ sectionId: "S-10", label: "Section 10" }],
        },
        expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
        linkedEvidence: [
          { id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "inventory" },
          { id: "ev-2", title: "Workbook tab A", type: "spreadsheet-workbook", source: "inventory" },
        ],
        candidateEvidence: [],
        status: "linked",
      },
      {
        ruleId: "R-2",
        ruleSummary: {
          title: "Eligibility boundary",
          snippet: "Document eligibility and ownership evidence.",
          summary: undefined,
          logic: undefined,
          notes: undefined,
          when: [],
          type: undefined,
          tags: [],
        },
        provenance: {
          sectionId: undefined,
          sectionTitle: undefined,
          page: undefined,
          anchor: undefined,
          primarySection: undefined,
          sectionAnchor: undefined,
          sectionStableId: undefined,
          tools: [],
          citations: [],
        },
        expectedEvidenceTypes: [],
        linkedEvidence: [],
        candidateEvidence: [],
        status: "needs-review",
      },
    ]);
  });

  test("exposes the supported status vocabulary", () => {
    expect(REQUIREMENT_COVERAGE_STATUSES).toEqual(["missing", "partial", "linked", "needs-review"]);
  });

  test("keeps expected evidence empty when optional metadata is absent", () => {
    const rows = buildRequirementCoverageRows({
      rules: [
        {
          id: "R-3",
          title: "General requirement",
          snippet: "Keep records available for review.",
          tags: [],
        },
      ],
    });

    expect(rows[0]?.expectedEvidenceTypes).toEqual([]);
    expect(rows[0]?.linkedEvidence).toEqual([]);
    expect(rows[0]?.candidateEvidence).toEqual([]);
    expect(rows[0]?.status).toBe("missing");
  });

  test("formats reviewer-facing summaries for sparse metadata safely", () => {
    const rows = buildRequirementCoverageRows({
      rules: [
        {
          id: "R-9",
          title: "Sparse requirement",
          snippet: "Keep records available for review.",
          tags: [],
        },
      ],
    });

    expect(summarizeExpectedEvidence(rows[0]?.expectedEvidenceTypes ?? [])).toBe("No expected evidence defined for this rule.");
    expect(summarizeLinkedEvidence(rows[0]?.linkedEvidence ?? [])).toBe("No linked evidence yet");
    expect(requirementProvenanceHint(rows[0]!)).toBe("Provenance pending");
  });

  test("maps linked PDD fragments into requirement-row provenance", () => {
    const inventoryItems: EvidenceInventoryItem[] = [
      {
        evidence_id: "ev-pdd",
        dedupe_key: "attachment:sha-pdd",
        display_name: "project-design.pdf",
        kind: "pdd",
        type: "PDD",
        source_summary: "PDD upload",
        provenance_summary: "project-design.pdf • 1 fragment",
        added_at: "2026-03-03T00:00:00Z",
        link_state: "linked",
        linked_requirement_ids: ["R-2"],
        pdd_document: {
          evidence_id: "ev-pdd",
          attachment_id: "att-pdd",
          file_name: "project-design.pdf",
          mime: "application/pdf",
          added_at: "2026-03-03T00:00:00Z",
          sha256: "sha-pdd",
        },
        pdd_fragments: [
          {
            fragment_id: "ev-pdd:frag:1",
            evidence_id: "ev-pdd",
            page_start: 7,
            page_end: 8,
            section_label: "2.3",
            section_heading: "Project design",
            excerpt: "The project uses grouped activity boundaries.",
          },
        ],
        pdd_fragment_links: [
          { fragment_id: "ev-pdd:frag:1", rule_id: "R-2", linked_at: "2026-03-03T00:00:00Z" },
        ],
      },
    ];

    const rows = buildRequirementCoverageRows({
      rules: [{ id: "R-2", title: "Project design", snippet: "Maintain PDD evidence.", tags: [] }],
      inventoryItems,
    });

    expect(rows[0]?.linkedEvidence).toEqual([
      {
        id: "ev-pdd:frag:1",
        evidenceId: "ev-pdd",
        fragmentId: "ev-pdd:frag:1",
        title: "project-design.pdf",
        type: "PDD",
        source: "inventory",
        provenanceSummary: "project-design.pdf • Project design • p. 7-8",
        documentLabel: "project-design.pdf",
        pageStart: 7,
        pageEnd: 8,
        sectionLabel: "2.3",
        sectionHeading: "Project design",
        excerpt: "The project uses grouped activity boundaries.",
      },
    ]);
    expect(summarizeLinkedEvidence(rows[0]?.linkedEvidence ?? [])).toBe(
      "project-design.pdf (PDD • project-design.pdf • Project design • p. 7-8)",
    );
  });
});
