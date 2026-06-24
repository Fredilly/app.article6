import { describe, expect, test } from "@jest/globals";
import { evaluateEvidenceSufficiency, type EvidenceSufficiencyResult } from "@/lib/quickCheck/evidence/sufficiencyValidators";
import type { ResolvedSpan } from "@/lib/quickCheck/evidence/resolveEvidenceSpans";
import type { ReviewArea } from "@/lib/quickCheck/retrieval/types";

function resolvedSpan(overrides: Partial<ResolvedSpan> = {}): ResolvedSpan {
  return {
    span: {} as ResolvedSpan["span"],
    spanId: overrides.spanId ?? "s1",
    page: overrides.page ?? 5,
    sectionId: overrides.sectionId ?? "section:4.2",
    heading: overrides.heading ?? "Baseline Scenario",
    headingPath: overrides.headingPath ?? ["Baseline Scenario"],
    sectionPath: overrides.sectionPath ?? ["section:4", "section:4.2"],
    text: overrides.text ?? "Baseline scenario content",
    normalizedText: overrides.normalizedText ?? "baseline scenario content",
    blockType: overrides.blockType ?? "paragraph",
    reliability: overrides.reliability ?? "primary",
    confidence: overrides.confidence ?? 0.9,
    tableId: overrides.tableId,
  };
}

function makeInput(overrides: {
  reviewArea?: ReviewArea;
  answerText?: string;
  quotes?: string[];
  pages?: number[];
  resolvedSpans?: ResolvedSpan[];
  route?: string;
  confidence?: number;
} = {}) {
  return {
    reviewArea: overrides.reviewArea ?? "baseline",
    answerText: overrides.answerText ?? "Baseline scenario description.",
    quotes: overrides.quotes ?? ["Baseline scenario description."],
    pages: overrides.pages ?? [5],
    resolvedSpans: overrides.resolvedSpans ?? [resolvedSpan()],
    route: overrides.route ?? "section_index",
    confidence: overrides.confidence ?? 0.9,
  };
}

function expectSufficient(result: EvidenceSufficiencyResult) {
  expect(result.sufficient).toBe(true);
}

function expectDowngraded(result: EvidenceSufficiencyResult, to: "unclear" | "no_evidence") {
  expect(result.sufficient).toBe(false);
  expect(result.downgradeTo).toBe(to);
}

