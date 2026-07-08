import { describe, expect, it } from "@jest/globals";
import { buildQuickCheckEvidenceStackDisplay } from "@/lib/quickCheckV2/evidenceStackAdapter";
import { buildQuickCheckEvidenceStackWithCompanions } from "@/lib/quickCheckV2/evidenceStackProducer";
import type {
  QuickCheckV2Block,
  QuickCheckV2ExtractedDocument,
  RetrievedCheckEvidence,
} from "@/lib/quickCheckV2/evidence";
import { validateAnswerResult } from "@/lib/quickCheckV2/status";

function makeDocument(blocks: QuickCheckV2Block[]): QuickCheckV2ExtractedDocument {
  return {
    documentId: "synthetic-doc",
    parser: "test",
    blocks,
    diagnostics: {
      warnings: [],
      pageCount: 5,
    },
  };
}

function makeSelectedEvidence(
  checkName: RetrievedCheckEvidence["checkName"],
  evidence: RetrievedCheckEvidence["evidence"],
): RetrievedCheckEvidence {
  return { checkName, evidence };
}

describe("Quick Check v2 evidence stack producer", () => {
  it("keeps the primary-only stack unchanged when no companion evidence exists", () => {
    const document = makeDocument([
      {
        spanId: "synthetic-doc:p1:b1",
        page: 1,
        text: "Alternative A - Clearing of Forest and Conversion to Agriculture - is selected as the baseline scenario.",
        blockType: "body",
        sectionHeading: "Additionality Methods",
        sectionPath: ["3", "3.1.5"],
        source: "primary",
      },
    ]);

    const stack = buildQuickCheckEvidenceStackWithCompanions(
      document,
      makeSelectedEvidence("additionality", {
        sourceType: "exact_section",
        quote: "Alternative A - Clearing of Forest and Conversion to Agriculture - is selected as the baseline scenario.",
        page: 1,
        sectionHeading: "Additionality Methods",
        sectionPath: ["3", "3.1.5"],
        spanId: "synthetic-doc:p1:b1",
      }),
    );

    expect(stack).toHaveLength(1);
    expect(stack[0]).toMatchObject({
      role: "primary",
      page: 1,
      quote: "Alternative A - Clearing of Forest and Conversion to Agriculture - is selected as the baseline scenario.",
      sectionHeading: "Additionality Methods",
      sectionPath: ["3", "3.1.5"],
      spanId: "synthetic-doc:p1:b1",
      sourceType: "exact_section",
    });
  });

  it("adds a baseline blocker after the primary citation when the formal section is under development", () => {
    const document = makeDocument([
      {
        spanId: "synthetic-doc:p2:b1",
        page: 2,
        text: "The baseline is defined as continuation of grazing without the project.",
        blockType: "body",
        sectionHeading: "Most-Likely Scenario Justification",
        sectionPath: ["2", "2.4"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p4:b1",
        page: 4,
        text: "This section is under development.",
        blockType: "body",
        sectionHeading: "Baseline Scenario",
        sectionPath: ["3", "3.13"],
        source: "primary",
      },
    ]);

    const stack = buildQuickCheckEvidenceStackWithCompanions(
      document,
      makeSelectedEvidence("baseline_scenario", {
        sourceType: "exact_section",
        quote: "The baseline is defined as continuation of grazing without the project.",
        page: 2,
        sectionHeading: "Most-Likely Scenario Justification",
        sectionPath: ["2", "2.4"],
        spanId: "synthetic-doc:p2:b1",
      }),
    );

    expect(stack.map((item) => item.role)).toStrictEqual(["primary", "blocker"]);
    expect(stack[1]).toMatchObject({
      page: 4,
      quote: "This section is under development.",
      label: "Formal baseline section incomplete",
    });
  });

  it("does not let a baseline blocker upgrade the result to FOUND without a primary citation", () => {
    const result = validateAnswerResult({
      checkName: "baseline_scenario",
      answer: "Baseline scenario is under development.",
      evidence: {
        sourceType: "exact_section",
        quote: "This section is under development.",
        page: 4,
        sectionHeading: "Baseline Scenario",
        sectionPath: ["3", "3.13"],
        spanId: "synthetic-doc:p4:b1",
      },
      evidenceStack: [
        {
          role: "blocker",
          page: 4,
          quote: "This section is under development.",
          sectionHeading: "Baseline Scenario",
          sectionPath: ["3", "3.13"],
          spanId: "synthetic-doc:p4:b1",
          sourceType: "exact_section",
          label: "Formal baseline section incomplete",
        },
      ],
    });

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("provenance_incomplete");
  });

  it("adds an additionality caveat when the formal section is incomplete", () => {
    const document = makeDocument([
      {
        spanId: "synthetic-doc:p2:b1",
        page: 2,
        text: "No government program, private organization, or community initiative currently possesses the capacity to implement these activities.",
        blockType: "body",
        sectionHeading: "Without-project Narrative",
        sectionPath: ["2", "2.2"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p5:b1",
        page: 5,
        text: "This section is under development.",
        blockType: "body",
        sectionHeading: "Additionality Methods",
        sectionPath: ["3", "3.14"],
        source: "primary",
      },
    ]);

    const stack = buildQuickCheckEvidenceStackWithCompanions(
      document,
      makeSelectedEvidence("additionality", {
        sourceType: "exact_section",
        quote: "No government program, private organization, or community initiative currently possesses the capacity to implement these activities.",
        page: 2,
        sectionHeading: "Without-project Narrative",
        sectionPath: ["2", "2.2"],
        spanId: "synthetic-doc:p2:b1",
      }),
    );

    expect(stack.map((item) => item.role)).toStrictEqual(["primary", "caveat"]);
    expect(stack[1]).toMatchObject({
      label: "Formal additionality section incomplete",
      reason: "Formal additionality section is incomplete at the Under Development stage.",
    });
  });

  it("adds leakage caveat and blocker companions for incomplete formal leakage sections", () => {
    const document = makeDocument([
      {
        spanId: "synthetic-doc:p2:b1",
        page: 2,
        text: "Leakage emissions are estimated using VMD0009 LK-ASP.",
        blockType: "body",
        sectionHeading: "Leakage Emissions",
        sectionPath: ["4", "4.3"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p3:b1",
        page: 3,
        text: "This section is under development.",
        blockType: "body",
        sectionHeading: "Leakage Management",
        sectionPath: ["3", "3.15"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p4:b1",
        page: 4,
        text: "This section is not required at the Under Development stage.",
        blockType: "body",
        sectionHeading: "Leakage Emissions",
        sectionPath: ["4", "4.3"],
        source: "primary",
      },
    ]);

    const stack = buildQuickCheckEvidenceStackWithCompanions(
      document,
      makeSelectedEvidence("leakage", {
        sourceType: "exact_section",
        quote: "Leakage emissions are estimated using VMD0009 LK-ASP.",
        page: 2,
        sectionHeading: "Leakage Emissions",
        sectionPath: ["4", "4.3"],
        spanId: "synthetic-doc:p2:b1",
      }),
    );

    expect(stack.map((item) => item.role)).toStrictEqual(["primary", "caveat", "blocker"]);
  });

  it("adds stakeholder supporting evidence for consent, approvals, assemblies, and follow-up records", () => {
    const document = makeDocument([
      {
        spanId: "synthetic-doc:p1:b1",
        page: 1,
        text: "Public consultations were held with community representatives.",
        blockType: "body",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p1:b2",
        page: 1,
        text: "Formal consent was obtained during the FPIC Principal Assembly.",
        blockType: "body",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p2:b1",
        page: 2,
        text: "Follow-up meetings recorded approvals and actions taken.",
        blockType: "body",
        sectionHeading: "Stakeholder Comments",
        sectionPath: ["2", "2.3.11"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p3:b1",
        page: 3,
        text: "A community assembly approved the consultation outcomes.",
        blockType: "body",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        source: "primary",
      },
    ]);

    const stack = buildQuickCheckEvidenceStackWithCompanions(
      document,
      makeSelectedEvidence("stakeholder_consultation", {
        sourceType: "exact_section",
        quote: "Public consultations were held with community representatives.",
        page: 1,
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        spanId: "synthetic-doc:p1:b1",
      }),
    );

    expect(stack.map((item) => item.role)).toStrictEqual(["primary", "supporting", "supporting", "supporting"]);
    expect(stack.slice(1).every((item) => item.label === "Supporting stakeholder evidence")).toBe(true);
    expect(stack.slice(1).map((item) => item.page)).toStrictEqual([1, 2, 3]);
  });

  it("caps stakeholder supporting companions at three after dedupe", () => {
    const document = makeDocument([
      {
        spanId: "synthetic-doc:p1:b1",
        page: 1,
        text: "Public consultations were held with community representatives.",
        blockType: "body",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p1:b2",
        page: 1,
        text: "Formal consent was obtained during the FPIC Principal Assembly.",
        blockType: "body",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p2:b1",
        page: 2,
        text: "Follow-up meetings recorded approvals and actions taken.",
        blockType: "body",
        sectionHeading: "Stakeholder Comments",
        sectionPath: ["2", "2.3.11"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p3:b1",
        page: 3,
        text: "A community assembly approved the consultation outcomes.",
        blockType: "body",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p4:b1",
        page: 4,
        text: "The community approved the revised plan at a meeting.",
        blockType: "body",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        source: "primary",
      },
    ]);

    const stack = buildQuickCheckEvidenceStackWithCompanions(
      document,
      makeSelectedEvidence("stakeholder_consultation", {
        sourceType: "exact_section",
        quote: "Public consultations were held with community representatives.",
        page: 1,
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        spanId: "synthetic-doc:p1:b1",
      }),
    );

    expect(stack.map((item) => item.role)).toStrictEqual(["primary", "supporting", "supporting", "supporting"]);
    expect(stack).toHaveLength(4);
    expect(stack.slice(1).map((item) => item.page)).toStrictEqual([1, 2, 3]);
  });

  it("deduplicates companions that point to the same span as the primary evidence", () => {
    const document = makeDocument([
      {
        spanId: "synthetic-doc:p1:b1",
        page: 1,
        text: "Formal consent was obtained during the FPIC Principal Assembly.",
        blockType: "body",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        source: "primary",
      },
    ]);

    const stack = buildQuickCheckEvidenceStackWithCompanions(
      document,
      makeSelectedEvidence("stakeholder_consultation", {
        sourceType: "exact_section",
        quote: "Formal consent was obtained during the FPIC Principal Assembly.",
        page: 1,
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        spanId: "synthetic-doc:p1:b1",
      }),
    );

    expect(stack).toHaveLength(1);
    expect(stack[0]?.role).toBe("primary");
  });

  it("only emits companions with valid page numbers and quotes", () => {
    const document = makeDocument([
      {
        spanId: "synthetic-doc:p1:b1",
        page: 1,
        text: "Leakage emissions are estimated using VMD0009 LK-ASP.",
        blockType: "body",
        sectionHeading: "Leakage Emissions",
        sectionPath: ["4", "4.3"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p0:b1",
        page: 0,
        text: "This section is under development.",
        blockType: "body",
        sectionHeading: "Leakage Emissions",
        sectionPath: ["4", "4.3"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p2:b1",
        page: 2,
        text: "   ",
        blockType: "body",
        sectionHeading: "Leakage Emissions",
        sectionPath: ["4", "4.3"],
        source: "primary",
      },
    ]);

    const stack = buildQuickCheckEvidenceStackWithCompanions(
      document,
      makeSelectedEvidence("leakage", {
        sourceType: "exact_section",
        quote: "Leakage emissions are estimated using VMD0009 LK-ASP.",
        page: 1,
        sectionHeading: "Leakage Emissions",
        sectionPath: ["4", "4.3"],
        spanId: "synthetic-doc:p1:b1",
      }),
    );

    expect(stack).toHaveLength(1);
  });

  it("keeps caveat and blocker labels visible in the formatted display", () => {
    const document = makeDocument([
      {
        spanId: "synthetic-doc:p1:b1",
        page: 1,
        text: "No government program, private organization, or community initiative currently possesses the capacity to implement these activities.",
        blockType: "body",
        sectionHeading: "Without-project Narrative",
        sectionPath: ["2", "2.2"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p5:b1",
        page: 5,
        text: "This section is under development.",
        blockType: "body",
        sectionHeading: "Additionality Methods",
        sectionPath: ["3", "3.14"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p6:b1",
        page: 6,
        text: "This section is not required at the Under Development stage.",
        blockType: "body",
        sectionHeading: "Additionality Methods",
        sectionPath: ["3", "3.14"],
        source: "primary",
      },
    ]);

    const stack = buildQuickCheckEvidenceStackWithCompanions(
      document,
      makeSelectedEvidence("additionality", {
        sourceType: "exact_section",
        quote: "No government program, private organization, or community initiative currently possesses the capacity to implement these activities.",
        page: 1,
        sectionHeading: "Without-project Narrative",
        sectionPath: ["2", "2.2"],
        spanId: "synthetic-doc:p1:b1",
      }),
    );
    const display = buildQuickCheckEvidenceStackDisplay(stack);

    expect(display.find((item) => item.role === "caveat")?.label).toBe("Formal additionality section incomplete");
    expect(display.find((item) => item.role === "blocker")?.label).toBe("Formal additionality section incomplete");
  });
});