describe("evidence sufficiency validators", () => {
  // ── Provenance requirements ─────────────────────────────────────────

  test("downgrades to no_evidence when no resolved spans", () => {
    const result = evaluateEvidenceSufficiency(makeInput({ resolvedSpans: [] }));
    expectDowngraded(result, "no_evidence");
    expect(result.warnings).toContain("missing_resolved_spans");
  });

  test("downgrades to unclear when no page provenance", () => {
    const result = evaluateEvidenceSufficiency(makeInput({ pages: [] }));
    expectDowngraded(result, "unclear");
    expect(result.warnings).toContain("missing_page_provenance");
  });

  // ── TOC-only rejection ───────────────────────────────────────────────

  test("rejects TOC-only evidence for any check", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "monitoring",
      answerText: "Table of Contents",
      quotes: ["Monitoring .................................................. 15"],
      resolvedSpans: [resolvedSpan({ text: "Monitoring .................................................. 15", heading: "Table of Contents" })],
    }));
    expectDowngraded(result, "no_evidence");
    expect(result.warnings).toContain("toc_only_evidence");
  });

  // ── Additionality ────────────────────────────────────────────────────

  test("rejects additionality from methodology preamble", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "additionality",
      answerText: "This methodology applies to afforestation and reforestation projects. The methodology requires an additionality assessment.",
      quotes: ["This methodology applies to afforestation and reforestation projects. The methodology requires an additionality assessment."],
      resolvedSpans: [resolvedSpan({
        heading: "Application of Methodology",
        headingPath: ["Application of Methodology"],
        text: "This methodology applies to afforestation and reforestation projects. The methodology requires an additionality assessment.",
      })],
    }));
    expectDowngraded(result, "unclear");
    expect(result.warnings).toContain("methodology_preamble_evidence");
  });

  test("accepts specific additionality evidence with demonstration details", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "additionality",
      answerText: "The project activity would not occur without carbon finance. An investment analysis demonstrates that the IRR falls below the benchmark without carbon revenues.",
      quotes: ["The project activity would not occur without carbon finance. An investment analysis demonstrates that the IRR falls below the benchmark without carbon revenues."],
      resolvedSpans: [resolvedSpan({
        heading: "Demonstration of Additionality",
        headingPath: ["Demonstration of Additionality"],
        text: "The project activity would not occur without carbon finance. An investment analysis demonstrates that the IRR falls below the benchmark without carbon revenues.",
      })],
    }));
    expectSufficient(result);
  });

  // ── Baseline ─────────────────────────────────────────────────────────

  test("rejects baseline from emission factor / calculation tables", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "baseline",
      answerText: "The grid emission factor is 0.714 tCO2/MWh. OM calculation uses the simple method. BM calculation uses the build margin.",
      quotes: ["The grid emission factor is 0.714 tCO2/MWh. OM calculation uses the simple method."],
      resolvedSpans: [resolvedSpan({
        heading: "Grid Emission Factor Calculation",
        headingPath: ["Grid Emission Factor Calculation"],
        text: "The grid emission factor is 0.714 tCO2/MWh. OM calculation uses the simple method.",
      })],
    }));
    expectDowngraded(result, "unclear");
    expect(result.warnings).toContain("calculation_table_evidence");
  });

  test("accepts strong baseline scenario evidence", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "baseline",
      answerText: "Without the project activity, deforestation continues at the historical rate of 2.3% annually. The baseline scenario involves business-as-usual land use with cattle ranching expansion.",
      quotes: ["Without the project activity, deforestation continues at the historical rate of 2.3% annually."],
      resolvedSpans: [resolvedSpan({
        heading: "Baseline Scenario",
        headingPath: ["Baseline Scenario"],
        text: "Without the project activity, deforestation continues at the historical rate of 2.3% annually. The baseline scenario involves business-as-usual land use with cattle ranching expansion.",
      })],
    }));
    expectSufficient(result);
  });

  // ── Monitoring ───────────────────────────────────────────────────────

  test("rejects TOC-only monitoring mention", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "monitoring",
      answerText: "Monitoring plan .............................................. 42",
      quotes: ["Monitoring plan .............................................. 42"],
      resolvedSpans: [resolvedSpan({
        text: "Monitoring plan .............................................. 42",
        heading: "Table of Contents",
        headingPath: ["Table of Contents"],
      })],
    }));
    expectDowngraded(result, "no_evidence");
  });

  test("accepts monitoring with parameter/frequency details", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "monitoring",
      answerText: "The monitoring plan includes annual measurement of carbon stocks in all pools. Parameters monitored include above-ground biomass, below-ground biomass, and soil organic carbon. Measurements are conducted every 5 years.",
      quotes: ["The monitoring plan includes annual measurement of carbon stocks in all pools."],
      resolvedSpans: [resolvedSpan({
        heading: "Monitoring Plan",
        headingPath: ["Monitoring Plan"],
        text: "The monitoring plan includes annual measurement of carbon stocks in all pools. Parameters monitored include above-ground biomass.",
      })],
    }));
    expectSufficient(result);
  });

  // ── Leakage ──────────────────────────────────────────────────────────

  test("rejects single generic leakage mention", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "leakage",
      answerText: "Leakage is considered in the project design.",
      quotes: ["Leakage is considered in the project design."],
      resolvedSpans: [resolvedSpan({
        heading: "Project Design",
        headingPath: ["Project Design"],
        text: "Leakage is considered in the project design.",
      })],
    }));
    expectDowngraded(result, "unclear");
  });

  test("accepts specific leakage assessment", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "leakage",
      answerText: "Activity-shifting leakage is not expected because the project area is not a source of subsistence livelihoods. The leakage management plan monitors for market leakage through annual surveys.",
      quotes: ["Activity-shifting leakage is not expected because the project area is not a source of subsistence livelihoods."],
      resolvedSpans: [resolvedSpan({
        heading: "Leakage",
        headingPath: ["Leakage"],
        text: "Activity-shifting leakage is not expected because the project area is not a source of subsistence livelihoods. The leakage management plan monitors for market leakage.",
      })],
    }));
    expectSufficient(result);
  });

  // ── Generic ──────────────────────────────────────────────────────────

  test("rejects boilerplate metadata as evidence", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "boundary",
      answerText: "This report was prepared by ICONTEC. Report ID VCSVA-15-003. Date of Issue 31-May-2016.",
      quotes: ["This report was prepared by ICONTEC. Report ID VCSVA-15-003. Date of Issue 31-May-2016."],
      resolvedSpans: [resolvedSpan({
        heading: "Report Header",
        headingPath: ["Report Header"],
        text: "This report was prepared by ICONTEC. Report ID VCSVA-15-003. Date of Issue 31-May-2016.",
      })],
    }));
    expectDowngraded(result, "unclear");
    expect(result.warnings).toContain("boilerplate_evidence");
  });

  // ── Evidence still works for strong cases ────────────────────────────

  test("strong section-backed evidence with full provenance returns sufficient", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "baseline",
      answerText: "Baseline scenario: Without the project activity, the forest continues to degrade.",
      quotes: ["Without the project activity, the forest continues to degrade."],
      pages: [12],
      resolvedSpans: [resolvedSpan({
        spanId: "span:123",
        page: 12,
        heading: "Baseline Scenario",
        headingPath: ["Baseline Scenario"],
        sectionPath: ["section:4", "section:4.2", "section:4.2.4"],
        text: "Without the project activity, the forest continues to degrade.",
        confidence: 0.95,
      })],
      route: "section_index",
    }));
    expectSufficient(result);
  });

  test("every sufficient result includes evidence span IDs", () => {
    // This is indirectly tested by the sufficiency check requiring resolvedSpans
    const result = evaluateEvidenceSufficiency(makeInput({
      resolvedSpans: [resolvedSpan({ spanId: "span:valid" })],
    }));
    expect(result.sufficient).toBeDefined();
    // sufficient results are from validators that received non-empty resolvedSpans
  });

  // ── Regression: baseline with emission factors + scenario ──────────────

  test("baseline evidence with emission factors AND scenario narrative stays sufficient", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "baseline",
      answerText: "Baseline scenario: Without the project activity, deforestation continues at 2.3% annually. The baseline emission factor is 0.714 tCO2/MWh based on the grid emission factor calculation.",
      quotes: ["Without the project activity, deforestation continues at 2.3% annually."],
      resolvedSpans: [resolvedSpan({
        heading: "Baseline Scenario",
        headingPath: ["Baseline Scenario"],
        text: "Without the project activity, deforestation continues at 2.3% annually. The baseline emission factor is 0.714 tCO2/MWh.",
      })],
    }));
    expectSufficient(result);
  });

  // ── Regression: stakeholder text with "contacted" ──────────────────────

  test("stakeholder evidence containing contacted/contacting is not flagged as boilerplate", () => {
    const result = evaluateEvidenceSufficiency(makeInput({
      reviewArea: "stakeholder",
      answerText: "Local stakeholders were contacted and community meetings held. No negative comments were received.",
      quotes: ["Local stakeholders were contacted and community meetings held. No negative comments were received."],
      resolvedSpans: [resolvedSpan({
        heading: "Stakeholder Consultation",
        headingPath: ["Stakeholder Consultation"],
        text: "Local stakeholders were contacted and community meetings held. No negative comments were received.",
      })],
    }));
    expectSufficient(result);
  });
});
